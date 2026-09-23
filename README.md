# Hive PM — Tauri + Bun + SolidJS + Tailwind

A honeybee-themed personal project manager (dark + light modes) with a strict hierarchy:

```
Project → Goal → Task
```

- **Project**: icon, color, description (e.g. "Nebula Launch 🚀")
- **Goal**: belongs to one project, has color + deadline, auto progress % from its tasks
- **Task**: belongs to one goal, has status (`todo` / `in-progress` / `done`), priority, due date, notes

## Stack

- [Tauri v2](https://tauri.app) — desktop shell (`src-tauri/`), Android/iOS possible
- [Bun](https://bun.sh) — package manager / scripts
- [SolidJS](https://solidjs.com) + Vite — reactive UI, no virtual DOM
- [Tailwind CSS v4](https://tailwindcss.com) — styling (`@tailwindcss/vite`)
- `SQLite` — all data lives in `hive-pm.db` on-device (Tauri plugin-sql),
  works fully offline; phone/plain-web browsers use a localStorage backend
- `sync-server/` — tiny Bun server holding the shared SQLite copy on your home network

## Features

- Overview dashboard with stats, completion ring, project cards
- Sidebar tree: expand projects → see goals with % + counts
- Project view: header + progress, goal cards with tasks
- Two views per project: **◧ Tree (hierarchy)** and **▤ Kanban (by status)**
- Full CRUD modals for projects, goals, tasks
- Search (`/`), priority badges, overdue highlighting, one-click toggle done
- Seed demo data + reset button
- Keyboard: `/` search, `Esc` close modal
- **Sync**: delta phone ⇄ PC merge over SQLite — only changed rows travel,
  newest edit per record wins, deletes carry over, no account needed

## Run (development)

```bash
bun install
bun run dev          # web at http://localhost:1420
bun run tauri dev    # desktop app
bun run build        # web build → dist/
bun run tauri build  # desktop bundle
```

## Production: start / stop (`start-prod.sh`)

On the home PC, one command runs both production processes **daemonized**
in the background:

1. **Sync server** — SQLite delta sync (phone ⇄ PC) on `HOST:PORT`
   (default `0.0.0.0:8091`, db `sync-server/hive-pm-sync.db`).
2. **Web UI** — the built `dist/` served via `vite preview` on
   `HOST:WEB_PORT` (default `0.0.0.0:8080`), so any LAN device can use the
   app in a browser with no install.

```bash
bun run prod -- start    # build dist/ if missing, then start both
bun run prod -- stop     # stop both
bun run prod -- restart  # stop, then start
bun run prod -- status   # running/stopped, health, LAN URLs
bun run prod -- logs     # tail logs/sync-server.log + logs/web.log
# ./start-prod.sh start  # same thing directly
```

- First `start` builds the frontend (`tsc + vite`) automatically when
  `dist/` is missing; afterwards it reuses the build until you pass
  `--build`. `--skip-build` fails instead of building when `dist/` is
  missing. `--no-web` runs the sync server only.
- Env overrides: `PORT=8091 WEB_PORT=8080 HOST=0.0.0.0
  SYNC_DB=./sync-server/hive-pm-sync.db` (also `WEB=0`, `SKIP_BUILD=1`).
- Runtime state: pid files in `.run/` (`sync-server.pid`, `web.pid`),
  logs in `logs/`. Both are gitignored. `status` prints the LAN URLs to
  enter in the app's ⇄ Sync dialog and to open in the phone browser,
  e.g. `http://192.168.1.10:8080` (app) · `http://192.168.1.10:8091`
  (sync). The PC itself uses `http://127.0.0.1:8091`.
- One owner per port: `start`/`stop` stop the conflicting systemd units
  (`pulse-pm-sync.service`, `pulse-pm-web.service`) if active, and
  installing the systemd service kills the script-managed processes —
  don't run both at once.

## Syncing phone ⇄ PC (home server, auto)

Both devices work fully offline, so the phone is usable away from home. For
automatic syncing at home, run the tiny sync server on your PC (or Pi/NAS).
No accounts — one shared copy on your trusted home network.

**Option A — always on (recommended for the home PC):**

```bash
bun run sync:service
```

This installs a systemd user service that starts on login and restarts on
failure. Check it with `systemctl --user status pulse-pm-sync`, watch logs
with `journalctl --user -u pulse-pm-sync -f`, remove it with
`bash sync-server/install-service.sh --uninstall`.

**Option B — just for now:**

```bash
bun run sync:server
# PORT=8091 SYNC_DB=./hive-pm-sync.db bun run sync:server
```

Then on **each** device (phone app + desktop app, which points at
`http://127.0.0.1:8091` on the PC itself): **⇄ Sync → enter the PC's LAN URL**
(e.g. `http://192.168.1.50:8091`, printed by the server on startup) **→ Sync
now**. From then on the app syncs itself on every launch whenever the server
is reachable, and quietly stays offline when you're away. One request syncs
both directions: newest edit per record wins, deletes carry over.

Notes:
- Same Wi-Fi required; the PC app can use `http://127.0.0.1:8091`.
- The server stores one `hive-pm-sync.db` SQLite file (WAL) next to itself —
  back it up like anything else. An old `hive/pulse-pm-sync.json` is migrated
  into the DB once automatically on first start. For trusted home networks
  only (no login).
- Each sync exchanges only rows changed since the last cursor (delta sync),
  merged per-record inside a single SQLite transaction — a stale offline
  device can no longer overwrite newer rows, and concurrent phone+PC pushes
  can't drop each other.
- Keep the server running: terminal, `systemd --user` service, autostart, etc.
- File sync (Save file / import) in the same dialog still works as a fallback
  with no network at all.

### Phone browser (no Android build needed)

Open the PC's web UI address (printed by `start-prod.sh`, e.g.
`http://192.168.1.50:8080`) in the phone browser while you're home, then
**Add to Home Screen** for an app-like icon.

- Outside, the app works fully offline: everything is saved in the phone
  browser's local storage (the top bar shows "Offline · saved here").
- Back home, it syncs itself automatically as soon as you're back online —
  only changed rows travel, so nothing gets overwritten.
- One limitation of plain-`http` LAN hosting: browsers only allow offline
  app installs (service workers) on HTTPS, so keep the tab open when you
  leave, or just reopen it when you're home — your data persists in the
  browser either way.

### Phone builds

- Android over plain `http://` LAN needs cleartext allowed: in the generated
  `src-tauri/gen/android/.../AndroidManifest.xml` set
  `android:usesCleartextTraffic="true"` (or serve via HTTPS).
- iOS likewise needs a transport exception (`NSAllowsLocalNetworking`).

## Structure

```
src/
  types.ts            # Project/Goal/Task/Tombstone types + meta
  seed.ts             # demo data
  store.tsx           # Solid store + SQLite/localStorage + delta sync
  lib/
    merge.ts          # shared merge + delta logic (client + server, last-write-wins)
    lanSync.ts        # server URL prefs + delta/full push-pull helpers
    repo.ts           # durable client snapshots: SQLite (Tauri) + localStorage (browser/phone)
  components/
    ui.tsx            # Ring, ProgressBar, Modal, inputs
    Sidebar.tsx       # project → goal tree
    TopBar.tsx        # search + view toggle + sync button + actions
    Dashboard.tsx     # overview hero + stats + grid
    ProjectView.tsx   # hierarchy + kanban for active project
    Modals.tsx        # Project/Goal/Task dialogs
    SyncDialog.tsx    # home server + export / import sync file
  App.tsx             # shell + modal router
src-tauri/            # Rust + tauri.conf.json (sql plugin: sqlite:hive-pm.db)
sync-server/
  server.ts           # home sync server (bun run sync:server)
  db.ts               # SQLite storage + transactional delta merge (bun:sqlite)
  install-service.sh  # always-on systemd install (bun run sync:service)
  sync.test.ts        # merge + delta + SQLite + HTTP checks (bun run sync:test)
```
