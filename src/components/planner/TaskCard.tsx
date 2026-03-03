import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Calendar, CheckCircle2, Clock, AlertTriangle, ArrowUp, Minus } from 'lucide-react';
import type { Task, Priority } from '@/lib/db';
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/priority';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  isMultiDay?: boolean;
}

const priorityBorderClass: Record<Priority, string> = {
  urgent: 'border-l-priority-urgent',
  high: 'border-l-priority-high',
  medium: 'border-l-priority-medium',
  low: 'border-l-priority-low',
  none: '',
};

function PriorityIcon({ priority }: { priority: Priority }) {
  switch (priority) {
    case 'urgent': return <AlertTriangle className="h-3 w-3 text-priority-urgent" />;
    case 'high': return <ArrowUp className="h-3 w-3 text-priority-high" />;
    case 'medium': return <Minus className="h-3 w-3 text-priority-medium" />;
    default: return null;
  }
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
  const priority = task.priority || 'none';
  const timeStr = formatMinutes(task.estimated_minutes);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-2 rounded-lg border bg-card p-3 shadow-sm transition-all cursor-pointer',
        'hover:shadow-md hover:border-primary/20',
        priority !== 'none' && 'border-l-[3px]',
        priorityBorderClass[priority],
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
        <div className="flex items-center gap-1.5">
          <PriorityIcon priority={priority} />
          <p className={cn(
            'text-sm font-medium leading-tight',
            isCompleted && 'line-through text-muted-foreground'
          )}>
            {task.title}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          {isMultiDay && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-primary/70" />
              <span className="text-xs text-primary/70 font-medium">Multi-day</span>
            </div>
          )}
          {timeStr && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-medium">{timeStr}</span>
            </div>
          )}
        </div>
      </div>

      {isCompleted && (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-completed mt-0.5" />
      )}
    </div>
  );
}
