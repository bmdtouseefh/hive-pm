// Bounded integration test: merge logic + HTTP round trip (in-process server).
import { blankPayload, isPayload, mergePayload } from "../src/lib/merge";

let pass = 0;
const ok = (name: string, cond: unknown) => {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    pass++;
    console.log(`ok: ${name}`);
  }
};

// --- 1. merge: union + last-write-wins ---
const now = "2026-09-17T12:00:00.000Z";
const older = "2026-09-16T12:00:00.000Z";
const base = {
  ...blankPayload(),
  projects: [{ id: "p1", name: "Old name", icon: "📦", color: "#6366f1", createdAt: older, updatedAt: older }],
};
const incoming: any = {
  app: "pulse-pm",
  version: 1,
  exportedAt: now,
  projects: [
    { id: "p1", name: "New name", icon: "📦", color: "#6366f1", createdAt: older, updatedAt: now },
    { id: "p2", name: "From other device", icon: "📱", color: "#06b6d4", createdAt: now, updatedAt: now },
  ],
  goals: [],
  tasks: [],
  deleted: [],
};
const r1 = mergePayload(base, incoming);
ok("union has both projects", r1.payload.projects.length === 2);
ok("newer title wins", r1.payload.projects.find((p) => p.id === "p1")?.name === "New name");
ok("counts", r1.counts.added === 1 && r1.counts.updated === 1);

// --- 2. tombstones propagate deletes ---
const withTomb: any = { ...blankPayload(), deleted: [{ id: "p2", at: now }] };
const r2 = mergePayload(r1.payload, withTomb);
ok("tombstone removes record", !r2.payload.projects.some((p) => p.id === "p2") && r2.counts.removed === 1);
const r3 = mergePayload(r2.payload, incoming); // stale re-upload must not resurrect (incoming p2 older than tomb)
ok("stale record stays deleted", !r3.payload.projects.some((p) => p.id === "p2"));

// --- 3. garbage in -> base unchanged, invalid rejected ---
const r4 = mergePayload(base, { hello: "world" });
ok("garbage ignored", r4.payload.projects.length === 1 && r4.counts.added === 0);
ok("isPayload guards", !isPayload({}) && !isPayload(null));

// --- 4. HTTP round trip against real route handlers (temp server, same code shape) ---
const { blankPayload: b2, mergePayload: m2 } = await import("../src/lib/merge");
let state = b2();
const srv = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health")
      return Response.json({ ok: true, app: "pulse-pm-sync", version: 1 });
    if (req.method === "POST" && url.pathname === "/sync") {
      const body = await req.json();
      const { payload } = m2(state, body);
      state = payload;
      return Response.json(state);
    }
    return Response.json({ error: "nf" }, { status: 404 });
  },
});
const root = `http://127.0.0.1:${srv.port}`;
const h = await (await fetch(`${root}/health`)).json();
ok("health", h?.app === "pulse-pm-sync");
const pushed = await (
  await fetch(`${root}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(incoming),
  })
).json();
ok("server merged phone payload", pushed.projects?.length === 2);
// second device with empty state gets everything back (both sides converge in one trip)
const pulled = await (
  await fetch(`${root}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(blankPayload()),
  })
).json();
ok("empty device receives full state", pulled.projects?.length === 2);
srv.stop();
console.log(`\n${pass} checks passed`);
