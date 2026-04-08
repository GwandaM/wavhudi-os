import type {
  PlannerDbBridge,
  PlannerJournalBridge,
  PlannerNotesBridge,
  PlannerProjectBridge,
  PlannerSettingsBridge,
} from "@/lib/db";

export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  isAllDay: boolean;
  location?: string;
  onlineMeetingUrl?: string;
  isCancelled: boolean;
}

export interface OutlookConfig {
  clientId: string;
  tenantId: string;
}

export interface OutlookAPI {
  getConfig: () => Promise<OutlookConfig | null>;
  setConfig: (config: OutlookConfig) => Promise<void>;
  getStatus: () => Promise<{ connected: boolean; expiresAt?: number }>;
  auth: () => Promise<{ success: boolean; error?: string }>;
  getCalendarEvents: (date: string) => Promise<OutlookCalendarEvent[]>;
  disconnect: () => Promise<void>;
}

export interface AppConfigAPI {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
}

export interface ElectronAPI {
  platform: string;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
  db: PlannerDbBridge;
  journal: PlannerJournalBridge;
  settings: PlannerSettingsBridge;
  projects: PlannerProjectBridge;
  notes: PlannerNotesBridge;
  appConfig: AppConfigAPI;
  outlook: OutlookAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
