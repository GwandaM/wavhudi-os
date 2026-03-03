# Wavhudi OS — Planned Improvements

> This document describes all approved improvements for turning the Daily Planner into a full local-first work operating system. The phase ordering prioritizes **daily usability** — building the habit of opening the app every morning, using it throughout the day, and closing it with a shutdown ritual every evening.

---

## Current state summary

The app is a single-page Daily Planner built with **React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui**. It has a three-panel layout (sidebar with backlog + mock calendar, scrolling day columns, slide-in task detail panel), drag & drop via `@dnd-kit`, multi-day tasks with per-day notes, and `localStorage` persistence with async API signatures.

### Key files

| File | Role |
|---|---|
| `src/lib/db.ts` | Low-level CRUD — async interface over storage. **This is the swap point for storage migration.** |
| `src/services/DatabaseService.ts` | Domain logic: filtering, reordering, completion, seeding |
| `src/hooks/useTasks.ts` | React state management — single source of truth |
| `src/components/planner/PlannerLayout.tsx` | Main three-panel layout + DnD orchestration |
| `src/components/planner/TaskCard.tsx` | Draggable task card |
| `src/components/planner/TaskDetailPanel.tsx` | Slide-in detail/editing panel |
| `src/components/planner/DayColumn.tsx` | Individual day column with droppable zone |
| `src/components/planner/BacklogList.tsx` | Sidebar backlog |
| `src/components/planner/OutlookEvents.tsx` | Mock calendar events |

---

## User workflow — the daily loop

**Morning (first open of the day):**
1. Open the app → see "My Day" as the default view
2. Daily Planning Ritual triggers automatically (or via "Plan My Day" button)
3. Triage yesterday's incomplete tasks → pull from backlog → check capacity → set intention
4. Close the ritual → My Day shows today's focused task list with time estimates and capacity bar

**Midday (throughout the day):**
1. Work through tasks in My Day view, checking off completed items
2. Quick-add new tasks as they come in
3. Drag tasks between days if priorities shift
4. Glance at capacity bar to stay realistic

**Evening (end of day):**
1. Trigger Shutdown Ritual (button or scheduled notification)
2. Review completed tasks → triage incomplete items → write reflection
3. See daily summary → close the day feeling accomplished

**If shutdown is skipped:**
- Auto-rollover: unfinished tasks surface in the next morning's planning ritual (Step 1). No tasks silently vanish.

---

## Phase 1 — "The Daily Habit"

> **Goal:** Create the core daily loop that makes the app worth opening every day.

---

### 1.1 "My Day" as the default view

**Goal:** When you open the app, you see TODAY. Not a scrolling week view.

**UI:**
- Today's tasks in a focused single-column list
- Today's calendar events alongside (mocked initially, real later via Phase 4)
- A capacity indicator showing planned vs available hours
- The week/month view becomes a secondary navigation mode (accessible via sidebar or keyboard shortcuts)

**New file:** `src/components/planner/MyDayView.tsx`
**Modify:** `src/components/planner/PlannerLayout.tsx` — add My Day as default view with ritual trigger logic

---

### 1.2 Task time estimation

**Goal:** When creating or editing a task, optionally set a duration. This is what makes planning feel like planning.

**Data model:** Add `estimated_minutes: number | null` and `actual_minutes: number | null` to the `Task` interface.

**UI:**
- Quick-pick duration buttons: **15m, 30m, 1h, 2h, 4h** plus a custom input
- Day columns and My Day view show **total planned time**
- Task cards show a small rounded badge with estimated duration (e.g., "1h", "30m")

**New file:** `src/components/planner/TimeEstimateSelector.tsx`
**New file:** `src/components/planner/CapacityBar.tsx` — visual capacity indicator (planned vs available hours)
**Modify:** `src/components/planner/TaskCard.tsx` — add time estimate badge
**Modify:** `src/components/planner/TaskDetailPanel.tsx` — add time estimate selector
**Modify:** `src/components/planner/DayColumn.tsx` — show total planned time per day
**Modify:** `src/hooks/useTasks.ts` — add time estimation support, capacity calculations

---

### 1.3 Daily Planning Ritual (morning flow)

**Goal:** A guided flow triggered on first open of each day (or manually via a "Plan My Day" button).

**Steps:**

1. **"Yesterday's unfinished tasks"** — Show incomplete tasks from yesterday. For each: drag to today, push to tomorrow, send to backlog, or mark done.
2. **"Today's calendar"** — Show today's meetings/events (mocked initially, real later). Shows how much free time you have.
3. **"Pull from backlog"** — Browse backlog and drag tasks into today.
4. **"Capacity check"** — "You've planned 6h 30m with 5h free after meetings. Consider trimming." with a visual bar.
5. **"Morning intention" (optional)** — A text field for a daily journal/intention entry. Saved to `DailyJournal`.
6. **"Ready to go"** — Confirms the plan, closes the modal, shows My Day view.

