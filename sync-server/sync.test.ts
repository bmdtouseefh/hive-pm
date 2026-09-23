// Bounded integration test: merge logic + HTTP round trip (in-process server).
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  blankPayload,
  extractChanges,
  isDeltaRequest,
  isDeltaResponse,
  isPayload,
  maxCursor,
  mergeChanges,
  mergePayload,
} from "../src/lib/merge";
import { SyncDb } from "./db";

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
const postJSON = async (root: string, body: unknown) =>
  (await (await fetch(`${root}/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json()) as any;
const rm = (p: string) => {
  try {
    unlinkSync(p);
  } catch { /* best effort */ }
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

// --- 2b. seed records must be timestamp-pinned (old), or a fresh install
// re-uploads the same seed IDs with newer stamps and resurrects deletes ---
import { SEED_PROJECTS, SEED_GOALS, SEED_TASKS } from "../src/seed";
const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const seedStamps = [
  ...SEED_PROJECTS.map((r) => r.updatedAt),
  ...SEED_GOALS.map((r) => r.updatedAt),
  ...SEED_TASKS.map((r) => r.updatedAt),
];
ok("seed timestamps pinned old", seedStamps.length > 0 && seedStamps.every((t) => t < dayAgo));

// server holds a tombstone for a seed task; a fresh client re-pushes the
// identical seed record (same old stamp) — it must stay deleted, repeatedly
const seedTask = SEED_TASKS[0];
const tombstoned: any = {
  ...blankPayload(),
  deleted: [{ id: seedTask.id, at: now }],
};
const freshPush: any = {
  ...blankPayload(),
  tasks: [{ ...seedTask }],
  deleted: [],
};
const r2b = mergePayload(tombstoned, freshPush);
ok("seed re-push stays deleted", !r2b.payload.tasks.some((t) => t.id === seedTask.id));
const r2c = mergePayload(r2b.payload, freshPush);
ok("seed re-push stays deleted (repeat)", !r2c.payload.tasks.some((t) => t.id === seedTask.id));

// --- 3. garbage in -> base unchanged, invalid rejected ---
const r4 = mergePayload(base, { hello: "world" });
ok("garbage ignored", r4.payload.projects.length === 1 && r4.counts.added === 0);
ok("isPayload guards", !isPayload({}) && !isPayload(null));

// --- 4. HTTP round trip against real route handlers (temp server, same code shape) ---
let state = blankPayload();
const srv = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health")
      return Response.json({ ok: true, app: "pulse-pm-sync", version: 1 });
    if (req.method === "POST" && url.pathname === "/sync") {
      const body = await req.json();
      const { payload } = mergePayload(state, body);
      state = payload;
      return Response.json(state);
    }
    return Response.json({ error: "nf" }, { status: 404 });
  },
});
const root = `http://127.0.0.1:${srv.port}`;
const h = await (await fetch(`${root}/health`)).json();
ok("health", h?.app === "pulse-pm-sync");
const pushed = await postJSON(root, incoming);
ok("server merged phone payload", pushed.projects?.length === 2);
// second device with empty state gets everything back (both sides converge in one trip)
const pulled = await postJSON(root, blankPayload());
ok("empty device receives full state", pulled.projects?.length === 2);
srv.stop();

// --- 5. delta sync: stale device cannot overwrite newer rows ---
const t0 = "2026-09-17T10:00:00.000Z";
const t1 = "2026-09-17T11:00:00.000Z";
const t2 = "2026-09-17T12:00:00.000Z";
const mk = (id: string, name: string, updatedAt: string) => ({
  id,
  name,
  icon: "📦",
  color: "#6366f1",
  createdAt: t0,
  updatedAt,
});
const serverState = {
  ...blankPayload(),
  projects: [mk("p1", "Server newer", t2)],
};
// Stale phone holds an older edit of p1 plus its own new p9 (edited at t1).
const stalePhone = {
  ...blankPayload(),
  projects: [mk("p1", "Phone stale", t1), mk("p9", "Phone only", t1)],
};
// Phone pushes only its delta (everything, first sync: since=null).
const phoneDelta = extractChanges(stalePhone, null);
const applied = mergeChanges(serverState, phoneDelta);
ok("stale row does not overwrite newer", applied.payload.projects.find((p) => p.id === "p1")?.name === "Server newer");
ok("phone-only row arrives", applied.payload.projects.some((p) => p.id === "p9"));
// Server replies with rows changed since the phone's cursor (t1): p1@t2.
const reply = extractChanges(applied.payload, t1);
ok("server delta carries newer p1", reply.projects.some((p) => p.id === "p1" && p.name === "Server newer"));
ok("server delta omits phone-only p9 (not newer than cursor)", !reply.projects.some((p) => p.id === "p9"));
// Phone merges the reply: converges without loss on either side.
const converged = mergeChanges(stalePhone, reply);
ok(
  "converged: server title + phone row kept",
  converged.payload.projects.find((p) => p.id === "p1")?.name === "Server newer" &&
    converged.payload.projects.some((p) => p.id === "p9")
);
// Absent records are never deletions (the old full-payload override bug).
const partial = mergeChanges(serverState, { projects: [], goals: [], tasks: [], deleted: [] });
ok("empty delta deletes nothing", partial.payload.projects.length === 1 && partial.counts.removed === 0);
ok("maxCursor tracks newest stamp", maxCursor(applied.payload) === t2);

// --- 6. SQLite storage: LWW + cursors + legacy JSON migration ---
const dbPath = join(tmpdir(), `hive-sync-test-${Date.now()}.db`);
const sdb = new SyncDb(dbPath);
ok("fresh db empty", sdb.counts().projects === 0);
sdb.applyChanges({ projects: [mk("p1", "Server newer", t2)], goals: [], tasks: [], deleted: [] });
ok("sqlite stores push", sdb.counts().projects === 1);
// Stale write loses, newer write wins.
sdb.applyChanges({ projects: [mk("p1", "Stale", t1)], goals: [], tasks: [], deleted: [] });
ok("sqlite LWW keeps newer", sdb.loadPayload().projects[0].name === "Server newer");
sdb.applyChanges({ projects: [mk("p1", "Newest", "2026-09-18T00:00:00.000Z")], goals: [], tasks: [], deleted: [] });
ok("sqlite accepts newer", sdb.loadPayload().projects[0].name === "Newest");
ok("sqlite delta since t2 finds newest", sdb.getChanges(t2).projects.length === 1);
ok("sqlite delta since future finds nothing", sdb.getChanges("2027-01-01T00:00:00.000Z").projects.length === 0);
// Legacy full-payload path still merges (old app versions).
const legacy = sdb.applyFullPayload({
  app: "pulse-pm",
  version: 1,
  exportedAt: t2,
  projects: [mk("p2", "Legacy client", t2)],
  goals: [],
  tasks: [],
  deleted: [],
});
ok("legacy full merge unions", legacy.payload.projects.length === 2);
// Tombstone via delta deletes and sticks.
sdb.applyChanges({ projects: [], goals: [], tasks: [], deleted: [{ id: "p2", at: "2026-09-19T00:00:00.000Z" }] });
ok("delta tombstone deletes", !sdb.loadPayload().projects.some((p) => p.id === "p2"));
// JSON migration imports once, never overwrites.
const jsonPath = join(tmpdir(), `hive-sync-legacy-${Date.now()}.json`);
await Bun.write(jsonPath, JSON.stringify({ app: "hive-pm", version: 1, exportedAt: t0, projects: [mk("old", "Old", t0)], goals: [], tasks: [], deleted: [] }));
const dbPath2 = join(tmpdir(), `hive-sync-test2-${Date.now()}.db`);
const sdb2 = new SyncDb(dbPath2);
ok("json migrates into empty db", (await sdb2.migrateFromJson(jsonPath)) === 1);
ok("migration does not re-run", (await sdb2.migrateFromJson(jsonPath)) === 0);
sdb.close();
sdb2.close();
for (const p of [dbPath, dbPath + "-wal", dbPath + "-shm", dbPath2, dbPath2 + "-wal", dbPath2 + "-shm", jsonPath]) rm(p);

// --- 7. delta HTTP round trip against the real SQLite-backed handlers ---
const dbPath3 = join(tmpdir(), `hive-sync-http-${Date.now()}.db`);
let hstate = new SyncDb(dbPath3);
const srv2 = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/sync") {
      const body = await req.json();
      if (isDeltaRequest(body)) {
        const since = body.since ?? null;
        const counts = hstate.applyChanges(body.changes);
        return Response.json({ app: "hive-pm", version: 1, serverTime: hstate.serverTime(), changes: hstate.getChanges(since), counts });
      }
      const { payload } = hstate.applyFullPayload(body);
      return Response.json(payload);
    }
    return Response.json({ error: "nf" }, { status: 404 });
  },
});
const root2 = `http://127.0.0.1:${srv2.port}`;
const deltaRes = await postJSON(root2, { app: "hive-pm", version: 1, since: null, changes: { projects: [mk("pa", "From phone", t2)], goals: [], tasks: [], deleted: [] } });
ok("delta HTTP round trip", isDeltaResponse(deltaRes) && deltaRes.changes.projects.length === 1);
srv2.stop();
hstate.close();
for (const p of [dbPath3, dbPath3 + "-wal", dbPath3 + "-shm"]) rm(p);
console.log(`\n${pass} checks passed`);
