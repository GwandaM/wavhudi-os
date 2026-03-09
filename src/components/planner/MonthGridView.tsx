import { useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
  isPast,
  startOfDay,
  differenceInCalendarDays,
} from 'date-fns';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sortByPriority } from '@/lib/priority';
import { parseTaskInput } from '@/lib/parseTaskInput';
import type { Task, Priority, Project } from '@/lib/db';

interface MonthGridViewProps {
  today: Date;
  getTasksForDate: (dateStr: string) => Task[];
  onTaskClick: (task: Task) => void;
  onCompleteTask: (id: number) => void;
  onAddTask: (title: string, dateStr: string, priority?: Priority, estimated_minutes?: number | null) => void;
  projects?: Project[];
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Priority → left-border + background tint
const PRIORITY_STYLES: Record<Priority, { border: string; bg: string; text: string }> = {
  urgent: {
    border: 'border-l-red-500',
    bg: 'bg-red-500/8 dark:bg-red-500/12',
    text: 'text-red-700 dark:text-red-300',
  },
  high: {
    border: 'border-l-orange-400',
    bg: 'bg-orange-400/8 dark:bg-orange-400/12',
    text: 'text-orange-700 dark:text-orange-300',
  },
  medium: {
    border: 'border-l-blue-400',
    bg: 'bg-blue-400/8 dark:bg-blue-400/12',
    text: 'text-blue-700 dark:text-blue-300',
  },
  low: {
    border: 'border-l-slate-400',
    bg: 'bg-slate-400/8 dark:bg-slate-400/12',
    text: 'text-slate-600 dark:text-slate-400',
  },
  none: {
    border: 'border-l-border',
    bg: 'bg-secondary/50',
    text: 'text-foreground',
  },
};

/** Compact draggable task pill for the month grid */
function MonthTaskPill({
  task,
  onTaskClick,
  onComplete,
  project,
}: {
  task: Task;
  onTaskClick: (task: Task) => void;
  onComplete: (id: number) => void;
  project?: Project | null;
}) {
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
  const ps = PRIORITY_STYLES[priority];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onTaskClick(task)}
      className={cn(
        'group flex items-center gap-1 rounded-[4px] border-l-[3px] px-1.5 py-[3px] mb-[2px]',
        'cursor-grab active:cursor-grabbing touch-none select-none',
        'transition-all duration-100',
        'hover:shadow-sm hover:brightness-95 dark:hover:brightness-110',
        ps.border,
        isCompleted ? 'bg-muted/30 opacity-50' : ps.bg,
        isDragging && 'shadow-lg ring-1 ring-primary/20 rotate-[1deg] opacity-80 z-10',
      )}
    >
      {/* Mini checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (task.id) onComplete(task.id);
        }}
        className={cn(
          'shrink-0 h-3 w-3 rounded-[3px] border flex items-center justify-center transition-colors',
          isCompleted
            ? 'border-completed bg-completed text-completed-foreground'
            : 'border-muted-foreground/25 hover:border-primary/50',
        )}
      >
        {isCompleted && <Check className="h-2 w-2" />}
      </button>

      {/* Project dot */}
      {project && (
        <span
          className="shrink-0 h-[6px] w-[6px] rounded-full"
          style={{ backgroundColor: project.color }}
        />
      )}

      {/* Title */}
      <span
        className={cn(
          'flex-1 truncate text-[11px] leading-tight font-medium',
          isCompleted ? 'line-through text-muted-foreground' : ps.text,
        )}
      >
        {task.title}
      </span>
    </div>
  );
}

/** Inline add-task for month cells */
function MonthAddTask({ onAdd }: { onAdd: (title: string, priority?: Priority, estimated_minutes?: number | null) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [value, setValue] = useState('');

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full flex items-center gap-1 px-1.5 py-[2px] rounded-[4px] text-[10px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <Plus className="h-2.5 w-2.5" />
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const { title, priority, estimated_minutes } = parseTaskInput(value);
        if (!title.trim()) return;
        onAdd(title.trim(), priority, estimated_minutes);
        setValue('');
        setIsAdding(false);
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (!value.trim()) setIsAdding(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setValue('');
            setIsAdding(false);
          }
        }}
        placeholder="Add task..."
        className="w-full text-[11px] bg-muted/20 rounded-[4px] px-1.5 py-[3px] outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/30"
      />
    </form>
  );
}

