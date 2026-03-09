import { useEffect, useState, useMemo } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  Sun, LayoutGrid, Sunrise, Sunset, Plus, Search,
  AlertTriangle, ArrowUp, Minus, ArrowDown, CheckCircle2,
  Clock, Inbox, Keyboard, BarChart3,
} from 'lucide-react';
import { formatMinutes, PRIORITY_LABELS } from '@/lib/priority';
import type { Task, Priority } from '@/lib/db';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onCreateTask: () => void;
  onSwitchView: (view: 'myday' | 'timeline' | 'review') => void;
  onStartPlanning: () => void;
  onStartShutdown: () => void;
  onShowShortcuts: () => void;
}

const priorityIcon: Record<Priority, typeof AlertTriangle | null> = {
  urgent: AlertTriangle,
  high: ArrowUp,
  medium: Minus,
  low: ArrowDown,
  none: null,
};

const priorityColor: Record<Priority, string> = {
  urgent: 'text-priority-urgent',
  high: 'text-priority-high',
  medium: 'text-priority-medium',
  low: 'text-priority-low',
  none: 'text-muted-foreground',
};

export function CommandPalette({
  open,
  onOpenChange,
  tasks,
  onTaskClick,
  onCreateTask,
  onSwitchView,
  onStartPlanning,
  onStartShutdown,
  onShowShortcuts,
}: CommandPaletteProps) {
  const scheduledTasks = useMemo(() =>
    tasks.filter(t => t.status === 'scheduled').slice(0, 20),
    [tasks]
  );
  const backlogTasks = useMemo(() =>
    tasks.filter(t => t.status === 'backlog').slice(0, 10),
    [tasks]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search tasks, actions, or type a command..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { onCreateTask(); onOpenChange(false); }}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { onSwitchView('myday'); onOpenChange(false); }}>
            <Sun className="mr-2 h-4 w-4" />
            Switch to My Day
            <CommandShortcut>⌘1</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { onSwitchView('timeline'); onOpenChange(false); }}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Switch to Timeline
            <CommandShortcut>⌘2</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { onSwitchView('review'); onOpenChange(false); }}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Switch to Review
            <CommandShortcut>⌘3</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { onStartPlanning(); onOpenChange(false); }}>
            <Sunrise className="mr-2 h-4 w-4" />
            Start Planning Ritual
          </CommandItem>
          <CommandItem onSelect={() => { onStartShutdown(); onOpenChange(false); }}>
            <Sunset className="mr-2 h-4 w-4" />
            Start Shutdown Ritual
          </CommandItem>
          <CommandItem onSelect={() => { onShowShortcuts(); onOpenChange(false); }}>
            <Keyboard className="mr-2 h-4 w-4" />
            Keyboard Shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {scheduledTasks.length > 0 && (
          <CommandGroup heading="Scheduled Tasks">
            {scheduledTasks.map(task => {
              const Icon = priorityIcon[task.priority || 'none'];
              return (
                <CommandItem
                  key={task.id}
                  value={`task-${task.id}-${task.title}`}
                  onSelect={() => { onTaskClick(task); onOpenChange(false); }}
                >
                  {Icon ? (
                    <Icon className={cn('mr-2 h-4 w-4', priorityColor[task.priority || 'none'])} />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4 text-muted-foreground/30" />
                  )}
                  <span className="flex-1 truncate">{task.title}</span>
                  {task.estimated_minutes && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {formatMinutes(task.estimated_minutes)}
                    </span>
                  )}
                  {task.start_date && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {task.start_date}
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {backlogTasks.length > 0 && (
          <CommandGroup heading="Backlog">
            {backlogTasks.map(task => (
              <CommandItem
                key={task.id}
                value={`backlog-${task.id}-${task.title}`}
                onSelect={() => { onTaskClick(task); onOpenChange(false); }}
              >
                <Inbox className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{task.title}</span>
                {task.estimated_minutes && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatMinutes(task.estimated_minutes)}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
