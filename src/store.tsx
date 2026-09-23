import { createContext, onCleanup, onMount, useContext, type ParentProps } from "solid-js";
import { createStore } from "solid-js/store";
import type { Goal, Project, Task, Tombstone } from "./types";
import { SEED_GOALS, SEED_PROJECTS, SEED_TASKS } from "./seed";
import { uid } from "./types";
import { MAX_TOMBSTONES, extractChanges, mergeChanges, mergePayload, type MergeCounts, type SyncPayload } from "./lib/merge";
import { getAutoSync, getSyncServer, pushPullDelta } from "./lib/lanSync";
import { loadSnapshot, readLocalBackup, saveSnapshot, type Backend } from "./lib/repo";

const isBrowserOnline = () => (typeof navigator !== "undefined" ? navigator.onLine : true);

interface State {
  projects: Project[];
  goals: Goal[];
  tasks: Task[];
  /** Deletion records so sync can propagate deletes. */
  deleted: Tombstone[];
  activeProjectId: string | null;
  query: string;
  view: "hierarchy" | "kanban";
  lastSyncAt: string | null;
  lastSyncSummary: string | null;
  /** Server cursor for delta sync (null = full pull on next sync). */
  serverCursor: string | null;
  /** Durable backend actually in use. Null until the async open finishes. */
  storage: Backend | null;
  /** Browser connectivity (navigator.onLine). Drives the offline badge. */
  online: boolean;
}

interface Actions {
  selectProject(id: string | null): void;
  setQuery(q: string): void;
  setView(v: State["view"]): void;
  addProject(p: Pick<Project, "name" | "description" | "icon" | "color">): Project;
  updateProject(id: string, patch: Partial<Project>): void;
  deleteProject(id: string): void;
  addGoal(g: Pick<Goal, "projectId" | "title" | "description" | "color" | "deadline">): Goal;
  updateGoal(id: string, patch: Partial<Goal>): void;
  deleteGoal(id: string): void;
  addTask(t: Pick<Task, "goalId" | "title" | "notes" | "status" | "priority" | "dueDate">): Task;
  updateTask(id: string, patch: Partial<Task>): void;
  deleteTask(id: string): void;
  toggleTask(id: string): void;
  resetDemo(): void;
  /** Serialize everything (incl. tombstones) for file sync. */
  exportData(): string;
  /** Merge a file-sync payload in. Last-write-wins per record. */
  importData(json: string): MergeCounts;
  /** Push to the home sync server and merge back. Null sync when offline. */
  syncNow(): Promise<MergeCounts>;
}

function withTimestamps<T extends { createdAt: string; updatedAt?: string }>(list: any[]): T[] {
  return list.map((r) => ({
    ...r,
    updatedAt: r.updatedAt ?? r.createdAt ?? new Date().toISOString(),
  }));
}

/**
 * Deep copies of the seed constants. Required because Solid's setState
 * mutates matched records in place — handing the live SEED_* arrays to the
 * store would let the first user edit permanently pollute them, making
 * every later resetDemo() restore already-edited data.
 */
function freshSeeds(): { projects: Project[]; goals: Goal[]; tasks: Task[] } {
  return {
    projects: structuredClone(SEED_PROJECTS),
    goals: structuredClone(SEED_GOALS),
    tasks: structuredClone(SEED_TASKS),
  };
}

function load(): State {
  const seeds = freshSeeds();
  const fallback: State = {
    projects: seeds.projects,
    goals: seeds.goals,
    tasks: seeds.tasks,
    deleted: [],
    activeProjectId: SEED_PROJECTS[0]?.id ?? null,
    query: "",
    view: "hierarchy",
    lastSyncAt: null,
    lastSyncSummary: null,
    serverCursor: null,
    storage: null,
    online: isBrowserOnline(),
  };
  // Synchronous fast boot from the localStorage cache; the authoritative
  // SQLite snapshot hydrates asynchronously in StoreProvider.
  try {
    const backup = readLocalBackup();
    if (backup) {
      return {
        projects: withTimestamps<Project>(backup.projects),
        goals: withTimestamps<Goal>(backup.goals),
        tasks: withTimestamps<Task>(backup.tasks),
        deleted: Array.isArray(backup.deleted) ? backup.deleted : [],
        activeProjectId: backup.activeProjectId ?? SEED_PROJECTS[0]?.id ?? null,
        query: "",
        view: "hierarchy",
        lastSyncAt: backup.lastSyncAt,
        lastSyncSummary: backup.lastSyncSummary,
        serverCursor: backup.serverCursor,
        storage: null,
        online: isBrowserOnline(),
      };
    }
  } catch {}
  return fallback;
}

