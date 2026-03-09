import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { format, addDays, subDays, startOfMonth, endOfMonth, differenceInCalendarDays } from 'date-fns';
import { CalendarDays, Inbox as InboxIcon, Sun, LayoutGrid, Search, FolderOpen, Plus, MoreHorizontal, BarChart3 } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useDailyJournal } from '@/hooks/useDailyJournal';
import { useSettings } from '@/hooks/useSettings';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useRitualReminders } from '@/hooks/useRitualReminders';
import { DayColumn } from './DayColumn';
import { MyDayView } from './MyDayView';
import { MonthGridView } from './MonthGridView';
import { CalendarEvents } from './CalendarEvents';
import { BacklogList } from './BacklogList';
import { TaskDetailPanel } from './TaskDetailPanel';
import { AddTaskInput } from './AddTaskInput';
import { PlanningRitual } from './PlanningRitual';
import { ShutdownRitual } from './ShutdownRitual';
import { CommandPalette } from './CommandPalette';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { WeeklyReview } from './WeeklyReview';
import { DateRangeSelector, type RangeMode } from './DateRangeSelector';
import type { Task, Priority, Project } from '@/lib/db';
import { cn } from '@/lib/utils';

type ViewMode = 'myday' | 'timeline' | 'review';

export function PlannerLayout() {
  const {
    loading,
    tasks,
    createTask,
    updateTask,
    deleteTask,
    moveTaskToDate,
    completeTask,
    getTasksForDate,
    getBacklogTasks,
    refresh,
  } = useTasks();

  const { projects, createProject, updateProject, deleteProject, getProjectById } = useProjects();

  const today = useMemo(() => new Date(), []);
  const todayStr = format(today, 'yyyy-MM-dd');

  const { settings } = useSettings();
  const { journal, isPlanningDone, isShutdownDone, updateJournal } = useDailyJournal(todayStr);

  const [viewMode, setViewMode] = useState<ViewMode>('myday');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showPlanningRitual, setShowPlanningRitual] = useState(false);
  const [showShutdownRitual, setShowShutdownRitual] = useState(false);

  useRitualReminders({
    todayStr,
    settings,
    journal,
    onStartPlanning: () => setShowPlanningRitual(true),
    onStartShutdown: () => setShowShutdownRitual(true),
  });

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const [rangeMode, setRangeMode] = useState<RangeMode>('week');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);

  const days = useMemo(() => {
    const arr: Date[] = [];
    switch (rangeMode) {
      case 'day':
        arr.push(subDays(today, 1), today, addDays(today, 1));
        break;
      case 'week':
        for (let i = -1; i < 6; i++) {
          arr.push(i < 0 ? subDays(today, Math.abs(i)) : addDays(today, i));
        }
        break;
      case 'month': {
        const start = startOfMonth(today);
        const end = endOfMonth(today);
        const count = differenceInCalendarDays(end, start) + 1;
        for (let i = 0; i < count; i++) {
          arr.push(addDays(start, i));
        }
        break;
      }
      case 'custom': {
        if (customStart && customEnd) {
          const count = differenceInCalendarDays(customEnd, customStart) + 1;
          for (let i = 0; i < Math.min(count, 90); i++) {
            arr.push(addDays(customStart, i));
          }
        } else {
          for (let i = -1; i < 6; i++) {
            arr.push(i < 0 ? subDays(today, Math.abs(i)) : addDays(today, i));
          }
        }
        break;
      }
    }
    return arr;
  }, [today, rangeMode, customStart, customEnd]);

  const backlogTasks = getBacklogTasks();
  const todayTasks = getTasksForDate(todayStr);
  const capacityMinutes = settings?.daily_capacity_minutes ?? 480;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined;
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = active.data.current?.task as Task | undefined;
    if (!task || !task.id) return;

    const overId = String(over.id);

    if (overId.startsWith('day-')) {
      const date = overId.replace('day-', '');
      const tasksInDay = getTasksForDate(date);
      moveTaskToDate(task.id, date, tasksInDay.length);
      return;
    }

    if (overId === 'backlog') {
      return;
    }

    if (overId.startsWith('task-')) {
      const overTask = over.data.current?.task as Task | undefined;
      if (overTask?.start_date) {
        moveTaskToDate(task.id, overTask.start_date, overTask.order_index);
      }
    }
  };

  const newTaskDefaults = {
    description: '',
    daily_notes: [],
    actual_minutes: null,
    project_id: null,
    is_pinned: false,
    subtasks: [],
    tags: [] as string[],
    recurrence_rule: null,
    recurrence_parent_id: null,
  };

  const handleAddBacklogTask = (title: string, priority?: Priority, estimated_minutes?: number | null) => {
    createTask({
      ...newTaskDefaults,
      title,
      status: 'backlog',
      start_date: null,
      end_date: null,
      order_index: backlogTasks.length,
      estimated_minutes: estimated_minutes ?? null,
      priority: priority ?? 'none',
    });
  };

  const handleAddTodayTask = (title: string, priority?: Priority, estimated_minutes?: number | null) => {
    createTask({
      ...newTaskDefaults,
      title,
      status: 'scheduled',
      start_date: todayStr,
      end_date: null,
      order_index: todayTasks.length,
      estimated_minutes: estimated_minutes ?? null,
      priority: priority ?? 'none',
    });
  };

  const handleCompleteToggle = async (id: number) => {
    const task = selectedTask;
    if (task?.status === 'completed') {
      await updateTask(id, { status: 'scheduled' });
    } else {
      await completeTask(id);
    }
    const updated = await import('@/services/DatabaseService').then(m => m.DatabaseService.getTaskById(id));
    if (updated) setSelectedTask(updated);
  };

  const handlePlanningComplete = async () => {
    await updateJournal({ planning_completed: true });
    setShowPlanningRitual(false);
    await refresh();
  };

  const handleShutdownComplete = async () => {
    await updateJournal({ shutdown_completed: true });
    setShowShutdownRitual(false);
    await refresh();
  };

  // Keyboard shortcuts
  useKeyboardShortcuts(useMemo(() => ({
    onCommandPalette: () => setShowCommandPalette(prev => !prev),
    onNewTask: () => setShowCommandPalette(true),
    onSwitchMyDay: () => setViewMode('myday'),
    onSwitchTimeline: () => setViewMode('timeline'),
    onSwitchReview: () => setViewMode('review'),
    onEscape: () => {
      if (showCommandPalette) setShowCommandPalette(false);
      else if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (selectedTask) setSelectedTask(null);
    },
    onShowShortcuts: () => setShowShortcutsHelp(prev => !prev),
  }), [showCommandPalette, showShortcutsHelp, selectedTask]));

  // Scroll today into view (timeline mode)
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loading && scrollRef.current && viewMode === 'timeline') {
      const todayCol = scrollRef.current.querySelector('[data-today="true"]');
      if (todayCol) {
        todayCol.scrollIntoView({ behavior: 'instant', inline: 'start', block: 'nearest' });
      }
    }
  }, [loading, viewMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-muted-foreground">Loading planner...</div>
      </div>
    );
  }

  // Planning ritual overlay
  if (showPlanningRitual) {
    return (
      <PlanningRitual
        todayStr={todayStr}
        tasks={tasks}
        journal={journal}
        onUpdateJournal={updateJournal}
        onMoveTask={moveTaskToDate}
        onComplete={handlePlanningComplete}
        onClose={() => setShowPlanningRitual(false)}
        getTasksForDate={getTasksForDate}
      />
    );
  }

  // Shutdown ritual overlay
  if (showShutdownRitual) {
    return (
      <ShutdownRitual
        todayStr={todayStr}
        todayTasks={todayTasks}
        journal={journal}
        onUpdateJournal={updateJournal}
        onMoveTask={moveTaskToDate}
        onMoveToBacklog={async (id) => {
          await import('@/services/DatabaseService').then(m => m.DatabaseService.moveTaskToBacklog(id));
          await refresh();
        }}
        onComplete={handleShutdownComplete}
        onClose={() => setShowShutdownRitual(false)}
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen overflow-hidden">
        {/* Left Sidebar */}
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
          <div className="px-3 pb-3 flex items-center gap-0.5">
            <button
              onClick={() => setViewMode('myday')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-[11px] font-medium transition-colors min-w-0',
                viewMode === 'myday'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/40'
              )}
            >
              <Sun className="h-3 w-3 shrink-0" />
              <span className="truncate">My Day</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-[11px] font-medium transition-colors min-w-0',
                viewMode === 'timeline'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/40'
              )}
            >
              <LayoutGrid className="h-3 w-3 shrink-0" />
              <span className="truncate">Timeline</span>
            </button>
            <button
              onClick={() => setViewMode('review')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-[11px] font-medium transition-colors min-w-0',
                viewMode === 'review'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/40'
              )}
            >
              <BarChart3 className="h-3 w-3 shrink-0" />
              <span className="truncate">Review</span>
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
              <CalendarEvents date={todayStr} />
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

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {viewMode === 'myday' ? (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <MyDayView
                tasks={todayTasks}
                capacityMinutes={capacityMinutes}
                onTaskClick={setSelectedTask}
                onAddTask={handleAddTodayTask}
                isPlanningDone={isPlanningDone}
                isShutdownDone={isShutdownDone}
                onStartPlanning={() => setShowPlanningRitual(true)}
                onStartShutdown={() => setShowShutdownRitual(true)}
                projects={projects}
              />
            </div>
          ) : viewMode === 'review' ? (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <WeeklyReview
                projects={projects}
                onClose={() => setViewMode('myday')}
              />
            </div>
          ) : (
            <>
              <div className="border-b border-border/20 px-4 py-3 flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {format(today, 'EEEE, MMMM d, yyyy')}
                </h2>
                <DateRangeSelector
                  mode={rangeMode}
                  onModeChange={setRangeMode}
                  customStart={customStart}
                  customEnd={customEnd}
                  onCustomRangeChange={(s, e) => {
                    setCustomStart(s);
                    setCustomEnd(e);
                  }}
                />
              </div>

              {rangeMode === 'month' ? (
                <MonthGridView
                  today={today}
                  getTasksForDate={getTasksForDate}
                  onTaskClick={setSelectedTask}
                  onCompleteTask={async (id) => {
                    const task = tasks.find(t => t.id === id);
                    if (task?.status === 'completed') {
                      await updateTask(id, { status: 'scheduled' });
                    } else {
                      await completeTask(id);
                    }
                  }}
                  onAddTask={(title, dateStr, priority, estimated_minutes) => {
                    const dayTasks = getTasksForDate(dateStr);
                    createTask({
                      ...newTaskDefaults,
                      title,
                      status: 'scheduled',
                      start_date: dateStr,
                      end_date: null,
                      order_index: dayTasks.length,
                      estimated_minutes: estimated_minutes ?? null,
                      priority: priority ?? 'none',
                    });
                  }}
                  projects={projects}
                />
              ) : (
                <div ref={scrollRef} className="flex-1 overflow-x-auto scrollbar-thin">
                  <div className="flex h-full">
                    {days.map((date) => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const dayTasks = getTasksForDate(dateStr);
                      const isTodayCol = todayStr === dateStr;
                      return (
                        <div key={dateStr} data-today={isTodayCol || undefined}>
                          <DayColumn
                            date={date}
                            tasks={dayTasks}
                            onTaskClick={setSelectedTask}
                            projects={projects}
                            onAddTask={(title, dateStr, priority, estimated_minutes) => {
                              createTask({
                                ...newTaskDefaults,
                                title,
                                status: 'scheduled',
                                start_date: dateStr,
                                end_date: null,
                                order_index: dayTasks.length,
                                estimated_minutes: estimated_minutes ?? null,
                                priority: priority ?? 'none',
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Task Detail — floating window (rendered via portal) */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          projects={projects}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (id, changes) => {
            await updateTask(id, changes);
            const updated = await import('@/services/DatabaseService').then(m => m.DatabaseService.getTaskById(id));
            if (updated) setSelectedTask(updated);
          }}
          onComplete={handleCompleteToggle}
          onDelete={deleteTask}
        />
      )}

      <DragOverlay>
        {activeTask && (
          <div className="rounded-lg border border-border/40 bg-card px-3 py-2.5 shadow-xl ring-2 ring-primary/20 rotate-[0.5deg] w-[250px]">
            <p className="text-sm leading-snug">{activeTask.title}</p>
          </div>
        )}
      </DragOverlay>

      {/* Command Palette */}
      <CommandPalette
        open={showCommandPalette}
        onOpenChange={setShowCommandPalette}
        tasks={tasks}
        onTaskClick={setSelectedTask}
        onCreateTask={() => {
          // Focus the backlog add input as a fallback
          const input = document.querySelector<HTMLInputElement>('[placeholder*="backlog"]');
          if (input) input.focus();
        }}
        onSwitchView={setViewMode}
        onStartPlanning={() => setShowPlanningRitual(true)}
        onStartShutdown={() => setShowShutdownRitual(true)}
        onShowShortcuts={() => setShowShortcutsHelp(true)}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        open={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </DndContext>
  );
}
