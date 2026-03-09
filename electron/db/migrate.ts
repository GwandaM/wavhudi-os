import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

interface MigrationFile {
  fileName: string;
  version: number;
  sql: string;
}

export interface MigrationConfig {
  dbFilePath: string;
  migrationsDir: string;
}

const FALLBACK_INITIAL_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  icon TEXT,
  description TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name ON projects(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_projects_order ON projects(order_index, id);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog', 'scheduled', 'completed', 'recurring_template')),
  start_date TEXT,
  end_date TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  priority TEXT NOT NULL DEFAULT 'none'
    CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  recurrence_rule TEXT,
  recurrence_parent_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_schedule ON tasks(start_date, end_date, status);
CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks(order_index, id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent ON tasks(recurrence_parent_id);

CREATE TABLE IF NOT EXISTS task_daily_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  note_date TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(task_id, note_date)
);

CREATE INDEX IF NOT EXISTS idx_task_daily_notes_task ON task_daily_notes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_daily_notes_date ON task_daily_notes(note_date);

CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id, order_index, id);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL,
  UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(task_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);

CREATE TABLE IF NOT EXISTS task_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'blocks' CHECK (link_type IN ('blocks')),
  created_at TEXT NOT NULL,
  UNIQUE(source_task_id, target_task_id, link_type),
  CHECK(source_task_id <> target_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_links_source ON task_links(source_task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_target ON task_links(target_task_id);

CREATE TABLE IF NOT EXISTS daily_journals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_date TEXT NOT NULL,
  intention TEXT NOT NULL DEFAULT '',
  reflection TEXT NOT NULL DEFAULT '',
  planning_completed INTEGER NOT NULL DEFAULT 0 CHECK (planning_completed IN (0, 1)),
  shutdown_completed INTEGER NOT NULL DEFAULT 0 CHECK (shutdown_completed IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(journal_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_journals_date ON daily_journals(journal_date);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC, id DESC);
`;

const FALLBACK_MIGRATIONS: MigrationFile[] = [
  {
    fileName: '0001_initial_schema.sql',
    version: 1,
    sql: FALLBACK_INITIAL_SCHEMA_SQL,
  },
];

function toMigrationVersion(fileName: string): number {
  const match = /^(\d+)_/.exec(fileName);
  if (!match) {
    throw new Error(`Invalid migration file name "${fileName}". Expected prefix like 0001_*.sql`);
  }
  return Number(match[1]);
}

function loadMigrationFiles(migrationsDir: string): MigrationFile[] {
  try {
    const files = readdirSync(migrationsDir)
      .filter((fileName) => fileName.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    if (files.length === 0) return FALLBACK_MIGRATIONS;

    return files.map((fileName) => ({
      fileName,
      version: toMigrationVersion(fileName),
      sql: readFileSync(path.join(migrationsDir, fileName), 'utf8'),
    }));
  } catch {
    return FALLBACK_MIGRATIONS;
  }
}

export function runMigrations(config: MigrationConfig): void {
  const db = new Database(config.dbFilePath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db
    .prepare('SELECT version FROM schema_migrations')
    .all() as Array<{ version: number }>;
  const appliedVersions = new Set(appliedRows.map((row) => row.version));
  const migrations = loadMigrationFiles(config.migrationsDir);

  const applyMigration = db.transaction((migration: MigrationFile) => {
    db.exec(migration.sql);
    db.prepare(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
    ).run(migration.version, migration.fileName, new Date().toISOString());
  });

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue;
    applyMigration(migration);
  }

  db.close();
}
