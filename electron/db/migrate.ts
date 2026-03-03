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

function toMigrationVersion(fileName: string): number {
  const match = /^(\d+)_/.exec(fileName);
  if (!match) {
    throw new Error(`Invalid migration file name "${fileName}". Expected prefix like 0001_*.sql`);
  }
  return Number(match[1]);
}

function loadMigrationFiles(migrationsDir: string): MigrationFile[] {
  const files = readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  return files.map((fileName) => ({
    fileName,
    version: toMigrationVersion(fileName),
    sql: readFileSync(path.join(migrationsDir, fileName), 'utf8'),
  }));
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
