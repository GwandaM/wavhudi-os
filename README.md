# Wavhudi OS — Daily Planner

A modern, drag-and-drop daily planner built as a single-page application. Organize tasks across days, manage a backlog, track multi-day projects, and journal per-day notes — all from a clean three-panel interface.

---

## ✨ Features

- **Three-panel layout** — Left sidebar (backlog + calendar events), scrollable day columns in the centre, and a slide-in task detail panel on the right.
- **Drag & drop** — Move tasks between day columns and the backlog with smooth `@dnd-kit` interactions.
- **Multi-day tasks** — Set a start and end date; the task appears in every column in the range.
- **Per-day notes** — Attach daily journal entries to any task for contextual progress tracking.
- **Flexible date views** — Switch between day, week, month, and custom range modes. Today's column auto-scrolls into view.
- **Backlog management** — Keep unscheduled tasks in the sidebar and drag them onto a day when ready.
- **Sample data seeding** — First launch populates realistic sample tasks so the UI is never empty.
- **Dark mode** — Class-based dark mode with custom HSL semantic tokens.
- **Responsive** — Mobile-aware hook (`use-mobile`) for adaptive layouts.

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 18 |
| **Language** | TypeScript |
| **Build** | Vite |
| **Styling** | Tailwind CSS + shadcn/ui component library |
| **Drag & Drop** | @dnd-kit/core + @dnd-kit/sortable |
| **Routing** | React Router v6 |
| **State / Data** | React Query, custom `useTasks` hook |
| **Persistence** | localStorage (async API, designed for future migration) |
| **Charts** | Recharts |
| **Testing** | Vitest + React Testing Library |
| **Font** | Inter (Google Fonts) |

## 📁 Project Structure

```
src/
├── components/
│   ├── planner/          # Feature components
│   │   ├── PlannerLayout.tsx       # Main three-panel layout
│   │   ├── DayColumn.tsx           # Individual day column
│   │   ├── TaskCard.tsx            # Draggable task card
│   │   ├── TaskDetailPanel.tsx     # Slide-in detail / notes panel
│   │   ├── BacklogList.tsx         # Sidebar backlog list
│   │   ├── AddTaskInput.tsx        # Quick-add task input
│   │   ├── DateRangeSelector.tsx   # Day/week/month/custom toggle
│   │   └── OutlookEvents.tsx       # Calendar events (mock)
│   └── ui/               # shadcn/ui primitives (do not edit manually)
├── hooks/
│   ├── useTasks.ts        # Single source of truth for task state
│   ├── use-mobile.tsx     # Mobile breakpoint detection
│   └── use-toast.ts       # Toast notification hook
├── lib/
│   ├── db.ts              # localStorage CRUD with async signatures
│   └── utils.ts           # Tailwind `cn()` helper
├── services/
│   └── DatabaseService.ts # Domain logic: filtering, reordering, seeding
├── pages/
│   ├── Index.tsx           # Home / planner page
│   └── NotFound.tsx        # 404 catch-all
└── test/
    └── setup.ts            # Vitest + jest-dom + matchMedia polyfill
```

## 🏗 Architecture

```
db.ts  →  DatabaseService.ts  →  useTasks.ts  →  Components
(localStorage)  (domain logic)       (React state)    (UI)
```

1. **`db.ts`** — Low-level CRUD over `localStorage`. All methods are async so the layer can be swapped for SQLite IPC or IndexedDB without touching upstream code.
2. **`DatabaseService.ts`** — Business logic: date-based filtering, backlog queries, task reordering, completion, and first-launch data seeding.
3. **`useTasks` hook** — The single source of truth for the UI. All mutations call `DatabaseService` and trigger a full state refresh.

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18 — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- **npm** (comes with Node) or **bun** (`bun.lockb` is also present)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/<your-username>/wavhudi-os.git
cd wavhudi-os

# Install dependencies
npm install

# Start the dev server (http://localhost:8080)
npm run dev
```

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build |
| `npm run build:dev` | Development build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run all tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

## 🧪 Testing

Tests use **Vitest** with a **jsdom** environment and `@testing-library/react`.

```bash
npm run test        # single run
npm run test:watch  # watch mode
```

Test files live alongside source code as `*.test.ts` / `*.test.tsx`.

## 🗺 Roadmap

- [ ] Replace localStorage with **better-sqlite3 IPC** for native Electron builds
- [ ] Connect Outlook calendar sidebar to **Electron IPC for local Outlook COM sync**
- [ ] Add CSV / data export

## 🤝 Contributing

1. Fork the repo and create a feature branch.
2. Follow existing conventions: feature components in `src/components/planner/`, UI primitives untouched in `src/components/ui/`.
3. Use the `cn()` utility from `@/lib/utils` for conditional Tailwind classes.
4. Add / update tests for new functionality.
5. Open a pull request.

## 📄 License

This project is private. All rights reserved.
