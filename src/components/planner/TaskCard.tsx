import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, ListChecks } from 'lucide-react';
import type { Task, Project } from '@/lib/db';
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/priority';
import { getProgressColor, PROGRESS_DOT } from '@/lib/statusColors';
import { TaskContextMenu } from './TaskContextMenu';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  onComplete?: (id: number) => void;
  isMultiDay?: boolean;
  projects?: Project[];
  onToggleComplete?: (task: Task) => void | Promise<void>;
  onDelete?: (task: Task) => void | Promise<void>;
}

export function TaskCard({ task, onClick, onComplete, isMultiDay, projects, onToggleComplete, onDelete }: TaskCardProps) {
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
  const progressColor = getProgressColor(task);
  const dotColor = PROGRESS_DOT[progressColor];
  const timeStr = formatMinutes(task.estimated_minutes);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  return (
    <TaskContextMenu task={task} onToggleComplete={onToggleComplete} onDelete={onDelete}>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          'group relative flex flex-col gap-1.5 rounded-lg px-3.5 py-3 transition-all duration-150',
          isCompleted
            ? !isDragging && 'bg-progress-completed/8 hover:bg-progress-completed/12 ring-1 ring-inset ring-completed/20'
            : 'hover:bg-muted/40',
          'cursor-grab active:cursor-grabbing touch-none select-none',
          isDragging && 'shadow-xl ring-2 ring-primary/20 rotate-[0.5deg] cursor-grabbing bg-card',
        )}
        onClick={() => onClick(task)}
      >
        <div className="flex items-start gap-2.5">
          {/* Status dot */}
          <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', dotColor)} />
          <p className={cn(
            'text-sm leading-snug break-words line-clamp-3',
            isCompleted ? 'font-medium text-completed' : 'text-foreground'
          )}>
            {task.title}
          </p>
        </div>

        {(timeStr || project || hasSubtasks) && (
          <div className={cn(
            'flex items-center gap-2 pl-[18px] text-xs',
            isCompleted ? 'text-completed/80' : 'text-muted-foreground'
          )}>
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
    </TaskContextMenu>
  );
}
