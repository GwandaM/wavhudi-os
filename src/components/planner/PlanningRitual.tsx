import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Sunrise, ArrowRight, CheckCircle2, Calendar, Inbox, PenLine, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DatabaseService } from '@/services/DatabaseService';
import { formatMinutes } from '@/lib/priority';
import type { Task, DailyJournal } from '@/lib/db';

interface PlanningRitualProps {
  todayStr: string;
  tasks: Task[];
  journal: DailyJournal | null;
  onUpdateJournal: (changes: Partial<Omit<DailyJournal, 'id' | 'date' | 'created_at'>>) => Promise<DailyJournal>;
  onMoveTask: (id: number, date: string, newIndex: number) => Promise<void>;
  onComplete: () => void;
  onClose: () => void;
  getTasksForDate: (date: string) => Task[];
}

type Step = 'rollover' | 'calendar' | 'backlog' | 'intention' | 'confirm';
const STEPS: Step[] = ['rollover', 'calendar', 'backlog', 'intention', 'confirm'];

export function PlanningRitual({
  todayStr,
  tasks,
  journal,
  onUpdateJournal,
  onMoveTask,
  onComplete,
  onClose,
  getTasksForDate,
}: PlanningRitualProps) {
  const [step, setStep] = useState<Step>('rollover');
  const [rolloverTasks, setRolloverTasks] = useState<Task[]>([]);
  const [intention, setIntention] = useState(journal?.intention || '');
  const [selectedRollovers, setSelectedRollovers] = useState<Set<number>>(new Set());

  useEffect(() => {
    DatabaseService.getIncompleteTasksBefore(todayStr).then(setRolloverTasks);
  }, [todayStr]);

  const stepIndex = STEPS.indexOf(step);
  const todayTasks = getTasksForDate(todayStr);
  const plannedMinutes = todayTasks
    .filter(t => t.status !== 'completed')
    .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

  const backlogTasks = tasks.filter(t => t.status === 'backlog');

  const handleNext = async () => {
    if (step === 'rollover') {
      // Move selected rollover tasks to today
      for (const id of selectedRollovers) {
        await onMoveTask(id, todayStr, todayTasks.length);
      }
      setStep('calendar');
    } else if (step === 'calendar') {
      setStep('backlog');
    } else if (step === 'backlog') {
      setStep('intention');
    } else if (step === 'intention') {
      if (intention.trim()) {
        await onUpdateJournal({ intention: intention.trim() });
      }
      setStep('confirm');
    } else if (step === 'confirm') {
      onComplete();
    }
  };

  const toggleRollover = (id: number) => {
    setSelectedRollovers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="w-full max-w-lg mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Sunrise className="h-8 w-8 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Morning Planning</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(todayStr), 'EEEE, MMMM d')}
          </p>
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  i <= stepIndex ? 'bg-primary' : 'bg-secondary'
                )}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="rounded-xl border bg-card p-6 min-h-[300px] space-y-4">
          {step === 'rollover' && (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Yesterday's Unfinished</h2>
              </div>
              {rolloverTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  All caught up! No incomplete tasks from previous days.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Select tasks to bring to today:
                  </p>
                  {rolloverTasks.map(task => (
                    <label
                      key={task.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                        selectedRollovers.has(task.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-secondary/50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRollovers.has(task.id)}
                        onChange={() => toggleRollover(task.id)}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          From {task.start_date}
                          {task.estimated_minutes ? ` · ${formatMinutes(task.estimated_minutes)}` : ''}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'calendar' && (
            <>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Today's Calendar</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Review your scheduled events for today. Consider blocking time for deep work.
              </p>
              <div className="rounded-lg border bg-secondary/20 p-4 text-center text-sm text-muted-foreground">
                Calendar integration coming soon.
                <br />
                Check your calendar manually before continuing.
              </div>
            </>
          )}

          {step === 'backlog' && (
            <>
              <div className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Pull from Backlog</h2>
              </div>
              {backlogTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Backlog is empty. You can add tasks from the sidebar after planning.
                </p>
              ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto scrollbar-thin">
                  <p className="text-sm text-muted-foreground">
                    Drag or click tasks to schedule for today:
                  </p>
                  {backlogTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={async () => {
                        await onMoveTask(task.id, todayStr, todayTasks.length);
                      }}
                      className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        {task.estimated_minutes && (
                          <p className="text-xs text-muted-foreground">
                            {formatMinutes(task.estimated_minutes)}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'intention' && (
            <>
              <div className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Set Your Intention</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                What's the one thing that would make today a success?
              </p>
              <textarea
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                rows={4}
                className="w-full rounded-lg border bg-secondary/30 p-3 text-sm resize-none outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20"
                placeholder="Today I will..."
                autoFocus
              />
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Ready to Go!</h2>
              </div>
              <div className="space-y-3 py-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tasks for today</span>
                  <span className="font-medium">{todayTasks.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Planned time</span>
                  <span className="font-medium">{formatMinutes(plannedMinutes) || '—'}</span>
                </div>
                {intention.trim() && (
                  <div className="rounded-lg border bg-primary/5 p-3 mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Intention</p>
                    <p className="text-sm italic">"{intention.trim()}"</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {step === 'confirm' ? "Let's go!" : 'Next'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
