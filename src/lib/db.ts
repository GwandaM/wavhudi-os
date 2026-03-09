// Storage-backed database layer.
// Browser mode keeps data in memory only.
// Electron mode routes calls to the main-process SQLite bridge.

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
  icon?: string | null;
  description?: string | null;
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
  planning_reminder_time: string; // HH:mm — when to nudge if planning not done
  shutdown_reminder_time: string; // HH:mm — when to nudge if shutdown not done
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

const DEFAULT_SETTINGS: UserSettings = {
  daily_capacity_minutes: 480, // 8 hours
  planning_ritual_enabled: true,
  shutdown_ritual_enabled: true,
  default_view: 'myday',
  planning_reminder_time: '09:00',
  shutdown_reminder_time: '17:00',
};

let nextId = 1;
let nextJournalId = 1;
let nextProjectId = 1;

let memoryTasks: Task[] = [];
let memoryJournals: DailyJournal[] = [];
let memoryProjects: Project[] = [];
let memorySettings: UserSettings = { ...DEFAULT_SETTINGS };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getElectronApi() {
  if (typeof window === 'undefined') return undefined;
  return window.electronAPI;
}

const inMemoryTaskDb: PlannerDbBridge = {
  async getAll(): Promise<Task[]> {
    return clone(memoryTasks);
  },

  async get(id: number): Promise<Task | undefined> {
    const task = memoryTasks.find((item) => item.id === id);
    return task ? clone(task) : undefined;
  },

  async add(task: Omit<Task, 'id'>): Promise<number> {
    const id = nextId++;
    memoryTasks = [...memoryTasks, clone({ ...task, id })];
    return id;
  },

  async update(id: number, changes: Partial<Task>): Promise<void> {
    memoryTasks = memoryTasks.map((task) =>
      task.id === id ? clone({ ...task, ...changes }) : task
    );
  },

  async delete(id: number): Promise<void> {
    memoryTasks = memoryTasks.filter((task) => task.id !== id);
  },

  async count(): Promise<number> {
    return memoryTasks.length;
  },
};

function getTaskDb(): PlannerDbBridge {
  if (getElectronApi()?.db) {
    return getElectronApi()!.db;
  }
  return inMemoryTaskDb;
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
const inMemoryJournalDb: PlannerJournalBridge = {
  async getAll(): Promise<DailyJournal[]> {
    return clone(memoryJournals);
  },

  async getByDate(date: string): Promise<DailyJournal | undefined> {
    const journal = memoryJournals.find((item) => item.date === date);
    return journal ? clone(journal) : undefined;
  },

  async upsert(
    date: string,
    changes: Partial<Omit<DailyJournal, 'id' | 'date' | 'created_at'>>
  ): Promise<DailyJournal> {
    const idx = memoryJournals.findIndex((journal) => journal.date === date);
    if (idx !== -1) {
      memoryJournals = memoryJournals.map((journal) =>
        journal.date === date ? clone({ ...journal, ...changes }) : journal
      );
      return clone(memoryJournals[idx]);
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
    memoryJournals = [...memoryJournals, clone(newJournal)];
    return clone(newJournal);
  },
};

function getJournalDb(): PlannerJournalBridge {
  if (getElectronApi()?.journal) {
    return getElectronApi()!.journal;
  }
  return inMemoryJournalDb;
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
const inMemorySettingsDb: PlannerSettingsBridge = {
  async get(): Promise<UserSettings> {
    return clone(memorySettings);
  },

  async update(changes: Partial<UserSettings>): Promise<UserSettings> {
    memorySettings = { ...memorySettings, ...changes };
    return clone(memorySettings);
  },
};

function getSettingsDb(): PlannerSettingsBridge {
  if (getElectronApi()?.settings) {
    return getElectronApi()!.settings;
  }
  return inMemorySettingsDb;
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
const inMemoryProjectDb: PlannerProjectBridge = {
  async getAll(): Promise<Project[]> {
    return clone(memoryProjects).sort((a, b) => a.order_index - b.order_index);
  },

  async get(id: number): Promise<Project | undefined> {
    const project = memoryProjects.find((item) => item.id === id);
    return project ? clone(project) : undefined;
  },

  async add(project: Omit<Project, 'id' | 'created_at'>): Promise<number> {
    const id = nextProjectId++;
    memoryProjects = [
      ...memoryProjects,
      clone({ ...project, id, created_at: new Date().toISOString() }),
    ];
    return id;
  },

  async update(id: number, changes: Partial<Project>): Promise<void> {
    memoryProjects = memoryProjects.map((project) =>
      project.id === id ? clone({ ...project, ...changes }) : project
    );
  },

  async delete(id: number): Promise<void> {
    memoryProjects = memoryProjects.filter((project) => project.id !== id);
  },
};

function getProjectDb(): PlannerProjectBridge {
  if (getElectronApi()?.projects) {
    return getElectronApi()!.projects;
  }
  return inMemoryProjectDb;
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
