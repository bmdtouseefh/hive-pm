import { For, Show, createMemo, createSignal } from "solid-js";
import { useStore, goalProgress } from "../store";
import { PRIORITY_META, STATUS_META, isOverdue, type Task, type TaskStatus } from "../types";
import { ProgressBar, Empty, Ring } from "./ui";

function TaskRow(props: { task: Task; onEdit: (t: Task) => void }) {
  const { actions } = useStore();
  const t = () => props.task;
  const overdue = () => isOverdue(t());

  return (
    <div class={`group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
      t().status === "done" ? "border-hive-700 bg-hive-800/50 opacity-70" : "border-hive-600 bg-hive-800 hover:border-hive-600"
    }`}>
      <button
        onClick={() => actions.toggleTask(t().id)}
        title="Toggle done"
        class={`hex mt-0.5 grid h-5 w-5 shrink-0 place-items-center border-2 transition ${
          t().status === "done" ? "border-honey-400 bg-honey-400 text-honey-ink" : "border-hive-600 hover:border-honey-400"
        }`}
      >
        <Show when={t().status === "done"}><span class="text-[11px] font-black leading-none">✓</span></Show>
      </button>
      <div class="min-w-0 flex-1 cursor-pointer" onClick={() => props.onEdit(t())} title="Edit task">
        <div class="flex items-center gap-2">
          <span class={`truncate text-[13px] font-medium ${t().status === "done" ? "text-cream-500 line-through" : "text-cream-100"}`}>{t().title}</span>
          <Show when={overdue()}><span class="shrink-0 rounded-full border border-hive-600 bg-hive-700 px-1.5 py-px text-[10px] font-bold text-rose-300">overdue</span></Show>
        </div>
        <Show when={t().notes}>
          <div class="truncate text-[11px] text-cream-500">{t().notes}</div>
        </Show>
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span class={`rounded-full border px-1.5 py-px text-[10px] font-semibold ${PRIORITY_META[t().priority].classes}`}>{PRIORITY_META[t().priority].label}</span>
          <Show when={t().dueDate}>
            <span class={`text-[10px] tabular-nums ${overdue() ? "font-bold text-rose-300" : "text-cream-500"}`}>📅 {t().dueDate}</span>
          </Show>
          <span class="flex items-center gap-1 text-[10px] text-cream-500">
            <span class={`h-1.5 w-1.5 rounded-full ${STATUS_META[t().status].dot}`} />{STATUS_META[t().status].label}
          </span>
        </div>
      </div>
      <div class="flex shrink-0 gap-0.5 opacity-100 transition focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <select
          value={t().status}
          onChange={(e) => actions.updateTask(t().id, { status: e.currentTarget.value as TaskStatus })}
          class="rounded-lg border border-hive-600 bg-hive-900 px-1 py-1 text-[11px] text-cream-300 outline-none"
          title="Move status"
        >
          <option value="todo">To do</option>
          <option value="in-progress">In prog</option>
          <option value="done">Done</option>
        </select>
        <button onClick={() => props.onEdit(t())} class="rounded-lg px-1.5 py-1 text-xs text-cream-500 hover:bg-hive-700 hover:text-cream-100" title="Edit">✎</button>
        <button onClick={() => actions.deleteTask(t().id)} class="rounded-lg px-1.5 py-1 text-xs text-cream-500/60 hover:bg-hive-700 hover:text-rose-300" title="Delete">✕</button>
      </div>
    </div>
  );
}

