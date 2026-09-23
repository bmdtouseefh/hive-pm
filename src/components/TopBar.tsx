import { Show, createSignal } from "solid-js";
import { useStore } from "../store";

const THEME_KEY = "hive-pm-theme";

function isLight(): boolean {
  return document.documentElement.classList.contains("light");
}

export function TopBar(props: {
  onNewTask: () => void;
  onNewGoal: () => void;
  onSync: () => void;
  home: boolean;
}) {
  const { state, actions } = useStore();
  const [light, setLight] = createSignal(isLight());
  const toggleTheme = () => {
    const next = !light();
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "light" : "dark");
    } catch {}
  };
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
    <header class="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-hive-700 bg-hive-900 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
      <div class="min-w-0 flex-1 basis-40">
        <Show when={!props.home && active()} fallback={<div class="text-sm font-bold text-cream-100">Overview ✦</div>}>
          <div class="flex items-center gap-2 text-sm">
            <span class="hex grid h-6 w-6 place-items-center bg-hive-800 text-xs">{active()!.icon}</span>
            <span class="truncate font-bold text-cream-100">{active()!.name}</span>
            <span class="hidden text-cream-500/70 sm:inline">/ goals & tasks</span>
          </div>
        </Show>
        <div class="text-[11px] text-cream-500">
          {state.goals.filter((g) => !props.home && active() ? g.projectId === active()!.id : true).length} goals ·{" "}
          {state.tasks.length} tasks total
        </div>
      </div>

      <div class="ml-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
        <Show when={!state.online}>
          <span
            title="No connection — everything is saved in this browser and syncs when you're back home."
            class="shrink-0 rounded-xl border border-honey-500/40 bg-honey-500/10 px-3 py-2 text-xs font-bold text-honey-300"
          >
            Offline · saved here
          </span>
        </Show>
        <button
          onClick={toggleTheme}
          title={light() ? "Switch to dark mode" : "Switch to light mode"}
          class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-hive-600 bg-hive-800 text-base transition hover:bg-hive-700"
        >
          {light() ? "🌙" : "☀️"}
        </button>
        <button
          onClick={props.onSync}
          title={state.lastSyncAt ? `Last synced ${new Date(state.lastSyncAt).toLocaleString()}${state.lastSyncSummary ? ` (${state.lastSyncSummary})` : ""}` : "Sync phone ⇄ PC"}
          class="shrink-0 rounded-xl border border-hive-600 bg-hive-800 px-3 py-2 text-xs font-semibold text-cream-300 transition hover:bg-hive-700 hover:text-cream-100"
        >
          {syncLabel()}
        </button>
        <div class="relative hidden md:block">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-cream-500">⌕</span>
          <input
            value={state.query}
            onInput={(e) => actions.setQuery(e.currentTarget.value)}
            placeholder="Search tasks…  ( / )"
            class="w-56 rounded-xl border border-hive-600 bg-hive-800 py-2 pl-9 pr-3 text-sm text-cream-100 placeholder:text-cream-500/60 outline-none focus:border-honey-500"
          />
        </div>

        <div class="flex rounded-xl border border-hive-600 bg-hive-800 p-0.5 text-xs font-semibold">
          {(["hierarchy", "kanban"] as const).map((v) => (
            <button
              onClick={() => actions.setView(v)}
              class={`rounded-lg px-2 py-1.5 capitalize transition sm:px-3 ${state.view === v ? "bg-honey-500 text-honey-ink" : "text-cream-500 hover:text-cream-100"}`}
            >
              {v === "hierarchy" ? "◧ Tree" : "▤ Kanban"}
            </button>
          ))}
        </div>

        <Show when={!props.home}>
          <button onClick={props.onNewGoal} class="hidden rounded-xl border border-hive-600 bg-hive-800 px-3 py-2 text-sm font-semibold text-cream-300 hover:bg-hive-700 hover:text-cream-100 sm:block">
            + Goal
          </button>
          <button onClick={props.onNewTask} class="rounded-xl bg-honey-400 px-4 py-2 text-sm font-bold text-honey-ink transition hover:bg-honey-300 active:scale-95">
            + Task
          </button>
        </Show>
      </div>
    </header>
  );
}
