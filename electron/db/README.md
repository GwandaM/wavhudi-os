# SQLite Layer (Electron)

This folder contains a local-first SQLite implementation for Wavhudi OS.

## What is included

- `migrations/0001_initial_schema.sql`: normalized schema for tasks, daily notes, journals, settings, projects, tags, subtasks, and links.
- `migrate.ts`: runs versioned SQL migrations tracked in `schema_migrations`.
- `sqliteRepositories.ts`: typed repositories for:
  - `tasks` (`PlannerDbBridge`)
  - `journal` (`PlannerJournalBridge`)
  - `settings` (`PlannerSettingsBridge`)
  - `projects` (`PlannerProjectBridge`)

## Required dependency

Install SQLite driver in your Electron/main-process package:

```bash
npm install better-sqlite3
```

## Usage in Electron main process

```ts
import path from 'node:path';
import { SqliteRepositoryBundle } from './electron/db';

const repos = new SqliteRepositoryBundle({
  dbFilePath: 'C:\\WavhudiOS\\data\\planner.db',
  migrationsDir: path.resolve('electron/db/migrations'),
});
```

## Preload bridge contract

Expose these bridge objects in preload:

- `window.wavhudiDb = repos.tasks`
- `window.wavhudiJournalDb = repos.journal`
- `window.wavhudiSettingsDb = repos.settings`
- `window.wavhudiProjectDb = repos.projects`

The frontend `src/lib/db.ts` automatically uses these bridges when present, and falls back to `localStorage` in browser-only mode.
