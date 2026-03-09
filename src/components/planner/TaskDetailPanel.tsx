import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Trash2, Calendar, AlertTriangle, ArrowUp, Minus, ArrowDown, Circle, Plus, Square, CheckSquare, Pin, Repeat, Maximize2, Minimize2, Save, GripHorizontal } from 'lucide-react';
import { format, addDays, differenceInCalendarDays, parse } from 'date-fns';
import type { Task, DailyNote, Priority, Project, Subtask, RecurrenceRule } from '@/lib/db';
import { cn } from '@/lib/utils';
import { TimeEstimateSelector } from './TimeEstimateSelector';
import { RichTextEditor } from './RichTextEditor';
import { PRIORITY_LABELS } from '@/lib/priority';

interface TaskDetailPanelProps {
  task: Task | null;
  projects?: Project[];
  onClose: () => void;
  onUpdate: (id: number, changes: Partial<Task>) => Promise<void>;
  onComplete: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const MIN_WIDTH = 380;
const MIN_HEIGHT = 400;
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 600;

export function TaskDetailPanel({ task, projects = [], onClose, onUpdate, onComplete, onDelete }: TaskDetailPanelProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dailyNotes, setDailyNotes] = useState<DailyNote[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Window position & size
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const [size, setSize] = useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
  const windowRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Center the window on first open
  useEffect(() => {
    if (task && pos.x === -1) {
      const x = Math.max(40, Math.round((window.innerWidth - size.w) / 2));
      const y = Math.max(40, Math.round((window.innerHeight - size.h) / 2));
      setPos({ x, y });
    }
  }, [task]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isFullscreen) return;
    e.preventDefault();
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };

