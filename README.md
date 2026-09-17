# Pulse PM — Tauri + Bun + SolidJS + Tailwind

A dark personal project manager with a strict hierarchy:

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
- `localStorage` — all data lives on-device, works fully offline
- `sync-server/` — tiny Bun server holding the shared copy on your home network

## Features

- Overview dashboard with stats, completion ring, project cards
- Sidebar tree: expand projects → see goals with % + counts
- Project view: header + progress, goal cards with tasks
- Two views per project: **◧ Tree (hierarchy)** and **▤ Kanban (by status)**
- Full CRUD modals for projects, goals, tasks
- Search (`/`), priority badges, overdue highlighting, one-click toggle done
- Seed demo data + reset button
- Keyboard: `/` search, `Esc` close modal
- **Sync**: file-based phone ⇄ PC merge, no server or account needed

## Run

```bash
bun install
bun run dev          # web at http://localhost:1420
bun run tauri dev    # desktop app
bun run build        # web build → dist/
bun run tauri build  # desktop bundle
```

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
# PORT=8091 SYNC_DATA=./pulse-pm-sync.json bun run sync:server
```

Then on **each** device (phone app + desktop app, which points at
`http://127.0.0.1:8091` on the PC itself): **⇄ Sync → enter the PC's LAN URL**
(e.g. `http://192.168.1.50:8091`, printed by the server on startup) **→ Sync
now**. From then on the app syncs itself on every launch whenever the server
is reachable, and quietly stays offline when you're away. One request syncs
both directions: newest edit per record wins, deletes carry over.

Notes:
- Same Wi-Fi required; the PC app can use `http://127.0.0.1:8091`.
- The server stores one `pulse-pm-sync.json` file next to itself — back it up
  like anything else. For trusted home networks only (no login).
- Keep the server running: terminal, `systemd --user` service, autostart, etc.
- File sync (Save file / import) in the same dialog still works as a fallback
  with no network at all.

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
  store.tsx           # Solid store + localStorage + server/file sync
  lib/
    merge.ts          # shared merge logic (client + server, last-write-wins)
    lanSync.ts        # server URL prefs + push/pull helper
  components/
    ui.tsx            # Ring, ProgressBar, Modal, inputs
    Sidebar.tsx       # project → goal tree
    TopBar.tsx        # search + view toggle + sync button + actions
    Dashboard.tsx     # overview hero + stats + grid
    ProjectView.tsx   # hierarchy + kanban for active project
    Modals.tsx        # Project/Goal/Task dialogs
    SyncDialog.tsx    # home server + export / import sync file
  App.tsx             # shell + modal router
src-tauri/            # Rust + tauri.conf.json
sync-server/
  server.ts           # home sync server (bun run sync:server)
  install-service.sh  # always-on systemd install (bun run sync:service)
  sync.test.ts        # merge + HTTP checks (bun run sync:test)
```
