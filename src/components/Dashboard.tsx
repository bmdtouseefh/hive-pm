import { For } from "solid-js";
import { useStore, projectProgress } from "../store";
import { isOverdue } from "../types";
import { Ring, ProgressBar } from "./ui";

export function Dashboard(props: { onOpen: (id: string) => void; onNewProject: () => void }) {
  const { state } = useStore();
  const done = () => state.tasks.filter((t) => t.status === "done").length;
  const inProg = () => state.tasks.filter((t) => t.status === "in-progress").length;
  const overdue = () => state.tasks.filter((t) => isOverdue(t)).length;
  const pct = () => (state.tasks.length ? Math.round((done() / state.tasks.length) * 100) : 0);

  const cards = () => [
    { icon: "📦", label: "Projects", value: state.projects.length, sub: `${state.goals.length} goals live` },
    { icon: "🎯", label: "Goals", value: state.goals.length, sub: `${inProg()} tasks in motion` },
    { icon: "✓", label: "Done", value: done(), sub: `${pct()}% completion` },
    { icon: "⏰", label: "Overdue", value: overdue(), sub: "needs attention" },
  ];

  return (
    <div class="anim-fadeUp space-y-6">
      {/* hero */}
      <div class="relative overflow-hidden rounded-2xl border border-honey-500/30 bg-hive-850 p-4 sm:p-8">
        <div class="honeycomb-bg absolute inset-0 opacity-60" />
        <div class="relative flex flex-wrap items-center gap-4 sm:gap-6">
          <div class="min-w-0 flex-1 basis-48">
            <div class="text-[11px] font-bold uppercase tracking-[0.2em] text-honey-300">Good day — let's ship</div>
            <h1 class="mt-1 text-2xl font-extrabold tracking-tight text-cream-100 sm:text-4xl">
              Mission control for your ideas
            </h1>
            <p class="mt-2 max-w-md text-sm leading-relaxed text-cream-500">
              Projects break into <b class="text-honey-200">goals</b>, goals break into <b class="text-honey-200">tasks</b>. Pick a project on the left, or spin up a new one.
            </p>
            <div class="mt-4 flex gap-2">
              <button onClick={props.onNewProject} class="rounded-xl bg-honey-400 px-4 py-2 text-sm font-bold text-honey-ink transition hover:bg-honey-300 active:scale-95">
                + New project
              </button>
              <div class="flex items-center gap-2 rounded-xl border border-hive-600 bg-hive-800 px-3 py-2 text-xs text-cream-300">
                <span class="hex h-2 w-2 bg-honey-400" /> Tauri desktop ready
              </div>
            </div>
          </div>
          <div class="flex min-w-0 w-full items-center gap-4 rounded-2xl border border-hive-600 bg-hive-800/90 p-4 sm:w-auto">
            <Ring value={pct()} size={72} />
            <div>
              <div class="text-sm font-bold text-cream-100">{done()}/{state.tasks.length} tasks</div>
              <div class="text-xs text-cream-500">across {state.projects.length} projects</div>
              <div class="mt-2 w-32 sm:w-40"><ProgressBar value={pct()} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* stats */}
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <For each={cards()}>
          {(c) => (
            <div class="rounded-2xl border border-hive-700 bg-hive-850 p-4">
              <div class="hex grid h-8 w-8 place-items-center bg-hive-800 text-lg">{c.icon}</div>
              <div class="mt-2 text-2xl font-extrabold tabular-nums text-cream-100">{c.value}</div>
              <div class="text-xs font-semibold uppercase tracking-wider text-honey-300/80">{c.label}</div>
              <div class="mt-0.5 text-[11px] text-cream-500">{c.sub}</div>
            </div>
          )}
        </For>
      </div>

      {/* projects grid */}
      <div>
        <div class="mb-3 flex items-center">
          <h2 class="text-sm font-bold uppercase tracking-[0.14em] text-cream-500">All projects</h2>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <For each={state.projects}>
            {(p) => {
              const prog = () => projectProgress(p.id, state.goals, state.tasks);
              const gs = () => state.goals.filter((g) => g.projectId === p.id);
              return (
                <button onClick={() => props.onOpen(p.id)} class="group rounded-2xl border border-hive-700 bg-hive-850 p-4 text-left transition hover:border-honey-500/60">
                  <div class="flex items-center gap-3">
                    <span class="hex grid h-11 w-11 place-items-center bg-hive-800 text-xl">{p.icon}</span>
                    <div class="min-w-0 flex-1">
                      <div class="truncate font-bold text-cream-100">{p.name}</div>
                      <div class="truncate text-xs text-cream-500">{p.description || "No description"}</div>
                    </div>
                    <span class="text-lg text-cream-500/50 transition group-hover:translate-x-1 group-hover:text-honey-300">→</span>
                  </div>
                  <div class="mt-3"><ProgressBar value={prog()} color={p.color} /></div>
                  <div class="mt-2 flex items-center text-[11px] text-cream-500">
                    <span>{prog()}% · {gs().length} goals</span>
                    <span class="ml-auto flex -space-x-1">
                      <For each={gs().slice(0, 4)}>
                        {(g) => <span class="hex h-4 w-4 border-2 border-hive-850" style={{ background: g.color }} title={g.title} />}
                      </For>
                    </span>
                  </div>
                </button>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}
