import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { SqliteRepositoryBundle } from "./db";
import {
  parseDate,
  parseId,
  parseJournalUpdate,
  parseNoteCreate,
  parseNoteUpdate,
  parseProjectCreate,
  parseProjectUpdate,
  parseSettingsUpdate,
  parseTaskCreate,
  parseTaskUpdate,
} from "./validators";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let repositories: SqliteRepositoryBundle | null = null;
const packagedIndexPath = path.resolve(__dirname, "../dist/index.html");

function getTrustedDevServerOrigin(): string | null {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (!devServerUrl || !/^https?:\/\//.test(devServerUrl)) {
    return null;
  }

  try {
    return new URL(devServerUrl).origin;
  } catch {
    return null;
  }
}

function isAllowedAppUrl(urlString: string): boolean {
  if (!urlString) return false;

  try {
    const url = new URL(urlString);
    if (url.protocol === "file:") {
      return path.resolve(fileURLToPath(url)) === packagedIndexPath;
    }

    const trustedDevServerOrigin = getTrustedDevServerOrigin();
    return trustedDevServerOrigin !== null && url.origin === trustedDevServerOrigin;
  } catch {
    return false;
  }
}

function isAllowedExternalUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol === "https:") {
      return true;
    }

    if (
      !app.isPackaged &&
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function assertTrustedRenderer(event: IpcMainInvokeEvent): void {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error("Rejected IPC call from unknown renderer");
  }

  const senderUrl = event.senderFrame?.url || event.sender.getURL();
  if (!isAllowedAppUrl(senderUrl)) {
    throw new Error(`Rejected IPC call from untrusted origin: ${senderUrl}`);
  }
}

function resolveMigrationsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "electron/db/migrations"),
    path.resolve(process.cwd(), "dist-electron/migrations"),
    path.join(app.getAppPath(), "electron/db/migrations"),
    path.join(app.getAppPath(), "dist-electron/migrations"),
    path.join(__dirname, "migrations"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

function ensureRepositories(): SqliteRepositoryBundle {
  if (repositories) return repositories;

  repositories = new SqliteRepositoryBundle({
    dbFilePath: path.join(app.getPath("userData"), "planner.db"),
    migrationsDir: resolveMigrationsDir(),
  });

  return repositories;
}

function createWindow() {
  const isMac = process.platform === "darwin";

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    ...(isMac ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
    backgroundColor: "#171717",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Show when ready to avoid white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedAppUrl(url)) return;

    event.preventDefault();
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("will-redirect", (event, url) => {
    if (isAllowedAppUrl(url)) return;

    event.preventDefault();
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  // Load the app
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl && /^https?:\/\//.test(devServerUrl)) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(packagedIndexPath);
  }

  // Forward window state changes to the renderer
  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window:maximized-change", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window:maximized-change", false);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Window control IPC ──────────────────────────────────────────────
ipcMain.handle("window:minimize", (event) => {
  assertTrustedRenderer(event);
  mainWindow?.minimize();
});
ipcMain.handle("window:maximize", (event) => {
  assertTrustedRenderer(event);
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle("window:close", (event) => {
  assertTrustedRenderer(event);
  mainWindow?.close();
});
ipcMain.handle("window:isMaximized", (event) => {
  assertTrustedRenderer(event);
  return mainWindow?.isMaximized() ?? false;
});

// ── SQLite IPC ───────────────────────────────────────────────────────
ipcMain.handle("db:tasks:getAll", async (event) => {
  assertTrustedRenderer(event);
  return ensureRepositories().tasks.getAll();
});
ipcMain.handle("db:tasks:get", async (event, id: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().tasks.get(parseId(id));
});
ipcMain.handle("db:tasks:add", async (event, task: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().tasks.add(parseTaskCreate(task));
});
ipcMain.handle("db:tasks:update", async (event, id: unknown, changes: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().tasks.update(parseId(id), parseTaskUpdate(changes));
});
ipcMain.handle("db:tasks:delete", async (event, id: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().tasks.delete(parseId(id));
});
ipcMain.handle("db:tasks:count", async (event) => {
  assertTrustedRenderer(event);
  return ensureRepositories().tasks.count();
});

ipcMain.handle("db:journal:getAll", async (event) => {
  assertTrustedRenderer(event);
  return ensureRepositories().journal.getAll();
});
ipcMain.handle("db:journal:getByDate", async (event, date: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().journal.getByDate(parseDate(date));
});
ipcMain.handle("db:journal:upsert", async (event, date: unknown, changes: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().journal.upsert(parseDate(date), parseJournalUpdate(changes));
});

ipcMain.handle("db:settings:get", async (event) => {
  assertTrustedRenderer(event);
  return ensureRepositories().settings.get();
});
ipcMain.handle("db:settings:update", async (event, changes: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().settings.update(parseSettingsUpdate(changes));
});

ipcMain.handle("db:projects:getAll", async (event) => {
  assertTrustedRenderer(event);
  return ensureRepositories().projects.getAll();
});
ipcMain.handle("db:projects:get", async (event, id: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().projects.get(parseId(id));
});
ipcMain.handle("db:projects:add", async (event, project: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().projects.add(parseProjectCreate(project));
});
ipcMain.handle("db:projects:update", async (event, id: unknown, changes: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().projects.update(parseId(id), parseProjectUpdate(changes));
});
ipcMain.handle("db:projects:delete", async (event, id: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().projects.delete(parseId(id));
});

ipcMain.handle("db:notes:getAll", async (event) => {
  assertTrustedRenderer(event);
  return ensureRepositories().notes.getAll();
});
ipcMain.handle("db:notes:get", async (event, id: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().notes.get(parseId(id));
});
ipcMain.handle("db:notes:add", async (event, note: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().notes.add(parseNoteCreate(note));
});
ipcMain.handle("db:notes:update", async (event, id: unknown, changes: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().notes.update(parseId(id), parseNoteUpdate(changes));
});
ipcMain.handle("db:notes:delete", async (event, id: unknown) => {
  assertTrustedRenderer(event);
  return ensureRepositories().notes.delete(parseId(id));
});

// ── App lifecycle ───────────────────────────────────────────────────
app.whenReady().then(() => {
  ensureRepositories();
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    repositories?.close();
    repositories = null;
    app.quit();
  }
});

app.on("before-quit", () => {
  repositories?.close();
  repositories = null;
});
