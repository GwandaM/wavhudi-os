# Wavhudi OS

**Your calm, focused daily work companion.**

Wavhudi OS is a local-first **Electron desktop app** designed around one idea: **start your day with intention, end it with clarity**. It runs on your PC, stores everything on your local drive, and needs no internet connection or cloud account. Built for people who want a simple system — not another project management tool — to stay on top of their work, every day.

---

## How it works

### ☀️ Morning — Plan your day

When you open the app, a gentle guided flow helps you get ready:

1. **Triage yesterday** — See anything you didn't finish. Drag it to today, push it to tomorrow, or send it back to your backlog.
2. **Check your calendar** — See today's meetings so you know how much time you actually have.
3. **Pull in tasks** — Browse your backlog and pick what matters today.
4. **Check your capacity** — A visual bar shows how many hours you've planned vs. how much free time you have. Keeps you realistic.
5. **Set an intention** *(optional)* — Write a sentence about what you want to focus on today.

### 🏃 During the day — Stay focused

- **My Day view** — Your default screen. A focused list of just today's tasks. No clutter.
- **Quick-add** — Type a new task and it lands right in your day.
- **Drag & drop** — Priorities shifted? Drag tasks between days or back to your backlog.
- **Priority colours** — Urgent tasks glow red, high-priority tasks show orange. You'll always know what matters most.
- **Time estimates** — Set how long each task should take (15 min, 30 min, 1 hour, etc.) and watch your capacity bar update.

### 🌙 Evening — Close the day

Trigger the shutdown flow when you're done:

1. **Review** — Check off what you finished.
2. **Triage what's left** — Push incomplete tasks to tomorrow, reschedule them, or drop them in the backlog.
3. **Reflect** *(optional)* — Write a quick note about how the day went.
4. **See your summary** — "5 tasks completed, 2 pushed to tomorrow, 6 hours planned." Close the day feeling accomplished.

> **Missed the shutdown?** No worries — unfinished tasks automatically show up in tomorrow morning's planning flow. Nothing silently disappears.

---

## Key features

| Feature | What it does |
|---|---|
| **My Day** | Focused single-column view of today's tasks. Your home screen. |
| **Planning Ritual** | Guided morning flow to set up your day intentionally. |
| **Shutdown Ritual** | Guided evening flow to close the day and triage leftovers. |
| **Capacity Bar** | Visual indicator of planned time vs. available time. Green → amber → red. |
| **Priority Levels** | Urgent, High, Medium, Low — with colour-coded visual hierarchy. |
| **Projects** | Group tasks by project. Coloured dots, filtering, sidebar navigation. |
| **Subtasks** | Break big tasks into checklists with progress tracking (2/4 ✓). |
| **Backlog** | A parking lot for tasks that aren't scheduled yet. |
| **Multi-day Tasks** | Tasks that span several days, with per-day notes. |
| **Drag & Drop** | Move tasks between days, between projects, in and out of the backlog. |
| **Search** | Find any task instantly — even searches inside your notes. |
| **Command Palette** | `Ctrl+K` / `Cmd+K` to access any action without touching the mouse. |
| **Keyboard Shortcuts** | Navigate, create, complete — all from the keyboard. |
| **Dark Mode** | Easy on the eyes for late finishes. |
| **Tags** | Label tasks with `#meeting`, `#blocked`, `#code-review`, etc. |
| **Recurring Tasks** | Set tasks to repeat daily, weekly, or monthly. |
| **Daily Journal** | Morning intentions and evening reflections, saved per day. |

---

## Getting started

### What you need

- **Node.js** 18 or newer — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Install and run (development)

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/wavhudi-os.git
cd wavhudi-os

# 2. Install dependencies
npm install

# 3. Start the app in dev mode
npm run dev
```

In development mode the app opens in your browser at **http://localhost:8080**. Once the Electron shell is complete, the app will launch as a native desktop window instead.

On first launch, sample tasks are loaded so the screen isn't empty.

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run build` | Build for production |
| `npm run test` | Run tests |
| `npm run lint` | Check code quality |

---

## Keyboard shortcuts

| Action | Windows / Linux | Mac |
|---|---|---|
| New task | `Ctrl + N` | `Cmd + N` |
| Open command palette | `Ctrl + K` | `Cmd + K` |
| Search | `Ctrl + F` | `Cmd + F` |
| Jump to today | `T` | `T` |
| Switch to My Day | `1` | `1` |
| Switch to week view | `2` | `2` |
| Switch to month view | `3` | `3` |
| Plan My Day | `Ctrl + P` | `Cmd + P` |
| Start Shutdown | `Ctrl + Shift + S` | `Cmd + Shift + S` |
| Mark complete | `Ctrl + Enter` | `Cmd + Enter` |
| Close panel | `Escape` | `Escape` |

---

## Built with

- [React](https://react.dev/) — UI framework
- [TypeScript](https://www.typescriptlang.org/) — Type-safe JavaScript
- [Vite](https://vitejs.dev/) — Fast dev server and build tool
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [shadcn/ui](https://ui.shadcn.com/) — Beautiful, accessible UI components
- [dnd kit](https://dndkit.com/) — Drag and drop
- [Recharts](https://recharts.org/) — Charts and analytics

---

## Your data

Wavhudi OS is **100% local-first**. Your data never leaves your machine — no cloud, no accounts, no tracking.

- **Current:** Data is stored in the browser's local storage (during early development).
- **Soon:** Data will move to a **SQLite database** saved on your local drive (`C:\WavhudiOS\data\planner.db` by default, configurable).
- **Future:** Optional automatic backups to a **local OneDrive folder** for peace of mind — still your files, still on your machine, just synced by OneDrive in the background.

---

## Roadmap

See [improvements.md](./improvements.md) for the full development plan, organized into phases:

1. **The Daily Habit** — My Day view, planning & shutdown rituals, time estimation, priorities
2. **Organize the Work** — Projects, subtasks, search, command palette, keyboard shortcuts
3. **Workflow Depth** — Recurring tasks, tags, pinned tasks, dependencies, weekly review
4. **Ecosystem & Polish** — Calendar integration, notifications, OneDrive backup, export

🖥️ **Electron & Storage** runs as a parallel track — wrapping the app in a native desktop window with SQLite storage on your C: drive.

---

## License

This project is private. All rights reserved.
