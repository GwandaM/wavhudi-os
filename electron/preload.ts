import { contextBridge, ipcRenderer } from "electron";
import type {
  DailyJournal,
  Note,
  PlannerDbBridge,
  PlannerJournalBridge,
  PlannerNotesBridge,
  PlannerProjectBridge,
  PlannerSettingsBridge,
  Project,
  Task,
  UserSettings,
} from "../src/lib/db";
import type { OutlookCalendarEvent, OutlookConfig } from "./outlook";

const taskDb: PlannerDbBridge = {
  getAll: () => ipcRenderer.invoke("db:tasks:getAll"),
  get: (id: number) => ipcRenderer.invoke("db:tasks:get", id),
  add: (task: Omit<Task, "id">) => ipcRenderer.invoke("db:tasks:add", task),
  update: (id: number, changes: Partial<Task>) =>
    ipcRenderer.invoke("db:tasks:update", id, changes),
  delete: (id: number) => ipcRenderer.invoke("db:tasks:delete", id),
  count: () => ipcRenderer.invoke("db:tasks:count"),
};

const journalDb: PlannerJournalBridge = {
  getAll: () => ipcRenderer.invoke("db:journal:getAll"),
  getByDate: (date: string) => ipcRenderer.invoke("db:journal:getByDate", date),
  upsert: (
    date: string,
    changes: Partial<Omit<DailyJournal, "id" | "date" | "created_at">>
  ) => ipcRenderer.invoke("db:journal:upsert", date, changes),
};

const settingsDb: PlannerSettingsBridge = {
  get: () => ipcRenderer.invoke("db:settings:get"),
  update: (changes: Partial<UserSettings>) =>
    ipcRenderer.invoke("db:settings:update", changes),
};

const projectDb: PlannerProjectBridge = {
  getAll: () => ipcRenderer.invoke("db:projects:getAll"),
  get: (id: number) => ipcRenderer.invoke("db:projects:get", id),
  add: (project: Omit<Project, "id" | "created_at">) =>
    ipcRenderer.invoke("db:projects:add", project),
  update: (id: number, changes: Partial<Project>) =>
    ipcRenderer.invoke("db:projects:update", id, changes),
  delete: (id: number) => ipcRenderer.invoke("db:projects:delete", id),
};

const notesDb: PlannerNotesBridge = {
  getAll: () => ipcRenderer.invoke("db:notes:getAll"),
  get: (id: number) => ipcRenderer.invoke("db:notes:get", id),
  add: (note: Omit<Note, "id" | "created_at" | "updated_at">) =>
    ipcRenderer.invoke("db:notes:add", note),
  update: (id: number, changes: Partial<Omit<Note, "id" | "created_at" | "updated_at">>) =>
    ipcRenderer.invoke("db:notes:update", id, changes),
  delete: (id: number) => ipcRenderer.invoke("db:notes:delete", id),
};

const appConfig = {
  get: (key: string): Promise<string | null> =>
    ipcRenderer.invoke("app:getConfig", key),
  set: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke("app:setConfig", key, value),
};

const outlook = {
  getConfig: (): Promise<OutlookConfig | null> =>
    ipcRenderer.invoke("outlook:getConfig"),
  setConfig: (config: OutlookConfig): Promise<void> =>
    ipcRenderer.invoke("outlook:setConfig", config.clientId, config.tenantId),
  getStatus: (): Promise<{ connected: boolean; expiresAt?: number }> =>
    ipcRenderer.invoke("outlook:getStatus"),
  auth: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("outlook:auth"),
  getCalendarEvents: (date: string): Promise<OutlookCalendarEvent[]> =>
    ipcRenderer.invoke("outlook:getCalendarEvents", date),
  disconnect: (): Promise<void> =>
    ipcRenderer.invoke("outlook:disconnect"),
};

contextBridge.exposeInMainWorld("electronAPI", Object.freeze({
  platform: process.platform,

  // Window controls
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  onMaximizedChange: (callback: (maximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) =>
      callback(maximized);
    ipcRenderer.on("window:maximized-change", handler);
    return () => {
      ipcRenderer.removeListener("window:maximized-change", handler);
    };
  },
  db: Object.freeze(taskDb),
  journal: Object.freeze(journalDb),
  settings: Object.freeze(settingsDb),
  projects: Object.freeze(projectDb),
  notes: Object.freeze(notesDb),
  appConfig: Object.freeze(appConfig),
  outlook: Object.freeze(outlook),
}));
