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
  onTaskToggleComplete?: (task: Task) => void | Promise<void>;
  onTaskDelete?: (task: Task) => void | Promise<void>;
  onAddTask?: (title: string, date: string, priority?: Priority, estimated_minutes?: number | null) => void;
  projects?: Project[];
}

function getDayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEEE');
}

export function DayColumn({ date, tasks, onTaskClick, onTaskToggleComplete, onTaskDelete, onAddTask, projects }: DayColumnProps) {
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
              onToggleComplete={onTaskToggleComplete}
              onDelete={onTaskDelete}
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
                  onToggleComplete={onTaskToggleComplete}
                  onDelete={onTaskDelete}
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