    const handleMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const nx = Math.max(0, Math.min(ev.clientX - dragOffset.current.x, window.innerWidth - 100));
      const ny = Math.max(0, Math.min(ev.clientY - dragOffset.current.y, window.innerHeight - 50));
      setPos({ x: nx, y: ny });
    };
    const handleUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [pos, isFullscreen]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isFullscreen) return;
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.w;
    const startH = size.h;

    const handleMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const nw = Math.max(MIN_WIDTH, startW + (ev.clientX - startX));
      const nh = Math.max(MIN_HEIGHT, startH + (ev.clientY - startY));
      setSize({ w: nw, h: nh });
    };
    const handleUp = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [size, isFullscreen]);

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
      setSubtasks((task.subtasks || []).sort((a, b) => a.order_index - b.order_index));
      setNewSubtaskTitle('');
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

  const hasUnsavedChanges = useMemo(() => {
    if (!task) return false;
    return (
      title !== task.title ||
      description !== task.description ||
      JSON.stringify(dailyNotes) !== JSON.stringify(task.daily_notes || [])
    );
  }, [task, title, description, dailyNotes]);

  const handleSave = async () => {
    if (!task?.id) return;
    const changes: Partial<Task> = {};
    if (title !== task.title) changes.title = title;
    if (description !== task.description) changes.description = description;
    if (JSON.stringify(dailyNotes) !== JSON.stringify(task.daily_notes || [])) {
      changes.daily_notes = dailyNotes;
    }
    if (Object.keys(changes).length > 0) {
      await onUpdate(task.id, changes);
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSubtask: Subtask = {
      id: Date.now(),
      title: newSubtaskTitle.trim(),
      completed: false,
      order_index: subtasks.length,
    };
    const updated = [...subtasks, newSubtask];
    setSubtasks(updated);
    setNewSubtaskTitle('');
    onUpdate(task.id!, { subtasks: updated });
  };

  const handleToggleSubtask = (subtaskId: number) => {
    const updated = subtasks.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    setSubtasks(updated);
    onUpdate(task.id!, { subtasks: updated });
  };

  const handleDeleteSubtask = (subtaskId: number) => {
    const updated = subtasks.filter(s => s.id !== subtaskId);
    setSubtasks(updated);
    onUpdate(task.id!, { subtasks: updated });
  };

  const handleAddTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (!tag) return;
    const currentTags = task.tags || [];
    if (currentTags.includes(tag)) {
      setNewTag('');
      return;
    }
    onUpdate(task.id!, { tags: [...currentTags, tag] });
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    const currentTags = task.tags || [];
    onUpdate(task.id!, { tags: currentTags.filter(t => t !== tag) });
  };

  const handleTogglePin = () => {
    onUpdate(task.id!, { is_pinned: !task.is_pinned });
  };

  const formatDateHeading = (dateStr: string) => {
    const d = parse(dateStr, 'yyyy-MM-dd', new Date());
    return format(d, 'EEEE, MMM d');
  };

  const isCompleted = task.status === 'completed';

  const windowStyle: React.CSSProperties = isFullscreen
    ? { position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 50 }
    : { position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: 50 };

  const panel = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Floating window */}
      <div
        ref={windowRef}
        style={windowStyle}
        className={cn(
          'flex flex-col bg-background border border-border/60 shadow-2xl overflow-hidden',
          isFullscreen ? 'rounded-none' : 'rounded-xl',
        )}
      >
        {/* Title bar — draggable */}
        <div
          onMouseDown={handleDragStart}
          className={cn(
            'flex items-center justify-between px-5 py-3 border-b border-border/40 select-none shrink-0',
            !isFullscreen && 'cursor-grab active:cursor-grabbing',
          )}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-muted-foreground/40" />
            <h2 className="text-[13px] font-medium text-muted-foreground">Task Details</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="rounded-md p-1.5 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 scrollbar-thin">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleBlurTitle}
              className="w-full text-lg font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/40 focus:ring-0 resize-none"
              placeholder="Task title..."
            />
          </div>

          {/* Date info */}
          {task.start_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{task.start_date}</span>
              {task.end_date && task.end_date !== task.start_date && (
                <span>&rarr; {task.end_date}</span>
              )}
            </div>
          )}

          {/* Status badge + Pin toggle */}
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
            <button
              onClick={handleTogglePin}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                task.is_pinned
                  ? 'bg-primary/10 text-primary'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
              title={task.is_pinned ? 'Unpin task' : 'Pin task'}
            >
              <Pin className={cn('h-3 w-3', task.is_pinned && '-rotate-45')} />
              {task.is_pinned ? 'Pinned' : 'Pin'}
            </button>
          </div>

          {/* Priority picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Priority
            </label>
            <div className="flex items-center gap-1.5">
              {([
                { p: 'urgent' as Priority, icon: AlertTriangle, color: 'text-priority-urgent' },
                { p: 'high' as Priority, icon: ArrowUp, color: 'text-priority-high' },
                { p: 'medium' as Priority, icon: Minus, color: 'text-priority-medium' },
                { p: 'low' as Priority, icon: ArrowDown, color: 'text-priority-low' },
                { p: 'none' as Priority, icon: Circle, color: 'text-priority-none' },
              ]).map(({ p, icon: Icon, color }) => (
                <button
                  key={p}
                  onClick={() => onUpdate(task.id!, { priority: p })}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                    task.priority === p
                      ? 'bg-secondary ring-1 ring-primary/30'
                      : 'hover:bg-secondary/60'
                  )}
                  title={PRIORITY_LABELS[p]}
                >
                  <Icon className={cn('h-3.5 w-3.5', color)} />
                  <span>{PRIORITY_LABELS[p]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time estimate */}
          <TimeEstimateSelector
            value={task.estimated_minutes}
            onChange={(minutes) => onUpdate(task.id!, { estimated_minutes: minutes })}
          />

          {/* Actual time logged */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Actual Time
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={task.actual_minutes ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value, 10) : null;
                  onUpdate(task.id!, { actual_minutes: val });
                }}
                placeholder="Minutes"
                className="w-20 rounded border bg-secondary/30 px-2 py-1.5 text-sm outline-none focus:border-primary/30"
              />
              <span className="text-xs text-muted-foreground">minutes</span>
              {task.estimated_minutes && task.actual_minutes ? (
                <span className={cn(
                  'text-xs font-medium',
                  task.actual_minutes <= task.estimated_minutes ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                )}>
                  {task.actual_minutes <= task.estimated_minutes ? 'On track' : 'Over estimate'}
                </span>
              ) : null}
            </div>
          </div>

          {/* Recurrence rule */}
          {!task.recurrence_parent_id && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                <Repeat className="h-3 w-3 inline mr-1" />
                Repeat
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  { value: null, label: 'None' },
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekdays', label: 'Weekdays' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'biweekly', label: 'Biweekly' },
                  { value: 'monthly', label: 'Monthly' },
                ] as const).map(({ value, label }) => {
                  const currentFreq = task.recurrence_rule?.frequency ?? null;
                  const isActive = currentFreq === value;
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        if (value === null) {
                          onUpdate(task.id!, { recurrence_rule: null });
                        } else {
                          onUpdate(task.id!, {
                            recurrence_rule: { frequency: value, end_date: task.recurrence_rule?.end_date },
                          });
                        }
                      }}
                      className={cn(
                        'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                        isActive
                          ? 'bg-secondary ring-1 ring-primary/30'
                          : 'hover:bg-secondary/60'
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {task.recurrence_parent_id && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Repeat className="h-3.5 w-3.5" />
              <span>This is a recurring instance</span>
            </div>
          )}

          {/* Project selector */}
          {projects.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                Project
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => onUpdate(task.id!, { project_id: null })}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                    !task.project_id
                      ? 'bg-secondary ring-1 ring-primary/30'
                      : 'hover:bg-secondary/60'
                  )}
                >
                  <Circle className="h-3 w-3 text-muted-foreground" />
                  <span>None</span>
                </button>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => onUpdate(task.id!, { project_id: project.id })}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                      task.project_id === project.id
                        ? 'bg-secondary ring-1 ring-primary/30'
                        : 'hover:bg-secondary/60'
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span>{project.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Tags
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(task.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <form
                className="inline-flex"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddTag();
                }}
              >
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag..."
                  className="text-xs bg-transparent outline-none placeholder:text-muted-foreground/40 w-20"
                />
              </form>
            </div>
          </div>

          {/* Subtasks / Checklist */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Subtasks
              {subtasks.length > 0 && (
                <span className="ml-1.5 text-muted-foreground/60">
                  ({subtasks.filter(s => s.completed).length}/{subtasks.length})
                </span>
              )}
            </label>

            {subtasks.length > 0 && (
              <div className="space-y-1 mb-2">
                {subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/50 transition-colors"
                  >
                    <button
                      onClick={() => handleToggleSubtask(subtask.id)}
                      className="shrink-0"
                    >
                      {subtask.completed ? (
                        <CheckSquare className="h-4 w-4 text-completed" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <span
                      className={cn(
                        'flex-1 text-sm',
                        subtask.completed && 'line-through text-muted-foreground'
                      )}
                    >
                      {subtask.title}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(subtask.id)}
                      className="opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleAddSubtask();
              }}
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Add subtask..."
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
              />
            </form>
          </div>

          {/* Notes section */}
          {isMultiDay ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block">
                Daily Notes & Reflections
              </label>
              <div className="space-y-4">
                {dayDates.map((dateStr) => (
                  <div key={dateStr}>
                    <div className="px-1 py-1.5">
                      <h4 className="text-xs font-semibold text-foreground">
                        {formatDateHeading(dateStr)}
                      </h4>
                    </div>
                    <RichTextEditor
                      content={getNoteForDate(dateStr)}
                      onChange={(html) => handleDailyNoteChange(dateStr, html)}
                      onBlur={handleDailyNoteBlur}
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
              <RichTextEditor
                content={description}
                onChange={setDescription}
                onBlur={handleBlurDescription}
                placeholder="Log what you achieved, reflections, or notes on closing out this task..."
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border/40 flex items-center gap-2 shrink-0">
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
              hasUnsavedChanges
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            )}
          >
            <Save className="h-4 w-4" />
            {hasUnsavedChanges ? 'Save' : 'Saved'}
          </button>
          <button
            onClick={() => onComplete(task.id!)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
              isCompleted
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                : 'bg-completed text-completed-foreground hover:bg-completed/90'
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isCompleted ? 'Undo' : 'Complete'}
          </button>
          <button
            onClick={() => {
              onDelete(task.id!);
              onClose();
            }}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete task"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Resize handle (bottom-right corner) */}
        {!isFullscreen && (
          <div
            onMouseDown={handleResizeStart}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            style={{
              background: 'linear-gradient(135deg, transparent 50%, hsl(var(--border)) 50%)',
              borderRadius: '0 0 0.75rem 0',
            }}
          />
        )}
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