function MonthDayCell({
  date,
  isCurrentMonth,
  tasks,
  onTaskClick,
  onCompleteTask,
  onAddTask,
  projects,
}: {
  date: Date;
  isCurrentMonth: boolean;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onCompleteTask: (id: number) => void;
  onAddTask: (title: string, priority?: Priority, estimated_minutes?: number | null) => void;
  projects?: Project[];
}) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const todayFlag = isToday(date);
  const pastDay = isPast(startOfDay(date)) && !todayFlag;

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateStr}`,
    data: { date: dateStr },
  });

  const sortedTasks = useMemo(() => sortByPriority(tasks), [tasks]);
  const incompleteTasks = sortedTasks.filter(t => t.status !== 'completed');
  const completedTasks = sortedTasks.filter(t => t.status === 'completed');
  const taskIds = sortedTasks.map(t => `task-${t.id}`);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'border-b border-r border-border/10 flex flex-col transition-colors',
        isCurrentMonth ? 'bg-card/80' : 'bg-muted/5',
        !isCurrentMonth && 'opacity-35',
        pastDay && isCurrentMonth && 'opacity-70',
        todayFlag && 'bg-today/25',
        isOver && 'bg-primary/5',
      )}
    >
      {/* Day number */}
      <div className="flex items-center justify-between px-1.5 pt-1 pb-0.5 shrink-0">
        <span
          className={cn(
            'text-[11px] leading-none font-medium',
            todayFlag && 'bg-primary text-primary-foreground rounded-full min-w-[20px] h-5 flex items-center justify-center text-[10px] font-semibold',
            !isCurrentMonth && 'text-muted-foreground/30',
            isCurrentMonth && !todayFlag && 'text-muted-foreground/70',
          )}
        >
          {format(date, 'd')}
        </span>
      </div>

      {/* Tasks */}
      <div className="flex-1 px-1 overflow-y-auto scrollbar-thin min-h-0">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {incompleteTasks.map((task) => {
            const project = task.project_id ? projects?.find(p => p.id === task.project_id) : null;
            return (
              <MonthTaskPill
                key={task.id}
                task={task}
                onTaskClick={onTaskClick}
                onComplete={onCompleteTask}
                project={project}
              />
            );
          })}
        </SortableContext>

        {completedTasks.length > 0 && (
          <>
            {completedTasks.map((task) => {
              const project = task.project_id ? projects?.find(p => p.id === task.project_id) : null;
              return (
                <MonthTaskPill
                  key={task.id}
                  task={task}
                  onTaskClick={onTaskClick}
                  onComplete={onCompleteTask}
                  project={project}
                />
              );
            })}
          </>
        )}
      </div>

      {/* Add task */}
      {isCurrentMonth && (
        <div className="px-1 pb-1 shrink-0">
          <MonthAddTask onAdd={onAddTask} />
        </div>
      )}
    </div>
  );
}

export function MonthGridView({
  today,
  getTasksForDate,
  onTaskClick,
  onCompleteTask,
  onAddTask,
  projects,
}: MonthGridViewProps) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const totalDays = differenceInCalendarDays(calEnd, calStart) + 1;
    return Array.from({ length: totalDays }, (_, i) => addDays(calStart, i));
  }, [today]);

  const weekRows = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7));
    }
    return rows;
  }, [calendarDays]);

  return (
    <div className="flex flex-col h-full">
      {/* Weekday header */}
      <div className="grid grid-cols-7 shrink-0 border-b border-border/20">
        {WEEKDAY_LABELS.map((day) => (
          <div
            key={day}
            className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider text-center py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid — each row is equal height */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {weekRows.map((week, rowIdx) => (
          <div key={rowIdx} className="flex-1 grid grid-cols-7 min-h-0 overflow-hidden">
            {week.map((date) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const tasks = getTasksForDate(dateStr);
              const isCurrentMonth = isSameMonth(date, today);

              return (
                <MonthDayCell
                  key={dateStr}
                  date={date}
                  isCurrentMonth={isCurrentMonth}
                  tasks={tasks}
                  onTaskClick={onTaskClick}
                  onCompleteTask={onCompleteTask}
                  onAddTask={(title, priority, estimated_minutes) =>
                    onAddTask(title, dateStr, priority, estimated_minutes)
                  }
                  projects={projects}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
