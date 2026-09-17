import type { Goal, Project, Task } from "./types";

const now = new Date().toISOString();
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
    color: "#8b5cf6",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p_mobile",
    name: "Pulse Mobile",
    description: "Native-feel Tauri mobile companion app",
    icon: "📱",
    color: "#06b6d4",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "p_growth",
    name: "Growth Engine",
    description: "Content, SEO and lifecycle experiments",
    icon: "📈",
    color: "#10b981",
    createdAt: now,
    updatedAt: now,
  },
];

export const SEED_GOALS: Goal[] = [
  { id: "g_brand", projectId: "p_launch", title: "Brand & landing page", description: "New visual identity, hero, pricing and docs IA", color: "#8b5cf6", deadline: d(9), createdAt: now, updatedAt: now },
  { id: "g_onboard", projectId: "p_launch", title: "Onboarding funnel", description: "Signup → first project in under 60 seconds", color: "#ec4899", deadline: d(16), createdAt: now, updatedAt: now },
  { id: "g_perf", projectId: "p_launch", title: "Performance pass", description: "Lighthouse 95+, <150kb initial JS", color: "#f59e0b", deadline: d(21), createdAt: now, updatedAt: now },
  { id: "g_shell", projectId: "p_mobile", title: "App shell & sync", description: "Offline-first shell with conflict-free sync", color: "#06b6d4", deadline: d(30), createdAt: now, updatedAt: now },
  { id: "g_seo", projectId: "p_growth", title: "SEO sprint", description: "20 programmatic pages + internal linking", color: "#10b981", deadline: d(12), createdAt: now, updatedAt: now },
];

export const SEED_TASKS: Task[] = [
  { id: "t1", goalId: "g_brand", title: "Design hero section", notes: "Simple flat header, 3 variants in Figma", status: "done", priority: "high", dueDate: d(-2), createdAt: now, updatedAt: now, completedAt: now },
  { id: "t2", goalId: "g_brand", title: "Build pricing section", notes: "Monthly/yearly toggle, 3 tiers", status: "in-progress", priority: "medium", dueDate: d(2), createdAt: now, updatedAt: now },
  { id: "t3", goalId: "g_brand", title: "Write launch announcement", status: "todo", priority: "low", dueDate: d(7), createdAt: now, updatedAt: now },
  { id: "t4", goalId: "g_onboard", title: "Empty-state wizard", notes: "3 steps: project → goal → first task", status: "in-progress", priority: "urgent", dueDate: d(1), createdAt: now, updatedAt: now },
  { id: "t5", goalId: "g_onboard", title: "Sample data templates", status: "todo", priority: "medium", dueDate: d(5), createdAt: now, updatedAt: now },
  { id: "t6", goalId: "g_onboard", title: "Invite-by-link flow", status: "todo", priority: "low", dueDate: d(12), createdAt: now, updatedAt: now },
  { id: "t7", goalId: "g_perf", title: "Code-split Solid routes", status: "todo", priority: "high", dueDate: d(6), createdAt: now, updatedAt: now },
  { id: "t8", goalId: "g_perf", title: "Image pipeline + AVIF", status: "todo", priority: "medium", dueDate: d(10), createdAt: now, updatedAt: now },
  { id: "t9", goalId: "g_shell", title: "Tauri window + tray config", notes: "Remember size, deep links pulse://", status: "in-progress", priority: "high", dueDate: d(4), createdAt: now, updatedAt: now },
  { id: "t10", goalId: "g_shell", title: "SQLite sync prototype", status: "todo", priority: "urgent", dueDate: d(14), createdAt: now, updatedAt: now },
  { id: "t11", goalId: "g_seo", title: "Keyword map for 20 pages", status: "done", priority: "medium", dueDate: d(-4), createdAt: now, updatedAt: now, completedAt: now },
  { id: "t12", goalId: "g_seo", title: "Publish 5 changelog stories", status: "in-progress", priority: "low", dueDate: d(3), createdAt: now, updatedAt: now },
];
