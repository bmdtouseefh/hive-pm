import { For } from "solid-js";
import { useStore, projectProgress } from "../store";
import { Ring, ProgressBar } from "./ui";

export function Dashboard(props: { onOpen: (id: string) => void; onNewProject: () => void }) {
  const { state } = useStore();
  const done = () => state.tasks.filter((t) => t.status === "done").length;
  const inProg = () => state.tasks.filter((t) => t.status === "in-progress").length;
  const overdue = () => state.tasks.filter((t) => t.dueDate && t.status !== "done" && new Date(t.dueDate) < new Date(new Date().toDateString())).length;
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
      <div class="rounded-2xl border border-zinc-700 bg-[#202227] p-6 sm:p-8">
        <div class="flex flex-wrap items-center gap-6">
          <div class="min-w-[240px] flex-1">
            <div class="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">Good day — let's ship</div>
            <h1 class="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Mission control for your ideas
            </h1>
            <p class="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
              Projects break into <b class="text-zinc-200">goals</b>, goals break into <b class="text-zinc-200">tasks</b>. Pick a project on the left, or spin up a new one.
            </p>
            <div class="mt-4 flex gap-2">
              <button onClick={props.onNewProject} class="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-400 active:scale-95">
                + New project
              </button>
              <div class="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300">
                <span class="h-2 w-2 rounded-full bg-emerald-400" /> Tauri desktop ready
              </div>
            </div>
          </div>
          <div class="flex items-center gap-4 rounded-2xl border border-zinc-700 bg-zinc-800 p-4">
            <Ring value={pct()} size={72} />
            <div>
              <div class="text-sm font-bold text-white">{done()}/{state.tasks.length} tasks</div>
              <div class="text-xs text-zinc-400">across {state.projects.length} projects</div>
              <div class="mt-2 w-40"><ProgressBar value={pct()} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* stats */}
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <For each={cards()}>
          {(c) => (
            <div class="rounded-2xl border border-zinc-700 bg-[#202227] p-4">
              <div class="text-xl">{c.icon}</div>
              <div class="mt-1 text-2xl font-extrabold tabular-nums text-white">{c.value}</div>
              <div class="text-xs font-semibold uppercase tracking-wider text-zinc-400">{c.label}</div>
              <div class="mt-0.5 text-[11px] text-zinc-500">{c.sub}</div>
            </div>
          )}
        </For>
      </div>

      {/* projects grid */}
      <div>
        <div class="mb-3 flex items-center">
          <h2 class="text-sm font-bold uppercase tracking-[0.14em] text-zinc-400">All projects</h2>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <For each={state.projects}>
            {(p) => {
              const prog = () => projectProgress(p.id, state.goals, state.tasks);
              const gs = () => state.goals.filter((g) => g.projectId === p.id);
              return (
                <button onClick={() => props.onOpen(p.id)} class="group rounded-2xl border border-zinc-700 bg-[#202227] p-4 text-left transition hover:border-zinc-500">
                  <div class="flex items-center gap-3">
                    <span class="grid h-11 w-11 place-items-center rounded-xl bg-zinc-700 text-xl">{p.icon}</span>
                    <div class="min-w-0 flex-1">
                      <div class="truncate font-bold text-white">{p.name}</div>
                      <div class="truncate text-xs text-zinc-500">{p.description || "No description"}</div>
                    </div>
                    <span class="text-lg text-zinc-600 transition group-hover:translate-x-1 group-hover:text-white">→</span>
                  </div>
                  <div class="mt-3"><ProgressBar value={prog()} color={p.color} /></div>
                  <div class="mt-2 flex items-center text-[11px] text-zinc-500">
                    <span>{prog()}% · {gs().length} goals</span>
                    <span class="ml-auto flex -space-x-1">
                      <For each={gs().slice(0, 4)}>
                        {(g) => <span class="h-4 w-4 rounded-full border-2 border-[#202227]" style={{ background: g.color }} title={g.title} />}
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
