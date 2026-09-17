/**
 * Pulse PM home sync server. One shared copy on your home network, no accounts.
 *
 *   bun sync-server/server.ts                 # serves http://0.0.0.0:8091
 *   PORT=8091 SYNC_DATA=./pulse-pm-sync.json bun sync-server/server.ts
 *
 * Endpoints:
 *   GET  /health  -> { ok, app: "pulse-pm-sync", version }
 *   GET  /state   -> current merged payload (debug/inspection)
 *   POST /sync    -> body = client's export payload, returns merged payload
 *
 * For trusted home networks only: no authentication.
 */
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { blankPayload, isPayload, mergePayload, type SyncPayload } from "../src/lib/merge";

const PORT = Number(process.env.PORT || 8091);
const HERE = dirname(new URL(import.meta.url).pathname);
const DATA_FILE = process.env.SYNC_DATA || join(HERE, "pulse-pm-sync.json");

let state: SyncPayload = blankPayload();

async function loadState() {
  try {
    const raw = await Bun.file(DATA_FILE).text();
    const parsed = JSON.parse(raw);
    if (isPayload(parsed)) {
      state = parsed;
      console.log(
        `Loaded ${state.projects.length} projects, ${state.goals.length} goals, ${state.tasks.length} tasks from ${DATA_FILE}`
      );
      return;
    }
    console.log(`Ignoring unrecognized ${DATA_FILE}, starting fresh.`);
  } catch (e: any) {
    if (e?.code !== "ENOENT") console.log(`Could not read ${DATA_FILE}: ${e?.message}. Starting fresh.`);
  }
}

async function saveState() {
  const tmp = `${DATA_FILE}.tmp`;
  await Bun.write(tmp, JSON.stringify(state));
  const { rename } = await import("node:fs/promises");
  await rename(tmp, DATA_FILE);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: CORS });

function lanUrls(): string[] {
  const out: string[] = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === "IPv4" && !i.internal) out.push(`http://${i.address}:${PORT}`);
    }
  }
  return out;
}

await loadState();

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (req.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, app: "pulse-pm-sync", version: 1 });
    }

    if (req.method === "GET" && url.pathname === "/state") {
      return json(state);
    }

    if (req.method === "POST" && url.pathname === "/sync") {
      try {
        const body = await req.json();
        if (!isPayload(body)) return json({ error: "Not a Pulse PM sync payload." }, 400);
        const { payload, counts } = mergePayload(state, body);
        state = payload;
        await saveState();
        console.log(
          `[sync] +${counts.added} ~${counts.updated} -${counts.removed} -> ${state.projects.length}p/${state.goals.length}g/${state.tasks.length}t`
        );
        return json(state);
      } catch (e: any) {
        return json({ error: e?.message || "Bad request." }, 400);
      }
    }

    return json({ error: "Not found. Try GET /health or POST /sync." }, 404);
  },
});

console.log(`Pulse PM sync server on port ${server.port} (data: ${DATA_FILE})`);
for (const u of lanUrls()) console.log(`  ${u}`);
console.log(`Enter one of those URLs in the app's ⇄ Sync dialog on each device.`);
