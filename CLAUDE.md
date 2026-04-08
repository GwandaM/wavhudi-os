# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite, port 8080)
npm run build      # Production build
npm run build:dev  # Development build
npm run lint       # ESLint
npm run test       # Run all tests once (vitest run)
npm run test:watch # Run tests in watch mode (vitest)
```

A `bun.lockb` is present alongside `package-lock.json`; either package manager works.

## Architecture

This is a **Daily Planner** single-page app built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui.

### Data Flow

```
src/lib/db.ts  →  src/services/DatabaseService.ts  →  src/hooks/useTasks.ts  →  Components
(localStorage)     (domain logic, queries, seeding)     (React state + actions)
```

- **`db.ts`** — Low-level CRUD over `localStorage` with async signatures (designed to be swapped for better-sqlite3 IPC or IndexedDB in a future Electron build).
- **`DatabaseService.ts`** — Higher-level operations: date-based filtering, backlog queries, task reordering, completion, seeding sample data.
- **`useTasks` hook** — Single source of truth for task state in the UI. All mutations go through this hook, which calls `DatabaseService` and triggers a full refresh.

### Layout (three-panel)

`PlannerLayout` (`src/components/planner/PlannerLayout.tsx`) renders the entire UI:

- **Left sidebar** (`--sidebar-width: 280px`) — Outlook calendar events (currently mocked, `OutlookEvents.tsx`) and a backlog task list with drag-and-drop.
- **Main area** — Horizontally-scrolling day columns (`DayColumn.tsx`). Supports day/week/month/custom range modes via `DateRangeSelector.tsx`. Today's column auto-scrolls into view.
- **Right detail panel** (`--detail-width: 360px`) — `TaskDetailPanel.tsx` slides in when a task is selected. Supports per-day notes for multi-day tasks.

### Drag and Drop

Uses `@dnd-kit/core` + `@dnd-kit/sortable`. Tasks can be dragged between day columns and to/from the backlog. Drop targets are identified by ID prefix (`day-`, `task-`, `backlog`).

### Key Types

The `Task` interface in `src/lib/db.ts` is the core data model:
- `status`: `'backlog' | 'scheduled' | 'completed'`
- `start_date` / `end_date`: nullable `yyyy-MM-dd` strings (end_date enables multi-day tasks)
- `daily_notes`: array of `{ date, content }` for per-day journaling on multi-day tasks

### Styling

- Tailwind CSS with HSL CSS custom properties defined in `src/index.css`
- Dark mode via `class` strategy (`tailwind.config.ts: darkMode: ["class"]`)
- Custom semantic colors: `today`, `today-border`, `completed`, `completed-foreground`, `sidebar-*`
- Font: Inter (loaded from Google Fonts)
- shadcn/ui components live in `src/components/ui/` — do not manually edit these

### Path Alias

`@/` maps to `src/` (configured in `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`).

### Testing

- Vitest with jsdom environment
- Setup file: `src/test/setup.ts` (includes `@testing-library/jest-dom` matchers and `matchMedia` polyfill)
- Test files: `src/**/*.{test,spec}.{ts,tsx}`

### SQLite Migration Rules

Migrations live in `electron/db/migrations/` and are applied automatically on startup via `electron/db/migrate.ts`. The `schema_migrations` table tracks which have run — **each migration runs exactly once, never again**.

**Rules you must follow when writing a new migration:**

- **Adding** columns or tables: always safe — use `ALTER TABLE … ADD COLUMN` or `CREATE TABLE IF NOT EXISTS`.
- **Renaming or dropping** a column: SQLite does not support `ALTER TABLE … DROP/RENAME COLUMN` in older versions. Instead, add a new column, copy the data in the same migration, and leave the old column in place (or do a full table-recreate-and-copy if you must remove it).
- **Never modify an existing migration file** that has already been committed. If you need to fix something, write a new migration.
- Name migrations sequentially: `0001_…`, `0002_…`, `0003_…` — the runner sorts by filename.

The user's database (`%APPDATA%\Wavhudi OS\planner.db`) is **outside the install directory** and is never touched by the installer. Updates ship new app code; migrations upgrade the schema in place. Existing data always survives an update as long as migrations are additive.

## Conventions

- TypeScript with relaxed settings: `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`
- `@typescript-eslint/no-unused-vars` is disabled
- Use the `cn()` utility from `@/lib/utils` for conditional Tailwind class merging
- Feature components go in `src/components/planner/`; reusable UI primitives in `src/components/ui/`
- Routing is via `react-router-dom` v6 — add new routes in `App.tsx` above the `*` catch-all
