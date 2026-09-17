import type { Goal, Project, Task, Tombstone } from "../types";

/** The sync payload: same shape as the manual sync file. */
export interface SyncPayload {
  app: "pulse-pm";
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

export function blankPayload(): SyncPayload {
  return {
    app: "pulse-pm",
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
    p.app === "pulse-pm" &&
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
      app: "pulse-pm",
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
      goals,
      tasks,
      deleted: [...tombstones.entries()]
        .map(([id, at]) => ({ id, at }))
        .slice(-1000),
    },
    counts: {
      added: p.added + g.added + t.added,
      updated: p.updated + g.updated + t.updated,
      removed,
    },
  };
}
