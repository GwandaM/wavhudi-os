import { useState } from 'react';
import { Plus, AlertTriangle, ArrowUp, Minus, ArrowDown, Clock } from 'lucide-react';
import { parseTaskInput } from '@/lib/parseTaskInput';
import { formatMinutes } from '@/lib/priority';
import type { Priority } from '@/lib/db';
import { cn } from '@/lib/utils';

interface AddTaskInputProps {
  onAdd: (title: string, priority?: Priority, estimated_minutes?: number | null) => void;
  placeholder?: string;
}

const priorityIndicator: Record<Priority, { icon: typeof AlertTriangle; color: string } | null> = {
  urgent: { icon: AlertTriangle, color: 'text-priority-urgent' },
  high: { icon: ArrowUp, color: 'text-priority-high' },
  medium: { icon: Minus, color: 'text-priority-medium' },
  low: { icon: ArrowDown, color: 'text-priority-low' },
  none: null,
};

export function AddTaskInput({ onAdd, placeholder = 'Add a task...' }: AddTaskInputProps) {
  const [value, setValue] = useState('');

  const parsed = parseTaskInput(value);
  const indicator = priorityIndicator[parsed.priority];
  const hasTokens = parsed.priority !== 'none' || parsed.estimated_minutes !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { title, priority, estimated_minutes } = parseTaskInput(value);
    if (!title.trim()) return;
    onAdd(title.trim(), priority, estimated_minutes);
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 transition-colors focus-within:border-primary/30">
        <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
        />
        {hasTokens && (
          <div className="flex items-center gap-1.5 shrink-0">
            {indicator && (
              <indicator.icon className={cn('h-3 w-3', indicator.color)} />
            )}
            {parsed.estimated_minutes && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-medium">
                <Clock className="h-2.5 w-2.5" />
                {formatMinutes(parsed.estimated_minutes)}
              </span>
            )}
          </div>
        )}
      </div>
      {value && hasTokens && (
        <p className="text-[10px] text-muted-foreground/60 px-1">
          → "{parsed.title}"
          {parsed.priority !== 'none' && ` · ${parsed.priority}`}
          {parsed.estimated_minutes && ` · ${formatMinutes(parsed.estimated_minutes)}`}
        </p>
      )}
    </form>
  );
}
