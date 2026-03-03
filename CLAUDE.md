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

### Planned Migrations (TODOs in code)

- Replace localStorage with **better-sqlite3 IPC** for a native Electron build (`db.ts`, `DatabaseService.ts`)
- Connect `OutlookEvents.tsx` to **Electron IPC for local Outlook COM sync**

## Conventions

- TypeScript with relaxed settings: `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`
- `@typescript-eslint/no-unused-vars` is disabled
- Use the `cn()` utility from `@/lib/utils` for conditional Tailwind class merging
- Feature components go in `src/components/planner/`; reusable UI primitives in `src/components/ui/`
- Routing is via `react-router-dom` v6 — add new routes in `App.tsx` above the `*` catch-all
