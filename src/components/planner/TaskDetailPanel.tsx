import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Trash2, Calendar, Plus, Square, CheckSquare, Pin, Maximize2, Minimize2, Save, GripHorizontal, ChevronDown, ChevronRight } from 'lucide-react';
import { format, addDays, differenceInCalendarDays, parse } from 'date-fns';
import type { Task, DailyNote, Priority, Project, Subtask } from '@/lib/db';
import { cn } from '@/lib/utils';
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
const DEFAULT_HEIGHT = 620;

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Priority: Urgent' },
  { value: 'high', label: 'Priority: High' },
  { value: 'medium', label: 'Priority: Medium' },
  { value: 'low', label: 'Priority: Low' },
  { value: 'none', label: 'Priority: None' },
];

const TIME_OPTIONS = [
  { value: 0, label: 'Estimate: None' },
  { value: 15, label: 'Estimate: 15 min' },
  { value: 30, label: 'Estimate: 30 min' },
  { value: 60, label: 'Estimate: 1 hour' },
  { value: 120, label: 'Estimate: 2 hours' },
  { value: 240, label: 'Estimate: 4 hours' },
  { value: 480, label: 'Estimate: 8 hours' },
];

const RECURRENCE_OPTIONS = [
  { value: '', label: 'Repeat: None' },
  { value: 'daily', label: 'Repeat: Daily' },
  { value: 'weekdays', label: 'Repeat: Weekdays' },
  { value: 'weekly', label: 'Repeat: Weekly' },
  { value: 'biweekly', label: 'Repeat: Biweekly' },
  { value: 'monthly', label: 'Repeat: Monthly' },
];

