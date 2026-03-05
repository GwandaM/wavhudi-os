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
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold">My Day</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(today, 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Ritual prompts */}
      {!isPlanningDone && (
        <button
          onClick={onStartPlanning}
          className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 transition-colors hover:border-primary/50 hover:bg-primary/10"
        >
          <Sunrise className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-semibold text-primary">Start your morning planning</p>
            <p className="text-xs text-muted-foreground">Review yesterday, plan today, set your intention</p>
          </div>
        </button>
      )}

      {isPlanningDone && isEvening && !isShutdownDone && (
        <button
          onClick={onStartShutdown}
          className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-accent-foreground/30 bg-accent/50 p-4 transition-colors hover:border-accent-foreground/50"
        >
          <Sunset className="h-5 w-5 text-accent-foreground" />
          <div className="text-left">
            <p className="text-sm font-semibold text-accent-foreground">Time for shutdown</p>
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
          'space-y-2 min-h-[200px] rounded-xl p-3 transition-colors',
          isOver && 'bg-primary/5 border border-primary/20'
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
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
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
        <div className="space-y-2 pt-4 border-t">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
        <div className="text-center text-xs text-muted-foreground pt-2">
          {incompleteTasks.length} remaining · {completedTasks.length} done
          {plannedMinutes > 0 && ` · ${formatMinutes(plannedMinutes)} planned`}
        </div>
      )}
    </div>
  );
}