const StoreCtx = createContext<{ state: State; actions: Actions }>(null as any);

const stamp = () => new Date().toISOString();

function currentPayload(s: State): SyncPayload {
  return {
    app: "hive-pm",
    version: 1,
    exportedAt: stamp(),
    projects: s.projects,
    goals: s.goals,
    tasks: s.tasks,
    deleted: s.deleted.slice(-MAX_TOMBSTONES),
  };
}

export function StoreProvider(props: ParentProps) {
  const [state, setState] = createStore<State>(load());

  // Authoritative hydration from SQLite (Tauri) once the DB is open.
  // Falls back to the localStorage snapshot on plain web.
  // Also tracks browser connectivity: coming back online auto-syncs, so the
  // phone just works outside and catches up when it's home again.
  onMount(() => {
    loadSnapshot()
      .then(({ snap, backend }) => {
        setState("storage", backend);
        if (!snap) return;
        setState({
          projects: withTimestamps<Project>(snap.projects),
          goals: withTimestamps<Goal>(snap.goals),
          tasks: withTimestamps<Task>(snap.tasks),
          deleted: Array.isArray(snap.deleted) ? snap.deleted : [],
          activeProjectId: snap.activeProjectId ?? state.projects[0]?.id ?? null,
          lastSyncAt: snap.lastSyncAt,
          lastSyncSummary: snap.lastSyncSummary,
          serverCursor: snap.serverCursor,
        });
      })
      .catch(() => {});

    const goOnline = () => {
      setState("online", true);
      if (getAutoSync() && getSyncServer()) actions.syncNow().catch(() => {});
    };
    const goOffline = () => setState("online", false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    onCleanup(() => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    });
  });

  const persist = () => {
    void saveSnapshot({
      projects: state.projects,
      goals: state.goals,
      tasks: state.tasks,
      deleted: state.deleted.slice(-MAX_TOMBSTONES),
      activeProjectId: state.activeProjectId,
      lastSyncAt: state.lastSyncAt,
      lastSyncSummary: state.lastSyncSummary,
      serverCursor: state.serverCursor,
    });
  };

  const rememberDeleted = (ids: string[]) => {
    if (!ids.length) return;
    const at = stamp();
    setState("deleted", (ds) => [...ds.filter((d) => !ids.includes(d.id)), ...ids.map((id) => ({ id, at }))].slice(-MAX_TOMBSTONES));
  };

  const actions: Actions = {
    selectProject: (id) => setState("activeProjectId", id),
    setQuery: (q) => setState("query", q),
    setView: (v) => setState("view", v),

    addProject: (p) => {
      const now = stamp();
      const project: Project = { ...p, id: uid("p"), createdAt: now, updatedAt: now };
      setState("projects", (ps) => [...ps, project]);
      setState("activeProjectId", project.id);
      persist();
      return project;
    },
    updateProject: (id, patch) => {
      setState("projects", (p) => p.id === id, { ...patch, updatedAt: stamp() });
      persist();
    },
    deleteProject: (id) => {
      const goalIds = state.goals.filter((g) => g.projectId === id).map((g) => g.id);
      const taskIds = state.tasks.filter((t) => goalIds.includes(t.goalId)).map((t) => t.id);
      rememberDeleted([id, ...goalIds, ...taskIds]);
      setState("tasks", (ts) => ts.filter((t) => !goalIds.includes(t.goalId)));
      setState("goals", (gs) => gs.filter((g) => g.projectId !== id));
      setState("projects", (ps) => ps.filter((p) => p.id !== id));
      if (state.activeProjectId === id) {
        setState("activeProjectId", state.projects[0]?.id ?? null);
      }
      persist();
    },

    addGoal: (g) => {
      const now = stamp();
      const goal: Goal = { ...g, id: uid("g"), createdAt: now, updatedAt: now };
      setState("goals", (gs) => [...gs, goal]);
      persist();
      return goal;
    },
    updateGoal: (id, patch) => {
      setState("goals", (g) => g.id === id, { ...patch, updatedAt: stamp() });
      persist();
    },
    deleteGoal: (id) => {
      const taskIds = state.tasks.filter((t) => t.goalId === id).map((t) => t.id);
      rememberDeleted([id, ...taskIds]);
      setState("tasks", (ts) => ts.filter((t) => t.goalId !== id));
      setState("goals", (gs) => gs.filter((g) => g.id !== id));
      persist();
    },

    addTask: (t) => {
      const now = stamp();
      const task: Task = { ...t, id: uid("t"), createdAt: now, updatedAt: now };
      setState("tasks", (ts) => [task, ...ts]);
      persist();
      return task;
    },
    updateTask: (id, patch) => {
      const patch2: Partial<Task> = { ...patch, updatedAt: stamp() };
      if (patch.status === "done") patch2.completedAt = new Date().toISOString();
      if (patch.status && patch.status !== "done") patch2.completedAt = undefined;
      setState("tasks", (t) => t.id === id, patch2);
      persist();
    },
    deleteTask: (id) => {
      rememberDeleted([id]);
      setState("tasks", (ts) => ts.filter((t) => t.id !== id));
      persist();
    },
    toggleTask: (id) => {
      const t = state.tasks.find((x) => x.id === id);
      if (!t) return;
      actions.updateTask(id, { status: t.status === "done" ? "todo" : "done" });
    },
    resetDemo: () => {
      const seeds = freshSeeds();
      setState({ projects: seeds.projects, goals: seeds.goals, tasks: seeds.tasks, deleted: [], activeProjectId: seeds.projects[0].id, query: "", view: "hierarchy", serverCursor: null });
      persist();
    },

    exportData: () => {
      return JSON.stringify(currentPayload(state), null, 2);
    },

    importData: (json) => {
      const parsed = JSON.parse(json);
      if (parsed?.app !== "hive-pm" && parsed?.app !== "pulse-pm") throw new Error("Not a Hive sync file.");
      const { payload, counts } = mergePayload(currentPayload(state), parsed);
      setState({
        projects: payload.projects,
        goals: payload.goals,
        tasks: payload.tasks,
        deleted: payload.deleted,
        activeProjectId: payload.projects.some((x) => x.id === state.activeProjectId)
          ? state.activeProjectId
          : (payload.projects[0]?.id ?? null),
      });
      persist();
      return counts;
    },

    syncNow: async () => {
      const server = getSyncServer();
      if (!server) throw new Error("No sync server set — enter your home server below.");
      const since = state.serverCursor;
      // Delta sync only. Only rows changed since the last cursor travel
      // either way, so an unsynced device can never overwrite newer rows
      // with its stale snapshot.
      const changes = extractChanges(currentPayload(state), since);
      const res = await pushPullDelta(server, changes, since);
      const { payload, counts } = mergeChanges(currentPayload(state), res.changes);
      const pushed = res.counts.pushed;
      const at = stamp();
      const summary = `${counts.added + pushed} new · ${counts.updated} updated · ${counts.removed} removed`;
      setState({
        projects: payload.projects,
        goals: payload.goals,
        tasks: payload.tasks,
        deleted: payload.deleted,
        activeProjectId: payload.projects.some((x) => x.id === state.activeProjectId)
          ? state.activeProjectId
          : (payload.projects[0]?.id ?? null),
        serverCursor: res.serverTime,
        lastSyncAt: at,
        lastSyncSummary: summary,
      });
      persist();
      return counts;
    },
  };

  return <StoreCtx.Provider value={{ state, actions }}>{props.children}</StoreCtx.Provider>;
}

export function useStore() {
  return useContext(StoreCtx)!;
}

// Selectors
export function goalProgress(goalId: string, tasks: Task[]): number {
  const list = tasks.filter((t) => t.goalId === goalId);
  if (!list.length) return 0;
  return Math.round((list.filter((t) => t.status === "done").length / list.length) * 100);
}

export function projectProgress(projectId: string, goals: Goal[], tasks: Task[]): number {
  const gIds = new Set(goals.filter((g) => g.projectId === projectId).map((g) => g.id));
  const list = tasks.filter((t) => gIds.has(t.goalId));
  if (!list.length) return 0;
  return Math.round((list.filter((t) => t.status === "done").length / list.length) * 100);
}
