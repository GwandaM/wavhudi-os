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
