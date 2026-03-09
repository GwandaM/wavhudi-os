# Sunsama-Aligned UI Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full visual redesign of the Daily Planner to match Sunsama's calm, premium dark-mode-first aesthetic.

**Architecture:** Pure CSS + component styling changes. No logic, data flow, or structural changes. All mutations are visual: color tokens, class names, padding/spacing values, and typography weights.

**Tech Stack:** Tailwind CSS (HSL custom properties in index.css), React components, shadcn/ui primitives.

---

### Task 1: Color Palette — Update CSS Custom Properties

**Files:**
- Modify: `src/index.css:8-108`

**Step 1: Replace light mode tokens**

In `src/index.css`, replace the `:root` block (lines 8-64) with:

```css
  :root {
    --background: 40 20% 98%;
    --foreground: 220 13% 18%;

    --card: 40 15% 99%;
    --card-foreground: 220 13% 18%;

    --popover: 40 15% 99%;
    --popover-foreground: 220 13% 18%;

    --primary: 24 50% 48%;
    --primary-foreground: 0 0% 100%;

    --secondary: 35 10% 95%;
    --secondary-foreground: 220 13% 25%;

    --muted: 35 12% 95%;
    --muted-foreground: 220 8% 46%;

    --accent: 35 10% 93%;
    --accent-foreground: 220 13% 25%;

    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;

    --border: 30 10% 90%;
    --input: 30 10% 90%;
    --ring: 24 50% 48%;

    --radius: 0.5rem;

    --today: 35 40% 96%;
    --today-border: 28 45% 60%;
    --completed: 145 45% 42%;
    --completed-foreground: 0 0% 100%;
    --sidebar-width: 240px;
    --detail-width: 360px;

    --sidebar-background: 30 15% 97%;
    --sidebar-foreground: 220 13% 18%;
    --sidebar-primary: 24 50% 48%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 35 10% 94%;
    --sidebar-accent-foreground: 220 13% 18%;
    --sidebar-border: 30 10% 90%;
    --sidebar-ring: 24 50% 48%;

    --priority-urgent: 0 72% 51%;
    --priority-high: 25 70% 50%;
    --priority-medium: 217 55% 53%;
    --priority-low: 220 9% 46%;
    --priority-none: 220 9% 76%;

    --capacity-ok: 145 45% 42%;
    --capacity-warn: 38 75% 50%;
    --capacity-over: 0 65% 50%;
  }
```

**Step 2: Replace dark mode tokens**

Replace the `.dark` block (lines 66-108) with:

```css
  .dark {
    --background: 220 15% 8%;
    --foreground: 220 8% 88%;
    --card: 220 12% 10%;
    --card-foreground: 220 8% 88%;
    --popover: 220 12% 10%;
    --popover-foreground: 220 8% 88%;
    --primary: 28 60% 55%;
    --primary-foreground: 0 0% 100%;
    --secondary: 220 10% 13%;
    --secondary-foreground: 220 8% 82%;
    --muted: 220 10% 12%;
    --muted-foreground: 220 8% 50%;
    --accent: 220 10% 14%;
    --accent-foreground: 220 8% 82%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 100%;
    --border: 220 10% 14%;
    --input: 220 10% 14%;
    --ring: 28 60% 55%;
    --today: 28 25% 12%;
    --today-border: 28 45% 40%;
    --completed: 145 40% 35%;
    --completed-foreground: 0 0% 100%;
    --sidebar-background: 220 15% 6%;
    --sidebar-foreground: 220 8% 82%;
    --sidebar-primary: 28 60% 55%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 220 10% 11%;
    --sidebar-accent-foreground: 220 8% 82%;
    --sidebar-border: 220 10% 12%;
    --sidebar-ring: 28 60% 55%;

    --priority-urgent: 0 55% 45%;
    --priority-high: 25 55% 48%;
    --priority-medium: 217 50% 55%;
    --priority-low: 220 8% 50%;
    --priority-none: 220 8% 30%;

    --capacity-ok: 145 40% 35%;
    --capacity-warn: 38 65% 45%;
    --capacity-over: 0 55% 45%;
  }
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 4: Commit**

```
feat(ui): update color palette to warm muted tones
```

---

### Task 2: Enable Dark Mode by Default

**Files:**
- Modify: `index.html:2`

**Step 1: Add dark class to html element**

Change line 2 from:
```html
<html lang="en">
```
to:
```html
<html lang="en" class="dark">
```

**Step 2: Verify**

Run: `npm run dev` and open in browser. The app should render with dark background.

**Step 3: Commit**

```
feat(ui): default to dark mode
```

---

### Task 3: Redesign TaskCard

**Files:**
- Modify: `src/components/planner/TaskCard.tsx` (full file)

**Step 1: Rewrite TaskCard**

Replace the entire file content with:

```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Clock, ListChecks } from 'lucide-react';
import type { Task, Priority, Project } from '@/lib/db';
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/priority';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  onComplete?: (id: number) => void;
  isMultiDay?: boolean;
  projects?: Project[];
}

