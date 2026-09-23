import type { Goal, Project, Task, Tombstone } from "../types";

/** The sync payload: same shape as the manual sync file. */
export interface SyncPayload {
  app: "hive-pm" | "pulse-pm";
  version: 1;
  exportedAt: string;
  projects: Project[];
  goals: Goal[];
  tasks: Task[];
  deleted: Tombstone[];
}

export interface MergeCounts {
  added: number;
  updated: number;
  removed: number;
}

/** Cap on retained tombstones (sync + local snapshots). */
export const MAX_TOMBSTONES = 1000;

/**
 * Delta-sync types. Instead of shipping the whole database on every sync
 * (which risks a stale device overwriting newer rows when merges race),
 * clients exchange only records changed since a server cursor.
 */
export interface SyncChanges {
  projects: Project[];
  goals: Goal[];
  tasks: Task[];
  deleted: Tombstone[];
}

export interface DeltaSyncRequest {
  app: "hive-pm" | "pulse-pm";
  version: 1;
  /** Server cursor the client last saw (null = full pull). */
  since: string | null;
  changes: SyncChanges;
}

export interface DeltaSyncResponse {
  app: "hive-pm";
  version: 1;
  /** New cursor the client should store and send as `since` next time. */
  serverTime: string;
  changes: SyncChanges;
  counts: MergeCounts & { pushed: number };
}

export function isDeltaRequest(v: unknown): v is DeltaSyncRequest {
  const r = v as DeltaSyncRequest;
  return (
    !!r &&
    typeof r === "object" &&
    (r.app === "hive-pm" || r.app === "pulse-pm") &&
    !!r.changes &&
    typeof r.changes === "object" &&
    Array.isArray((r.changes as SyncChanges).projects) &&
    Array.isArray((r.changes as SyncChanges).goals) &&
    Array.isArray((r.changes as SyncChanges).tasks) &&
    (r.since === null || r.since === undefined || typeof r.since === "string")
  );
}

export function isDeltaResponse(v: unknown): v is DeltaSyncResponse {
  const r = v as DeltaSyncResponse;
  return (
    !!r &&
    typeof r === "object" &&
    r.app === "hive-pm" &&
    typeof r.serverTime === "string" &&
    !!r.changes &&
    Array.isArray(r.changes.projects) &&
    Array.isArray(r.changes.goals) &&
    Array.isArray(r.changes.tasks)
  );
}

/** Highest timestamp across a payload — usable as a sync cursor. */
export function maxCursor(p: Pick<SyncPayload, "projects" | "goals" | "tasks" | "deleted">): string | null {
  let max: string | null = null;
  const consider = (t?: string) => {
    if (typeof t === "string" && (max === null || t > max)) max = t;
  };
  for (const r of p.projects) consider(r.updatedAt);
  for (const r of p.goals) consider(r.updatedAt);
  for (const r of p.tasks) consider(r.updatedAt);
  for (const d of p.deleted) consider(d.at);
  return max;
}

/**
 * Slice a full payload down to records changed after `since`.
 * Null `since` returns everything (initial pull).
 */
export function extractChanges(
  p: Pick<SyncPayload, "projects" | "goals" | "tasks" | "deleted">,
  since: string | null | undefined
): SyncChanges {
  if (!since) {
    return { projects: [...p.projects], goals: [...p.goals], tasks: [...p.tasks], deleted: [...p.deleted] };
  }
  return {
    projects: p.projects.filter((r) => (r.updatedAt ?? "") > since),
    goals: p.goals.filter((r) => (r.updatedAt ?? "") > since),
    tasks: p.tasks.filter((r) => (r.updatedAt ?? "") > since),
    deleted: p.deleted.filter((d) => d.at > since),
  };
}

/**
 * Merge a delta `changes` object into `base`. Same LWW-per-record +
 * tombstone semantics as mergePayload, but never lets absent records read
 * as deletions (fixes full-payload override data loss).
 */
