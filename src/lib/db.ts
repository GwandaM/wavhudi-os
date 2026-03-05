// Storage-backed database layer.
// Browser mode uses localStorage.
// Electron mode can inject bridge objects on window to route calls to SQLite.

export interface DailyNote {
  date: string; // yyyy-MM-dd
  content: string;
}

export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface Subtask {
  id: number;
  title: string;
  completed: boolean;
  order_index: number;
}

export interface Project {
  id: number;
  name: string;
  color: string;
  icon?: string;
  description?: string;
  is_archived: boolean;
  order_index: number;
  created_at: string;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly';
  end_date?: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  daily_notes: DailyNote[];
  status: 'backlog' | 'scheduled' | 'completed';
  start_date: string | null;
  end_date: string | null;
  order_index: number;
  created_at: string;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  priority: Priority;
  project_id: number | null;
  is_pinned: boolean;
  subtasks: Subtask[];
  tags: string[];
  recurrence_rule: RecurrenceRule | null;
  recurrence_parent_id: number | null;
}

export interface DailyJournal {
  id: number;
  date: string; // yyyy-MM-dd
  intention: string; // Morning intention
  reflection: string; // Evening reflection
  planning_completed: boolean;
  shutdown_completed: boolean;
  created_at: string;
}

export interface UserSettings {
  daily_capacity_minutes: number; // Default available work minutes per day
  planning_ritual_enabled: boolean;
  shutdown_ritual_enabled: boolean;
  default_view: 'myday' | 'week' | 'month';
}

export interface PlannerDbBridge {
  getAll(): Promise<Task[]>;
  get(id: number): Promise<Task | undefined>;
  add(task: Omit<Task, 'id'>): Promise<number>;
  update(id: number, changes: Partial<Task>): Promise<void>;
  delete(id: number): Promise<void>;
  count(): Promise<number>;
}

export interface PlannerJournalBridge {
  getAll(): Promise<DailyJournal[]>;
  getByDate(date: string): Promise<DailyJournal | undefined>;
  upsert(
    date: string,
    changes: Partial<Omit<DailyJournal, 'id' | 'date' | 'created_at'>>
  ): Promise<DailyJournal>;
}

export interface PlannerSettingsBridge {
  get(): Promise<UserSettings>;
  update(changes: Partial<UserSettings>): Promise<UserSettings>;
}

export interface PlannerProjectBridge {
  getAll(): Promise<Project[]>;
  get(id: number): Promise<Project | undefined>;
  add(project: Omit<Project, 'id' | 'created_at'>): Promise<number>;
  update(id: number, changes: Partial<Project>): Promise<void>;
  delete(id: number): Promise<void>;
}

const STORAGE_KEY = 'daily_planner_tasks';
const JOURNAL_STORAGE_KEY = 'daily_planner_journals';
const SETTINGS_STORAGE_KEY = 'daily_planner_settings';
const PROJECTS_STORAGE_KEY = 'daily_planner_projects';
let nextId = 1;
let nextJournalId = 1;
let nextProjectId = 1;

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadTasksFromStorage(): Task[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const tasks: Task[] = JSON.parse(raw);
      if (tasks.length > 0) {
        nextId = Math.max(...tasks.map(t => t.id)) + 1;
      }
      return tasks;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveTasksToStorage(tasks: Task[]): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

const localStorageTaskDb: PlannerDbBridge = {
  async getAll(): Promise<Task[]> {
    return loadTasksFromStorage();
  },

  async get(id: number): Promise<Task | undefined> {
    return loadTasksFromStorage().find(t => t.id === id);
  },

  async add(task: Omit<Task, 'id'>): Promise<number> {
    const tasks = loadTasksFromStorage();
    const id = nextId++;
    tasks.push({ ...task, id });
    saveTasksToStorage(tasks);
    return id;
  },

  async update(id: number, changes: Partial<Task>): Promise<void> {
    const tasks = loadTasksFromStorage();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...changes };
      saveTasksToStorage(tasks);
    }
  },

  async delete(id: number): Promise<void> {
    const tasks = loadTasksFromStorage().filter(t => t.id !== id);
    saveTasksToStorage(tasks);
  },

  async count(): Promise<number> {
    return loadTasksFromStorage().length;
  },
};

function getTaskDb(): PlannerDbBridge {
  if (typeof window !== 'undefined' && window.wavhudiDb) {
    return window.wavhudiDb;
  }
  return localStorageTaskDb;
}

export const db: PlannerDbBridge = {
  async getAll() {
    return getTaskDb().getAll();
  },
  async get(id: number) {
    return getTaskDb().get(id);
  },
  async add(task: Omit<Task, 'id'>) {
    return getTaskDb().add(task);
  },
  async update(id: number, changes: Partial<Task>) {
    return getTaskDb().update(id, changes);
  },
  async delete(id: number) {
    return getTaskDb().delete(id);
  },
  async count() {
    return getTaskDb().count();
  },
};

