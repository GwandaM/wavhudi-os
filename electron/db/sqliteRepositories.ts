import Database from 'better-sqlite3';
import type {
  DailyJournal,
  PlannerDbBridge,
  PlannerJournalBridge,
  PlannerSettingsBridge,
  Task,
  UserSettings,
} from '../../src/lib/db';
import { runMigrations } from './migrate';

interface TaskRow {
  id: number;
  title: string;
  description: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  order_index: number;
  created_at: string;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  priority: Task['priority'];
}

interface DailyNoteRow {
  task_id: number;
  note_date: string;
  content: string;
}

interface JournalRow {
  id: number;
  journal_date: string;
  intention: string;
  reflection: string;
  planning_completed: number;
  shutdown_completed: number;
  created_at: string;
}

interface SettingRow {
  key: string;
  value: string;
}

export interface SqliteRepositoryOptions {
  dbFilePath: string;
  migrationsDir: string;
  autoMigrate?: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  daily_capacity_minutes: 480,
  planning_ritual_enabled: true,
  shutdown_ritual_enabled: true,
  default_view: 'myday',
};

function coerceTaskStatus(status: string): Task['status'] {
  if (status === 'backlog' || status === 'scheduled' || status === 'completed') {
    return status;
  }
  return 'backlog';
}

function toTask(row: TaskRow, dailyNotes: Array<{ date: string; content: string }>): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    daily_notes: dailyNotes,
    status: coerceTaskStatus(row.status),
    start_date: row.start_date,
    end_date: row.end_date,
    order_index: row.order_index,
    created_at: row.created_at,
    estimated_minutes: row.estimated_minutes,
    actual_minutes: row.actual_minutes,
    priority: row.priority,
  };
}

function toDailyJournal(row: JournalRow): DailyJournal {
  return {
    id: row.id,
    date: row.journal_date,
    intention: row.intention,
    reflection: row.reflection,
    planning_completed: row.planning_completed === 1,
    shutdown_completed: row.shutdown_completed === 1,
    created_at: row.created_at,
  };
}

export class SqliteTaskRepository implements PlannerDbBridge {
  constructor(private readonly connection: Database.Database) {}

  async getAll(): Promise<Task[]> {
    const taskRows = this.connection
      .prepare(
        `
        SELECT
          id, title, description, status, start_date, end_date,
          order_index, created_at, estimated_minutes, actual_minutes, priority
        FROM tasks
        ORDER BY order_index ASC, id ASC
        `
      )
      .all() as TaskRow[];

    const noteRows = this.connection
      .prepare(
        `
        SELECT task_id, note_date, content
        FROM task_daily_notes
        ORDER BY note_date ASC, id ASC
        `
      )
      .all() as DailyNoteRow[];

    const noteMap = new Map<number, Array<{ date: string; content: string }>>();
    for (const note of noteRows) {
      const bucket = noteMap.get(note.task_id);
      if (bucket) {
        bucket.push({ date: note.note_date, content: note.content });
      } else {
        noteMap.set(note.task_id, [{ date: note.note_date, content: note.content }]);
      }
    }

    return taskRows.map((row) => toTask(row, noteMap.get(row.id) ?? []));
  }

  async get(id: number): Promise<Task | undefined> {
    const row = this.connection
      .prepare(
        `
        SELECT
          id, title, description, status, start_date, end_date,
          order_index, created_at, estimated_minutes, actual_minutes, priority
        FROM tasks
        WHERE id = ?
        `
      )
      .get(id) as TaskRow | undefined;

    if (!row) return undefined;

    const notes = this.connection
      .prepare(
        `
        SELECT note_date, content
        FROM task_daily_notes
        WHERE task_id = ?
        ORDER BY note_date ASC, id ASC
        `
      )
      .all(id) as Array<{ note_date: string; content: string }>;

    return toTask(
      row,
      notes.map((note) => ({ date: note.note_date, content: note.content }))
    );
  }

