import type { Goal, Project, Task } from "../types";

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

// Spreadsheet export of all tasks. Import back via the JSON sync file, not this.
export function tasksToCSV(projects: Project[], goals: Goal[], tasks: Task[]): string {
  const goalOf = new Map(goals.map((g) => [g.id, g]));
  const projOf = new Map(projects.map((p) => [p.id, p]));
  const rows = [["project", "goal", "title", "notes", "status", "priority", "due", "created", "updated"]];
  for (const t of tasks) {
    const g = goalOf.get(t.goalId);
    rows.push([
      projOf.get(g?.projectId ?? "")?.name ?? "",
      g?.title ?? "",
      t.title,
      t.notes ?? "",
      t.status,
      t.priority,
      t.dueDate ?? "",
      t.createdAt,
      t.updatedAt,
    ]);
  }
  // ponytail: BOM so Excel opens UTF-8 correctly, drop it if spreadsheets aren't the target
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\n");
}
