import Database from 'better-sqlite3';
import { safeStorage } from 'electron';
import type {
  DailyJournal,
  PlannerDbBridge,
  PlannerJournalBridge,
  PlannerProjectBridge,
  PlannerSettingsBridge,
  Project,
  RecurrenceRule,
  Subtask,
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
  project_id: number | null;
  is_pinned: number;
  recurrence_rule: string | null;
  recurrence_parent_id: number | null;
}

interface DailyNoteRow {
  task_id: number;
  note_date: string;
  content: string;
}

interface SubtaskRow {
  id: number;
  task_id: number;
  title: string;
  completed: number;
  order_index: number;
}

interface TagRow {
  task_id: number;
  tag_name: string;
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

interface ProjectRow {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  is_archived: number;
  order_index: number;
  created_at: string;
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
const ENCRYPTION_PREFIX = '__wavhudi__:enc:v1:';

function canUseSecureStorage(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encryptText(value: string): string {
  if (!value || !canUseSecureStorage() || value.startsWith(ENCRYPTION_PREFIX)) {
    return value;
  }

  return `${ENCRYPTION_PREFIX}${safeStorage
    .encryptString(value)
    .toString('base64')}`;
}

function encryptNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return encryptText(value);
}

function decryptText(value: string): string {
  if (!value || !value.startsWith(ENCRYPTION_PREFIX) || !canUseSecureStorage()) {
    return value;
  }

  try {
    return safeStorage.decryptString(
      Buffer.from(value.slice(ENCRYPTION_PREFIX.length), 'base64')
    );
  } catch {
    return value;
  }
}

function decryptNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return decryptText(value);
}

function isEncrypted(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(ENCRYPTION_PREFIX));
}

function coerceTaskStatus(status: string): Task['status'] {
  if (status === 'backlog' || status === 'scheduled' || status === 'completed') {
    return status;
  }
  return 'backlog';
}

function parseRecurrenceRule(raw: string | null): RecurrenceRule | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RecurrenceRule;
    if (
      parsed &&
      ['daily', 'weekdays', 'weekly', 'biweekly', 'monthly'].includes(
        parsed.frequency
      )
    ) {
      return parsed;
    }
  } catch {
    // ignore malformed data and treat as no recurrence
  }
  return null;
}

function serializeRecurrenceRule(
  rule: RecurrenceRule | null | undefined
): string | null | undefined {
  if (rule === undefined) return undefined;
  if (rule === null) return null;
  return JSON.stringify(rule);
}

function normalizeTags(tags: string[]): string[] {
  const unique = new Set<string>();
  for (const tag of tags) {
    const normalized = tag.trim();
    if (!normalized) continue;
    unique.add(normalized);
  }
  return [...unique];
}

function toSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    title: decryptText(row.title),
    completed: row.completed === 1,
    order_index: row.order_index,
  };
}

function toTask(
  row: TaskRow,
  dailyNotes: Array<{ date: string; content: string }>,
  subtasks: Subtask[],
  tags: string[]
): Task {
  return {
    id: row.id,
    title: decryptText(row.title),
    description: decryptText(row.description),
    daily_notes: dailyNotes,
    status: coerceTaskStatus(row.status),
    start_date: row.start_date,
    end_date: row.end_date,
    order_index: row.order_index,
    created_at: row.created_at,
    estimated_minutes: row.estimated_minutes,
    actual_minutes: row.actual_minutes,
    priority: row.priority,
    project_id: row.project_id,
    is_pinned: row.is_pinned === 1,
    subtasks,
    tags,
    recurrence_rule: parseRecurrenceRule(row.recurrence_rule),
    recurrence_parent_id: row.recurrence_parent_id,
  };
}

function toDailyJournal(row: JournalRow): DailyJournal {
  return {
    id: row.id,
    date: row.journal_date,
    intention: decryptText(row.intention),
    reflection: decryptText(row.reflection),
    planning_completed: row.planning_completed === 1,
    shutdown_completed: row.shutdown_completed === 1,
    created_at: row.created_at,
  };
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon ?? undefined,
    description: decryptNullableText(row.description) ?? undefined,
    is_archived: row.is_archived === 1,
    order_index: row.order_index,
    created_at: row.created_at,
  };
}

export class SqliteTaskRepository implements PlannerDbBridge {
  constructor(private readonly connection: Database.Database) {}