// --- Journal Storage ---
function loadJournalsFromStorage(): DailyJournal[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(JOURNAL_STORAGE_KEY);
    if (raw) {
      const journals: DailyJournal[] = JSON.parse(raw);
      if (journals.length > 0) {
        nextJournalId = Math.max(...journals.map(j => j.id)) + 1;
      }
      return journals;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveJournalsToStorage(journals: DailyJournal[]): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journals));
}

const localStorageJournalDb: PlannerJournalBridge = {
  async getAll(): Promise<DailyJournal[]> {
    return loadJournalsFromStorage();
  },

  async getByDate(date: string): Promise<DailyJournal | undefined> {
    return loadJournalsFromStorage().find(j => j.date === date);
  },

  async upsert(date: string, changes: Partial<Omit<DailyJournal, 'id' | 'date' | 'created_at'>>): Promise<DailyJournal> {
    const journals = loadJournalsFromStorage();
    const idx = journals.findIndex(j => j.date === date);
    if (idx !== -1) {
      journals[idx] = { ...journals[idx], ...changes };
      saveJournalsToStorage(journals);
      return journals[idx];
    }
    const newJournal: DailyJournal = {
      id: nextJournalId++,
      date,
      intention: '',
      reflection: '',
      planning_completed: false,
      shutdown_completed: false,
      created_at: new Date().toISOString(),
      ...changes,
    };
    journals.push(newJournal);
    saveJournalsToStorage(journals);
    return newJournal;
  },
};

function getJournalDb(): PlannerJournalBridge {
  if (typeof window !== 'undefined' && window.wavhudiJournalDb) {
    return window.wavhudiJournalDb;
  }
  return localStorageJournalDb;
}

export const journalDb: PlannerJournalBridge = {
  async getAll() {
    return getJournalDb().getAll();
  },
  async getByDate(date: string) {
    return getJournalDb().getByDate(date);
  },
  async upsert(date: string, changes: Partial<Omit<DailyJournal, 'id' | 'date' | 'created_at'>>) {
    return getJournalDb().upsert(date, changes);
  },
};

// --- Settings Storage ---
const DEFAULT_SETTINGS: UserSettings = {
  daily_capacity_minutes: 480, // 8 hours
  planning_ritual_enabled: true,
  shutdown_ritual_enabled: true,
  default_view: 'myday',
};

const localStorageSettingsDb: PlannerSettingsBridge = {
  async get(): Promise<UserSettings> {
    const storage = getStorage();
    if (!storage) return DEFAULT_SETTINGS;
    try {
      const raw = storage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  },

  async update(changes: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.get();
    const updated = { ...current, ...changes };
    const storage = getStorage();
    if (storage) {
      storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  },
};

function getSettingsDb(): PlannerSettingsBridge {
  if (typeof window !== 'undefined' && window.wavhudiSettingsDb) {
    return window.wavhudiSettingsDb;
  }
  return localStorageSettingsDb;
}

export const settingsDb: PlannerSettingsBridge = {
  async get() {
    return getSettingsDb().get();
  },
  async update(changes: Partial<UserSettings>) {
    return getSettingsDb().update(changes);
  },
};

// --- Projects Storage ---
function loadProjectsFromStorage(): Project[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      const projects: Project[] = JSON.parse(raw);
      if (projects.length > 0) {
        nextProjectId = Math.max(...projects.map(p => p.id)) + 1;
      }
      return projects;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveProjectsToStorage(projects: Project[]): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

const localStorageProjectDb: PlannerProjectBridge = {
  async getAll(): Promise<Project[]> {
    return loadProjectsFromStorage().sort((a, b) => a.order_index - b.order_index);
  },

  async get(id: number): Promise<Project | undefined> {
    return loadProjectsFromStorage().find(p => p.id === id);
  },

  async add(project: Omit<Project, 'id' | 'created_at'>): Promise<number> {
    const projects = loadProjectsFromStorage();
    const id = nextProjectId++;
    projects.push({ ...project, id, created_at: new Date().toISOString() });
    saveProjectsToStorage(projects);
    return id;
  },

  async update(id: number, changes: Partial<Project>): Promise<void> {
    const projects = loadProjectsFromStorage();
    const idx = projects.findIndex(p => p.id === id);
    if (idx !== -1) {
      projects[idx] = { ...projects[idx], ...changes };
      saveProjectsToStorage(projects);
    }
  },

  async delete(id: number): Promise<void> {
    const projects = loadProjectsFromStorage().filter(p => p.id !== id);
    saveProjectsToStorage(projects);
  },
};

function getProjectDb(): PlannerProjectBridge {
  if (typeof window !== 'undefined' && window.wavhudiProjectDb) {
    return window.wavhudiProjectDb;
  }
  return localStorageProjectDb;
}

export const projectDb: PlannerProjectBridge = {
  async getAll() {
    return getProjectDb().getAll();
  },
  async get(id: number) {
    return getProjectDb().get(id);
  },
  async add(project: Omit<Project, 'id' | 'created_at'>) {
    return getProjectDb().add(project);
  },
  async update(id: number, changes: Partial<Project>) {
    return getProjectDb().update(id, changes);
  },
  async delete(id: number) {
    return getProjectDb().delete(id);
  },
};
