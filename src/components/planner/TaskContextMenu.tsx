import type { ReactNode } from 'react';
import { CheckCheck, RotateCcw, Trash2 } from 'lucide-react';
import type { Task } from '@/lib/db';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface TaskContextMenuProps {
  task: Task;
  children: ReactNode;
  onToggleComplete?: (task: Task) => void | Promise<void>;
  onDelete?: (task: Task) => void | Promise<void>;
}

export function TaskContextMenu({
  task,
  children,
  onToggleComplete,
  onDelete,
}: TaskContextMenuProps) {
  if (!onToggleComplete && !onDelete) {
    return <>{children}</>;
  }

  const isCompleted = task.status === 'completed';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {onToggleComplete && (
          <ContextMenuItem onSelect={() => { void onToggleComplete(task); }}>
            {isCompleted ? <RotateCcw className="mr-2 h-4 w-4" /> : <CheckCheck className="mr-2 h-4 w-4" />}
            {isCompleted ? 'Reopen task' : 'Mark as completed'}
          </ContextMenuItem>
        )}
        {onToggleComplete && onDelete && <ContextMenuSeparator />}
        {onDelete && (
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => { void onDelete(task); }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete task
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
