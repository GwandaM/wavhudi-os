import { useState } from 'react';
import { CheckCircle2, Calendar, Clock, ChevronRight } from 'lucide-react';
import { settingsDb } from '@/lib/db';
import { cn } from '@/lib/utils';

interface FirstRunSetupProps {
  onComplete: () => void;
}

const CAPACITY_OPTIONS = [
  { label: '4 hours', value: 240 },
  { label: '6 hours', value: 360 },
  { label: '7 hours', value: 420 },
  { label: '8 hours', value: 480 },
];

export function FirstRunSetup({ onComplete }: FirstRunSetupProps) {
  const [capacityMinutes, setCapacityMinutes] = useState(480);
  const [saving, setSaving] = useState(false);

  const handleGetStarted = async () => {
    setSaving(true);
    try {
      await settingsDb.update({ daily_capacity_minutes: capacityMinutes });
      await window.electronAPI!.appConfig.set('setup_completed', 'true');
    } finally {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-8 py-10 space-y-8">

        {/* Header */}
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Wavhudi OS</h1>
          <p className="text-sm text-muted-foreground">
            Your daily planning workspace. Let's set up one thing before you start.
          </p>
        </div>

        {/* Work capacity */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">How many hours can you work each day?</h2>
          </div>
          <p className="text-[12px] text-muted-foreground">
            This sets your daily capacity so the planner can warn you when you've over-scheduled.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {CAPACITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCapacityMinutes(opt.value)}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                  capacityMinutes === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/30'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Outlook hint */}
        <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-1">
          <p className="text-[12px] font-medium text-foreground/80">Connect Outlook later</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            You can connect your Microsoft calendar from the sidebar's Calendar section once the app is open. It takes about 2 minutes.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={handleGetStarted}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70 transition-colors"
        >
          {saving ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Setting up…
            </>
          ) : (
            <>
              Get started
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
