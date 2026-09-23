import { For, Show, createSignal } from "solid-js";
import { useStore } from "../store";
import { COLORS, type Goal, type Priority, type Project, type Task, type TaskStatus } from "../types";
import { Modal, Field, inputCls } from "./ui";

const EMOJIS = ["🚀", "📱", "📈", "🎨", "⚙️", "📚", "💡", "🏠", "🎮", "💼", "🌟", "🔥"];

// ---- Project modal ----
export function ProjectModal(props: { editing?: Project; onClose: () => void }) {
  const { actions } = useStore();
  const [name, setName] = createSignal(props.editing?.name ?? "");
  const [desc, setDesc] = createSignal(props.editing?.description ?? "");
  const [icon, setIcon] = createSignal(props.editing?.icon ?? "🚀");
  const [color, setColor] = createSignal(props.editing?.color ?? COLORS[0]);

  const save = () => {
    if (!name().trim()) return;
    if (props.editing) actions.updateProject(props.editing.id, { name: name().trim(), description: desc().trim(), icon: icon(), color: color() });
    else actions.addProject({ name: name().trim(), description: desc().trim(), icon: icon(), color: color() });
    props.onClose();
  };

  return (
    <Modal onClose={props.onClose}>
      <div class="p-5">
        <h2 class="text-lg font-extrabold text-cream-100">{props.editing ? "Edit project" : "New project"}</h2>
        <p class="text-xs text-cream-500">Top of the hierarchy — it holds goals.</p>
        <form class="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field label="Name"><input class={inputCls} value={name()} onInput={(e) => setName(e.currentTarget.value)} placeholder="e.g. Website relaunch" autofocus /></Field>
          <Field label="Description"><textarea class={inputCls} rows={2} value={desc()} onInput={(e) => setDesc(e.currentTarget.value)} placeholder="What does success look like?" /></Field>
          <Field label="Icon">
            <div class="flex flex-wrap gap-1.5">
              <For each={EMOJIS}>{(e) => <button type="button" onClick={() => setIcon(e)} class={`grid h-9 w-9 place-items-center rounded-xl border text-lg transition ${icon() === e ? "border-honey-400 bg-honey-500/20" : "border-hive-600 bg-hive-800 hover:bg-hive-700"}`}>{e}</button>}</For>
            </div>
          </Field>
          <Field label="Color">
            <div class="flex flex-wrap gap-2">
              <For each={COLORS}>{(c) => <button type="button" onClick={() => setColor(c)} class="hex h-8 w-8 border-2 transition" style={{ background: c, "border-color": color() === c ? "#fef3c7" : "transparent" }} />}</For>
            </div>
          </Field>
          <div class="flex gap-2 pt-1">
            <button type="button" onClick={props.onClose} class="flex-1 rounded-xl border border-hive-600 bg-hive-800 py-2 text-sm font-semibold text-cream-300 hover:bg-hive-700">Cancel</button>
            <button type="submit" disabled={!name().trim()} class="flex-1 rounded-xl bg-honey-400 py-2 text-sm font-bold text-honey-ink hover:bg-honey-300 disabled:opacity-40">Save project</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// ---- Goal modal ----
export function GoalModal(props: { projectId: string; editing?: Goal; onClose: () => void }) {
  const { state, actions } = useStore();
  const [title, setTitle] = createSignal(props.editing?.title ?? "");
  const [desc, setDesc] = createSignal(props.editing?.description ?? "");
  const [color, setColor] = createSignal(props.editing?.color ?? COLORS[0]);
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
        <h2 class="text-lg font-extrabold text-cream-100">{props.editing ? "Edit goal" : "New goal"}</h2>
        <p class="text-xs text-cream-500">Middle of the hierarchy — it groups tasks.</p>
        <form class="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
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
            <Field label="Deadline"><input type="date" class={inputCls} value={deadline()} onInput={(e) => setDeadline(e.currentTarget.value)} /></Field>
            <Field label="Color">
              <div class="flex flex-wrap gap-1.5 pt-1">
                <For each={COLORS}>{(c) => <button type="button" onClick={() => setColor(c)} class="hex h-7 w-7 border-2 transition" style={{ background: c, "border-color": color() === c ? "#fef3c7" : "transparent" }} />}</For>
              </div>
            </Field>
          </div>
          <div class="flex gap-2 pt-1">
            <button type="button" onClick={props.onClose} class="flex-1 rounded-xl border border-hive-600 bg-hive-800 py-2 text-sm font-semibold text-cream-300 hover:bg-hive-700">Cancel</button>
            <button type="submit" disabled={!title().trim()} class="flex-1 rounded-xl bg-honey-400 py-2 text-sm font-bold text-honey-ink hover:bg-honey-300 disabled:opacity-40">Save goal</button>
          </div>
        </form>
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
    return state.goals.filter((g) => g.projectId === pid);
  };

  const resolvedGoalId = () => {
    const cur = goalId();
    if (cur && state.goals.some((g) => g.id === cur)) return cur;
    return goalsOfActive()[0]?.id ?? "";
  };

  const save = () => {
    if (!title().trim() || !resolvedGoalId()) return;
    const payload = { goalId: resolvedGoalId(), title: title().trim(), notes: notes().trim(), status: status(), priority: priority(), dueDate: due() || undefined };
    if (props.editing) actions.updateTask(props.editing.id, payload);
    else actions.addTask(payload);
    props.onClose();
  };

  return (
    <Modal onClose={props.onClose} wide>
      <div class="p-5">
        <h2 class="text-lg font-extrabold text-cream-100">{props.editing ? "Edit task" : "New task"}</h2>
        <p class="text-xs text-cream-500">Bottom of the hierarchy — the actual work.</p>
        <form class="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field label="Goal">
            <select class={inputCls} value={resolvedGoalId()} onChange={(e) => setGoalId(e.currentTarget.value)}>
              <For each={goalsOfActive()}>
                {(g) => {
                  const pname = state.projects.find((p) => p.id === g.projectId)?.name ?? "";
                  return <option value={g.id}>{pname} → {g.title}</option>;
                }}
              </For>
            </select>
            <Show when={goalsOfActive().length === 0}>
              <p class="mt-1 text-xs text-honey-300">No goals in this project yet — create a goal first, then add tasks to it.</p>
            </Show>
          </Field>
          <Field label="Title"><input class={inputCls} value={title()} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="e.g. Design empty state" autofocus /></Field>
          <Field label="Notes"><textarea class={inputCls} rows={3} value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} placeholder="Details, links, acceptance criteria…" /></Field>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            <Field label="Due date"><input type="date" class={inputCls} value={due()} onInput={(e) => setDue(e.currentTarget.value)} /></Field>
          </div>
          <div class="flex gap-2 pt-1">
            <button type="button" onClick={props.onClose} class="flex-1 rounded-xl border border-hive-600 bg-hive-800 py-2 text-sm font-semibold text-cream-300 hover:bg-hive-700">Cancel</button>
            <button type="submit" disabled={!title().trim() || !resolvedGoalId()} class="flex-1 rounded-xl bg-honey-400 py-2 text-sm font-bold text-honey-ink hover:bg-honey-300 disabled:opacity-40">Save task</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