**Design:** Warm, inviting, step-by-step. Soft transitions between steps. Not a modal that feels like a chore.

**New file:** `src/components/planner/PlanningRitual.tsx`

---

### 1.4 Daily Shutdown Ritual (evening flow)

**Goal:** A guided flow triggered manually (button) or at a configurable time (notification if Electron).

**Steps:**

1. **"Today's review"** — Show all tasks with checkboxes. Mark done/undone.
2. **"Incomplete tasks"** — For each unfinished task: push to tomorrow, send to backlog, reschedule to specific date, or delete.
3. **"Reflection" (optional)** — "How was today?" text field. Saved as a daily journal entry.
4. **"Day complete"** — Shows summary (X tasks done, Y pushed, Z hours planned vs actual).

**Design:** Reflective, calming. End-of-day energy. Summary feels like an accomplishment.

**New file:** `src/components/planner/ShutdownRitual.tsx`

---

### 1.5 Auto-rollover fallback

**Goal:** If the user skips the shutdown ritual, unfinished tasks from yesterday automatically surface in the next morning's planning ritual (Step 1). No tasks silently vanish.

**Implementation:** On app load, check for incomplete tasks with `start_date` before today. Surface them in the planning ritual's first step.

---

### 1.6 Priority levels

**Goal:** Visual hierarchy so urgent tasks stand out immediately. Inspired by **Sunsama's** priority approach.

**Data model:** Add `priority: 'urgent' | 'high' | 'medium' | 'low' | 'none'` to `Task` (default: `'none'`).

**Visual design (Sunsama-inspired):**
- **Urgent:** Bold red left-border on the task card, filled red circle icon, card has a subtle warm tint background.
- **High:** Orange left-border, filled orange circle icon.
- **Medium:** Blue left-border, outlined blue circle icon.
- **Low:** Grey left-border, outlined grey circle icon.
- **None:** No border accent, no icon.

