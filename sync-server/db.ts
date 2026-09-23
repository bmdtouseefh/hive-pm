/**
 * SQLite storage for the Hive PM home sync server (Bun's built-in sqlite).
 *
 * Why SQLite instead of a JSON file:
 * - Atomic transactions: concurrent POST /sync from phone + PC can no
 *   longer interleave a read-modify-write and silently drop one side.
 * - Indexed per-record upserts: sync merges row-by-row with
 *   last-write-wins, so a stale device never overwrites newer rows.
 * - WAL + fsync: no more torn writes from crashed mid-save renames.
 *
 * Schema: one row per record (JSON blob + updated_at for LWW/cursors),
 * plus tombstones for propagated deletes.
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  MAX_TOMBSTONES,
  isPayload,
  mergeChanges,
  type MergeCounts,
  type SyncChanges,
  type SyncPayload,
} from "../src/lib/merge";

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deleted (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_goals_updated ON goals(updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_deleted_at ON deleted(at);
`;

type Kind = "projects" | "goals" | "tasks";

export class SyncDb {
  private db: Database;
  readonly path: string;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.path = path;
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(SCHEMA);
  }

  close() {
    this.db.close();
  }

  /** Row counts, for /health and logs. */
  counts(): { projects: number; goals: number; tasks: number; deleted: number } {
    const q = (t: string) => (this.db.query(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    return { projects: q("projects"), goals: q("goals"), tasks: q("tasks"), deleted: q("deleted") };
  }

  /** Full payload (legacy clients + GET /state + backups). */
  loadPayload(): SyncPayload {
    const all = (t: string) =>
      (this.db.query(`SELECT data FROM ${t}`).all() as { data: string }[]).map((r) => JSON.parse(r.data));
    const deleted = (
      this.db.query(`SELECT id, at FROM deleted ORDER BY at ASC LIMIT ${MAX_TOMBSTONES}`).all() as { id: string; at: string }[]
    ).map((r) => ({ id: r.id, at: r.at }));
    return {
      app: "hive-pm",
      version: 1,
      exportedAt: new Date().toISOString(),
      projects: all("projects"),
      goals: all("goals"),
      tasks: all("tasks"),
      deleted,
    };
  }

  /** Records changed after `since` (null = everything). Backs delta sync. */
  getChanges(since: string | null | undefined): SyncChanges {
    if (!since) {
      const p = this.loadPayload();
      return { projects: p.projects, goals: p.goals, tasks: p.tasks, deleted: p.deleted };
    }
    const rows = (t: string) =>
      (this.db.query(`SELECT data FROM ${t} WHERE updated_at > ?`).all(since) as { data: string }[]).map((r) =>
        JSON.parse(r.data)
      );
    const deleted = (
      this.db.query(`SELECT id, at FROM deleted WHERE at > ? ORDER BY at ASC LIMIT ${MAX_TOMBSTONES}`).all(since) as {
        id: string;
        at: string;
      }[]
    ).map((r) => ({ id: r.id, at: r.at }));
    return { projects: rows("projects"), goals: rows("goals"), tasks: rows("tasks"), deleted };
  }

  serverTime(): string {
    const row = this.db
      .query(
        `SELECT MAX(m) AS m FROM (SELECT MAX(updated_at) AS m FROM projects UNION ALL SELECT MAX(updated_at) FROM goals UNION ALL SELECT MAX(updated_at) FROM tasks UNION ALL SELECT MAX(at) FROM deleted)`
      )
      .get() as { m: string | null };
    const now = new Date().toISOString();
    return row.m && row.m > now ? row.m : now;
  }

  private upsert(kind: Kind, id: string, updatedAt: string, data: string) {
    this.db
      .query(`INSERT INTO ${kind} (id, updated_at, data) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, data = excluded.data
              WHERE excluded.updated_at > ${kind}.updated_at`)
      .run(id, updatedAt, data);
  }

  /**
   * Apply incoming delta changes with LWW per record inside one
   * transaction. Returns what changed locally (for logging/counts).
   */
  applyChanges(changes: SyncChanges): MergeCounts & { pushed: number } {
    const before = this.loadPayload();
    const { payload, counts } = mergeChanges(before, changes);
    const pushed =
      (changes.projects?.length ?? 0) + (changes.goals?.length ?? 0) + (changes.tasks?.length ?? 0) + (changes.deleted?.length ?? 0);

    const txn = this.db.transaction(() => {
      for (const r of payload.projects as { id: string; updatedAt?: string }[]) {
        this.upsert("projects", r.id, r.updatedAt ?? "1970-01-01T00:00:00.000Z", JSON.stringify(r));
      }
      for (const r of payload.goals as { id: string; updatedAt?: string }[]) {
        this.upsert("goals", r.id, r.updatedAt ?? "1970-01-01T00:00:00.000Z", JSON.stringify(r));
      }
      for (const r of payload.tasks as { id: string; updatedAt?: string }[]) {
        this.upsert("tasks", r.id, r.updatedAt ?? "1970-01-01T00:00:00.000Z", JSON.stringify(r));
      }
      // Tombstones: keep newest per id; drop resurrected rows the merge removed.
      for (const d of payload.deleted) {
        this.db
          .query(`INSERT INTO deleted (id, at) VALUES (?, ?)
                  ON CONFLICT(id) DO UPDATE SET at = excluded.at WHERE excluded.at > deleted.at`)
          .run(d.id, d.at);
      }
      // Remove rows that the merge decided are deleted (tombstone won).
      for (const kind of ["projects", "goals", "tasks"] as Kind[]) {
        const rows = this.db.query(`SELECT id, updated_at FROM ${kind}`).all() as { id: string; updated_at: string }[];
        for (const row of rows) {
          const tombAt = payload.deleted.find((d) => d.id === row.id)?.at;
          if (tombAt && tombAt >= row.updated_at) this.db.query(`DELETE FROM ${kind} WHERE id = ?`).run(row.id);
        }
      }
      // Drop orphans from partial pushes (mergePayload already filtered them from payload).
      this.db.query(`DELETE FROM goals WHERE json_extract(data,'$.projectId') IS NOT NULL AND json_extract(data,'$.projectId') NOT IN (SELECT id FROM projects)`).run();
      this.db.query(`DELETE FROM tasks WHERE json_extract(data,'$.goalId') IS NOT NULL AND json_extract(data,'$.goalId') NOT IN (SELECT id FROM goals)`).run();
      // Cap tombstones at newest.
      this.db.exec(`DELETE FROM deleted WHERE id NOT IN (SELECT id FROM deleted ORDER BY at DESC LIMIT ${MAX_TOMBSTONES})`);
    });
    txn();
    return { ...counts, pushed };
  }

  /** Legacy path: merge a full payload (old clients / manual file import). */
  applyFullPayload(incoming: unknown): { payload: SyncPayload; counts: MergeCounts } {
    if (!isPayload(incoming)) throw new Error("Not a Hive sync payload.");
    const counts = this.applyChanges({
      projects: incoming.projects,
      goals: incoming.goals,
      tasks: incoming.tasks,
      deleted: incoming.deleted ?? [],
    });
    // applyChanges re-derives via merge; return the authoritative merged view.
    return { payload: this.loadPayload(), counts };
  }

  /** One-time migration from the old JSON sync file. Returns records imported. */
  async migrateFromJson(jsonPath: string): Promise<number> {
    // Don't overwrite a DB that already has data.
    const c = this.counts();
    if (c.projects + c.goals + c.tasks > 0) return 0;
    let parsed: unknown = null;
    try {
      const f = Bun.file(jsonPath);
      if (!(await f.exists())) return 0;
      parsed = JSON.parse(await f.text());
    } catch {
      return 0;
    }
    if (!isPayload(parsed)) return 0;
    const p = parsed as SyncPayload;
    const n = p.projects.length + p.goals.length + p.tasks.length;
    if (n === 0 && (p.deleted?.length ?? 0) === 0) return 0;
    this.applyChanges({ projects: p.projects, goals: p.goals, tasks: p.tasks, deleted: p.deleted ?? [] });
    console.log(`Migrated ${n} records from ${jsonPath} into SQLite.`);
    return n;
  }
}
