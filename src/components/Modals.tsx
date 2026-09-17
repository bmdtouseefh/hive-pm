import { For, Show, createSignal } from "solid-js";
import { useStore } from "../store";
import { GOAL_COLORS, PROJECT_COLORS, type Goal, type Priority, type Project, type Task, type TaskStatus } from "../types";
import { Modal, Field, inputCls } from "./ui";

const EMOJIS = ["🚀", "📱", "📈", "🎨", "⚙️", "📚", "💡", "🏠", "🎮", "💼", "🌟", "🔥"];

// ---- Project modal ----
export function ProjectModal(props: { editing?: Project; onClose: () => void }) {
  const { actions } = useStore();
  const [name, setName] = createSignal(props.editing?.name ?? "");
  const [desc, setDesc] = createSignal(props.editing?.description ?? "");
  const [icon, setIcon] = createSignal(props.editing?.icon ?? "🚀");
  const [color, setColor] = createSignal(props.editing?.color ?? PROJECT_COLORS[0]);

  const save = () => {
    if (!name().trim()) return;
    if (props.editing) actions.updateProject(props.editing.id, { name: name().trim(), description: desc().trim(), icon: icon(), color: color() });
    else actions.addProject({ name: name().trim(), description: desc().trim(), icon: icon(), color: color() });
    props.onClose();
  };

  return (
    <Modal onClose={props.onClose}>
      <div class="p-5">
        <h2 class="text-lg font-extrabold text-white">{props.editing ? "Edit project" : "New project"}</h2>
        <p class="text-xs text-zinc-500">Top of the hierarchy — it holds goals.</p>
        <div class="mt-4 space-y-3">
          <Field label="Name"><input class={inputCls} value={name()} onInput={(e) => setName(e.currentTarget.value)} placeholder="e.g. Website relaunch" autofocus /></Field>
          <Field label="Description"><textarea class={inputCls} rows={2} value={desc()} onInput={(e) => setDesc(e.currentTarget.value)} placeholder="What does success look like?" /></Field>
          <Field label="Icon">
            <div class="flex flex-wrap gap-1.5">
              <For each={EMOJIS}>{(e) => <button onClick={() => setIcon(e)} class={`grid h-9 w-9 place-items-center rounded-xl border text-lg transition ${icon() === e ? "border-indigo-400 bg-indigo-500/20" : "border-zinc-700 bg-zinc-800 hover:bg-zinc-700"}`}>{e}</button>}</For>
            </div>
          </Field>
          <Field label="Color">
            <div class="flex flex-wrap gap-2">
              <For each={PROJECT_COLORS}>{(c) => <button onClick={() => setColor(c)} class="h-8 w-8 rounded-full border-2 transition" style={{ background: c, "border-color": color() === c ? "#fff" : "transparent" }} />}</For>
            </div>
          </Field>
          <div class="flex gap-2 pt-1">
            <button onClick={props.onClose} class="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700">Cancel</button>
            <button onClick={save} disabled={!name().trim()} class="flex-1 rounded-xl bg-indigo-500 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-40">Save project</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---- Goal modal ----
export function GoalModal(props: { projectId: string; editing?: Goal; onClose: () => void }) {
  const { state, actions } = useStore();
  const [title, setTitle] = createSignal(props.editing?.title ?? "");
  const [desc, setDesc] = createSignal(props.editing?.description ?? "");
  const [color, setColor] = createSignal(props.editing?.color ?? GOAL_COLORS[0]);
  const [deadline, setDeadline] = createSignal(props.editing?.deadline ?? "");
  const [projectId, setProjectId] = createSignal(props.editing?.projectId ?? props.projectId);

  const save = () => {
    if (!title().trim()) return;
    const payload = { projectId: projectId(), title: title().trim(), description: desc().trim(), color: color(), deadline: deadline() || undefined };
    if (props.editing) actions.updateGoal(props.editing.id, payload);
    else actions.addGoal(payload);
    props.onClose();
  };

  return (
    <Modal onClose={props.onClose}>
      <div class="p-5">
        <h2 class="text-lg font-extrabold text-white">{props.editing ? "Edit goal" : "New goal"}</h2>
        <p class="text-xs text-zinc-500">Middle of the hierarchy — it groups tasks.</p>
        <div class="mt-4 space-y-3">
          <Show when={state.projects.length > 1}>
            <Field label="Project">
              <select class={inputCls} value={projectId()} onChange={(e) => setProjectId(e.currentTarget.value)}>
                <For each={state.projects}>{(p) => <option value={p.id}>{p.icon} {p.name}</option>}</For>
              </select>
            </Field>
          </Show>
          <Field label="Title"><input class={inputCls} value={title()} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="e.g. Launch landing page" autofocus /></Field>
          <Field label="Description"><textarea class={inputCls} rows={2} value={desc()} onInput={(e) => setDesc(e.currentTarget.value)} placeholder="Outcome + scope…" /></Field>
          <div class="grid grid-cols-2 gap-3">
            <Field label="Deadline"><input type="date" class={`${inputCls} [color-scheme:dark]`} value={deadline()} onInput={(e) => setDeadline(e.currentTarget.value)} /></Field>
            <Field label="Color">
              <div class="flex flex-wrap gap-1.5 pt-1">
                <For each={GOAL_COLORS}>{(c) => <button onClick={() => setColor(c)} class="h-7 w-7 rounded-full border-2 transition" style={{ background: c, "border-color": color() === c ? "#fff" : "transparent" }} />}</For>
              </div>
            </Field>
          </div>
          <div class="flex gap-2 pt-1">
            <button onClick={props.onClose} class="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700">Cancel</button>
            <button onClick={save} disabled={!title().trim()} class="flex-1 rounded-xl bg-indigo-500 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-40">Save goal</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---- Task modal ----
export function TaskModal(props: { goalId: string; editing?: Task; onClose: () => void }) {
  const { state, actions } = useStore();
  const [title, setTitle] = createSignal(props.editing?.title ?? "");
  const [notes, setNotes] = createSignal(props.editing?.notes ?? "");
  const [status, setStatus] = createSignal<TaskStatus>(props.editing?.status ?? "todo");
  const [priority, setPriority] = createSignal<Priority>(props.editing?.priority ?? "medium");
  const [due, setDue] = createSignal(props.editing?.dueDate ?? "");
  const [goalId, setGoalId] = createSignal(props.editing?.goalId ?? props.goalId);

  const goalsOfActive = () => {
    const pid = state.activeProjectId;
    if (!pid) return state.goals;
    const mine = state.goals.filter((g) => g.projectId === pid);
    return mine.length ? mine : state.goals;
  };

  const save = () => {
    if (!title().trim()) return;
    const payload = { goalId: goalId(), title: title().trim(), notes: notes().trim(), status: status(), priority: priority(), dueDate: due() || undefined };
    if (props.editing) actions.updateTask(props.editing.id, payload);
    else actions.addTask(payload);
    props.onClose();
  };

  return (
    <Modal onClose={props.onClose} wide>
      <div class="p-5">
        <h2 class="text-lg font-extrabold text-white">{props.editing ? "Edit task" : "New task"}</h2>
        <p class="text-xs text-zinc-500">Bottom of the hierarchy — the actual work.</p>
        <div class="mt-4 space-y-3">
          <Field label="Goal">
            <select class={inputCls} value={goalId()} onChange={(e) => setGoalId(e.currentTarget.value)}>
              <For each={goalsOfActive()}>
                {(g) => {
                  const pname = state.projects.find((p) => p.id === g.projectId)?.name ?? "";
                  return <option value={g.id}>{pname} → {g.title}</option>;
                }}
              </For>
            </select>
          </Field>
          <Field label="Title"><input class={inputCls} value={title()} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="e.g. Design empty state" autofocus /></Field>
          <Field label="Notes"><textarea class={inputCls} rows={3} value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} placeholder="Details, links, acceptance criteria…" /></Field>
          <div class="grid grid-cols-3 gap-3">
            <Field label="Status">
              <select class={inputCls} value={status()} onChange={(e) => setStatus(e.currentTarget.value as TaskStatus)}>
                <option value="todo">To do</option>
                <option value="in-progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </Field>
            <Field label="Priority">
              <select class={inputCls} value={priority()} onChange={(e) => setPriority(e.currentTarget.value as Priority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
            <Field label="Due date"><input type="date" class={`${inputCls} [color-scheme:dark]`} value={due()} onInput={(e) => setDue(e.currentTarget.value)} /></Field>
          </div>
          <div class="flex gap-2 pt-1">
            <button onClick={props.onClose} class="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700">Cancel</button>
            <button onClick={save} disabled={!title().trim()} class="flex-1 rounded-xl bg-indigo-500 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-40">Save task</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
