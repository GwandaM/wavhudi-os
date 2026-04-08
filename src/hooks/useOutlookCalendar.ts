import { useState, useEffect, useCallback, useRef } from 'react';
import type { OutlookCalendarEvent, OutlookConfig } from '@/electron.d';

interface OutlookState {
  events: OutlookCalendarEvent[];
  connected: boolean;
  configured: boolean;
  loading: boolean;
  error: string | null;
}

const INITIAL: OutlookState = {
  events: [],
  connected: false,
  configured: false,
  loading: true,
  error: null,
};

export function useOutlookCalendar(date: string) {
  const [state, setState] = useState<OutlookState>(INITIAL);
  const outlook = window.electronAPI?.outlook;
  const fetchedDateRef = useRef<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!outlook) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    try {
      const [config, status] = await Promise.all([
        outlook.getConfig(),
        outlook.getStatus(),
      ]);

      setState((s) => ({
        ...s,
        configured: !!config,
        connected: status.connected,
        loading: false,
      }));
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [outlook]);

  const fetchEvents = useCallback(async (targetDate: string) => {
    if (!outlook) return;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const events = await outlook.getCalendarEvents(targetDate);
      fetchedDateRef.current = targetDate;
      setState((s) => ({ ...s, events, loading: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load calendar events',
      }));
    }
  }, [outlook]);

  // Initial status check
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Fetch events when connected or date changes
  useEffect(() => {
    if (state.connected && fetchedDateRef.current !== date) {
      fetchEvents(date);
    } else if (!state.connected) {
      setState((s) => ({ ...s, events: [] }));
      fetchedDateRef.current = null;
    }
  }, [state.connected, date, fetchEvents]);

  const connect = useCallback(async () => {
    if (!outlook) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const result = await outlook.auth();
    if (result.success) {
      setState((s) => ({ ...s, connected: true, error: null }));
      fetchedDateRef.current = null; // force re-fetch
    } else {
      setState((s) => ({
        ...s,
        loading: false,
        error: result.error ?? 'Authentication failed',
      }));
    }
  }, [outlook]);

  const disconnect = useCallback(async () => {
    if (!outlook) return;
    await outlook.disconnect();
    fetchedDateRef.current = null;
    setState((s) => ({ ...s, connected: false, events: [] }));
  }, [outlook]);

  const saveConfig = useCallback(async (config: OutlookConfig) => {
    if (!outlook) return;
    await outlook.setConfig(config);
    setState((s) => ({ ...s, configured: true }));
  }, [outlook]);

  const refresh = useCallback(() => {
    if (state.connected) {
      fetchedDateRef.current = null;
      fetchEvents(date);
    }
  }, [state.connected, date, fetchEvents]);

  return {
    ...state,
    isElectron: !!outlook,
    connect,
    disconnect,
    saveConfig,
    refresh,
  };
}
