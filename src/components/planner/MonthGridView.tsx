import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
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
  differenceInCalendarDays,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import { AddTaskInput } from './AddTaskInput';
import { sortByPriority } from '@/lib/priority';
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
        'border border-border/15 flex flex-col transition-colors overflow-hidden',
        isCurrentMonth ? 'bg-card' : 'bg-muted/10 opacity-50',
        todayFlag && 'bg-today/30 ring-1 ring-inset ring-today-border/30',
        isOver && 'bg-primary/5 ring-1 ring-inset ring-primary/30',
      )}
    >
      {/* Day header */}
      <div className="flex items-center justify-between px-1.5 py-1 shrink-0">
        <span
          className={cn(
            'text-[11px] font-medium leading-none',
            todayFlag && 'bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px]',
            !isCurrentMonth && 'text-muted-foreground/40',
            isCurrentMonth && !todayFlag && 'text-muted-foreground',
          )}
        >
          {format(date, 'd')}
        </span>
        {tasks.length > 0 && (
          <span className="text-[9px] text-muted-foreground/60">{tasks.length}</span>
        )}
      </div>

      {/* Task area — scrollable */}
      <div className="flex-1 px-0.5 pb-0.5 overflow-y-auto scrollbar-thin min-h-0">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {incompleteTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              onComplete={onCompleteTask}
              isMultiDay={!!task.end_date && task.end_date !== task.start_date}
              projects={projects}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && isCurrentMonth && (
          <div className="flex items-center justify-center h-8 text-[10px] text-muted-foreground/30">
            Drop here
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="pt-1 mt-1 border-t border-border/15">
            <p className="text-[9px] font-medium text-muted-foreground/50 mb-0.5 px-1">
              Done ({completedTasks.length})
            </p>
            {completedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
                onComplete={onCompleteTask}
                isMultiDay={!!task.end_date && task.end_date !== task.start_date}
                projects={projects}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add task */}
      {isCurrentMonth && (
        <div className="px-0.5 pb-1 shrink-0">
          <AddTaskInput onAdd={onAddTask} placeholder="+ Add..." />
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

  return (
    <div className="flex flex-col h-full">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border/20 shrink-0">
        {WEEKDAY_LABELS.map((day) => (
          <div
            key={day}
            className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto scrollbar-thin min-h-0">
        {calendarDays.map((date) => {
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
    </div>
  );
}