**UI changes:**
- **Task card:** Coloured left-border + optional priority icon. Urgent tasks should feel visually "hot".
- **Task detail panel:** Priority selector — a row of clickable icons/buttons (like Sunsama's priority picker, not a dropdown).
- **Day column:** Tasks auto-sort by priority within each day (urgent first), with drag-and-drop still allowing manual override.
- **Quick-add:** Option to set priority inline when creating a task (e.g., `!1` for urgent, `!2` for high in the text input, parsed on submit).

---

## Phase 2 — "Organize the Work"

> **Goal:** Add the organizational scaffolding — structure and speed for 50+ tasks.

---

### 2.1 Projects

**Goal:** Group tasks by projects. The user thinks in terms of projects → tasks.

**Data model:**
```ts
interface Project {
  id: number;
  name: string;
  color: string;       // hex, e.g. "#6366f1"
  icon?: string;       // optional lucide icon name
  description?: string;
  is_archived: boolean;
  order_index: number;
  created_at: string;
}
```

Add `project_id: number | null` to the `Task` interface.

**UI changes:**
- **Sidebar:** Add a "Projects" section above "Task Backlog" showing all projects as a collapsible list with coloured dots. Clicking a project filters the main board to show only that project's tasks.
- **Task card:** Show a small coloured project badge/dot with the project name.
- **Task detail panel:** Add a project selector dropdown.
- **Toolbar:** Add a project filter dropdown in the main toolbar alongside the date range selector.
- **Project management:** A settings/modal to create, edit, reorder, archive, and delete projects.

---

### 2.2 Subtasks / Checklists

**Goal:** Break down complex tasks into actionable steps without creating a separate top-level task for each.

**Data model:**
```ts
interface Subtask {
  id: number;
  title: string;
  completed: boolean;
  order_index: number;
}
```

Add `subtasks: Subtask[]` to `Task`.

**Workflow example:**

1. User creates a task: "Ship v2 authentication"
2. Opens the task detail panel → sees a "Subtasks" section below the description
3. Clicks "+ Add subtask" or presses `Enter` in the last subtask input to chain-add
4. Types subtask titles:
   - ☐ Design token refresh flow
   - ☐ Implement backend endpoint
   - ☐ Write integration tests
   - ☐ Update API docs
5. Checks off subtasks as they complete them — each checkbox toggles independently
6. **Task card** shows a compact progress indicator: `2/4 ✓` with a mini progress bar
7. When all subtasks are complete, the app prompts (toast or inline) "All subtasks done — mark task complete?"
8. Subtasks are **reorderable** via drag handles within the detail panel
9. Subtasks can be **converted** to standalone tasks (right-click or ⋯ menu → "Promote to task")

**UI in TaskDetailPanel:**
- Section header: "Subtasks (2/4)"
- List of subtasks with: checkbox, title (editable inline), drag handle, ⋯ menu (delete, promote)
- "+ Add subtask" at the bottom
- Mini progress bar below the section header

---

### 2.3 Quick-add task per day column

**Goal:** Let the user add a task directly to a specific day without dragging from the backlog.

**UI:** Add an `AddTaskInput` component at the **bottom** of each `DayColumn`. The new task is created with `status: 'scheduled'` and `start_date` set to that column's date. Support the `!1`/`!2` priority shorthand and `#project-name` tag parsing in the input text.

---

### 2.4 Search & filter

**Goal:** Instantly find any task across all data — including text inside notes and descriptions.

**What gets searched:**
- Task title
- Task description
- Daily notes content (`daily_notes[].content`)
- Subtask titles
- Project name

**UI:**
- A search bar in the main toolbar (left of date range selector). Activatable via `Ctrl+F` / `Cmd+F`.
- **Instant fuzzy results** shown in a dropdown panel as you type — grouped by project.
- Each result shows: task title, matching snippet (highlighted), project badge, date, status.
- Clicking a result opens the task in the detail panel and scrolls the relevant day column into view.
- **Filter bar** below the search: toggle-buttons for status (`Scheduled`, `Backlog`, `Completed`), project filter dropdown, priority filter dropdown. Filters apply to the main board view.

---

### 2.5 Command palette (`Ctrl+K` / `Cmd+K`)

**Goal:** Keyboard-first access to every action. The `cmdk` package is already in `package.json`.

**Cross-platform shortcuts:** Detect OS at runtime. Show `Ctrl` on Windows/Linux, `Cmd` on Mac. Internally bind both.

**Available commands:**
| Command | Shortcut |
|---|---|
| New task | `Ctrl/Cmd + N` |
| New task in backlog | `Ctrl/Cmd + Shift + N` |
| Search tasks | `Ctrl/Cmd + F` |
| Open command palette | `Ctrl/Cmd + K` |
| Jump to today | `T` (when no input focused) |
| Switch to My Day view | `1` (when no input focused) |
| Switch to week view | `2` (when no input focused) |
| Switch to month view | `3` (when no input focused) |
| Close detail panel | `Escape` |
| Toggle dark mode | `Ctrl/Cmd + D` |
| Navigate days (prev/next) | `←` / `→` (when no input focused) |
| Mark selected task complete | `Ctrl/Cmd + Enter` |
| Plan My Day | `Ctrl/Cmd + P` |
| Start Shutdown Ritual | `Ctrl/Cmd + Shift + S` |

---

### 2.6 Keyboard shortcuts (global)

Implement a global keyboard event listener (probably a `useKeyboardShortcuts` hook) that:
- Checks if the active element is an input/textarea (if so, most single-key shortcuts are suppressed)
- Binds all shortcuts from the table above
- Shows a "Keyboard shortcuts" help modal accessible from a `?` key or from the command palette

---

## Phase 3 — "Workflow Depth"

> **Goal:** Handle complex recurring workflows and power features.

---

### 3.1 Recurring tasks

**Goal:** Tasks that automatically repeat (e.g., "Daily standup prep", "Weekly 1:1 prep", "Monthly report").

**Data model:**
```ts
interface RecurrenceRule {
  frequency: 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly';
  end_date?: string;  // optional stop date, null = forever
}
```

Add `recurrence: RecurrenceRule | null` to `Task`. Recurring tasks also need a `recurrence_parent_id: number | null` to link generated instances back to the template.

**Behaviour:**
1. User creates a task and toggles "Repeat" in the detail panel — selects frequency.
2. The original task becomes a **template** (hidden from day columns, stored with `status: 'recurring_template'`).
3. On app load (and whenever the user navigates to a new date range), a background service checks the range and **generates instances** that don't already exist. Each instance is a normal `scheduled` task linked via `recurrence_parent_id`.
4. Completing an instance only completes that single day's instance — the next one still appears.
5. Editing the **template** (via a "Edit all future" option) updates future generated instances.
6. Deleting the template stops future generation. Existing instances remain.
7. **UI indicator:** Recurring tasks show a small repeat icon (↻) on the task card.

---

### 3.2 Tags / Labels

**Goal:** Cross-cutting categorization that complements projects.

**Data model:** Add `tags: string[]` to `Task`. Tags are freeform strings prefixed with `#` by convention (e.g., `meeting`, `blocked`, `code-review`).

**UI:**
- **Task card:** Render as small coloured chips below the title (auto-assign colours by hashing the tag name).
- **Task detail panel:** Tag input with autocomplete from existing tags.
- **Toolbar filter:** Add a tag filter (multi-select) alongside the project/priority filters.
- **Quick-add parsing:** Support `#tag` syntax in the quick-add input (e.g., "Review PR #code-review #urgent").

---

### 3.3 Pinned / Starred tasks

**Goal:** Critical tasks always visible at the top.

**Data model:** Add `is_pinned: boolean` to `Task`.

**UI:**
- A star icon on each task card — click to toggle.
- Pinned tasks float to the **top** of their day column above non-pinned tasks.
- **Sidebar:** Add a "Pinned" / "Focus" section above the backlog showing all currently pinned tasks across all days. This acts as a "what matters right now" quick-reference.

---

### 3.4 Task linking / Dependencies

**Goal:** Express "Task A is blocked by Task B" or "Task A blocks Task C" relationships.

**Data model:**
```ts
interface TaskLink {
  id: number;
  source_task_id: number;   // the task that blocks
  target_task_id: number;   // the task that is blocked
  link_type: 'blocks';      // keep simple — only one type for now
}
```

Store links in a separate `task_links` table/array.

**Behaviour:**
1. In the task detail panel, a "Dependencies" section shows:
   - **Blocked by:** list of tasks that must complete first
   - **Blocks:** list of tasks this one is blocking
2. User can add a link by searching for a task in a dropdown.
3. If all "blocked by" tasks are incomplete, the blocked task shows a 🔒 lock icon on its card and its title is slightly dimmed.
4. When a blocking task is completed, the blocked task's lock clears automatically and a toast notifies: "Task X is now unblocked".
5. **No calendar enforcement** — blocked tasks can still be scheduled and worked on. The visual is informational, not restrictive.

---

### 3.5 Work/Personal contexts

**Goal:** Light separation between work and personal tasks.

**Data model:** Add `context: 'work' | 'personal' | 'side_project' | null` to `Task`.

**UI:**
- Filterable in toolbar — toggle-buttons for each context
- Tasks show a subtle context indicator (e.g., small icon or colored dot)
- Morning planning ritual can filter by context (e.g., "Plan work day" vs "Plan everything")

---

### 3.6 Weekly Review

**Goal:** Guided end-of-week flow for reflection and forward planning.

**Flow:**
1. Completion stats for the week (tasks done, tasks pushed, time spent)
2. Time spent per project breakdown
3. Unfinished items to reschedule or send to backlog
4. Weekly journal entry

---

### 3.7 Analytics / Insights

**Goal:** Weekly dashboard with actionable data.

**Metrics:**
- Time per project (bar chart)
- Completion rate trends (line chart over weeks)
- Average daily capacity utilization
- Busiest days of the week

---

## Phase 4 — "Ecosystem & Polish"

> **Goal:** Integrations and platform maturity. These are approved for the roadmap but **not for immediate implementation**. Implement the phases above first.

---

### 4.1 Real calendar integration

Replace mock `OutlookEvents.tsx` with **Microsoft Graph API** for Outlook calendar. Show real meetings in the planning ritual and day view.

### 4.2 Microsoft To Do sync

Pull tasks from Microsoft To Do into the backlog. Two-way sync optional.

### 4.3 GitHub / Jira integration

Pull issues/PRs as tasks into the backlog. Show PR status on task cards.

### 4.4 File attachments / Links

Attach URLs, files, or paste images to tasks.

### 4.5 Notifications / Reminders

System notifications for upcoming tasks and shutdown reminder (via Electron).

### 4.6 OneDrive backup

Scheduled backup of `.db` file to a configurable OneDrive folder path.

### 4.7 Data export

Export tasks to JSON/CSV.

### 4.8 PWA support

Web manifest + service worker for browser-based use when not on work PC.

---

## PARALLEL Track — "Electron & Storage"

> **Runs alongside Phase 1–2. Does NOT block feature work. Separate agent handles this.**

### P.1 Electron shell

Wrap the Vite app in Electron with basic window management.

### P.2 better-sqlite3 + IPC

Replace `localStorage` in `db.ts` with SQLite IPC calls. The existing async API contract means **zero changes** to `DatabaseService` or `useTasks`.

### P.3 Schema migrations

`migrations/` folder with versioned SQL migration files. Run pending migrations on app start.

### P.4 Default DB path

`C:\WavhudiOS\data\planner.db` (configurable in settings).

### P.5 First-run setup screen

If DB doesn't exist, show setup wizard.

---

## Key data model changes (Phase 1)

```ts
// Add to Task interface
interface Task {
  // ... existing fields ...
  estimated_minutes: number | null;  // Planned duration (NEW)
  actual_minutes: number | null;     // Tracked time, updated manually or via timer (NEW)
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';  // (NEW)
  project_id: number | null;         // (Phase 2, but define early)
}

// NEW: Daily Journal entries (global, not per-task)
interface DailyJournal {
  id: number;
  date: string;              // yyyy-MM-dd
  morning_intention: string; // From morning planning ritual
  evening_reflection: string; // From shutdown ritual
  created_at: string;
}

// NEW: User Settings (for ritual configuration)
interface UserSettings {
  shutdown_reminder_time: string | null;  // e.g., "17:30"
  default_day_start: string;              // e.g., "08:00"
  default_day_end: string;                // e.g., "17:00"
  skip_weekends: boolean;
  planning_ritual_completed_today: boolean;
}
```

---

## Key files to modify/create

| File | Action | Purpose |
|---|---|---|
| `improvements.md` | Rewrite | Replace with revised phase structure (this file) |
| `src/lib/db.ts` | Modify | Add new interfaces (DailyJournal, UserSettings), extend Task interface |
| `src/services/DatabaseService.ts` | Modify | Add journal CRUD, settings CRUD, rollover logic |
| `src/hooks/useTasks.ts` | Modify | Add time estimation support, capacity calculations |
| `src/components/planner/MyDayView.tsx` | Create | New default "My Day" focused view |
| `src/components/planner/PlanningRitual.tsx` | Create | Morning guided planning flow |
| `src/components/planner/ShutdownRitual.tsx` | Create | Evening guided shutdown flow |
| `src/components/planner/CapacityBar.tsx` | Create | Visual capacity indicator (planned vs available hours) |
| `src/components/planner/TimeEstimateSelector.tsx` | Create | Quick-pick duration buttons (15m, 30m, 1h, 2h, 4h, custom) |
| `src/hooks/useDailyJournal.ts` | Create | Hook for journal entries |
| `src/hooks/useSettings.ts` | Create | Hook for user settings |
| `src/components/planner/PlannerLayout.tsx` | Modify | Add My Day as default view, add ritual trigger logic |
| `src/components/planner/TaskCard.tsx` | Modify | Add priority visual, time estimate badge |
| `src/components/planner/TaskDetailPanel.tsx` | Modify | Add priority picker, time estimate selector |
| `src/components/planner/DayColumn.tsx` | Modify | Show total planned time per day, capacity indicator |

---

## Build order summary

```
Phase 1 ("The Daily Habit")    →  My Day view, Time estimation, Planning ritual,
                                   Shutdown ritual, Auto-rollover, Priorities

Phase 2 ("Organize the Work")  →  Projects, Subtasks, Quick-add, Search,
                                   Command palette, Keyboard shortcuts

Phase 3 ("Workflow Depth")     →  Recurring tasks, Tags, Pinned tasks, Dependencies,
                                   Contexts, Weekly review, Analytics

Phase 4 ("Ecosystem & Polish") →  Calendar integration, Microsoft To Do, GitHub/Jira,
                                   Attachments, Notifications, Backup, Export, PWA

PARALLEL ("Electron & Storage") → Electron shell, SQLite + IPC, Migrations,
                                   DB path config, First-run setup
```

Each phase should be fully functional and tested before moving to the next. Within each phase, implement in the listed order — later items may depend on earlier ones. The Electron/Storage track runs independently and can be merged whenever ready.

---

## Design direction

- **Inspiration:** Sunsama — calm, intentional, ritual-driven. The app should feel like a personal assistant that gently guides you through your day, not a project management tool.
- **Morning ritual:** Warm, inviting, step-by-step. Soft transitions between steps. Not a modal that feels like a chore.
- **Shutdown ritual:** Reflective, calming. End-of-day energy. Summary feels like an accomplishment.
- **Capacity bar:** Green when under-planned, amber when at capacity, red when over-committed. Always visible in My Day view.
- **Time chips:** Small, rounded badges on task cards showing estimated duration (e.g., "1h", "30m"). Subtle but informative.
- **Font:** Inter (already in use).
- **Dark mode:** Continue using class-based strategy with HSL custom properties.
- **Component library:** Continue using shadcn/ui. Do not manually edit files in `src/components/ui/`.
- **Storage contract:** All storage changes must go through `db.ts`. No component should import storage directly.