export function TaskDetailPanel({ task, projects = [], onClose, onUpdate, onComplete, onDelete }: TaskDetailPanelProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dailyNotes, setDailyNotes] = useState<DailyNote[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);

  // Window position & size
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const [size, setSize] = useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
  const windowRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (task && pos.x === -1) {
      const x = Math.max(40, Math.round((window.innerWidth - size.w) / 2));
      const y = Math.max(40, Math.round((window.innerHeight - size.h) / 2));
      setPos({ x, y });
    }
  }, [task]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isFullscreen) return;
    e.preventDefault();
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    const handleMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      setPos({
        x: Math.max(0, Math.min(ev.clientX - dragOffset.current.x, window.innerWidth - 100)),
        y: Math.max(0, Math.min(ev.clientY - dragOffset.current.y, window.innerHeight - 50)),
      });
    };
    const handleUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [pos, isFullscreen]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isFullscreen) return;
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    const startX = e.clientX, startY = e.clientY;
    const startW = size.w, startH = size.h;
    const handleMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      setSize({
        w: Math.max(MIN_WIDTH, startW + (ev.clientX - startX)),
        h: Math.max(MIN_HEIGHT, startH + (ev.clientY - startY)),
      });
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
    return Array.from({ length: count }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
  }, [task?.start_date, task?.end_date, isMultiDay]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setDailyNotes(task.daily_notes || []);
      setSubtasks((task.subtasks || []).sort((a, b) => a.order_index - b.order_index));
      setNewSubtaskTitle('');
      setShowSubtasks((task.subtasks || []).length > 0);
    }
  }, [task]);

  if (!task) return null;

  const handleBlurTitle = () => {
    if (title !== task.title) onUpdate(task.id!, { title });
  };

  const handleBlurDescription = () => {
    if (description !== task.description) onUpdate(task.id!, { description });
  };

  const getNoteForDate = (date: string) => dailyNotes.find(n => n.date === date)?.content || '';

  const handleDailyNoteChange = (date: string, content: string) => {
    setDailyNotes(prev => {
      const existing = prev.find(n => n.date === date);
      if (existing) return prev.map(n => n.date === date ? { ...n, content } : n);
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
    if (JSON.stringify(dailyNotes) !== JSON.stringify(task.daily_notes || [])) changes.daily_notes = dailyNotes;
    if (Object.keys(changes).length > 0) await onUpdate(task.id, changes);
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const updated = [...subtasks, { id: Date.now(), title: newSubtaskTitle.trim(), completed: false, order_index: subtasks.length }];
    setSubtasks(updated);
    setNewSubtaskTitle('');
    onUpdate(task.id!, { subtasks: updated });
  };

  const handleToggleSubtask = (subtaskId: number) => {
    const updated = subtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
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
    if (currentTags.includes(tag)) { setNewTag(''); return; }
    onUpdate(task.id!, { tags: [...currentTags, tag] });
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    onUpdate(task.id!, { tags: (task.tags || []).filter(t => t !== tag) });
  };

  const formatDateHeading = (dateStr: string) => format(parse(dateStr, 'yyyy-MM-dd', new Date()), 'EEEE, MMM d');

  const isCompleted = task.status === 'completed';
  const currentProject = projects.find(p => p.id === task.project_id);

  const selectClass = 'h-7 rounded-md border border-border/40 bg-secondary/30 px-2 text-[12px] font-medium outline-none focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer';

  const windowStyle: React.CSSProperties = isFullscreen
    ? { position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 50 }
    : { position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: 50 };

  const panel = (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      <div
        ref={windowRef}
        style={windowStyle}
        className={cn(
          'flex flex-col bg-background border border-border/60 shadow-2xl overflow-hidden',
          isFullscreen ? 'rounded-none' : 'rounded-xl',
        )}
      >
        {/* Title bar */}
        <div
          onMouseDown={handleDragStart}
          className={cn(
            'flex items-center justify-between px-5 py-2.5 border-b border-border/40 select-none shrink-0',
            !isFullscreen && 'cursor-grab active:cursor-grabbing',
          )}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-muted-foreground/30" />
            <h2 className="text-[12px] font-medium text-muted-foreground">Task Details</h2>
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
          {/* ─── Header zone (compact) ─── */}
          <div className="px-5 pt-4 pb-3 space-y-3">
            {/* Title */}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleBlurTitle}
              className="w-full text-[17px] font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
              placeholder="Task title..."
            />

            {/* Metadata row: status, pin, date */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                isCompleted ? 'bg-completed/10 text-completed'
                  : task.status === 'backlog' ? 'bg-secondary text-secondary-foreground'
                  : 'bg-accent text-accent-foreground'
              )}>
                {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
              </span>
              <button
                onClick={() => onUpdate(task.id!, { is_pinned: !task.is_pinned })}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                  task.is_pinned ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                <Pin className={cn('h-2.5 w-2.5', task.is_pinned && '-rotate-45')} />
                {task.is_pinned ? 'Pinned' : 'Pin'}
              </button>
              {task.start_date && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {task.start_date}
                  {task.end_date && task.end_date !== task.start_date && <>&nbsp;&rarr;&nbsp;{task.end_date}</>}
                </span>
              )}
            </div>

            {/* ─── Dropdown row: priority, time, repeat, project ─── */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Priority */}
              <select
                value={task.priority || 'none'}
                onChange={(e) => onUpdate(task.id!, { priority: e.target.value as Priority })}
                className={selectClass}
              >
                {PRIORITY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Time estimate */}
              <select
                value={task.estimated_minutes ?? 0}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  onUpdate(task.id!, { estimated_minutes: v || null });
                }}
                className={selectClass}
              >
                {TIME_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Recurrence */}
              {!task.recurrence_parent_id && (
                <select
                  value={task.recurrence_rule?.frequency ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    onUpdate(task.id!, {
                      recurrence_rule: v ? { frequency: v as any, end_date: task.recurrence_rule?.end_date } : null,
                    });
                  }}
                  className={selectClass}
                >
                  {RECURRENCE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}

              {/* Project */}
              {projects.length > 0 && (
                <select
                  value={task.project_id ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    onUpdate(task.id!, { project_id: v ? Number(v) : null });
                  }}
                  className={selectClass}
                >
                  <option value="">Project: None</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>Project: {p.name}</option>
                  ))}
                </select>
              )}

              {/* Actual time — inline */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={task.actual_minutes ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    onUpdate(task.id!, { actual_minutes: val });
                  }}
                  placeholder="Actual min"
                  className="w-20 h-7 rounded-md border border-border/40 bg-secondary/30 px-2 text-[12px] outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Tags — inline */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(task.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium"
                >
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-2 w-2" />
                  </button>
                </span>
              ))}
              <form className="inline-flex" onSubmit={(e) => { e.preventDefault(); handleAddTag(); }}>
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="+ tag"
                  className="text-[11px] bg-transparent outline-none placeholder:text-muted-foreground/30 w-14"
                />
              </form>
            </div>
          </div>

          {/* ─── Divider ─── */}
          <div className="border-t border-border/30" />

          {/* ─── Notes section (prominent) ─── */}
          <div className="px-5 pt-3 pb-4">
            {isMultiDay ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                  Daily Notes
                </label>
                <div className="space-y-3">
                  {dayDates.map((dateStr) => (
                    <div key={dateStr}>
                      <h4 className="text-[11px] font-semibold text-muted-foreground mb-1">
                        {formatDateHeading(dateStr)}
                      </h4>
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
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                  Notes & Reflections
                </label>
                <RichTextEditor
                  content={description}
                  onChange={setDescription}
                  onBlur={handleBlurDescription}
                  placeholder="Log what you achieved, reflections, or notes..."
                />
              </div>
            )}
          </div>

          {/* ─── Subtasks (collapsible) ─── */}
          <div className="px-5 pb-4">
            <button
              onClick={() => setShowSubtasks(!showSubtasks)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              {showSubtasks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Subtasks
              {subtasks.length > 0 && (
                <span className="text-muted-foreground/50">
                  ({subtasks.filter(s => s.completed).length}/{subtasks.length})
                </span>
              )}
            </button>

            {showSubtasks && (
              <div className="space-y-1 pl-1">
                {subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary/50 transition-colors"
                  >
                    <button onClick={() => handleToggleSubtask(subtask.id)} className="shrink-0">
                      {subtask.completed
                        ? <CheckSquare className="h-3.5 w-3.5 text-completed" />
                        : <Square className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                    </button>
                    <span className={cn('flex-1 text-[13px]', subtask.completed && 'line-through text-muted-foreground')}>
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
                <form className="flex items-center gap-2 px-2" onSubmit={(e) => { e.preventDefault(); handleAddSubtask(); }}>
                  <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                  <input
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add subtask..."
                    className="flex-1 text-[13px] bg-transparent outline-none placeholder:text-muted-foreground/30"
                  />
                </form>
              </div>
            )}
          </div>
        </div>

        {/* ─── Actions bar ─── */}
        <div className="px-4 py-3 border-t border-border/40 flex items-center gap-2 shrink-0">
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
              hasUnsavedChanges
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            )}
          >
            <Save className="h-3.5 w-3.5" />
            {hasUnsavedChanges ? 'Save' : 'Saved'}
          </button>
          <button
            onClick={() => onComplete(task.id!)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
              isCompleted
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                : 'bg-completed text-completed-foreground hover:bg-completed/90'
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isCompleted ? 'Undo' : 'Complete'}
          </button>
          <button
            onClick={() => { onDelete(task.id!); onClose(); }}
            className="flex items-center justify-center rounded-lg px-3 py-2 text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete task"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Resize handle */}
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
