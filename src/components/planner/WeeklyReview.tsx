import { useState, useEffect, useMemo } from 'react';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { BarChart3, CheckCircle2, Clock, TrendingUp, Target, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DatabaseService } from '@/services/DatabaseService';
import { formatMinutes, PRIORITY_LABELS } from '@/lib/priority';
import type { Task, Project, Priority } from '@/lib/db';

interface WeeklyReviewProps {
  projects: Project[];
  onClose: () => void;
}

interface DayStat {
  date: string;
  label: string;
  total: number;
  completed: number;
  estimatedMinutes: number;
  actualMinutes: number;
}

export function WeeklyReview({ projects, onClose }: WeeklyReviewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);
  const weekEnd = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);

  useEffect(() => {
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');
    DatabaseService.getTasksInDateRange(startStr, endStr).then((t) => {
      setTasks(t);
      setLoading(false);
    });
  }, [weekStart, weekEnd]);

  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const dayStats: DayStat[] = useMemo(() => {
    return days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayTasks = tasks.filter(t => t.start_date === dateStr);
      return {
        date: dateStr,
        label: format(day, 'EEE'),
        total: dayTasks.length,
        completed: dayTasks.filter(t => t.status === 'completed').length,
        estimatedMinutes: dayTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0),
        actualMinutes: dayTasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0),
      };
    });
  }, [days, tasks]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
  const totalActual = tasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
  const estimateAccuracy = totalEstimated > 0 && totalActual > 0
    ? Math.round((totalActual / totalEstimated) * 100)
    : null;

  // Tasks by priority
  const priorityCounts = useMemo(() => {
    const counts: Record<Priority, number> = { urgent: 0, high: 0, medium: 0, low: 0, none: 0 };
    tasks.forEach(t => {
      counts[t.priority || 'none']++;
    });
    return counts;
  }, [tasks]);

  // Tasks by project
  const projectStats = useMemo(() => {
    const map = new Map<number | null, { name: string; color: string; count: number; completed: number }>();
    tasks.forEach(t => {
      const pid = t.project_id;
      if (!map.has(pid)) {
        const project = pid ? projects.find(p => p.id === pid) : null;
        map.set(pid, {
          name: project?.name || 'No project',
          color: project?.color || '#94a3b8',
          count: 0,
          completed: 0,
        });
      }
      const stat = map.get(pid)!;
      stat.count++;
      if (t.status === 'completed') stat.completed++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [tasks, projects]);

  const maxDayTasks = Math.max(...dayStats.map(d => d.total), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-muted-foreground">Loading review...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Weekly Review</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(weekStart, 'MMM d')} — {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-secondary"
        >
          Close
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-xs font-medium text-muted-foreground">Completion</span>
          </div>
          <p className="text-2xl font-bold">{completionRate}%</p>
          <p className="text-xs text-muted-foreground">{completedTasks}/{totalTasks} tasks</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">Time Planned</span>
          </div>
          <p className="text-2xl font-bold">{formatMinutes(totalEstimated) || '0m'}</p>
          <p className="text-xs text-muted-foreground">estimated</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-medium text-muted-foreground">Time Logged</span>
          </div>
          <p className="text-2xl font-bold">{formatMinutes(totalActual) || '0m'}</p>
          <p className="text-xs text-muted-foreground">actual</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-medium text-muted-foreground">Accuracy</span>
          </div>
          <p className="text-2xl font-bold">{estimateAccuracy !== null ? `${estimateAccuracy}%` : '—'}</p>
          <p className="text-xs text-muted-foreground">
            {estimateAccuracy !== null
              ? estimateAccuracy <= 100 ? 'under estimated' : 'over estimated'
              : 'no data'}
          </p>
        </div>
      </div>

      {/* Daily completion chart */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">Daily Activity</h3>
        <div className="flex items-end gap-2 h-32">
          {dayStats.map((day) => {
            const totalHeight = (day.total / maxDayTasks) * 100;
            const completedHeight = day.total > 0
              ? (day.completed / day.total) * totalHeight
              : 0;
            const isToday = day.date === format(today, 'yyyy-MM-dd');

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center justify-end h-24 relative">
                  <div
                    className="w-full rounded-t bg-muted/60 absolute bottom-0"
                    style={{ height: `${totalHeight}%` }}
                  />
                  <div
                    className="w-full rounded-t bg-primary absolute bottom-0"
                    style={{ height: `${completedHeight}%` }}
                  />
                </div>
                <span className={cn(
                  'text-[10px] font-medium',
                  isToday ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {day.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {day.completed}/{day.total}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded bg-primary" /> Completed
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded bg-muted/60" /> Total
          </div>
        </div>
      </div>

      {/* Priority breakdown + Project breakdown side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Priority breakdown */}
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">By Priority</h3>
          <div className="space-y-2">
            {(['urgent', 'high', 'medium', 'low', 'none'] as Priority[]).map((p) => {
              const count = priorityCounts[p];
              if (count === 0) return null;
              const width = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
              const colors: Record<Priority, string> = {
                urgent: 'bg-red-500',
                high: 'bg-orange-500',
                medium: 'bg-blue-500',
                low: 'bg-slate-400',
                none: 'bg-muted-foreground/30',
              };
              return (
                <div key={p} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-14">{PRIORITY_LABELS[p]}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div className={cn('h-full rounded-full', colors[p])} style={{ width: `${width}%` }} />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Project breakdown */}
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            By Project
          </h3>
          <div className="space-y-2">
            {projectStats.map((stat) => (
              <div key={stat.name} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: stat.color }}
                />
                <span className="text-xs text-muted-foreground flex-1 truncate">{stat.name}</span>
                <span className="text-xs font-medium">
                  {stat.completed}/{stat.count}
                </span>
              </div>
            ))}
            {projectStats.length === 0 && (
              <p className="text-xs text-muted-foreground">No tasks this week</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
