import type { Goal, Project, Task } from "./types";

// Pinned old timestamp for seed records. Sync is last-write-wins per record,
// so seeds MUST look older than any real edit or deletion (tombstone).
// Otherwise a fresh install (seeds stamped "now") would resurrect records
// another device already deleted. Due dates/deadlines stay relative to today.
const SEED_STAMP = "2025-01-01T00:00:00.000Z";
const d = (offsetDays: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
};

export const SEED_PROJECTS: Project[] = [
  {
    id: "p_launch",
    name: "Nebula Launch",
    description: "Ship the v2 marketing site + onboarding flow",
    icon: "🚀",
    color: "#f59e0b",
    createdAt: SEED_STAMP,
    updatedAt: SEED_STAMP,
  },
  {
    id: "p_mobile",
    name: "Pulse Mobile",
    description: "Native-feel mobile companion app",
    icon: "📱",
    color: "#fbbf24",
    createdAt: SEED_STAMP,
    updatedAt: SEED_STAMP,
  },
  {
    id: "p_growth",
    name: "Growth Engine",
    description: "Content, SEO and lifecycle experiments",
    icon: "📈",
    color: "#84cc16",
    createdAt: SEED_STAMP,
    updatedAt: SEED_STAMP,
  },
];

export const SEED_GOALS: Goal[] = [
  { id: "g_brand", projectId: "p_launch", title: "Brand & landing page", description: "New visual identity, hero, pricing and docs IA", color: "#fbbf24", deadline: d(9), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "g_onboard", projectId: "p_launch", title: "Onboarding funnel", description: "Signup → first project in under 60 seconds", color: "#fb923c", deadline: d(16), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "g_perf", projectId: "p_launch", title: "Performance pass", description: "Lighthouse 95+, <150kb initial JS", color: "#facc15", deadline: d(21), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "g_shell", projectId: "p_mobile", title: "App shell & sync", description: "Offline-first shell with conflict-free sync", color: "#f59e0b", deadline: d(30), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "g_seo", projectId: "p_growth", title: "SEO sprint", description: "20 programmatic pages + internal linking", color: "#a3e635", deadline: d(12), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
];

export const SEED_TASKS: Task[] = [
  { id: "t1", goalId: "g_brand", title: "Design hero section", notes: "Simple flat header, 3 variants in Figma", status: "done", priority: "high", dueDate: d(-2), createdAt: SEED_STAMP, updatedAt: SEED_STAMP, completedAt: SEED_STAMP },
  { id: "t2", goalId: "g_brand", title: "Build pricing section", notes: "Monthly/yearly toggle, 3 tiers", status: "in-progress", priority: "medium", dueDate: d(2), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "t3", goalId: "g_brand", title: "Write launch announcement", status: "todo", priority: "low", dueDate: d(7), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "t4", goalId: "g_onboard", title: "Empty-state wizard", notes: "3 steps: project → goal → first task", status: "in-progress", priority: "urgent", dueDate: d(1), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "t5", goalId: "g_onboard", title: "Sample data templates", status: "todo", priority: "medium", dueDate: d(5), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "t6", goalId: "g_onboard", title: "Invite-by-link flow", status: "todo", priority: "low", dueDate: d(12), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "t7", goalId: "g_perf", title: "Code-split routes", status: "todo", priority: "high", dueDate: d(6), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "t8", goalId: "g_perf", title: "Image pipeline + AVIF", status: "todo", priority: "medium", dueDate: d(10), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "t9", goalId: "g_shell", title: "Window + tray config", notes: "Remember size, deep links", status: "in-progress", priority: "high", dueDate: d(4), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "t10", goalId: "g_shell", title: "SQLite sync prototype", status: "todo", priority: "urgent", dueDate: d(14), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
  { id: "t11", goalId: "g_seo", title: "Keyword map for 20 pages", status: "done", priority: "medium", dueDate: d(-4), createdAt: SEED_STAMP, updatedAt: SEED_STAMP, completedAt: SEED_STAMP },
  { id: "t12", goalId: "g_seo", title: "Publish 5 changelog stories", status: "in-progress", priority: "low", dueDate: d(3), createdAt: SEED_STAMP, updatedAt: SEED_STAMP },
];
