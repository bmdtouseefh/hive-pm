/**
 * Durable client persistence: SQLite (Tauri plugin-sql) with a
 * localStorage backend for plain browsers — including the phone browser,
 * so no Android build is needed: outside the home LAN the app works fully
 * offline against browser localStorage and delta-syncs on return.
 *
 * Why SQLite under Tauri: localStorage/WebView storage is quota-limited,
 * synchronous, and can be evicted. Under Tauri every snapshot goes into
 * `sqlite:hive-pm.db` (table `kv`, single atomic row). The localStorage
 * copy doubles as fast-boot cache + the browser backend.
 */
import type { Goal, Project, Task, Tombstone } from "../types";
import { MAX_TOMBSTONES } from "./merge";

export interface Snapshot {
  projects: Project[];
  goals: Goal[];
  tasks: Task[];
  deleted: Tombstone[];
  activeProjectId: string | null;
  lastSyncAt: string | null;
  lastSyncSummary: string | null;
  /** Server cursor from the last successful delta sync (null = never). */
  serverCursor: string | null;
}

export type Backend = "sqlite" | "localStorage";

const LS_KEY = "hive-pm-v1";
const LS_LEGACY_KEY = "pulse-pm-v1";
const SQLITE_DB = "sqlite:hive-pm.db";
const KV_ROW = "snapshot-v1";

const SCHEMA = `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;

// Serializes overlapping saves (rapid edits) into one write chain.
let writeChain: Promise<void> = Promise.resolve();
let sqliteOk: boolean | null = null;

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI__" in window || "__TAURI_INTERNALS__" in window)
  );
}

type SqlDb = {
  execute: (q: string, params?: unknown[]) => Promise<unknown>;
  select: <T>(q: string, params?: unknown[]) => Promise<T>;
  close?: () => Promise<void>;
};

async function openSqlite(): Promise<SqlDb | null> {
  if (!isTauri()) return null;
  try {
    const mod = await import("@tauri-apps/plugin-sql");
    const Database = mod.default;
    const db = (await Database.load(SQLITE_DB)) as unknown as SqlDb;
    await db.execute(SCHEMA);
    return db;
  } catch {
    return null;
  }
}

/** Best-effort: ask the browser not to evict this origin's site data. */
function ensurePersistentStorage() {
  try {
    const p = navigator.storage?.persist?.();
    if (p) p.catch(() => {});
  } catch {
    /* unsupported browser — localStorage still works, just evictable */
  }
}

/** Synchronous fast-boot read (localStorage cache). Null when absent/corrupt. */
export function readLocalBackup(): Snapshot | null {
  try {
    const raw = localStorage.getItem(LS_KEY) ?? localStorage.getItem(LS_LEGACY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Snapshot>;
    return {
      projects: Array.isArray(p.projects) ? p.projects : [],
      goals: Array.isArray(p.goals) ? p.goals : [],
      tasks: Array.isArray(p.tasks) ? p.tasks : [],
      deleted: Array.isArray(p.deleted) ? p.deleted : [],
      activeProjectId: p.activeProjectId ?? null,
      lastSyncAt: p.lastSyncAt ?? null,
      lastSyncSummary: p.lastSyncSummary ?? null,
      serverCursor: p.serverCursor ?? localStorage.getItem("hive-pm-server-cursor"),
    };
  } catch {
    return null;
  }
}

function writeLocalBackup(snap: Snapshot) {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        projects: snap.projects,
        goals: snap.goals,
        tasks: snap.tasks,
        deleted: snap.deleted.slice(-MAX_TOMBSTONES),
        activeProjectId: snap.activeProjectId,
        lastSyncAt: snap.lastSyncAt,
        lastSyncSummary: snap.lastSyncSummary,
        serverCursor: snap.serverCursor,
      })
    );
  } catch {
    /* quota / private mode — SQLite remains authoritative */
  }
}

/**
 * Authoritative load. Prefers SQLite; migrates the localStorage backup into
 * it on first run; falls back to localStorage on plain web.
 */
export async function loadSnapshot(): Promise<{ snap: Snapshot | null; backend: Backend }> {
  const db = await openSqlite();
  if (db) {
    try {
      const rows = await db.select<{ value: string }[]>(`SELECT value FROM kv WHERE key = $1`, [KV_ROW]);
      if (rows.length > 0) {
        sqliteOk = true;
        const snap = JSON.parse(rows[0].value) as Snapshot;
        writeLocalBackup(snap); // refresh fast-boot cache
        return { snap, backend: "sqlite" };
      }
      // First run under Tauri: adopt the localStorage backup (if any).
      const backup = readLocalBackup();
      if (backup) {
        await db.execute(`INSERT OR REPLACE INTO kv (key, value) VALUES ($1, $2)`, [
          KV_ROW,
          JSON.stringify(backup),
        ]);
        sqliteOk = true;
        return { snap: backup, backend: "sqlite" };
      }
      sqliteOk = true;
      return { snap: null, backend: "sqlite" };
    } catch {
      /* fall through to localStorage */
    } finally {
      try {
        await db.close?.();
      } catch {
        /* ignore */
      }
    }
  }
  sqliteOk = false;
  ensurePersistentStorage();
  return { snap: readLocalBackup(), backend: "localStorage" };
}

/** Durable save. Always refreshes the localStorage fast-boot cache too. */
export function saveSnapshot(snap: Snapshot): Promise<void> {
  writeLocalBackup(snap);
  if (sqliteOk === false) return Promise.resolve();
  const task = async () => {
    const db = await openSqlite();
    if (!db) {
      sqliteOk = false;
      return;
    }
    try {
      await db.execute(`INSERT OR REPLACE INTO kv (key, value) VALUES ($1, $2)`, [
        KV_ROW,
        JSON.stringify({ ...snap, deleted: snap.deleted.slice(-MAX_TOMBSTONES) }),
      ]);
      sqliteOk = true;
    } finally {
      try {
        await db.close?.();
      } catch {
        /* ignore */
      }
    }
  };
  const run = writeChain.then(task, task);
  // Keep the chain alive across failures; surface errors to console only —
  // the in-memory store + localStorage backup remain usable.
  writeChain = run.catch(() => {});
  return writeChain;
}
