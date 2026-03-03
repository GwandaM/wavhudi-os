import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { format, isToday, isYesterday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
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

  const taskIds = tasks.map((t) => `task-${t.id}`);

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
        <p className="text-xs text-muted-foreground mt-0.5">
          {format(date, 'MMM d')}
        </p>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 min-h-[200px] scrollbar-thin overflow-y-auto"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
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
