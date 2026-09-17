import { createContext, useContext, type ParentProps } from "solid-js";
import { createStore } from "solid-js/store";
import type { Goal, Project, Task, Tombstone } from "./types";
import { SEED_GOALS, SEED_PROJECTS, SEED_TASKS } from "./seed";
import { uid } from "./types";
import { mergePayload, type SyncPayload } from "./lib/merge";
import { getSyncServer, pushPull } from "./lib/lanSync";

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
}

export interface MergeResult {
  added: number;
  updated: number;
  removed: number;
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
  importData(json: string): MergeResult;
  /** Push to the home sync server and merge back. Null sync when offline. */
  syncNow(): Promise<MergeResult>;
}

const KEY = "pulse-pm-v1";

function withTimestamps<T extends { createdAt: string; updatedAt?: string }>(list: any[]): T[] {
  return list.map((r) => ({
    ...r,
    updatedAt: r.updatedAt ?? r.createdAt ?? new Date().toISOString(),
  }));
}

function load(): State {
  const fallback: State = {
    projects: SEED_PROJECTS,
    goals: SEED_GOALS,
    tasks: SEED_TASKS,
    deleted: [],
    activeProjectId: SEED_PROJECTS[0]?.id ?? null,
    query: "",
    view: "hierarchy",
    lastSyncAt: null,
    lastSyncSummary: null,
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        projects: withTimestamps<Project>(parsed.projects ?? SEED_PROJECTS),
        goals: withTimestamps<Goal>(parsed.goals ?? SEED_GOALS),
        tasks: withTimestamps<Task>(parsed.tasks ?? SEED_TASKS),
        deleted: Array.isArray(parsed.deleted) ? parsed.deleted : [],
        activeProjectId: parsed.activeProjectId ?? SEED_PROJECTS[0]?.id ?? null,
        query: "",
        view: "hierarchy",
        lastSyncAt: parsed.lastSyncAt ?? null,
        lastSyncSummary: parsed.lastSyncSummary ?? null,
      };
    }
  } catch {}
  return fallback;
}

const StoreCtx = createContext<{ state: State; actions: Actions }>(null as any);

const stamp = () => new Date().toISOString();

function currentPayload(s: State): SyncPayload {
  return {
    app: "pulse-pm",
    version: 1,
    exportedAt: stamp(),
    projects: s.projects,
    goals: s.goals,
    tasks: s.tasks,
    deleted: s.deleted.slice(-1000),
  };
}

export function StoreProvider(props: ParentProps) {
  const [state, setState] = createStore<State>(load());

  const persist = () => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          projects: state.projects,
          goals: state.goals,
          tasks: state.tasks,
          deleted: state.deleted.slice(-1000),
          activeProjectId: state.activeProjectId,
          lastSyncAt: state.lastSyncAt,
          lastSyncSummary: state.lastSyncSummary,
        })
      );
    } catch {}
  };

  const rememberDeleted = (ids: string[]) => {
    if (!ids.length) return;
    const at = stamp();
    setState("deleted", (ds) => [...ds.filter((d) => !ids.includes(d.id)), ...ids.map((id) => ({ id, at }))].slice(-1000));
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
      setState({ projects: SEED_PROJECTS, goals: SEED_GOALS, tasks: SEED_TASKS, deleted: [], activeProjectId: SEED_PROJECTS[0].id, query: "", view: "hierarchy" });
      persist();
    },

    exportData: () => {
      return JSON.stringify(
        {
          app: "pulse-pm",
          version: 1,
          exportedAt: stamp(),
          projects: state.projects,
          goals: state.goals,
          tasks: state.tasks,
          deleted: state.deleted.slice(-1000),
        },
        null,
        2
      );
    },

    importData: (json) => {
      const parsed = JSON.parse(json);
      if (parsed?.app !== "pulse-pm") throw new Error("Not a Pulse PM sync file.");
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
      const mergedJson = await pushPull(server, actions.exportData());
      const result = actions.importData(mergedJson);
      const at = stamp();
      const summary = `${result.added} new · ${result.updated} updated · ${result.removed} removed`;
      setState({ lastSyncAt: at, lastSyncSummary: summary });
      persist();
      return result;
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
