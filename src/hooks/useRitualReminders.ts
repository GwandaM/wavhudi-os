import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { UserSettings, DailyJournal } from '@/lib/db';

const REMINDER_STORAGE_KEY = 'daily_planner_reminder_state';
const CHECK_INTERVAL_MS = 60_000; // Check every minute

interface ReminderState {
  date: string;
  planningShown: boolean;
  shutdownShown: boolean;
}

function getStoredState(): ReminderState | null {
  try {
    const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state: ReminderState) {
  localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(state));
}

function currentHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

interface UseRitualRemindersOptions {
  todayStr: string;
  settings: UserSettings | null;
  journal: DailyJournal | null;
  onStartPlanning: () => void;
  onStartShutdown: () => void;
}

/**
 * Fires sonner toasts at configurable times when planning or shutdown rituals
 * haven't been completed yet. Each reminder fires at most once per day.
 */
export function useRitualReminders({
  todayStr,
  settings,
  journal,
  onStartPlanning,
  onStartShutdown,
}: UseRitualRemindersOptions) {
  const onStartPlanningRef = useRef(onStartPlanning);
  const onStartShutdownRef = useRef(onStartShutdown);
  onStartPlanningRef.current = onStartPlanning;
  onStartShutdownRef.current = onStartShutdown;

  useEffect(() => {
    if (!settings) return;

    function check() {
      if (!settings) return;

      const now = currentHHMM();
      const stored = getStoredState();

      // Reset state if date changed
      const state: ReminderState = stored && stored.date === todayStr
        ? stored
        : { date: todayStr, planningShown: false, shutdownShown: false };

      // Planning reminder
      if (
        settings.planning_ritual_enabled &&
        !state.planningShown &&
        now >= settings.planning_reminder_time &&
        !journal?.planning_completed
      ) {
        state.planningShown = true;
        saveState(state);
        toast('Time to plan your day', {
          description: 'Start your morning planning ritual to set intentions and review tasks.',
          duration: 15_000,
          action: {
            label: 'Start planning',
            onClick: () => onStartPlanningRef.current(),
          },
        });
      }

      // Shutdown reminder
      if (
        settings.shutdown_ritual_enabled &&
        !state.shutdownShown &&
        now >= settings.shutdown_reminder_time &&
        !journal?.shutdown_completed
      ) {
        state.shutdownShown = true;
        saveState(state);
        toast('Time to wrap up', {
          description: 'Start your shutdown ritual to review the day and handle remaining tasks.',
          duration: 15_000,
          action: {
            label: 'Start shutdown',
            onClick: () => onStartShutdownRef.current(),
          },
        });
      }
    }

    // Check immediately, then on interval
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [todayStr, settings, journal?.planning_completed, journal?.shutdown_completed]);
}