  async add(task: Omit<Task, 'id'>): Promise<number> {
    const insertTask = this.connection.prepare(
      `
      INSERT INTO tasks (
        title, description, status, start_date, end_date, order_index,
        created_at, updated_at, estimated_minutes, actual_minutes, priority
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );

    const insertNote = this.connection.prepare(
      `
      INSERT INTO task_daily_notes (task_id, note_date, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      `
    );

    const now = new Date().toISOString();
    const tx = this.connection.transaction((input: Omit<Task, 'id'>) => {
      const result = insertTask.run(
        input.title,
        input.description,
        input.status,
        input.start_date,
        input.end_date,
        input.order_index,
        input.created_at,
        now,
        input.estimated_minutes,
        input.actual_minutes,
        input.priority
      );

      const id = Number(result.lastInsertRowid);
      for (const note of input.daily_notes) {
        insertNote.run(id, note.date, note.content, now, now);
      }
      return id;
    });

    return tx(task);
  }

  async update(id: number, changes: Partial<Task>): Promise<void> {
    const replaceNotes = this.connection.prepare(
      `
      INSERT INTO task_daily_notes (task_id, note_date, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      `
    );

    const tx = this.connection.transaction((taskId: number, patch: Partial<Task>) => {
      const assignments: string[] = [];
      const values: unknown[] = [];

      if (patch.title !== undefined) {
        assignments.push('title = ?');
        values.push(patch.title);
      }
      if (patch.description !== undefined) {
        assignments.push('description = ?');
        values.push(patch.description);
      }
      if (patch.status !== undefined) {
        assignments.push('status = ?');
        values.push(patch.status);
      }
      if (patch.start_date !== undefined) {
        assignments.push('start_date = ?');
        values.push(patch.start_date);
      }
      if (patch.end_date !== undefined) {
        assignments.push('end_date = ?');
        values.push(patch.end_date);
      }
      if (patch.order_index !== undefined) {
        assignments.push('order_index = ?');
        values.push(patch.order_index);
      }
      if (patch.estimated_minutes !== undefined) {
        assignments.push('estimated_minutes = ?');
        values.push(patch.estimated_minutes);
      }
      if (patch.actual_minutes !== undefined) {
        assignments.push('actual_minutes = ?');
        values.push(patch.actual_minutes);
      }
      if (patch.priority !== undefined) {
        assignments.push('priority = ?');
        values.push(patch.priority);
      }

      const now = new Date().toISOString();
      if (assignments.length > 0 || patch.daily_notes !== undefined) {
        assignments.push('updated_at = ?');
        values.push(now);
        values.push(taskId);
        this.connection
          .prepare(`UPDATE tasks SET ${assignments.join(', ')} WHERE id = ?`)
          .run(...values);
      }

      if (patch.daily_notes !== undefined) {
        this.connection
          .prepare('DELETE FROM task_daily_notes WHERE task_id = ?')
          .run(taskId);
        for (const note of patch.daily_notes) {
          replaceNotes.run(taskId, note.date, note.content, now, now);
        }
      }
    });

    tx(id, changes);
  }

  async delete(id: number): Promise<void> {
    this.connection.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  }

  async count(): Promise<number> {
    const result = this.connection
      .prepare('SELECT COUNT(*) as total FROM tasks')
      .get() as { total: number };
    return result.total;
  }
}

export class SqliteJournalRepository implements PlannerJournalBridge {
  constructor(private readonly connection: Database.Database) {}

  async getAll(): Promise<DailyJournal[]> {
    const rows = this.connection
      .prepare(
        `
        SELECT
          id, journal_date, intention, reflection,
          planning_completed, shutdown_completed, created_at
        FROM daily_journals
        ORDER BY journal_date DESC
        `
      )
      .all() as JournalRow[];

    return rows.map((row) => toDailyJournal(row));
  }

  async getByDate(date: string): Promise<DailyJournal | undefined> {
    const row = this.connection
      .prepare(
        `
        SELECT
          id, journal_date, intention, reflection,
          planning_completed, shutdown_completed, created_at
        FROM daily_journals
        WHERE journal_date = ?
        `
      )
      .get(date) as JournalRow | undefined;

    return row ? toDailyJournal(row) : undefined;
  }

  async upsert(
    date: string,
    changes: Partial<Omit<DailyJournal, 'id' | 'date' | 'created_at'>>
  ): Promise<DailyJournal> {
    const existing = await this.getByDate(date);
    const now = new Date().toISOString();

    if (existing) {
      const next = {
        intention: changes.intention ?? existing.intention,
        reflection: changes.reflection ?? existing.reflection,
        planning_completed: changes.planning_completed ?? existing.planning_completed,
        shutdown_completed: changes.shutdown_completed ?? existing.shutdown_completed,
      };

      this.connection
        .prepare(
          `
          UPDATE daily_journals
          SET
            intention = ?,
            reflection = ?,
            planning_completed = ?,
            shutdown_completed = ?,
            updated_at = ?
          WHERE journal_date = ?
          `
        )
        .run(
          next.intention,
          next.reflection,
          next.planning_completed ? 1 : 0,
          next.shutdown_completed ? 1 : 0,
          now,
          date
        );

      return (await this.getByDate(date)) as DailyJournal;
    }

    const inserted = this.connection
      .prepare(
        `
        INSERT INTO daily_journals (
          journal_date, intention, reflection,
          planning_completed, shutdown_completed, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        date,
        changes.intention ?? '',
        changes.reflection ?? '',
        changes.planning_completed ? 1 : 0,
        changes.shutdown_completed ? 1 : 0,
        now,
        now
      );

    return {
      id: Number(inserted.lastInsertRowid),
      date,
      intention: changes.intention ?? '',
      reflection: changes.reflection ?? '',
      planning_completed: changes.planning_completed ?? false,
      shutdown_completed: changes.shutdown_completed ?? false,
      created_at: now,
    };
  }
}

export class SqliteSettingsRepository implements PlannerSettingsBridge {
  constructor(private readonly connection: Database.Database) {}

  async get(): Promise<UserSettings> {
    const rows = this.connection
      .prepare(
        `
        SELECT key, value
        FROM app_settings
        WHERE key IN (
          'daily_capacity_minutes',
          'planning_ritual_enabled',
          'shutdown_ritual_enabled',
          'default_view'
        )
        `
      )
      .all() as SettingRow[];

    const map = new Map(rows.map((row) => [row.key, row.value]));
    const parsedDefaultView = map.get('default_view');
    const defaultView =
      parsedDefaultView === 'myday' || parsedDefaultView === 'week' || parsedDefaultView === 'month'
        ? parsedDefaultView
        : DEFAULT_SETTINGS.default_view;

    return {
      daily_capacity_minutes: Number(
        map.get('daily_capacity_minutes') ?? DEFAULT_SETTINGS.daily_capacity_minutes
      ),
      planning_ritual_enabled:
        map.get('planning_ritual_enabled') !== undefined
          ? map.get('planning_ritual_enabled') === 'true'
          : DEFAULT_SETTINGS.planning_ritual_enabled,
      shutdown_ritual_enabled:
        map.get('shutdown_ritual_enabled') !== undefined
          ? map.get('shutdown_ritual_enabled') === 'true'
          : DEFAULT_SETTINGS.shutdown_ritual_enabled,
      default_view: defaultView,
    };
  }

  async update(changes: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.get();
    const updated = { ...current, ...changes };
    const now = new Date().toISOString();

    const upsert = this.connection.prepare(
      `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key)
      DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
      `
    );

    const tx = this.connection.transaction((nextSettings: UserSettings) => {
      upsert.run('daily_capacity_minutes', String(nextSettings.daily_capacity_minutes), now);
      upsert.run('planning_ritual_enabled', String(nextSettings.planning_ritual_enabled), now);
      upsert.run('shutdown_ritual_enabled', String(nextSettings.shutdown_ritual_enabled), now);
      upsert.run('default_view', nextSettings.default_view, now);
    });

    tx(updated);
    return updated;
  }
}

export class SqliteRepositoryBundle {
  readonly tasks: SqliteTaskRepository;
  readonly journal: SqliteJournalRepository;
  readonly settings: SqliteSettingsRepository;
  readonly connection: Database.Database;

  constructor(options: SqliteRepositoryOptions) {
    if (options.autoMigrate !== false) {
      runMigrations({
        dbFilePath: options.dbFilePath,
        migrationsDir: options.migrationsDir,
      });
    }

    this.connection = new Database(options.dbFilePath);
    this.connection.pragma('foreign_keys = ON');
    this.connection.pragma('journal_mode = WAL');

    this.tasks = new SqliteTaskRepository(this.connection);
    this.journal = new SqliteJournalRepository(this.connection);
    this.settings = new SqliteSettingsRepository(this.connection);
  }

  close(): void {
    this.connection.close();
  }
}
