import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Inbox } from 'lucide-react';
import type { Task } from '@/lib/db';
import { cn } from '@/lib/utils';

function BacklogItem({ task, onClick }: { task: Task; onClick: (t: Task) => void }) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 cursor-pointer transition-all',
        'hover:shadow-sm hover:border-primary/20',
        isDragging && 'opacity-50 shadow-lg'
      )}
      onClick={() => onClick(task)}
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <p className="text-sm truncate flex-1">{task.title}</p>
    </div>
  );
}

interface BacklogListProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function BacklogList({ tasks, onTaskClick }: BacklogListProps) {
  return (
    <div className="space-y-1.5">
      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
          <Inbox className="h-6 w-6 mb-2" />
          <p className="text-xs">No backlog tasks</p>
        </div>
      )}
      {tasks.map((task) => (
        <BacklogItem key={task.id} task={task} onClick={onTaskClick} />
      ))}
    </div>
  );
}
