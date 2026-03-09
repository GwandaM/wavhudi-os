// TODO: Swap IndexedDB wrapper with better-sqlite3 IPC calls for native Electron build.

import { db, journalDb, settingsDb, projectDb, notesDb, type Task, type DailyJournal, type UserSettings, type Project, type Note } from '@/lib/db';

export const DatabaseService = {
  async getAllTasks(): Promise<Task[]> {
    const all = await db.getAll();
    return all.sort((a, b) => a.order_index - b.order_index);
  },

  async getTasksByDate(date: string): Promise<Task[]> {
    const all = await db.getAll();
    return all
      .filter((t) => {
        if (t.status === 'backlog') return false;
        if (!t.start_date) return false;
        if (t.end_date) return date >= t.start_date && date <= t.end_date;
        return t.start_date === date;
      })
      .sort((a, b) => a.order_index - b.order_index);
  },

  async getBacklogTasks(): Promise<Task[]> {
    const all = await db.getAll();
    return all.filter((t) => t.status === 'backlog').sort((a, b) => a.order_index - b.order_index);
  },

  async getTaskById(id: number): Promise<Task | undefined> {
    return db.get(id);
  },

  async createTask(task: Omit<Task, 'id' | 'created_at'>): Promise<number> {
    return db.add({
      ...task,
      created_at: new Date().toISOString(),
    });
  },

  async updateTask(id: number, changes: Partial<Task>): Promise<void> {
    await db.update(id, changes);
  },

  async deleteTask(id: number): Promise<void> {
    await db.delete(id);
  },

  async moveTaskToDate(id: number, date: string): Promise<void> {
    await db.update(id, {
      start_date: date,
      end_date: null,
      status: 'scheduled',
    });
  },

  async moveTaskToBacklog(id: number): Promise<void> {
    await db.update(id, {
      start_date: null,
      end_date: null,
      status: 'backlog',
    });
  },

  async reorderTask(id: number, newIndex: number): Promise<void> {
    await db.update(id, { order_index: newIndex });
  },

  async completeTask(id: number): Promise<void> {
    await db.update(id, { status: 'completed' });
  },

  // --- Rollover & Capacity ---
  async getIncompleteTasksBefore(date: string): Promise<Task[]> {
    const all = await db.getAll();
    return all.filter((t) => {
      if (t.status !== 'scheduled') return false;
      if (!t.start_date) return false;
      // Task's effective date is before the given date
      const effectiveEnd = t.end_date || t.start_date;
      return effectiveEnd < date;
    }).sort((a, b) => a.order_index - b.order_index);
  },

  async getPlannedMinutesForDate(date: string): Promise<number> {
    const tasks = await this.getTasksByDate(date);
    return tasks
      .filter(t => t.status !== 'completed')
      .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  },

  // --- Journal CRUD ---
  async getJournal(date: string): Promise<DailyJournal | undefined> {
    return journalDb.getByDate(date);
  },

  async upsertJournal(date: string, changes: Partial<Omit<DailyJournal, 'id' | 'date' | 'created_at'>>): Promise<DailyJournal> {
    return journalDb.upsert(date, changes);
  },

  // --- Settings CRUD ---
  async getSettings(): Promise<UserSettings> {
    return settingsDb.get();
  },

  async updateSettings(changes: Partial<UserSettings>): Promise<UserSettings> {
    return settingsDb.update(changes);
  },

  // --- Project CRUD ---
  async getAllProjects(): Promise<Project[]> {
    return projectDb.getAll();
  },

  async getAllNotes(): Promise<Note[]> {
    return notesDb.getAll();
  },

  async getNoteById(id: number): Promise<Note | undefined> {
    return notesDb.get(id);
  },

  async createNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    return notesDb.add(note);
  },

  async updateNote(id: number, changes: Partial<Omit<Note, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    await notesDb.update(id, changes);
  },

  async deleteNote(id: number): Promise<void> {
    await notesDb.delete(id);
  },

  async createProject(project: Omit<Project, 'id' | 'created_at'>): Promise<number> {
    return projectDb.add(project);
  },

  async updateProject(id: number, changes: Partial<Project>): Promise<void> {
    return projectDb.update(id, changes);
  },

  async deleteProject(id: number): Promise<void> {
    // Unlink tasks from this project
    const allTasks = await db.getAll();
    for (const task of allTasks) {
      if (task.project_id === id) {
        await db.update(task.id, { project_id: null });
      }
    }
    return projectDb.delete(id);
  },

  async getTasksByProject(projectId: number): Promise<Task[]> {
    const all = await db.getAll();
    return all.filter(t => t.project_id === projectId).sort((a, b) => a.order_index - b.order_index);
  },

  // --- Analytics ---
  async getTasksInDateRange(startDate: string, endDate: string): Promise<Task[]> {
    const all = await db.getAll();
    return all.filter(t => {
      if (!t.start_date) return false;
      return t.start_date >= startDate && t.start_date <= endDate;
    });
  },

  // --- Recurrence ---
  async generateRecurringTasks(forDate: string): Promise<number> {
    const all = await db.getAll();
    let created = 0;

    // Find parent tasks that have a recurrence rule
    const recurringParents = all.filter(t => t.recurrence_rule && !t.recurrence_parent_id);

    for (const parent of recurringParents) {
      const rule = parent.recurrence_rule!;

      // Check if end_date has passed
      if (rule.end_date && forDate > rule.end_date) continue;

      // Check if this frequency applies to forDate
      if (!this._shouldRecurOnDate(rule.frequency, forDate)) continue;

      // Check if an instance already exists for this parent on this date
      const existingInstance = all.find(
        t => t.recurrence_parent_id === parent.id && t.start_date === forDate
      );
      if (existingInstance) continue;

      // Create the recurring instance
      const tasksOnDate = all.filter(t => t.start_date === forDate && t.status !== 'backlog');
      await db.add({
        title: parent.title,
        description: parent.description,
        daily_notes: [],
        status: 'scheduled',
        start_date: forDate,
        end_date: null,
        order_index: tasksOnDate.length,
        created_at: new Date().toISOString(),
        estimated_minutes: parent.estimated_minutes,
        actual_minutes: null,
        priority: parent.priority,
        project_id: parent.project_id,
        is_pinned: false,
        subtasks: [],
        tags: [...parent.tags],
        recurrence_rule: null,
        recurrence_parent_id: parent.id,
      });
      created++;
    }

    return created;
  },

  _shouldRecurOnDate(frequency: string, dateStr: string): boolean {
    const date = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

    switch (frequency) {
      case 'daily':
        return true;
      case 'weekdays':
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      case 'weekly': {
        // We can't fully determine weekly without a start reference,
        // so for simplicity, always generate and let dedup handle it
        return true;
      }
      case 'biweekly': {
        // Use week number parity
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
        return weekNum % 2 === 0;
      }
      case 'monthly': {
        // Same day of month as today — for simplicity, generate on 1st call each day
        return true;
      }
      default:
        return false;
    }
  },

  async seedIfEmpty(): Promise<void> {
    const count = await db.count();
    if (count > 0) return;

    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const addDays = (d: Date, n: number) => {
      const r = new Date(d);
      r.setDate(r.getDate() + n);
      return r;
    };

    const base = { daily_notes: [], estimated_minutes: null as number | null, actual_minutes: null, project_id: null, is_pinned: false, subtasks: [], tags: [] as string[], recurrence_rule: null, recurrence_parent_id: null };
    const tasks: Omit<Task, 'id' | 'created_at'>[] = [
      { ...base, title: 'Review Q1 metrics dashboard', description: '', status: 'scheduled', start_date: fmt(addDays(today, -1)), end_date: null, order_index: 0, estimated_minutes: 60, priority: 'high' },
      { ...base, title: 'Prepare sprint retrospective', description: '', status: 'scheduled', start_date: fmt(today), end_date: null, order_index: 0, estimated_minutes: 30, priority: 'urgent' },
      { ...base, title: 'Write API documentation', description: '', status: 'scheduled', start_date: fmt(today), end_date: null, order_index: 1, estimated_minutes: 120, priority: 'medium' },
      { ...base, title: 'Fix auth token refresh bug', description: 'Token expires prematurely on mobile clients', status: 'scheduled', start_date: fmt(today), end_date: null, order_index: 2, estimated_minutes: 90, priority: 'high' },
      { ...base, title: 'Design system audit', description: '', status: 'scheduled', start_date: fmt(addDays(today, 1)), end_date: null, order_index: 0, estimated_minutes: 240, priority: 'medium' },
      { ...base, title: 'Multi-day migration project', description: 'Database migration spanning multiple days', status: 'scheduled', start_date: fmt(today), end_date: fmt(addDays(today, 2)), order_index: 3, estimated_minutes: 480, priority: 'high' },
      { ...base, title: 'Update onboarding flow', description: '', status: 'backlog', start_date: null, end_date: null, order_index: 0, estimated_minutes: 180, priority: 'low' },
      { ...base, title: 'Refactor notification service', description: '', status: 'backlog', start_date: null, end_date: null, order_index: 1, estimated_minutes: 120, priority: 'medium' },
      { ...base, title: 'Add export to CSV feature', description: '', status: 'backlog', start_date: null, end_date: null, order_index: 2, estimated_minutes: 60, priority: 'none' },
    ];

    for (const t of tasks) {
      await DatabaseService.createTask(t);
    }
  },
};