  private readAllDailyNotes(): Map<number, Array<{ date: string; content: string }>> {
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
      const value = { date: note.note_date, content: decryptText(note.content) };
      if (bucket) {
        bucket.push(value);
      } else {
        noteMap.set(note.task_id, [value]);
      }
    }
    return noteMap;
  }

  private readAllSubtasks(): Map<number, Subtask[]> {
    const subtaskRows = this.connection
      .prepare(
        `
        SELECT id, task_id, title, completed, order_index
        FROM subtasks
        ORDER BY task_id ASC, order_index ASC, id ASC
        `
      )
      .all() as SubtaskRow[];

    const subtaskMap = new Map<number, Subtask[]>();
    for (const row of subtaskRows) {
      const bucket = subtaskMap.get(row.task_id);
      const value = toSubtask(row);
      if (bucket) {
        bucket.push(value);
      } else {
        subtaskMap.set(row.task_id, [value]);
      }
    }
    return subtaskMap;
  }

  private readAllTags(): Map<number, string[]> {
    const tagRows = this.connection
      .prepare(
        `
        SELECT tt.task_id as task_id, tags.name as tag_name
        FROM task_tags tt
        INNER JOIN tags ON tags.id = tt.tag_id
        ORDER BY tt.task_id ASC, tags.name ASC
        `
      )
      .all() as TagRow[];

    const tagMap = new Map<number, string[]>();
    for (const row of tagRows) {
      const bucket = tagMap.get(row.task_id);
      if (bucket) {
        bucket.push(row.tag_name);
      } else {
        tagMap.set(row.task_id, [row.tag_name]);
      }
    }
    return tagMap;
  }

  private replaceDailyNotes(taskId: number, notes: Task['daily_notes'], now: string): void {
    const insertNote = this.connection.prepare(
      `
      INSERT INTO task_daily_notes (task_id, note_date, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      `
    );

    this.connection
      .prepare('DELETE FROM task_daily_notes WHERE task_id = ?')
      .run(taskId);
    for (const note of notes) {
      insertNote.run(taskId, note.date, encryptText(note.content), now, now);
    }
  }

  private replaceSubtasks(taskId: number, subtasks: Subtask[], now: string): void {
    const insertSubtask = this.connection.prepare(
      `
      INSERT INTO subtasks (task_id, title, completed, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    );

    this.connection.prepare('DELETE FROM subtasks WHERE task_id = ?').run(taskId);
    for (let i = 0; i < subtasks.length; i += 1) {
      const subtask = subtasks[i];
      insertSubtask.run(
        taskId,
        encryptText(subtask.title),
        subtask.completed ? 1 : 0,
        subtask.order_index ?? i,
        now,
        now
      );
    }
  }

  private replaceTags(taskId: number, tags: string[], now: string): void {
    const normalized = normalizeTags(tags);
    const upsertTag = this.connection.prepare(
      `
      INSERT INTO tags (name, created_at)
      VALUES (?, ?)
      ON CONFLICT(name) DO NOTHING
      `
    );
    const getTagId = this.connection.prepare(
      `
      SELECT id
      FROM tags
      WHERE name = ?
      `
    );
    const insertTaskTag = this.connection.prepare(
      `
      INSERT INTO task_tags (task_id, tag_id, created_at)
      VALUES (?, ?, ?)
      `
    );

    this.connection.prepare('DELETE FROM task_tags WHERE task_id = ?').run(taskId);
    for (const tagName of normalized) {
      upsertTag.run(tagName, now);
      const tagRow = getTagId.get(tagName) as { id: number } | undefined;
      if (!tagRow) continue;
      insertTaskTag.run(taskId, tagRow.id, now);
    }
  }

  async getAll(): Promise<Task[]> {
    const taskRows = this.connection
      .prepare(
        `
        SELECT
          id, title, description, status, start_date, end_date,
          order_index, created_at, estimated_minutes, actual_minutes,
          priority, project_id, is_pinned, recurrence_rule, recurrence_parent_id
        FROM tasks
        ORDER BY order_index ASC, id ASC
        `
      )
      .all() as TaskRow[];

    const noteMap = this.readAllDailyNotes();
    const subtaskMap = this.readAllSubtasks();
    const tagMap = this.readAllTags();

    return taskRows.map((row) =>
      toTask(
        row,
        noteMap.get(row.id) ?? [],
        subtaskMap.get(row.id) ?? [],
        tagMap.get(row.id) ?? []
      )
    );
  }

  async get(id: number): Promise<Task | undefined> {
    const row = this.connection
      .prepare(
        `
        SELECT
          id, title, description, status, start_date, end_date,
          order_index, created_at, estimated_minutes, actual_minutes,
          priority, project_id, is_pinned, recurrence_rule, recurrence_parent_id
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

    const subtasks = this.connection
      .prepare(
        `
        SELECT id, task_id, title, completed, order_index
        FROM subtasks
        WHERE task_id = ?
        ORDER BY order_index ASC, id ASC
        `
      )
      .all(id) as SubtaskRow[];

    const tags = this.connection
      .prepare(
        `
        SELECT tags.name as tag_name
        FROM task_tags tt
        INNER JOIN tags ON tags.id = tt.tag_id
        WHERE tt.task_id = ?
        ORDER BY tags.name ASC
        `
      )
      .all(id) as Array<{ tag_name: string }>;

    return toTask(
      row,
      notes.map((note) => ({ date: note.note_date, content: decryptText(note.content) })),
      subtasks.map((item) => toSubtask(item)),
      tags.map((item) => item.tag_name)
    );
  }

  async add(task: Omit<Task, 'id'>): Promise<number> {
    const insertTask = this.connection.prepare(
      `
      INSERT INTO tasks (
        title, description, status, start_date, end_date, order_index,
        created_at, updated_at, estimated_minutes, actual_minutes, priority,
        project_id, is_pinned, recurrence_rule, recurrence_parent_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );

    const now = new Date().toISOString();
    const tx = this.connection.transaction((input: Omit<Task, 'id'>) => {
      const result = insertTask.run(
        encryptText(input.title),
        encryptText(input.description),
        input.status,
        input.start_date,
        input.end_date,
        input.order_index,
        input.created_at,
        now,
        input.estimated_minutes,
        input.actual_minutes,
        input.priority,
        input.project_id,
        input.is_pinned ? 1 : 0,
        serializeRecurrenceRule(input.recurrence_rule),
        input.recurrence_parent_id
      );

      const taskId = Number(result.lastInsertRowid);
      this.replaceDailyNotes(taskId, input.daily_notes, now);
      this.replaceSubtasks(taskId, input.subtasks ?? [], now);
      this.replaceTags(taskId, input.tags ?? [], now);
      return taskId;
    });

    return tx(task);
  }

  async update(id: number, changes: Partial<Task>): Promise<void> {
    const tx = this.connection.transaction((taskId: number, patch: Partial<Task>) => {
      const assignments: string[] = [];
      const values: unknown[] = [];

      if (patch.title !== undefined) {
        assignments.push('title = ?');
        values.push(encryptText(patch.title));
      }
      if (patch.description !== undefined) {
        assignments.push('description = ?');
        values.push(encryptText(patch.description));
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
      if (patch.project_id !== undefined) {
        assignments.push('project_id = ?');
        values.push(patch.project_id);
      }
      if (patch.is_pinned !== undefined) {
        assignments.push('is_pinned = ?');
        values.push(patch.is_pinned ? 1 : 0);
      }
      if (patch.recurrence_rule !== undefined) {
        assignments.push('recurrence_rule = ?');
        values.push(serializeRecurrenceRule(patch.recurrence_rule));
      }
      if (patch.recurrence_parent_id !== undefined) {
        assignments.push('recurrence_parent_id = ?');
        values.push(patch.recurrence_parent_id);
      }

      const now = new Date().toISOString();
      if (
        assignments.length > 0 ||
        patch.daily_notes !== undefined ||
        patch.subtasks !== undefined ||
        patch.tags !== undefined
      ) {
        assignments.push('updated_at = ?');
        values.push(now);
        values.push(taskId);
        this.connection
          .prepare(`UPDATE tasks SET ${assignments.join(', ')} WHERE id = ?`)
          .run(...values);
      }

      if (patch.daily_notes !== undefined) {
        this.replaceDailyNotes(taskId, patch.daily_notes, now);
      }
      if (patch.subtasks !== undefined) {
        this.replaceSubtasks(taskId, patch.subtasks, now);
      }
      if (patch.tags !== undefined) {
        this.replaceTags(taskId, patch.tags, now);
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
          encryptText(next.intention),
          encryptText(next.reflection),
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
        encryptText(changes.intention ?? ''),
        encryptText(changes.reflection ?? ''),
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

export class SqliteProjectRepository implements PlannerProjectBridge {
  constructor(private readonly connection: Database.Database) {}

  async getAll(): Promise<Project[]> {
    const rows = this.connection
      .prepare(
        `
        SELECT
          id, name, color, icon, description, is_archived, order_index, created_at
        FROM projects
        ORDER BY order_index ASC, id ASC
        `
      )
      .all() as ProjectRow[];

    return rows.map((row) => toProject(row));
  }

  async get(id: number): Promise<Project | undefined> {
    const row = this.connection
      .prepare(
        `
        SELECT
          id, name, color, icon, description, is_archived, order_index, created_at
        FROM projects
        WHERE id = ?
        `
      )
      .get(id) as ProjectRow | undefined;

    return row ? toProject(row) : undefined;
  }

  async add(project: Omit<Project, 'id' | 'created_at'>): Promise<number> {
    const now = new Date().toISOString();
    const result = this.connection
      .prepare(
        `
        INSERT INTO projects (
          name, color, icon, description, is_archived, order_index, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        project.name,
        project.color,
        project.icon ?? null,
        encryptNullableText(project.description) ?? null,
        project.is_archived ? 1 : 0,
        project.order_index,
        now,
        now
      );

    return Number(result.lastInsertRowid);
  }

  async update(id: number, changes: Partial<Project>): Promise<void> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    if (changes.name !== undefined) {
      assignments.push('name = ?');
      values.push(changes.name);
    }
    if (changes.color !== undefined) {
      assignments.push('color = ?');
      values.push(changes.color);
    }
    if (changes.icon !== undefined) {
      assignments.push('icon = ?');
      values.push(changes.icon ?? null);
    }
    if (changes.description !== undefined) {
      assignments.push('description = ?');
      values.push(encryptNullableText(changes.description) ?? null);
    }
    if (changes.is_archived !== undefined) {
      assignments.push('is_archived = ?');
      values.push(changes.is_archived ? 1 : 0);
    }
    if (changes.order_index !== undefined) {
      assignments.push('order_index = ?');
      values.push(changes.order_index);
    }

    if (assignments.length === 0) return;

    assignments.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.connection
      .prepare(`UPDATE projects SET ${assignments.join(', ')} WHERE id = ?`)
      .run(...values);
  }

  async delete(id: number): Promise<void> {
    this.connection.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }
}