export function ProjectView(props: {
  projectId: string;
  onEditTask: (t: Task) => void;
  onNewTask: (goalId?: string) => void;
  onEditGoal: (id: string) => void;
  onNewGoal: () => void;
  onEditProject: (id: string) => void;
}) {
  const { state, actions } = useStore();
  const [collapsed, setCollapsed] = createSignal<Record<string, boolean>>({});
  const project = () => state.projects.find((p) => p.id === props.projectId);
  const q = () => state.query.trim().toLowerCase();

  const goals = createMemo(() => state.goals.filter((g) => g.projectId === props.projectId));

  const visibleTasks = (goalId: string) => {
    const all = state.tasks.filter((t) => t.goalId === goalId);
    if (!q()) return all;
    return all.filter((t) => (t.title + " " + (t.notes ?? "")).toLowerCase().includes(q()));
  };

  const allTasks = createMemo(() => {
    const gIds = new Set(goals().map((g) => g.id));
    let list = state.tasks.filter((t) => gIds.has(t.goalId));
    if (q()) list = list.filter((t) => (t.title + " " + (t.notes ?? "")).toLowerCase().includes(q()));
    return list;
  });

  const doneCount = () => allTasks().filter((t) => t.status === "done").length;
  const pct = () => (allTasks().length ? Math.round((doneCount() / allTasks().length) * 100) : 0);

  return (
    <div class="anim-fadeUp space-y-4">
      <Show when={project()} fallback={<Empty icon="🛰" title="Project not found" hint="It may have been deleted." />}>
        {(p) => (
          <>
            {/* header */}
            <div class="rounded-2xl border border-honey-500/30 bg-hive-850 p-4 sm:p-5">
              <div class="flex flex-wrap items-center gap-4">
                <span class="hex grid h-14 w-14 place-items-center bg-hive-800 text-3xl">{p().icon}</span>
                <div class="min-w-0 flex-1 basis-48">
                  <h1 class="text-xl font-extrabold tracking-tight text-cream-100">{p().name}</h1>
                  <p class="text-sm text-cream-500">{p().description || "No description yet."}</p>
                  <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-cream-500">
                    <span>{goals().length} goals</span>·<span>{allTasks().length} tasks</span>·<span>{doneCount()} done</span>
                    <button onClick={() => props.onEditProject(p().id)} class="rounded-md px-1.5 py-0.5 text-cream-500 hover:bg-hive-700 hover:text-cream-100">✎ Edit project</button>
                    <button onClick={() => { if (confirm(`Delete "${p().name}" and all its goals/tasks?`)) actions.deleteProject(p().id); }} class="rounded-md px-1.5 py-0.5 text-cream-500 hover:bg-hive-700 hover:text-rose-300">Delete</button>
                  </div>
                </div>
                <div class="flex w-full items-center gap-3 rounded-2xl border border-hive-600 bg-hive-800 px-4 py-3 sm:w-auto">
                  <Ring value={pct()} color={p().color} />
                  <div>
                    <div class="text-sm font-bold text-cream-100">{pct()}% complete</div>
                    <button onClick={props.onNewGoal} class="mt-1 rounded-lg bg-honey-500 px-2.5 py-1 text-[11px] font-bold text-honey-ink hover:bg-honey-400">+ New goal</button>
                  </div>
                </div>
              </div>
            </div>

            <Show when={state.view === "kanban"} fallback={
              /* HIERARCHY VIEW */
              <Show when={goals().length > 0} fallback={<Empty icon="🎯" title="No goals yet" hint="Goals group related tasks. Create your first goal to structure this project." />}>
                <div class="grid gap-3 xl:grid-cols-2">
                  <For each={goals()}>
                    {(g) => {
                      const tasks = () => visibleTasks(g.id);
                      const prog = () => goalProgress(g.id, state.tasks);
                      const isCol = () => collapsed()[g.id];
                      return (
                        <div class="rounded-2xl border border-hive-600 bg-hive-850 p-4">
                          <div class="flex items-start gap-3">
                            <span class="mt-1 h-8 w-2 shrink-0 hex" style={{ background: g.color }} />
                            <div class="min-w-0 flex-1">
                              <div class="flex items-center gap-2">
                                <button onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !isCol() }))} class="grid h-6 w-6 place-items-center rounded-md text-xs text-cream-500 hover:bg-hive-700 hover:text-cream-100">
                                  {isCol() ? "▸" : "▾"}
                                </button>
                                <h3 class="truncate font-bold text-cream-100">{g.title}</h3>
                                <span class="ml-auto shrink-0 text-[11px] tabular-nums text-cream-500">{prog()}%</span>
                              </div>
                              <Show when={g.description}><p class="ml-8 truncate text-xs text-cream-500">{g.description}</p></Show>
                              <div class="ml-8 mt-2 flex items-center gap-2">
                                <div class="flex-1"><ProgressBar value={prog()} color={g.color} /></div>
                                <Show when={g.deadline}><span class="shrink-0 text-[10px] tabular-nums text-cream-500">⌛ {g.deadline}</span></Show>
                              </div>
                            </div>
                            <div class="flex shrink-0 gap-1">
                              <button onClick={() => props.onNewTask(g.id)} title="Add task" class="grid h-7 w-7 place-items-center rounded-lg border border-hive-600 bg-hive-800 text-sm text-cream-300 hover:bg-hive-700 hover:text-cream-100">+</button>
                              <button onClick={() => props.onEditGoal(g.id)} class="grid h-7 w-7 place-items-center rounded-lg text-xs text-cream-500 hover:bg-hive-700 hover:text-cream-100">✎</button>
                              <button onClick={() => { if (confirm(`Delete goal "${g.title}"?`)) actions.deleteGoal(g.id); }} class="grid h-7 w-7 place-items-center rounded-lg text-xs text-cream-500/60 hover:bg-hive-700 hover:text-rose-300">✕</button>
                            </div>
                          </div>
                          <Show when={!isCol()}>
                            <div class="mt-3 space-y-2">
                              <For each={tasks()}>
                                {(t) => <TaskRow task={t} onEdit={props.onEditTask} />}
                              </For>
                              <Show when={tasks().length === 0}>
                                <button onClick={() => props.onNewTask(g.id)} class="w-full rounded-xl border border-dashed border-hive-600 py-3 text-xs text-cream-500 transition hover:border-honey-500 hover:text-cream-100">
                                  + Add the first task to “{g.title}”
                                </button>
                              </Show>
                            </div>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
            }>
              {/* KANBAN VIEW */}
              <div class="grid gap-3 md:grid-cols-3">
                {(["todo", "in-progress", "done"] as const).map((s) => {
                  const list = () => allTasks().filter((t) => t.status === s);
                  const goalOf = (t: Task) => state.goals.find((g) => g.id === t.goalId);
                  return (
                    <div class="rounded-2xl border border-hive-600 bg-hive-850 p-3">
                      <div class="mb-2 flex items-center gap-2 px-1">
                        <span class={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />
                        <span class="text-xs font-bold uppercase tracking-wider text-cream-300">{STATUS_META[s].label}</span>
                        <span class="ml-auto rounded-full bg-hive-700 px-2 py-px text-[11px] tabular-nums text-cream-300">{list().length}</span>
                      </div>
                      <div class="max-h-[60vh] space-y-2 overflow-y-auto">
                        <For each={list()}>
                          {(t) => (
                            <div class="cursor-pointer rounded-xl border border-hive-600 bg-hive-800 p-3" onClick={() => props.onEditTask(t)} title="Edit task">
                              <Show when={goalOf(t)}>
                                <div class="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: goalOf(t)!.color }}>
                                  <span class="h-1.5 w-1.5 rounded-full" style={{ background: goalOf(t)!.color }} />{goalOf(t)!.title}
                                </div>
                              </Show>
                              <div class={`text-[13px] font-medium ${t.status === "done" ? "text-cream-500 line-through" : "text-cream-100"}`}>{t.title}</div>
                              <div class="mt-2 flex items-center gap-1.5">
                                <span class={`rounded-full border px-1.5 py-px text-[10px] font-semibold ${PRIORITY_META[t.priority].classes}`}>{PRIORITY_META[t.priority].label}</span>
                                <Show when={t.dueDate}><span class="text-[10px] text-cream-500">{t.dueDate}</span></Show>
                                <span class="ml-auto flex gap-1">
                                  <Show when={s !== "todo"}>
                                    <button onClick={(e) => { e.stopPropagation(); actions.updateTask(t.id, { status: s === "done" ? "in-progress" : "todo" }); }} class="rounded-md bg-hive-700 px-1.5 py-0.5 text-[11px] text-cream-300 hover:bg-hive-600 hover:text-cream-100" title="Move back">←</button>
                                  </Show>
                                  <Show when={s !== "done"}>
                                    <button onClick={(e) => { e.stopPropagation(); actions.updateTask(t.id, { status: s === "todo" ? "in-progress" : "done" }); }} class="rounded-md bg-hive-700 px-1.5 py-0.5 text-[11px] text-cream-300 hover:bg-hive-600 hover:text-cream-100" title="Move forward">→</button>
                                  </Show>
                                  <button onClick={() => props.onEditTask(t)} class="rounded-md bg-hive-700 px-1.5 py-0.5 text-[11px] text-cream-300 hover:bg-hive-600 hover:text-cream-100">✎</button>
                                </span>
                              </div>
                            </div>
                          )}
                        </For>
                        <Show when={list().length === 0}>
                          <div class="rounded-xl border border-dashed border-hive-600 py-6 text-center text-[11px] text-cream-500/60">Empty</div>
                        </Show>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
