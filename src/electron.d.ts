import type {
  PlannerDbBridge,
  PlannerJournalBridge,
  PlannerProjectBridge,
  PlannerSettingsBridge,
} from "@/lib/db";

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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
