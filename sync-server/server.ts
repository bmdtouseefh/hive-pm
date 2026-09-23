/**
 * Hive PM home sync server. One shared SQLite copy on your home network, no accounts.
 *
 *   bun sync-server/server.ts                 # serves http://0.0.0.0:8091
 *   PORT=8091 SYNC_DB=./hive-pm-sync.db bun sync-server/server.ts
 *
 * Storage: SQLite (WAL) via sync-server/db.ts. The old hive-pm-sync.json /
 * pulse-pm-sync.json file is migrated once automatically if the DB is empty.
 *
 * Endpoints:
 *   GET  /health          -> { ok, app, version, storage, counts }
 *   POST /sync            -> delta ({ since, changes }) or legacy full payload.
 *                            Delta returns { app, version, serverTime, changes, counts }.
 *                            Legacy returns the full merged payload.
 *
 * Delta sync is what prevents override data loss: each side only sends rows
 * changed since its last cursor, and the server merges row-by-row (newest
 * updatedAt wins) inside a single SQLite transaction — concurrent phone+PC
 * pushes can no longer clobber each other.
 *
 * For trusted home networks only: no authentication.
 */
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import {
  isDeltaRequest,
  isPayload,
} from "../src/lib/merge";
import { SyncDb } from "./db";

const PORT = Number(process.env.PORT || 8091);
const HERE = dirname(new URL(import.meta.url).pathname);
const DB_PATH = process.env.SYNC_DB || process.env.HIVE_SYNC_DB || join(HERE, "hive-pm-sync.db");
const LEGACY_JSON = [
  process.env.SYNC_DATA || process.env.HIVE_SYNC_DATA || join(HERE, "hive-pm-sync.json"),
  join(HERE, "pulse-pm-sync.json"),
];

const db = new SyncDb(DB_PATH);
for (const f of LEGACY_JSON) {
  if (f) await db.migrateFromJson(f);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: CORS });

function lanUrls(): string[] {
  const out: string[] = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === "IPv4" && !i.internal) out.push(`http://${i.address}:${PORT}`);
    }
  }
  return out;
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (req.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, app: "hive-pm-sync", version: 2, storage: "sqlite", counts: db.counts() });
    }

    if (req.method === "POST" && url.pathname === "/sync") {
      try {
        const body = await req.json();

        // --- Delta sync (preferred): apply caller's changes, return what's new for them.
        if (isDeltaRequest(body)) {
          const since = body.since ?? null;
          const counts = db.applyChanges(body.changes);
          const changes = db.getChanges(since);
          const serverTime = db.serverTime();
          const res = { app: "hive-pm", version: 1, serverTime, changes, counts };
          const c = db.counts();
          console.log(
            `[sync:delta] pushed=${counts.pushed} +${counts.added} ~${counts.updated} -${counts.removed} -> ${c.projects}p/${c.goals}g/${c.tasks}t`
          );
          return json(res);
        }

        // --- Legacy: full-payload merge (old app versions + manual file import).
        if (!isPayload(body)) return json({ error: "Not a Hive sync payload." }, 400);
        const { payload, counts } = db.applyFullPayload(body);
        const c = db.counts();
        console.log(
          `[sync:full] +${counts.added} ~${counts.updated} -${counts.removed} -> ${c.projects}p/${c.goals}g/${c.tasks}t`
        );
        return json(payload);
      } catch (e: unknown) {
        return json({ error: (e as Error)?.message || "Bad request." }, 400);
      }
    }

    return json({ error: "Not found. Try GET /health or POST /sync." }, 404);
  },
});

{
  const c = db.counts();
  console.log(`Hive PM sync server on port ${server.port} (sqlite: ${DB_PATH})`);
  console.log(`  data: ${c.projects} projects, ${c.goals} goals, ${c.tasks} tasks, ${c.deleted} tombstones`);
}
for (const u of lanUrls()) console.log(`  ${u}`);
console.log(`Enter one of those URLs in the app's ⇄ Sync dialog on each device.`);