export function mergeChanges(
  base: SyncPayload,
  changes: unknown
): { payload: SyncPayload; counts: MergeCounts } {
  const c = (changes ?? {}) as Partial<SyncChanges>;
  const arr = (v: unknown) => (Array.isArray(v) ? v : []) as never[];
  return mergePayload(base, {
    ...blankPayload(),
    projects: arr(c.projects),
    goals: arr(c.goals),
    tasks: arr(c.tasks),
    deleted: arr(c.deleted),
  });
}

export function blankPayload(): SyncPayload {
  return {
    app: "hive-pm",
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: [],
    goals: [],
    tasks: [],
    deleted: [],
  };
}

export function isPayload(v: unknown): v is SyncPayload {
  const p = v as SyncPayload;
  return (
    !!p &&
    (p.app === "hive-pm" || p.app === "pulse-pm") &&
    Array.isArray(p.projects) &&
    Array.isArray(p.goals) &&
    Array.isArray(p.tasks)
  );
}

/** Merge one record list by id, newest updatedAt wins. Tombstones suppress stale records. */
function mergeList<T extends { id: string; updatedAt?: string }>(
  local: T[],
  incoming: unknown,
  tombstones: Map<string, string>
): { list: T[]; added: number; updated: number } {
  const norm = (r: T) => ({ ...r, updatedAt: r.updatedAt ?? "1970-01-01T00:00:00.000Z" });
  const byId = new Map<string, T>(local.map((r) => [r.id, norm(r)]));
  let added = 0;
  let updated = 0;
  if (!Array.isArray(incoming)) return { list: [...byId.values()], added, updated };
  for (const raw of incoming) {
    const rec = norm(raw as T);
    if (!rec || typeof rec.id !== "string" || typeof rec.updatedAt !== "string") continue;
    const tombAt = tombstones.get(rec.id);
    if (tombAt && tombAt >= rec.updatedAt) continue; // deleted after their edit
    const cur = byId.get(rec.id);
    if (!cur) {
      byId.set(rec.id, rec);
      added++;
    } else if (rec.updatedAt > (cur.updatedAt ?? "")) {
      byId.set(rec.id, rec);
      updated++;
    }
  }
  return { list: [...byId.values()], added, updated };
}

/**
 * Merge `incoming` into `base`. Symmetric: merging A→B then B→A converges.
 * Returns the merged payload plus what changed in `base`.
 */
export function mergePayload(
  base: SyncPayload,
  incoming: unknown
): { payload: SyncPayload; counts: MergeCounts } {
  const inc = (isPayload(incoming) ? incoming : blankPayload()) as SyncPayload;
  const tombstones = new Map<string, string>();
  for (const d of [...base.deleted, ...inc.deleted]) {
    if (d && typeof d.id === "string" && typeof d.at === "string") {
      const cur = tombstones.get(d.id);
      if (!cur || d.at > cur) tombstones.set(d.id, d.at);
    }
  }

  const p = mergeList<Project>(base.projects, inc.projects, tombstones);
  const g = mergeList<Goal>(base.goals, inc.goals, tombstones);
  const t = mergeList<Task>(base.tasks, inc.tasks, tombstones);

  let removed = 0;
  const dropDeleted = <T extends { id: string; updatedAt?: string }>(list: T[]): T[] =>
    list.filter((r) => {
      const at = tombstones.get(r.id);
      if (at && at >= (r.updatedAt ?? "")) {
        removed++;
        return false;
      }
      return true;
    });

  const projects = dropDeleted(p.list);
  const projectIds = new Set(projects.map((x) => x.id));
  const goals = dropDeleted(g.list).filter((x) => projectIds.has(x.projectId));
  const goalIds = new Set(goals.map((x) => x.id));
  const tasks = dropDeleted(t.list).filter((x) => goalIds.has(x.goalId));

  return {
    payload: {
      app: "hive-pm",
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
      goals,
      tasks,
      deleted: [...tombstones.entries()]
        .map(([id, at]) => ({ id, at }))
        .slice(-MAX_TOMBSTONES),
    },
    counts: {
      added: p.added + g.added + t.added,
      updated: p.updated + g.updated + t.updated,
      removed,
    },
  };
}
