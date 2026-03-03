import { contextBridge, ipcRenderer } from "electron";

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

  // ── Database IPC stub ───────────────────────────────────────────
  // The SQLite agent will wire these up. Until then they are no-ops
  // that let the renderer code compile without errors.
  // db: {
  //   getAll:  (store: string) => ipcRenderer.invoke('db:getAll', store),
  //   get:     (store: string, id: number) => ipcRenderer.invoke('db:get', store, id),
  //   add:     (store: string, data: unknown) => ipcRenderer.invoke('db:add', store, data),
  //   update:  (store: string, id: number, changes: unknown) => ipcRenderer.invoke('db:update', store, id, changes),
  //   delete:  (store: string, id: number) => ipcRenderer.invoke('db:delete', store, id),
  //   count:   (store: string) => ipcRenderer.invoke('db:count', store),
  // },
});
