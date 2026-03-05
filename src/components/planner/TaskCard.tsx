import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Clock, Pin, ListChecks } from 'lucide-react';
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

const priorityConfig: Record<Priority, { label: string; pill: string; border: string } | null> = {
  urgent: { label: 'P0', pill: 'bg-red-500/15 text-red-600 dark:text-red-400', border: 'border-l-red-500' },
  high: { label: 'P1', pill: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', border: 'border-l-orange-500' },
  medium: { label: 'P2', pill: 'bg-blue-500/10 text-blue-500 dark:text-blue-400', border: 'border-l-blue-500' },
  low: { label: 'P3', pill: 'bg-slate-400/10 text-slate-400', border: 'border-l-slate-400' },
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
  const config = priorityConfig[priority];
  const timeStr = formatMinutes(task.estimated_minutes);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const hasTags = task.tags && task.tags.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative flex flex-col gap-1.5 rounded-lg px-3 py-2.5 transition-all duration-200',
        'bg-card hover:bg-card/80',
        'border border-border/40 hover:border-border/60',
        'cursor-grab active:cursor-grabbing touch-none select-none',
        priority !== 'none' && config && `border-l-[3px] ${config.border}`,
        isDragging && 'shadow-xl ring-2 ring-primary/20 rotate-[0.5deg] cursor-grabbing',
        isCompleted && 'opacity-50 hover:opacity-60 bg-card/50'
      )}
      onClick={() => onClick(task)}
    >
      {/* Checkbox + Title row */}
      <div className="flex items-start gap-2">
        <button
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 rounded-full border-[1.5px] flex items-center justify-center transition-colors',
            isCompleted
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/40 hover:border-primary hover:bg-primary/10'
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (onComplete && task.id) onComplete(task.id);
          }}
        >
          {isCompleted && <Check className="h-2.5 w-2.5" />}
        </button>
        {task.is_pinned && (
          <Pin className="h-3 w-3 text-primary shrink-0 mt-0.5 -rotate-45" />
        )}
        <p className={cn(
          'text-sm leading-snug break-words line-clamp-3',
          isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
        )}>
          {task.title}
        </p>
      </div>

      {/* Metadata row */}
      {(timeStr || config || project || hasSubtasks || hasTags) && (
        <div className="flex items-center gap-1.5 pl-6 flex-wrap">
          {timeStr && (
            <span className="flex items-center gap-1 bg-muted/50 text-[11px] tabular-nums text-muted-foreground rounded px-1.5 py-0.5">
              <Clock className="h-3 w-3" />
              {timeStr}
            </span>
          )}
          {config && (
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', config.pill)}>
              {config.label}
            </span>
          )}
          {project && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: (project as Project).color }}
              />
              {(project as Project).name}
            </span>
          )}
          {hasSubtasks && (
            <span className="flex items-center gap-1 bg-muted/50 text-[11px] text-muted-foreground rounded px-1.5 py-0.5">
              <ListChecks className="h-3 w-3" />
              {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
            </span>
          )}
          {hasTags && task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-medium text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
