import { useState } from 'react';
import { format } from 'date-fns';
import { Sunset, ArrowRight, CheckCircle2, PenLine, Moon, CalendarPlus, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/priority';
import type { Task, DailyJournal } from '@/lib/db';

interface ShutdownRitualProps {
  todayStr: string;
  todayTasks: Task[];
  journal: DailyJournal | null;
  onUpdateJournal: (changes: Partial<Omit<DailyJournal, 'id' | 'date' | 'created_at'>>) => Promise<DailyJournal>;
  onMoveTask: (id: number, date: string, newIndex: number) => Promise<void>;
  onMoveToBacklog: (id: number) => Promise<void>;
  onComplete: () => void;
  onClose: () => void;
}

type Step = 'review' | 'incomplete' | 'reflection' | 'summary';
const STEPS: Step[] = ['review', 'incomplete', 'reflection', 'summary'];

export function ShutdownRitual({
  todayStr,
  todayTasks,
  journal,
  onUpdateJournal,
  onMoveTask,
  onMoveToBacklog,
  onComplete,
  onClose,
}: ShutdownRitualProps) {
  const [step, setStep] = useState<Step>('review');
  const [reflection, setReflection] = useState(journal?.reflection || '');

  const stepIndex = STEPS.indexOf(step);
  const completedTasks = todayTasks.filter(t => t.status === 'completed');
  const incompleteTasks = todayTasks.filter(t => t.status === 'scheduled');
  const totalEstimated = todayTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

  // Compute tomorrow's date string
  const tomorrow = new Date(todayStr);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

  const handleNext = async () => {
    if (step === 'review') {
      setStep(incompleteTasks.length > 0 ? 'incomplete' : 'reflection');
    } else if (step === 'incomplete') {
      setStep('reflection');
    } else if (step === 'reflection') {
      if (reflection.trim()) {
        await onUpdateJournal({ reflection: reflection.trim() });
      }
      setStep('summary');
    } else if (step === 'summary') {
      onComplete();
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="w-full max-w-lg mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Sunset className="h-8 w-8 text-accent-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Shutdown Ritual</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(todayStr), 'EEEE, MMMM d')}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  i <= stepIndex ? 'bg-accent-foreground' : 'bg-secondary'
                )}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="rounded-xl border bg-card p-6 min-h-[300px] space-y-4">
          {step === 'review' && (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-completed" />
                <h2 className="text-lg font-semibold">Today's Review</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="rounded-lg border bg-completed/5 p-3 text-center">
                  <p className="text-2xl font-bold text-completed">{completedTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="rounded-lg border bg-secondary/50 p-3 text-center">
                  <p className="text-2xl font-bold">{incompleteTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>
              </div>
              {completedTasks.length > 0 && (
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto scrollbar-thin">
                  {completedTasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 rounded-md border border-completed/15 bg-completed/5 px-2.5 py-1.5 text-sm text-completed"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-completed shrink-0" />
                      <span className="truncate font-medium">{task.title}</span>
                    </div>
                  ))}
                </div>
              )}
              {totalEstimated > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total planned: {formatMinutes(totalEstimated)}
                </p>
              )}
            </>
          )}

          {step === 'incomplete' && (
            <>
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Handle Incomplete Tasks</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Choose what to do with each unfinished task:
              </p>
              <div className="space-y-3 max-h-[250px] overflow-y-auto scrollbar-thin">
                {incompleteTasks.map(task => (
                  <div key={task.id} className="rounded-lg border p-3 space-y-2">
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onMoveTask(task.id, tomorrowStr, 0)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <ArrowRight className="h-3 w-3" />
                        Tomorrow
                      </button>
                      <button
                        onClick={() => onMoveToBacklog(task.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                      >
                        <Inbox className="h-3 w-3" />
                        Backlog
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 'reflection' && (
            <>
              <div className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-accent-foreground" />
                <h2 className="text-lg font-semibold">Evening Reflection</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                What went well today? What would you do differently?
              </p>
              {journal?.intention && (
                <div className="rounded-lg border bg-primary/5 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">This morning's intention</p>
                  <p className="text-sm italic">"{journal.intention}"</p>
                </div>
              )}
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={4}
                className="w-full rounded-lg border bg-secondary/30 p-3 text-sm resize-none outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20"
                placeholder="Today I learned..."
                autoFocus
              />
            </>
          )}

          {step === 'summary' && (
            <>
              <div className="flex items-center gap-2">
                <Moon className="h-5 w-5 text-accent-foreground" />
                <h2 className="text-lg font-semibold">Day Complete</h2>
              </div>
              <div className="space-y-3 py-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tasks completed</span>
                  <span className="font-medium text-completed">{completedTasks.length}</span>
                </div>
                {reflection.trim() && (
                  <div className="rounded-lg border bg-accent/30 p-3 mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Reflection</p>
                    <p className="text-sm italic">"{reflection.trim()}"</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground text-center pt-4">
                Great work today. Rest well!
              </p>
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
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {step === 'summary' ? 'Finish' : 'Next'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