const priorityDot: Record<Priority, string | null> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-blue-400',
  low: 'bg-slate-400',
  none: null,
};

export function TaskCard({ task, onClick, onComplete, isMultiDay, projects }: TaskCardProps) {
  const project = task.project_id && projects?.find(p => p.id === task.project_id);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task-${task.id}`,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCompleted = task.status === 'completed';
  const priority = task.priority || 'none';
  const dotColor = priorityDot[priority];
  const timeStr = formatMinutes(task.estimated_minutes);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative flex flex-col gap-1.5 rounded-lg px-3.5 py-3 transition-all duration-150',
        'hover:bg-muted/40',
        'cursor-grab active:cursor-grabbing touch-none select-none',
        isDragging && 'shadow-xl ring-2 ring-primary/20 rotate-[0.5deg] cursor-grabbing bg-card',
        isCompleted && 'opacity-40'
      )}
      onClick={() => onClick(task)}
    >
      <div className="flex items-start gap-2.5">
        <button
          className={cn(
            'mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border flex items-center justify-center transition-colors',
            isCompleted
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/30 hover:border-primary/60'
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (onComplete && task.id) onComplete(task.id);
          }}
        >
          {isCompleted && <Check className="h-2.5 w-2.5" />}
        </button>
        <p className={cn(
          'text-sm leading-snug break-words line-clamp-3',
          isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
        )}>
          {task.title}
        </p>
      </div>

      {(timeStr || dotColor || project || hasSubtasks) && (
        <div className="flex items-center gap-2 pl-7 text-xs text-muted-foreground">
          {dotColor && (
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColor)} />
          )}
          {timeStr && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeStr}
            </span>
          )}
          {project && (
            <span className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: (project as Project).color }}
              />
              {(project as Project).name}
            </span>
          )}
          {hasSubtasks && (
            <span className="flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit**

```
feat(ui): redesign task cards — cleaner, borderless, minimal metadata
```

---

### Task 4: Simplify DayColumn Headers

**Files:**
- Modify: `src/components/planner/DayColumn.tsx` (full file)

**Step 1: Rewrite DayColumn**

Replace the entire file with:

```tsx
import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { format, isToday, isYesterday, isTomorrow, isPast, startOfDay } from 'date-fns';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import { AddTaskInput } from './AddTaskInput';
import { sortByPriority, formatMinutes } from '@/lib/priority';
import type { Task, Priority, Project } from '@/lib/db';

interface DayColumnProps {
  date: Date;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask?: (title: string, date: string, priority?: Priority, estimated_minutes?: number | null) => void;
  projects?: Project[];
}

function getDayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEEE');
}

