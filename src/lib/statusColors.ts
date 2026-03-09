import type { Task } from './db';

export type ProgressColor = 'not-started' | 'in-progress' | 'completed' | 'overdue';

/**
 * Returns the progress color key for a task based on:
 * - Green: completed
 * - Red: urgent/high priority AND not completed
 * - Orange: in progress (non-priority)
 * - Yellow: not started (non-priority)
 */
export function getProgressColor(task: Task): ProgressColor {
  if (task.status === 'completed') return 'completed';

  const isHighPriority = task.priority === 'urgent' || task.priority === 'high';
  if (isHighPriority) return 'overdue';

  if (task.status === 'in_progress') return 'in-progress';

  return 'not-started';
}

/** Tailwind classes for progress status badges */
export const PROGRESS_BADGE: Record<ProgressColor, string> = {
  'not-started': 'bg-progress-not-started/15 text-progress-not-started',
  'in-progress': 'bg-progress-in-progress/15 text-progress-in-progress',
  'completed': 'bg-progress-completed/15 text-progress-completed',
  'overdue': 'bg-progress-overdue/15 text-progress-overdue',
};

/** Left border color for month grid pills */
export const PROGRESS_BORDER: Record<ProgressColor, string> = {
  'not-started': 'border-l-progress-not-started',
  'in-progress': 'border-l-progress-in-progress',
  'completed': 'border-l-progress-completed',
  'overdue': 'border-l-progress-overdue',
};

/** Subtle background tint for month grid pills */
export const PROGRESS_BG: Record<ProgressColor, string> = {
  'not-started': 'bg-progress-not-started/8',
  'in-progress': 'bg-progress-in-progress/8',
  'completed': 'bg-progress-completed/8',
  'overdue': 'bg-progress-overdue/8',
};

/** Dot color for task cards */
export const PROGRESS_DOT: Record<ProgressColor, string> = {
  'not-started': 'bg-progress-not-started',
  'in-progress': 'bg-progress-in-progress',
  'completed': 'bg-progress-completed',
  'overdue': 'bg-progress-overdue',
};

/** User-facing labels */
export const PROGRESS_LABELS: Record<string, string> = {
  'backlog': 'Backlog',
  'scheduled': 'Not Yet Started',
  'in_progress': 'In Progress',
  'completed': 'Completed',
};
