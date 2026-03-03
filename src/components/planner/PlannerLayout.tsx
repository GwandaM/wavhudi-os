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
import { CalendarDays, Inbox as InboxIcon, Sun, LayoutGrid, Search } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useDailyJournal } from '@/hooks/useDailyJournal';
import { useSettings } from '@/hooks/useSettings';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { DayColumn } from './DayColumn';
import { MyDayView } from './MyDayView';
import { OutlookEvents } from './OutlookEvents';
import { BacklogList } from './BacklogList';
import { TaskDetailPanel } from './TaskDetailPanel';
import { AddTaskInput } from './AddTaskInput';
import { PlanningRitual } from './PlanningRitual';
import { ShutdownRitual } from './ShutdownRitual';
import { CommandPalette } from './CommandPalette';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { DateRangeSelector, type RangeMode } from './DateRangeSelector';
import type { Task, Priority } from '@/lib/db';
import { cn } from '@/lib/utils';

type ViewMode = 'myday' | 'timeline';

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

  const today = useMemo(() => new Date(), []);
  const todayStr = format(today, 'yyyy-MM-dd');

  const { settings } = useSettings();
  const { journal, isPlanningDone, isShutdownDone, updateJournal } = useDailyJournal(todayStr);

  const [viewMode, setViewMode] = useState<ViewMode>('myday');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showPlanningRitual, setShowPlanningRitual] = useState(false);
  const [showShutdownRitual, setShowShutdownRitual] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const [rangeMode, setRangeMode] = useState<RangeMode>('week');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

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

  const handleAddBacklogTask = (title: string, priority?: Priority, estimated_minutes?: number | null) => {
    createTask({
      title,
      description: '',
      daily_notes: [],
      status: 'backlog',
      start_date: null,
      end_date: null,
      order_index: backlogTasks.length,
      estimated_minutes: estimated_minutes ?? null,
      actual_minutes: null,
      priority: priority ?? 'none',
    });
  };

  const handleAddTodayTask = (title: string, priority?: Priority, estimated_minutes?: number | null) => {
    createTask({
      title,
      description: '',
      daily_notes: [],
      status: 'scheduled',
      start_date: todayStr,
      end_date: null,
      order_index: todayTasks.length,
      estimated_minutes: estimated_minutes ?? null,
      actual_minutes: null,
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
        <aside className="w-[var(--sidebar-width)] shrink-0 border-r bg-sidebar flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <Sun className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold tracking-tight">Daily Planner</h1>
          </div>

          {/* View Toggle */}
          <div className="px-4 py-3 border-b flex items-center gap-1">
            <button
              onClick={() => setViewMode('myday')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === 'myday'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary'
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
                  : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Timeline
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {/* Outlook Events */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Outlook Events
                </h2>
              </div>
              <OutlookEvents />
            </div>

            {/* Backlog */}
            <div className="p-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <InboxIcon className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Task Backlog
                </h2>
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
              />
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b bg-card/50 flex items-center justify-between gap-4">
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
              <div ref={scrollRef} className="flex-1 overflow-x-auto p-4 scrollbar-thin">
                <div className="flex gap-3 h-full">
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
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </main>

        {/* Right Panel */}
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
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
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rounded-lg border bg-card p-3 shadow-xl rotate-2 opacity-90 w-[250px]">
            <p className="text-sm font-medium">{activeTask.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
