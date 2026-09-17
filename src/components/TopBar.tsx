import { Show } from "solid-js";
import { useStore } from "../store";

export function TopBar(props: {
  onNewTask: () => void;
  onNewGoal: () => void;
  onSync: () => void;
  home: boolean;
}) {
  const { state, actions } = useStore();
  const active = () => state.projects.find((p) => p.id === state.activeProjectId);
  const syncLabel = () => {
    if (state.lastSyncAt) {
      const d = new Date(state.lastSyncAt);
      const today = new Date().toDateString() === d.toDateString();
      const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `✓ ${today ? time : d.toLocaleDateString()}`;
    }
    return "⇄ Sync";
  };

  return (
    <header class="flex items-center gap-3 border-b border-zinc-800 bg-[#1d1f25] px-6 py-3">
      <div class="min-w-0">
        <Show when={!props.home && active()} fallback={<div class="text-sm font-bold text-white">Overview ✦</div>}>
          <div class="flex items-center gap-2 text-sm">
            <span>{active()!.icon}</span>
            <span class="truncate font-bold text-white">{active()!.name}</span>
            <span class="hidden text-zinc-600 sm:inline">/ goals & tasks</span>
          </div>
        </Show>
        <div class="text-[11px] text-zinc-500">
          {state.goals.filter((g) => !props.home && active() ? g.projectId === active()!.id : true).length} goals ·{" "}
          {state.tasks.length} tasks total
        </div>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button
          onClick={props.onSync}
          title={state.lastSyncAt ? `Last synced ${new Date(state.lastSyncAt).toLocaleString()}${state.lastSyncSummary ? ` (${state.lastSyncSummary})` : ""}` : "Sync phone ⇄ PC"}
          class="shrink-0 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
        >
          {syncLabel()}
        </button>
        <div class="relative hidden md:block">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">⌕</span>
          <input
            value={state.query}
            onInput={(e) => actions.setQuery(e.currentTarget.value)}
            placeholder="Search tasks…  ( / )"
            class="w-56 rounded-xl border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-zinc-500"
          />
        </div>

        <div class="flex rounded-xl border border-zinc-700 bg-zinc-800 p-0.5 text-xs font-semibold">
          {(["hierarchy", "kanban"] as const).map((v) => (
            <button
              onClick={() => actions.setView(v)}
              class={`rounded-lg px-3 py-1.5 capitalize transition ${state.view === v ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              {v === "hierarchy" ? "◧ Tree" : "▤ Kanban"}
            </button>
          ))}
        </div>

        <Show when={!props.home}>
          <button onClick={props.onNewGoal} class="hidden rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white sm:block">
            + Goal
          </button>
          <button onClick={props.onNewTask} class="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-400 active:scale-95">
            + Task
          </button>
        </Show>
      </div>
    </header>
  );
}
