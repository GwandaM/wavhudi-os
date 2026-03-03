// TODO: Swap IndexedDB wrapper with better-sqlite3 IPC calls for native Electron build.

import { db, journalDb, settingsDb, type Task, type DailyJournal, type UserSettings } from '@/lib/db';

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

    const tasks: Omit<Task, 'id' | 'created_at'>[] = [
      { title: 'Review Q1 metrics dashboard', description: '', daily_notes: [], status: 'scheduled', start_date: fmt(addDays(today, -1)), end_date: null, order_index: 0, estimated_minutes: 60, actual_minutes: null, priority: 'high' },
      { title: 'Prepare sprint retrospective', description: '', daily_notes: [], status: 'scheduled', start_date: fmt(today), end_date: null, order_index: 0, estimated_minutes: 30, actual_minutes: null, priority: 'urgent' },
      { title: 'Write API documentation', description: '', daily_notes: [], status: 'scheduled', start_date: fmt(today), end_date: null, order_index: 1, estimated_minutes: 120, actual_minutes: null, priority: 'medium' },
      { title: 'Fix auth token refresh bug', description: 'Token expires prematurely on mobile clients', daily_notes: [], status: 'scheduled', start_date: fmt(today), end_date: null, order_index: 2, estimated_minutes: 90, actual_minutes: null, priority: 'high' },
      { title: 'Design system audit', description: '', daily_notes: [], status: 'scheduled', start_date: fmt(addDays(today, 1)), end_date: null, order_index: 0, estimated_minutes: 240, actual_minutes: null, priority: 'medium' },
      { title: 'Multi-day migration project', description: 'Database migration spanning multiple days', daily_notes: [], status: 'scheduled', start_date: fmt(today), end_date: fmt(addDays(today, 2)), order_index: 3, estimated_minutes: 480, actual_minutes: null, priority: 'high' },
      { title: 'Update onboarding flow', description: '', daily_notes: [], status: 'backlog', start_date: null, end_date: null, order_index: 0, estimated_minutes: 180, actual_minutes: null, priority: 'low' },
      { title: 'Refactor notification service', description: '', daily_notes: [], status: 'backlog', start_date: null, end_date: null, order_index: 1, estimated_minutes: 120, actual_minutes: null, priority: 'medium' },
      { title: 'Add export to CSV feature', description: '', daily_notes: [], status: 'backlog', start_date: null, end_date: null, order_index: 2, estimated_minutes: 60, actual_minutes: null, priority: 'none' },
    ];

    for (const t of tasks) {
      await DatabaseService.createTask(t);
    }
  },
};
