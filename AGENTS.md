# Repository Guidelines

## Project Structure & Module Organization
- `src/components/planner/`: Planner feature components (`PlannerLayout`, `DayColumn`, `TaskCard`, etc.).
- `src/components/ui/`: shadcn/ui primitives; treat as shared building blocks and avoid ad-hoc edits.
- `src/hooks/`: custom hooks, including `useTasks` as the main task state entry point.
- `src/lib/`: low-level utilities and persistence helpers (`db.ts`, `utils.ts`).
- `src/services/`: domain logic (`DatabaseService.ts`) between storage and UI hooks.
- `src/pages/`: route-level pages; `public/`: static assets; `src/test/`: test setup and examples.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start Vite dev server (default `http://localhost:8080`).
- `npm run build`: generate production bundle in `dist/`.
- `npm run build:dev`: build with development mode flags.
- `npm run lint`: run ESLint across the codebase.
- `npm run test`: run Vitest once (CI-style).
- `npm run test:watch`: run Vitest in watch mode for local iteration.

## Coding Style & Naming Conventions
- Use TypeScript + React function components.
- Follow existing formatting: 2-space indentation and double quotes.
- Naming: `PascalCase` for components/files, `camelCase` for functions/variables, hooks prefixed with `use`.
- Use the `@/` alias for imports from `src` (for example, `@/hooks/useTasks`).
- Keep feature code in `src/components/planner/`; keep reusable UI primitives in `src/components/ui/`.
- Run `npm run lint` before opening a PR.

## Testing Guidelines
- Stack: Vitest + Testing Library with `jsdom` (`vitest.config.ts`, `src/test/setup.ts`).
- Test file patterns: `src/**/*.{test,spec}.{ts,tsx}`.
- Prefer focused unit tests for `DatabaseService` and `useTasks`, plus interaction tests for planner flows.
- Execute `npm run test` before submitting changes.

## Commit & Pull Request Guidelines
- Local Git history is unavailable in this snapshot (`.git` directory is missing), so use Conventional Commit style (`feat:`, `fix:`, `refactor:`, `test:`) with imperative subjects.
- PRs should include a clear summary, linked issue/task, and screenshots or GIFs for UI updates.
- Document test coverage for the change and note any follow-up work explicitly.

## Configuration & Data Notes
- Task data is currently persisted in browser `localStorage`; do not commit generated data dumps.
- Treat external integrations (for example planner calendar/event connectors) as mock/stub unless explicitly wired.