export function DayColumn({ date, tasks, onTaskClick, onAddTask, projects }: DayColumnProps) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const today = isToday(date);
  const pastDay = isPast(startOfDay(date)) && !today;

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateStr}`,
    data: { date: dateStr },
  });

  const sortedTasks = useMemo(() => sortByPriority(tasks), [tasks]);
  const incompleteTasks = sortedTasks.filter(t => t.status !== 'completed');
  const completedTasks = sortedTasks.filter(t => t.status === 'completed');
  const taskIds = sortedTasks.map((t) => `task-${t.id}`);

  const plannedMinutes = incompleteTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

  return (
    <div
      className={cn(
        'flex flex-col w-[280px] min-w-[280px] max-w-[280px] border-r border-border/20 transition-colors duration-150',
        today && 'bg-today/30',
        pastDay && 'opacity-50',
        isOver && 'bg-primary/5'
      )}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 bg-background px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <h3 className={cn(
              'text-[15px] font-medium',
              today && 'text-primary'
            )}>
              {getDayLabel(date)}
            </h3>
            <span className="text-xs text-muted-foreground">
              {tasks.length}
            </span>
          </div>
          {plannedMinutes > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatMinutes(plannedMinutes)}
            </span>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {format(date, 'MMMM d')}
        </p>
      </div>

      {/* Task Area */}
      <div
        ref={setNodeRef}
        className="flex-1 px-2 pb-2 space-y-0.5 min-h-[200px] scrollbar-thin overflow-y-auto"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {incompleteTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              isMultiDay={!!task.end_date && task.end_date !== task.start_date}
              projects={projects}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/40">
            Drop tasks here
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="pt-3 mt-3 border-t border-border/20">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5 px-1">
              Completed ({completedTasks.length})
            </p>
            <div className="space-y-0.5">
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={onTaskClick}
                  isMultiDay={!!task.end_date && task.end_date !== task.start_date}
                  projects={projects}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add task input at bottom */}
      {onAddTask && (
        <div className="px-3 pb-3" data-column={dateStr}>
          <AddTaskInput
            onAdd={(title, priority, estimated_minutes) =>
              onAddTask(title, dateStr, priority, estimated_minutes)
            }
            placeholder="Add task..."
          />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit**

```
feat(ui): simplify day column headers — less chrome, more space
```

---

### Task 5: Redesign Sidebar in PlannerLayout

**Files:**
- Modify: `src/components/planner/PlannerLayout.tsx:292-460` (sidebar section only)

**Step 1: Update sidebar markup**

Replace the sidebar `<aside>` block (line 294 through line 460) with:

```tsx
        <aside className="w-60 shrink-0 border-r border-border/20 bg-sidebar flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />
            <h1 className="text-[13px] font-semibold flex-1">Daily Planner</h1>
            <button
              onClick={() => setShowCommandPalette(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              title="Search (⌘K)"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* View Toggle */}
          <div className="px-4 pb-3 flex items-center gap-1">
            <button
              onClick={() => setViewMode('myday')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === 'myday'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/40'
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              My Day
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === 'timeline'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/40'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Timeline
            </button>
            <button
              onClick={() => setViewMode('review')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === 'review'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/40'
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Review
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {/* Outlook Events */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Calendar
                </h2>
              </div>
              <OutlookEvents />
            </div>

            {/* Projects */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex-1">
                  Projects
                </h2>
                <button
                  onClick={() => setShowNewProject(true)}
                  className="rounded p-0.5 hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
                  title="New project"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setFilterProjectId(null)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] transition-colors',
                    filterProjectId === null
                      ? 'bg-muted/50 font-medium text-foreground'
                      : 'hover:bg-muted/30 text-muted-foreground'
                  )}
                >
                  All tasks
                </button>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setFilterProjectId(
                      filterProjectId === project.id ? null : project.id
                    )}
                    className={cn(
                      'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] transition-colors',
                      filterProjectId === project.id
                        ? 'bg-muted/50 font-medium text-foreground'
                        : 'hover:bg-muted/30 text-muted-foreground'
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate flex-1 text-left">{project.name}</span>
                  </button>
                ))}
              </div>
              {showNewProject && (
                <form
                  className="mt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newProjectName.trim()) return;
                    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
                    createProject({
                      name: newProjectName.trim(),
                      color: colors[projects.length % colors.length],
                      description: '',
                      is_archived: false,
                      order_index: projects.length,
                    });
                    setNewProjectName('');
                    setShowNewProject(false);
                  }}
                >
                  <input
                    autoFocus
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onBlur={() => {
                      if (!newProjectName.trim()) setShowNewProject(false);
                    }}
                    placeholder="Project name..."
                    className="w-full text-[13px] rounded-md bg-muted/30 px-2.5 py-2 outline-none focus:ring-1 focus:ring-primary/30 border-0"
                  />
                </form>
              )}
            </div>

            {/* Backlog */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <InboxIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex-1">
                  Backlog
                </h2>
                <span className="text-[11px] text-muted-foreground">{backlogTasks.length}</span>
              </div>
              <SortableContext
                items={backlogTasks.map((t) => `task-${t.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <BacklogList tasks={backlogTasks} onTaskClick={setSelectedTask} />
              </SortableContext>
              <div className="mt-3">
                <AddTaskInput onAdd={handleAddBacklogTask} placeholder="Add to backlog..." />
              </div>
            </div>
          </div>
        </aside>
```

**Step 2: Update the timeline header border**

Find the timeline `<div className="border-b px-3 py-2` (around line 487) and change to:

```tsx
              <div className="border-b border-border/20 px-4 py-3 flex items-center justify-between gap-4">
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Clean build.

**Step 4: Commit**

```
feat(ui): redesign sidebar — more breathing room, softer borders
```

---

### Task 6: Update MyDayView Spacing & Typography

**Files:**
- Modify: `src/components/planner/MyDayView.tsx`

**Step 1: Update spacing and typography**

Key changes to make in the file:
- Outer container: `py-8 px-6` (from py-6 px-4)
- Header: `text-lg` stays, but change `font-semibold` to `font-medium`
- Ritual prompt buttons: change `border-2` to `border`, reduce visual weight
- Task list container: remove `rounded-xl p-3`, keep `space-y-1`
- Empty state: softer messaging

Replace the full file content with:

```tsx
import { useMemo } from 'react';
import { format } from 'date-fns';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Sun, Sunrise, Sunset } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sortByPriority, formatMinutes } from '@/lib/priority';
import { TaskCard } from './TaskCard';
import { CapacityBar } from './CapacityBar';
import { AddTaskInput } from './AddTaskInput';
import type { Task, Priority, Project } from '@/lib/db';

interface MyDayViewProps {
  tasks: Task[];
  capacityMinutes: number;
  onTaskClick: (task: Task) => void;
  onAddTask: (title: string, priority?: Priority, estimated_minutes?: number | null) => void;
  isPlanningDone: boolean;
  isShutdownDone: boolean;
  onStartPlanning: () => void;
  onStartShutdown: () => void;
  projects?: Project[];
}

export function MyDayView({
  tasks,
  capacityMinutes,
  onTaskClick,
  onAddTask,
  isPlanningDone,
  isShutdownDone,
  onStartPlanning,
  onStartShutdown,
  projects,
}: MyDayViewProps) {
  const today = useMemo(() => new Date(), []);
  const dateStr = format(today, 'yyyy-MM-dd');

  const sortedTasks = useMemo(() => sortByPriority(tasks), [tasks]);
  const incompleteTasks = sortedTasks.filter(t => t.status !== 'completed');
  const completedTasks = sortedTasks.filter(t => t.status === 'completed');

  const plannedMinutes = incompleteTasks.reduce(
    (sum, t) => sum + (t.estimated_minutes || 0), 0
  );

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateStr}`,
    data: { date: dateStr },
  });

  const taskIds = sortedTasks.map(t => `task-${t.id}`);
  const hour = new Date().getHours();
  const isEvening = hour >= 17;

  return (
    <div className="max-w-2xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-medium">My Day</h1>
        </div>
        <p className="text-[13px] text-muted-foreground">
          {format(today, 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Ritual prompts */}
      {!isPlanningDone && (
        <button
          onClick={onStartPlanning}
          className="w-full flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
        >
          <Sunrise className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-medium text-primary">Start your morning planning</p>
            <p className="text-xs text-muted-foreground">Review yesterday, plan today, set your intention</p>
          </div>
        </button>
      )}

      {isPlanningDone && isEvening && !isShutdownDone && (
        <button
          onClick={onStartShutdown}
          className="w-full flex items-center gap-3 rounded-lg border border-border/30 bg-muted/30 p-4 transition-colors hover:bg-muted/50"
        >
          <Sunset className="h-5 w-5 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium">Time for shutdown</p>
            <p className="text-xs text-muted-foreground">Review progress, handle incomplete tasks, reflect</p>
          </div>
        </button>
      )}

      {/* Capacity bar */}
      <CapacityBar
        plannedMinutes={plannedMinutes}
        capacityMinutes={capacityMinutes}
      />

      {/* Task list */}
      <div
        ref={setNodeRef}
        className={cn(
          'space-y-1 min-h-[200px] transition-colors',
          isOver && 'bg-primary/5 rounded-lg'
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {incompleteTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              isMultiDay={!!task.end_date && task.end_date !== task.start_date}
              projects={projects}
            />
          ))}
        </SortableContext>

        {incompleteTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40">
            <Sun className="h-8 w-8 mb-2" />
            <p className="text-sm">No tasks for today</p>
            <p className="text-xs">Add a task or drag from the backlog</p>
          </div>
        )}
      </div>

      {/* Add task */}
      <AddTaskInput onAdd={onAddTask} placeholder="Add a task for today..." />

      {/* Completed section */}
      {completedTasks.length > 0 && (
        <div className="space-y-1 pt-4 border-t border-border/20">
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Completed ({completedTasks.length})
          </h3>
          {completedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              isMultiDay={!!task.end_date && task.end_date !== task.start_date}
              projects={projects}
            />
          ))}
        </div>
      )}

      {/* Day summary */}
      {tasks.length > 0 && (
        <div className="text-center text-xs text-muted-foreground/60 pt-2">
          {incompleteTasks.length} remaining · {completedTasks.length} done
          {plannedMinutes > 0 && ` · ${formatMinutes(plannedMinutes)} planned`}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit**

```
feat(ui): update MyDayView — better spacing, softer typography
```

---

### Task 7: Update BacklogList, CapacityBar, AddTaskInput, OutlookEvents

**Files:**
- Modify: `src/components/planner/BacklogList.tsx`
- Modify: `src/components/planner/CapacityBar.tsx`
- Modify: `src/components/planner/AddTaskInput.tsx`
- Modify: `src/components/planner/OutlookEvents.tsx`

**Step 1: Update BacklogList item spacing**

In `BacklogList.tsx`, change the BacklogItem className (line 31-34) from:
```
'group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-all duration-200',
'hover:bg-muted/50',
```
to:
```
'group flex items-center gap-2.5 rounded-md px-2.5 py-2.5 cursor-pointer transition-colors duration-150',
'hover:bg-muted/30',
```

Also change the empty state icon size in BacklogList (line 53) from `py-8` to `py-6`.

**Step 2: Update AddTaskInput border/padding**

In `AddTaskInput.tsx`, change the form input container (line 38) from:
```
"flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 transition-colors focus-within:border-primary/30 hover:bg-muted/30"
```
to:
```
"flex items-center gap-2 rounded-md bg-muted/20 px-3 py-2.5 transition-colors focus-within:bg-muted/40 focus-within:ring-1 focus-within:ring-primary/20"
```

**Step 3: Update OutlookEvents card styling**

In `OutlookEvents.tsx`, change the event card className (line 18) from:
```
"flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-secondary/50"
```
to:
```
"flex items-start gap-3 rounded-md px-3 py-3 transition-colors hover:bg-muted/30"
```

**Step 4: Update CapacityBar**

In `CapacityBar.tsx`, change the daily capacity text (line 41) from:
```
<p className="text-[10px] text-muted-foreground">
```
to:
```
<p className="text-[10px] text-muted-foreground/60">
```

**Step 5: Verify build**

Run: `npm run build`
Expected: Clean build.

**Step 6: Commit**

```
feat(ui): polish BacklogList, AddTaskInput, OutlookEvents, CapacityBar
```

---

### Task 8: Final Verification

**Step 1: Full build check**

Run: `npm run build`
Expected: Clean build, zero errors.

**Step 2: Run tests**

Run: `npm run test`
Expected: All existing tests pass (these are visual changes only, no logic changes).

**Step 3: Visual spot-check**

Run: `npm run dev` — verify:
- Dark mode is default
- Colors are warm/muted, not bright orange
- Task cards are clean, no left borders
- Column headers are simple
- Sidebar has breathing room
- No harsh borders anywhere

**Step 4: Commit all remaining changes (if any)**

```
chore: final UI polish pass
```
