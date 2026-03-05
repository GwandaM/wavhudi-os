import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { SqliteRepositoryBundle } from "./db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let repositories: SqliteRepositoryBundle | null = null;

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
    },
  });

  // Show when ready to avoid white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Load the app
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl && /^https?:\/\//.test(devServerUrl)) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
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
ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle("window:close", () => mainWindow?.close());
ipcMain.handle("window:isMaximized", () => mainWindow?.isMaximized() ?? false);

// ── SQLite IPC ───────────────────────────────────────────────────────
ipcMain.handle("db:tasks:getAll", async () => ensureRepositories().tasks.getAll());
ipcMain.handle("db:tasks:get", async (_event, id: number) =>
  ensureRepositories().tasks.get(id)
);
ipcMain.handle("db:tasks:add", async (_event, task) =>
  ensureRepositories().tasks.add(task)
);
ipcMain.handle("db:tasks:update", async (_event, id: number, changes) =>
  ensureRepositories().tasks.update(id, changes)
);
ipcMain.handle("db:tasks:delete", async (_event, id: number) =>
  ensureRepositories().tasks.delete(id)
);
ipcMain.handle("db:tasks:count", async () => ensureRepositories().tasks.count());

ipcMain.handle("db:journal:getAll", async () => ensureRepositories().journal.getAll());
ipcMain.handle("db:journal:getByDate", async (_event, date: string) =>
  ensureRepositories().journal.getByDate(date)
);
ipcMain.handle("db:journal:upsert", async (_event, date: string, changes) =>
  ensureRepositories().journal.upsert(date, changes)
);

ipcMain.handle("db:settings:get", async () => ensureRepositories().settings.get());
ipcMain.handle("db:settings:update", async (_event, changes) =>
  ensureRepositories().settings.update(changes)
);

ipcMain.handle("db:projects:getAll", async () => ensureRepositories().projects.getAll());
ipcMain.handle("db:projects:get", async (_event, id: number) =>
  ensureRepositories().projects.get(id)
);
ipcMain.handle("db:projects:add", async (_event, project) =>
  ensureRepositories().projects.add(project)
);
ipcMain.handle("db:projects:update", async (_event, id: number, changes) =>
  ensureRepositories().projects.update(id, changes)
);
ipcMain.handle("db:projects:delete", async (_event, id: number) =>
  ensureRepositories().projects.delete(id)
);

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
