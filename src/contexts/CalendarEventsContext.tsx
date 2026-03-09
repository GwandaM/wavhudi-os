import * as React from "react";
import { parseIcs, getEventsForDate, type CalendarEvent } from "@/lib/icsParser";

const STORAGE_KEY = "daily_planner_calendar_events";

type CalendarEventsContextValue = {
  events: CalendarEvent[];
  importIcs: (icsContent: string) => number;
  clearEvents: () => void;
  removeEvent: (uid: string) => void;
  getForDate: (date: string) => CalendarEvent[];
  count: number;
  loading: boolean;
};

const CalendarEventsContext =
  React.createContext<CalendarEventsContextValue | null>(null);

function loadEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEvents(events: CalendarEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function useCalendarEventsContext() {
  const context = React.useContext(CalendarEventsContext);
  if (!context) {
    throw new Error(
      "useCalendarEventsContext must be used within a CalendarEventsProvider."
    );
  }
  return context;
}

function CalendarEventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setEvents(loadEvents());
    setLoading(false);
  }, []);

  const importIcs = React.useCallback((icsContent: string) => {
    const parsed = parseIcs(icsContent);
    if (parsed.length === 0) return 0;
    setEvents((prev) => {
      const map = new Map(prev.map((e) => [e.uid, e]));
      for (const event of parsed) {
        const key = event.uid || `${event.summary}-${event.dtstart}`;
        map.set(key, { ...event, uid: key });
      }
      const merged = Array.from(map.values());
      saveEvents(merged);
      return merged;
    });
    return parsed.length;
  }, []);

  const clearEvents = React.useCallback(() => {
    setEvents([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const removeEvent = React.useCallback((uid: string) => {
    setEvents((prev) => {
      const updated = prev.filter((e) => e.uid !== uid);
      saveEvents(updated);
      return updated;
    });
  }, []);

  const getForDate = React.useCallback(
    (date: string) => {
      return getEventsForDate(events, date);
    },
    [events]
  );

  const contextValue = React.useMemo<CalendarEventsContextValue>(
    () => ({
      events,
      importIcs,
      clearEvents,
      removeEvent,
      getForDate,
      count: events.length,
      loading,
    }),
    [events, importIcs, clearEvents, removeEvent, getForDate, loading]
  );

  return (
    <CalendarEventsContext.Provider value={contextValue}>
      {children}
    </CalendarEventsContext.Provider>
  );
}

export { CalendarEventsProvider, useCalendarEventsContext };
