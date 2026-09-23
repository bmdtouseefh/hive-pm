import { For, Show, createMemo, createSignal } from "solid-js";
import { useStore, projectProgress, goalProgress } from "../store";
import { ProgressBar } from "./ui";

export function Sidebar(props: {
  onNewProject: () => void;
  onEditProject: (id: string) => void;
  onHome: () => void;
  home: boolean;
}) {
  const { state, actions } = useStore();
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({ [state.activeProjectId ?? ""]: true });

  const totals = createMemo(() => {
    const map: Record<string, { goals: number; done: number; total: number }> = {};
    for (const p of state.projects) {
      const gs = state.goals.filter((g) => g.projectId === p.id);
      const gIds = new Set(gs.map((g) => g.id));
      const ts = state.tasks.filter((t) => gIds.has(t.goalId));
      map[p.id] = { goals: gs.length, done: ts.filter((t) => t.status === "done").length, total: ts.length };
    }
    return map;
  });

  return (
    <aside class="relative flex h-full w-[290px] shrink-0 flex-col border-r border-hive-700 bg-hive-900">
      <div class="honeycomb-bg honeycomb-fade pointer-events-none absolute inset-x-0 top-0 h-28 opacity-70" />
      {/* logo */}
      <div class="relative flex items-center gap-3 px-5 pb-4 pt-5">
        <div class="bee-waggle hex grid h-10 w-10 shrink-0 place-items-center bg-honey-400 text-xl text-honey-ink">
          🐝
        </div>
        <div>
          <div class="text-[15px] font-extrabold tracking-tight text-cream-100">
            Hive PM
          </div>
          <div class="text-[11px] text-cream-500">Project → Goal → Task</div>
        </div>
        <button
          onClick={props.onNewProject}
          title="New project"
          class="ml-auto grid h-8 w-8 place-items-center rounded-xl border border-hive-600 bg-hive-800 text-lg text-honey-300 transition hover:bg-hive-700"
        >
          +
        </button>
      </div>

      {/* nav */}
      <div class="relative px-3">
        <button
          onClick={props.onHome}
          class={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            props.home ? "bg-honey-500 text-honey-ink" : "text-cream-500 hover:bg-hive-800 hover:text-cream-100"
          }`}
        >
          <span class="text-base">✦</span> Overview
          <span class={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${props.home ? "bg-honey-ink/20 text-honey-ink" : "bg-hive-800 text-cream-300"}`}>{state.tasks.length}</span>
        </button>
      </div>

      <div class="mt-4 flex items-center px-5">
        <span class="text-[11px] font-bold uppercase tracking-[0.14em] text-cream-500">Projects</span>
        <span class="ml-auto text-[11px] text-cream-500/70">{state.projects.length}</span>
      </div>

      {/* projects tree */}
      <div class="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        <For each={state.projects}>
          {(p) => {
            const isActive = () => state.activeProjectId === p.id;
            const prog = () => projectProgress(p.id, state.goals, state.tasks);
            const t = () => totals()[p.id] ?? { goals: 0, done: 0, total: 0 };
            const isOpen = () => expanded()[p.id] ?? false;
            const goals = () => state.goals.filter((g) => g.projectId === p.id);
            return (
              <div class={`rounded-xl border transition ${isActive() ? "border-honey-500/50 bg-hive-800" : "border-transparent hover:bg-hive-800/60"}`}>
                <div class="flex items-center gap-2 px-2 py-2">
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [p.id]: !isOpen() }))}
                    class="grid h-6 w-6 place-items-center rounded-md text-xs text-cream-500 hover:bg-hive-700 hover:text-cream-100"
                  >
                    {isOpen() ? "▾" : "▸"}
                  </button>
                  <button onClick={() => actions.selectProject(p.id)} class="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span class="hex grid h-7 w-7 shrink-0 place-items-center bg-hive-700 text-sm">
                      {p.icon}
                    </span>
                    <span class="min-w-0">
                      <span class={`block truncate text-[13px] font-semibold ${isActive() ? "text-cream-100" : "text-cream-300"}`}>{p.name}</span>
                      <span class="block text-[11px] text-cream-500">{t().done}/{t().total} tasks · {t().goals} goals</span>
                    </span>
                  </button>
                  <button onClick={() => props.onEditProject(p.id)} class="rounded-md px-1.5 py-1 text-xs text-cream-500/60 hover:bg-hive-700 hover:text-cream-100" title="Edit project">✎</button>
                </div>
                <div class="px-3 pb-1"><ProgressBar value={prog()} color={p.color} /></div>
                <Show when={isOpen()}>
                  <div class="space-y-0.5 px-2 pb-2 pl-9">
                    <For each={goals()}>
                      {(g) => {
                        const gp = () => goalProgress(g.id, state.tasks);
                        const count = () => state.tasks.filter((t) => t.goalId === g.id).length;
                        return (
                          <button onClick={() => actions.selectProject(p.id)} class="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-hive-700/60">
                            <span class="hex h-2.5 w-2.5 shrink-0" style={{ background: g.color }} />
                            <span class="min-w-0 flex-1 truncate text-xs text-cream-500 group-hover:text-cream-100">{g.title}</span>
                            <span class="text-[10px] tabular-nums text-cream-500/70">{gp()}% · {count()}</span>
                          </button>
                        );
                      }}
                    </For>
                    <Show when={goals().length === 0}>
                      <div class="px-2 py-1 text-[11px] text-cream-500/60">No goals yet</div>
                    </Show>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* footer */}
      <div class="border-t border-hive-700 p-4">
        <div class="rounded-2xl border border-honey-500/30 bg-hive-800 p-3">
          <div class="text-xs font-bold text-honey-300">Ship it 🚀</div>
          <div class="mt-0.5 text-[11px] leading-snug text-cream-500">
            {state.tasks.filter((t) => t.status === "done").length} of {state.tasks.length} tasks complete
          </div>
          <button onClick={() => actions.resetDemo()} class="mt-2 w-full rounded-lg border border-hive-600 bg-hive-700 py-1.5 text-[11px] font-semibold text-cream-300 hover:bg-hive-600 hover:text-cream-100">
            ↺ Reset demo data
          </button>
        </div>
      </div>
    </aside>
  );
}
