import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { format, isToday, isYesterday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import { sortByPriority, formatMinutes } from '@/lib/priority';
import type { Task } from '@/lib/db';

interface DayColumnProps {
  date: Date;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

function getDayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEEE');
}

export function DayColumn({ date, tasks, onTaskClick }: DayColumnProps) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const today = isToday(date);

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateStr}`,
    data: { date: dateStr },
  });

  const sortedTasks = useMemo(() => sortByPriority(tasks), [tasks]);
  const taskIds = sortedTasks.map((t) => `task-${t.id}`);
  const plannedMinutes = tasks
    .filter(t => t.status !== 'completed')
    .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  const plannedStr = formatMinutes(plannedMinutes);

  return (
    <div
      className={cn(
        'flex flex-col w-[280px] shrink-0 rounded-xl border transition-colors',
        today ? 'bg-today border-today-border' : 'bg-card',
        isOver && 'border-primary/40 bg-primary/5'
      )}
    >
      <div className={cn(
        'px-4 py-3 border-b',
        today ? 'border-today-border/30' : ''
      )}>
        <h3 className={cn(
          'text-sm font-semibold',
          today && 'text-primary'
        )}>
          {getDayLabel(date)}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground">
            {format(date, 'MMM d')}
          </p>
          {plannedStr && (
            <span className="text-[10px] font-medium text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded">
              {plannedStr}
            </span>
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 min-h-[200px] scrollbar-thin overflow-y-auto"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              isMultiDay={!!task.end_date && task.end_date !== task.start_date}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}
