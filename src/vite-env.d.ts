/// <reference types="vite/client" />

import type {
  PlannerDbBridge,
  PlannerJournalBridge,
  PlannerSettingsBridge,
} from '@/lib/db';

declare global {
  interface Window {
    wavhudiDb?: PlannerDbBridge;
    wavhudiJournalDb?: PlannerJournalBridge;
    wavhudiSettingsDb?: PlannerSettingsBridge;
  }
}

export {};
