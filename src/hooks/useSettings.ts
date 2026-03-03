import { useState, useEffect, useCallback } from 'react';
import { DatabaseService } from '@/services/DatabaseService';
import type { UserSettings } from '@/lib/db';

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = await DatabaseService.getSettings();
    setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateSettings = useCallback(async (changes: Partial<UserSettings>) => {
    const updated = await DatabaseService.updateSettings(changes);
    setSettings(updated);
    return updated;
  }, []);

  return {
    settings,
    loading,
    refresh,
    updateSettings,
  };
}
