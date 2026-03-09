import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Inbox } from 'lucide-react';
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
      {...attributes}
      {...listeners}
      className={cn(
        'group flex items-center gap-2.5 rounded-md px-2.5 py-2.5 cursor-pointer transition-colors duration-150',
        'hover:bg-muted/30',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/20 rotate-[0.5deg]'
      )}
      onClick={() => onClick(task)}
    >
      <span className="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-muted-foreground/40" />
      <p className="text-sm truncate flex-1 leading-snug">{task.title}</p>
    </div>
  );
}

interface BacklogListProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function BacklogList({ tasks, onTaskClick }: BacklogListProps) {
  return (
    <div className="space-y-0.5">
      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground/50">
          <Inbox className="h-5 w-5 mb-1.5" />
          <p className="text-xs">No backlog tasks</p>
        </div>
      )}
      {tasks.map((task) => (
        <BacklogItem key={task.id} task={task} onClick={onTaskClick} />
      ))}
    </div>
  );
}
