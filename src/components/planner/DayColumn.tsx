import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { format, isToday, isYesterday, isTomorrow, isPast, startOfDay } from 'date-fns';
import { Plus, Clock } from 'lucide-react';
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
  const completedMinutes = completedTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  const totalMinutes = plannedMinutes + completedMinutes;
  const progressPercent = totalMinutes > 0 ? Math.min((completedMinutes / totalMinutes) * 100, 100) : 0;

  return (
    <div
      className={cn(
        'flex flex-col w-[280px] min-w-[280px] max-w-[280px] border-r border-border/40 transition-colors duration-150',
        today && 'bg-primary/[0.02]',
        pastDay && 'opacity-60',
        isOver && 'bg-primary/5 ring-2 ring-primary/20 ring-inset'
      )}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 border-b border-border/40 bg-background px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className={cn(
            'text-base font-semibold',
            today && 'text-primary'
          )}>
            {getDayLabel(date)}
          </h3>
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded',
            today
              ? 'bg-primary/20 text-primary'
              : 'bg-muted text-muted-foreground'
          )}>
            {tasks.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {format(date, 'MMMM d')}
        </p>

        {/* Progress bar (today only) */}
        {today && totalMinutes > 0 && (
          <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Add task + time row */}
        <div className="flex items-center justify-between mt-3">
          {onAddTask && (
            <button
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded flex items-center gap-1 transition-colors"
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>(`[data-column="${dateStr}"] input`);
                input?.focus();
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add task
            </button>
          )}
          {plannedMinutes > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatMinutes(plannedMinutes)}
            </span>
          )}
        </div>
      </div>

      {/* Task Area */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-1 min-h-[200px] scrollbar-thin overflow-y-auto"
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
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50">
            Drop tasks here
          </div>
        )}

        {/* Completed section */}
        {completedTasks.length > 0 && (
          <div className="pt-3 mt-3 border-t border-border/40">
            <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
              Completed ({completedTasks.length})
            </p>
            <div className="space-y-1">
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

      {/* Add task input */}
      {onAddTask && (
        <div className="p-2 border-t border-border/40" data-column={dateStr}>
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