function migrateSensitiveTextData(connection: Database.Database): void {
  if (!canUseSecureStorage()) return;

  const encryptTasks = connection.prepare(
    `
    UPDATE tasks
    SET title = ?, description = ?
    WHERE id = ?
    `
  );
  const encryptNotes = connection.prepare(
    `
    UPDATE task_daily_notes
    SET content = ?
    WHERE id = ?
    `
  );
  const encryptSubtasks = connection.prepare(
    `
    UPDATE subtasks
    SET title = ?
    WHERE id = ?
    `
  );
  const encryptJournals = connection.prepare(
    `
    UPDATE daily_journals
    SET intention = ?, reflection = ?
    WHERE id = ?
    `
  );
  const encryptProjects = connection.prepare(
    `
    UPDATE projects
    SET description = ?
    WHERE id = ?
    `
  );

  const tx = connection.transaction(() => {
    const taskRows = connection
      .prepare('SELECT id, title, description FROM tasks')
      .all() as Array<{ id: number; title: string; description: string }>;
    for (const row of taskRows) {
      if (isEncrypted(row.title) && isEncrypted(row.description)) continue;
      encryptTasks.run(encryptText(row.title), encryptText(row.description), row.id);
    }

    const noteRows = connection
      .prepare('SELECT id, content FROM task_daily_notes')
      .all() as Array<{ id: number; content: string }>;
    for (const row of noteRows) {
      if (isEncrypted(row.content)) continue;
      encryptNotes.run(encryptText(row.content), row.id);
    }

    const subtaskRows = connection
      .prepare('SELECT id, title FROM subtasks')
      .all() as Array<{ id: number; title: string }>;
    for (const row of subtaskRows) {
      if (isEncrypted(row.title)) continue;
      encryptSubtasks.run(encryptText(row.title), row.id);
    }

    const journalRows = connection
      .prepare('SELECT id, intention, reflection FROM daily_journals')
      .all() as Array<{ id: number; intention: string; reflection: string }>;
    for (const row of journalRows) {
      if (isEncrypted(row.intention) && isEncrypted(row.reflection)) continue;
      encryptJournals.run(
        encryptText(row.intention),
        encryptText(row.reflection),
        row.id
      );
    }

    const projectRows = connection
      .prepare('SELECT id, description FROM projects WHERE description IS NOT NULL')
      .all() as Array<{ id: number; description: string | null }>;
    for (const row of projectRows) {
      if (!row.description || isEncrypted(row.description)) continue;
      encryptProjects.run(encryptText(row.description), row.id);
    }
  });

  tx();
}

export class SqliteRepositoryBundle {
  readonly tasks: SqliteTaskRepository;
  readonly journal: SqliteJournalRepository;
  readonly settings: SqliteSettingsRepository;
  readonly projects: SqliteProjectRepository;
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
    this.projects = new SqliteProjectRepository(this.connection);
    migrateSensitiveTextData(this.connection);
  }

  close(): void {
    this.connection.close();
  }
}
