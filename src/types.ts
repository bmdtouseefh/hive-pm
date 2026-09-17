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
  todo: { label: "To do", dot: "bg-zinc-400" },
  "in-progress": { label: "In progress", dot: "bg-amber-400" },
  done: { label: "Done", dot: "bg-emerald-400" },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; classes: string }
> = {
  low: { label: "Low", classes: "text-sky-300 bg-sky-400/10 border-sky-400/20" },
  medium: { label: "Med", classes: "text-violet-300 bg-violet-400/10 border-violet-400/20" },
  high: { label: "High", classes: "text-amber-300 bg-amber-400/10 border-amber-400/20" },
  urgent: { label: "Urgent", classes: "text-rose-300 bg-rose-400/10 border-rose-400/20" },
};

export const PROJECT_COLORS = [
  "#8b5cf6", "#6366f1", "#22d3ee", "#34d399",
  "#fbbf24", "#fb7185", "#f97316", "#e879f9",
];

export const GOAL_COLORS = [
  "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#6366f1", "#84cc16",
];

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isOverdue(t: Task): boolean {
  if (!t.dueDate || t.status === "done") return false;
  return new Date(t.dueDate + "T23:59:59") < new Date();
}
