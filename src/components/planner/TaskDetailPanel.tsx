import { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle2, Trash2, Calendar } from 'lucide-react';
import { format, addDays, differenceInCalendarDays, parse } from 'date-fns';
import type { Task, DailyNote } from '@/lib/db';
import { cn } from '@/lib/utils';

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
  onUpdate: (id: number, changes: Partial<Task>) => Promise<void>;
  onComplete: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function TaskDetailPanel({ task, onClose, onUpdate, onComplete, onDelete }: TaskDetailPanelProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dailyNotes, setDailyNotes] = useState<DailyNote[]>([]);

  const isMultiDay = !!(task?.start_date && task?.end_date && task.end_date !== task.start_date);

  const dayDates = useMemo(() => {
    if (!isMultiDay || !task?.start_date || !task?.end_date) return [];
    const start = parse(task.start_date, 'yyyy-MM-dd', new Date());
    const end = parse(task.end_date, 'yyyy-MM-dd', new Date());
    const count = differenceInCalendarDays(end, start) + 1;
    return Array.from({ length: count }, (_, i) => {
      const d = addDays(start, i);
      return format(d, 'yyyy-MM-dd');
    });
  }, [task?.start_date, task?.end_date, isMultiDay]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setDailyNotes(task.daily_notes || []);
    }
  }, [task]);

  if (!task) return null;

  const handleBlurTitle = () => {
    if (title !== task.title) {
      onUpdate(task.id!, { title });
    }
  };

  const handleBlurDescription = () => {
    if (description !== task.description) {
      onUpdate(task.id!, { description });
    }
  };

  const getNoteForDate = (date: string) => {
    return dailyNotes.find(n => n.date === date)?.content || '';
  };

  const handleDailyNoteChange = (date: string, content: string) => {
    setDailyNotes(prev => {
      const existing = prev.find(n => n.date === date);
      if (existing) {
        return prev.map(n => n.date === date ? { ...n, content } : n);
      }
      return [...prev, { date, content }];
    });
  };

  const handleDailyNoteBlur = () => {
    const currentNotes = task.daily_notes || [];
    if (JSON.stringify(dailyNotes) !== JSON.stringify(currentNotes)) {
      onUpdate(task.id!, { daily_notes: dailyNotes });
    }
  };

  const formatDateHeading = (dateStr: string) => {
    const d = parse(dateStr, 'yyyy-MM-dd', new Date());
    return format(d, 'EEEE, MMM d');
  };

  const isCompleted = task.status === 'completed';

  return (
    <div className="w-[var(--detail-width)] border-l bg-card flex flex-col animate-slide-in-right shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Task Details</h2>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
        {/* Title */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleBlurTitle}
            className="w-full text-lg font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/40 focus:ring-0"
            placeholder="Task title..."
          />
        </div>

        {/* Date info */}
        {task.start_date && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{task.start_date}</span>
            {task.end_date && task.end_date !== task.start_date && (
              <span>→ {task.end_date}</span>
            )}
          </div>
        )}

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
            isCompleted
              ? 'bg-completed/10 text-completed'
              : task.status === 'backlog'
                ? 'bg-secondary text-secondary-foreground'
                : 'bg-accent text-accent-foreground'
          )}>
            {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
          </span>
        </div>

        {/* Notes section */}
        {isMultiDay ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block">
              Daily Notes & Reflections
            </label>
            <div className="space-y-4">
              {dayDates.map((dateStr) => (
                <div key={dateStr} className="rounded-lg border bg-secondary/20 overflow-hidden">
                  <div className="px-3 py-2 bg-secondary/40 border-b">
                    <h4 className="text-xs font-semibold text-foreground">
                      {formatDateHeading(dateStr)}
                    </h4>
                  </div>
                  <textarea
                    value={getNoteForDate(dateStr)}
                    onChange={(e) => handleDailyNoteChange(dateStr, e.target.value)}
                    onBlur={handleDailyNoteBlur}
                    rows={4}
                    className="w-full bg-transparent p-3 text-sm resize-none outline-none placeholder:text-muted-foreground/40"
                    placeholder={`Notes for ${formatDateHeading(dateStr)}...`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Notes & Reflections
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleBlurDescription}
              rows={8}
              className="w-full rounded-lg border bg-secondary/30 p-3 text-sm resize-none outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
              placeholder="Log what you achieved, reflections, or notes on closing out this task..."
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t space-y-2">
        <button
          onClick={() => onComplete(task.id!)}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
            isCompleted
              ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              : 'bg-completed text-completed-foreground hover:bg-completed/90'
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          {isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
        </button>
        <button
          onClick={() => {
            onDelete(task.id!);
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Delete Task
        </button>
      </div>
    </div>
  );
}