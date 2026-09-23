import { Show, createEffect, createSignal, onMount } from "solid-js";
import { StoreProvider, useStore } from "./store";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Dashboard } from "./components/Dashboard";
import { ProjectView } from "./components/ProjectView";
import { GoalModal, ProjectModal, TaskModal } from "./components/Modals";
import { SyncDialog } from "./components/SyncDialog";
import { getAutoSync, getSyncServer } from "./lib/lanSync";
import type { Task } from "./types";

type ModalState =
  | { kind: "none" }
  | { kind: "project"; editingId?: string }
  | { kind: "goal"; editingId?: string }
  | { kind: "task"; goalId: string; editing?: Task };

function Shell() {
  const { state, actions } = useStore();
  const [modal, setModal] = createSignal<ModalState>({ kind: "none" });
  const [syncOpen, setSyncOpen] = createSignal(false);

  const home = () => state.activeProjectId === null;
  const defaultGoalId = () => {
    const pid = state.activeProjectId;
    if (!pid) return state.goals[0]?.id ?? "";
    return state.goals.find((g) => g.projectId === pid)?.id ?? "";
  };

  // keyboard: "/" focuses search, Esc closes
  onMount(() => {
    // fire-and-forget: syncs when home, silently stays offline when away
    if (getAutoSync() && getSyncServer()) {
      actions.syncNow().catch(() => {});
    }
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA")) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus();
      }
      if (e.key === "Escape") { setModal({ kind: "none" }); setSyncOpen(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // if active project got deleted, go home
  createEffect(() => {
    if (state.activeProjectId && !state.projects.some((p) => p.id === state.activeProjectId)) {
      actions.selectProject(null);
    }
  });

  const openNewTask = (goalId?: string) => setModal({ kind: "task", goalId: goalId ?? defaultGoalId() });

  return (
    <div class="flex h-dvh overflow-hidden bg-hive-950 text-cream-100">
      <div class="flex h-full w-full">
        <div class="hidden md:block">
          <Sidebar
            home={home()}
            onHome={() => actions.selectProject(null)}
            onNewProject={() => setModal({ kind: "project" })}
            onEditProject={(id) => setModal({ kind: "project", editingId: id })}
          />
        </div>

        <main class="flex min-w-0 flex-1 flex-col">
          <TopBar
            home={home()}
            onNewTask={() => openNewTask()}
            onNewGoal={() => setModal({ kind: "goal" })}
            onSync={() => setSyncOpen(true)}
          />

          {/* mobile project picker */}
          <div class="flex gap-2 overflow-x-auto border-b border-hive-700 bg-hive-900 px-3 py-2 md:hidden">
            <button onClick={() => actions.selectProject(null)} class={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${home() ? "bg-honey-500 text-honey-ink" : "bg-hive-800 text-cream-500"}`}>⬢ All</button>
            {state.projects.map((p) => (
              <button onClick={() => actions.selectProject(p.id)} class={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${state.activeProjectId === p.id ? "bg-honey-500 text-honey-ink" : "bg-hive-800 text-cream-500"}`}>
                {p.icon} {p.name}
              </button>
            ))}
          </div>

          <div class="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
            <div class="mx-auto max-w-6xl pb-16">
              <Show
                when={!home() && state.activeProjectId}
                fallback={<Dashboard onOpen={(id) => actions.selectProject(id)} onNewProject={() => setModal({ kind: "project" })} />}
              >
                <ProjectView
                  projectId={state.activeProjectId!}
                  onNewTask={(g) => openNewTask(g)}
                  onEditTask={(t) => setModal({ kind: "task", goalId: t.goalId, editing: t })}
                  onNewGoal={() => setModal({ kind: "goal" })}
                  onEditGoal={(id) => setModal({ kind: "goal", editingId: id })}
                  onEditProject={(id) => setModal({ kind: "project", editingId: id })}
                />
              </Show>
            </div>
          </div>
        </main>
      </div>

      {/* modals */}
      <Show when={modal().kind === "project"}>
        <ProjectModal
          editing={(() => { const m = modal(); return m.kind === "project" && m.editingId ? state.projects.find((p) => p.id === m.editingId) : undefined; })()}
          onClose={() => setModal({ kind: "none" })}
        />
      </Show>
      <Show when={modal().kind === "goal" && state.activeProjectId}>
        <GoalModal
          projectId={state.activeProjectId!}
          editing={(() => { const m = modal(); return m.kind === "goal" && m.editingId ? state.goals.find((g) => g.id === m.editingId) : undefined; })()}
          onClose={() => setModal({ kind: "none" })}
        />
      </Show>
      <Show when={modal().kind === "task"}>
        <TaskModal
          goalId={(() => { const m = modal(); return m.kind === "task" ? m.goalId : defaultGoalId(); })()}
          editing={(() => { const m = modal(); return m.kind === "task" ? m.editing : undefined; })()}
          onClose={() => setModal({ kind: "none" })}
        />
      </Show>
      <Show when={syncOpen()}>
        <SyncDialog onClose={() => setSyncOpen(false)} />
      </Show>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
