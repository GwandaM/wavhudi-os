import { useState, useEffect, useCallback } from 'react';
import { DatabaseService } from '@/services/DatabaseService';
import type { DailyJournal } from '@/lib/db';

export function useDailyJournal(date: string) {
  const [journal, setJournal] = useState<DailyJournal | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const j = await DatabaseService.getJournal(date);
    setJournal(j || null);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const updateJournal = useCallback(async (
    changes: Partial<Omit<DailyJournal, 'id' | 'date' | 'created_at'>>
  ) => {
    const updated = await DatabaseService.upsertJournal(date, changes);
    setJournal(updated);
    return updated;
  }, [date]);

  const isPlanningDone = journal?.planning_completed ?? false;
  const isShutdownDone = journal?.shutdown_completed ?? false;

  return {
    journal,
    loading,
    refresh,
    updateJournal,
    isPlanningDone,
    isShutdownDone,
  };
}
