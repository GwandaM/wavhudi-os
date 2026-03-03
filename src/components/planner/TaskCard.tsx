import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Calendar, CheckCircle2 } from 'lucide-react';
import type { Task } from '@/lib/db';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  isMultiDay?: boolean;
}

export function TaskCard({ task, onClick, isMultiDay }: TaskCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-2 rounded-lg border bg-card p-3 shadow-sm transition-all cursor-pointer',
        'hover:shadow-md hover:border-primary/20',
        isDragging && 'opacity-50 shadow-lg rotate-1 scale-105',
        isCompleted && 'opacity-60'
      )}
      onClick={() => onClick(task)}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium leading-tight',
          isCompleted && 'line-through text-muted-foreground'
        )}>
          {task.title}
        </p>
        {isMultiDay && (
          <div className="flex items-center gap-1 mt-1.5">
            <Calendar className="h-3 w-3 text-primary/70" />
            <span className="text-xs text-primary/70 font-medium">Multi-day</span>
          </div>
        )}
      </div>

      {isCompleted && (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-completed mt-0.5" />
      )}
    </div>
  );
}
