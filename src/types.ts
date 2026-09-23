export type TaskStatus = "todo" | "in-progress" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  goalId: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string; // ISO date
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Goal {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  color: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

/** A record of a deletion, so file sync can propagate deletes. */
export interface Tombstone {
  id: string;
  at: string; // ISO timestamp
}

export const STATUS_META: Record<TaskStatus, { label: string; dot: string }> = {
  todo: { label: "To do", dot: "bg-stone-400" },
  "in-progress": { label: "In progress", dot: "bg-honey-400" },
  done: { label: "Done", dot: "bg-emerald-400" },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; classes: string }
> = {
  low: { label: "Low", classes: "text-cream-300 bg-hive-800 border-hive-600" },
  medium: { label: "Med", classes: "text-honey-200 bg-honey-500/10 border-honey-500/30" },
  high: { label: "High", classes: "text-honey-300 bg-honey-400/15 border-honey-400/40" },
  urgent: { label: "Urgent", classes: "text-orange-300 bg-orange-500/15 border-orange-400/40" },
};

export const COLORS = [
  "#f59e0b", "#fbbf24", "#f97316", "#eab308",
  "#84cc16", "#10b981", "#fde68a", "#b45309",
];

export function uid(prefix = "id"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function isOverdue(t: Task): boolean {
  if (!t.dueDate || t.status === "done") return false;
  return new Date(t.dueDate + "T23:59:59") < new Date();
}
