import { contextBridge, ipcRenderer } from "electron";
import type {
  DailyJournal,
  PlannerDbBridge,
  PlannerJournalBridge,
  PlannerProjectBridge,
  PlannerSettingsBridge,
  Project,
  Task,
  UserSettings,
} from "../src/lib/db";

const wavhudiDb: PlannerDbBridge = {
  getAll: () => ipcRenderer.invoke("db:tasks:getAll"),
  get: (id: number) => ipcRenderer.invoke("db:tasks:get", id),
  add: (task: Omit<Task, "id">) => ipcRenderer.invoke("db:tasks:add", task),
  update: (id: number, changes: Partial<Task>) =>
    ipcRenderer.invoke("db:tasks:update", id, changes),
  delete: (id: number) => ipcRenderer.invoke("db:tasks:delete", id),
  count: () => ipcRenderer.invoke("db:tasks:count"),
};

const wavhudiJournalDb: PlannerJournalBridge = {
  getAll: () => ipcRenderer.invoke("db:journal:getAll"),
  getByDate: (date: string) => ipcRenderer.invoke("db:journal:getByDate", date),
  upsert: (
    date: string,
    changes: Partial<Omit<DailyJournal, "id" | "date" | "created_at">>
  ) => ipcRenderer.invoke("db:journal:upsert", date, changes),
};

const wavhudiSettingsDb: PlannerSettingsBridge = {
  get: () => ipcRenderer.invoke("db:settings:get"),
  update: (changes: Partial<UserSettings>) =>
    ipcRenderer.invoke("db:settings:update", changes),
};

const wavhudiProjectDb: PlannerProjectBridge = {
  getAll: () => ipcRenderer.invoke("db:projects:getAll"),
  get: (id: number) => ipcRenderer.invoke("db:projects:get", id),
  add: (project: Omit<Project, "id" | "created_at">) =>
    ipcRenderer.invoke("db:projects:add", project),
  update: (id: number, changes: Partial<Project>) =>
    ipcRenderer.invoke("db:projects:update", id, changes),
  delete: (id: number) => ipcRenderer.invoke("db:projects:delete", id),
};

contextBridge.exposeInMainWorld("electronAPI", {
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

});

contextBridge.exposeInMainWorld("wavhudiDb", wavhudiDb);
contextBridge.exposeInMainWorld("wavhudiJournalDb", wavhudiJournalDb);
contextBridge.exposeInMainWorld("wavhudiSettingsDb", wavhudiSettingsDb);
contextBridge.exposeInMainWorld("wavhudiProjectDb", wavhudiProjectDb);
