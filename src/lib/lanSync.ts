import type { DeltaSyncRequest, DeltaSyncResponse, SyncChanges } from "./merge";

const URL_KEY = "hive-pm-sync-server";
const LEGACY_URL_KEY = "pulse-pm-sync-server";
const AUTO_KEY = "hive-pm-auto-sync";
const LEGACY_AUTO_KEY = "pulse-pm-auto-sync";

const normUrl = (u: string) => u.trim().replace(/\/+$/, "");

export function getSyncServer(): string {
  return normUrl(localStorage.getItem(URL_KEY) || localStorage.getItem(LEGACY_URL_KEY) || "");
}

export function setSyncServer(url: string) {
  const clean = normUrl(url);
  if (clean) localStorage.setItem(URL_KEY, clean);
  else localStorage.removeItem(URL_KEY);
}

export function getAutoSync(): boolean {
  const v = localStorage.getItem(AUTO_KEY) ?? localStorage.getItem(LEGACY_AUTO_KEY);
  return v === null ? true : v === "1";
}

export function setAutoSync(on: boolean) {
  localStorage.setItem(AUTO_KEY, on ? "1" : "0");
}

/**
 * Delta sync: POST only rows changed since `since`, get back only rows
 * changed since `since` plus a new `serverTime` cursor. A stale device can
 * no longer overwrite newer server rows with its full snapshot.
 */
export async function pushPullDelta(
  serverUrl: string,
  changes: SyncChanges,
  since: string | null,
  timeoutMs = 8000
): Promise<DeltaSyncResponse> {
  const body: DeltaSyncRequest = { app: "hive-pm", version: 1, since, changes };
  const res = await fetch(`${normUrl(serverUrl)}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Sync server replied ${res.status}`);
  const data = (await res.json()) as unknown;
  // Old servers answer delta POSTs with a full payload; reject so the user
  // updates the server instead of corrupting state.
  if (typeof data === "object" && data !== null && "serverTime" in data && "changes" in data) {
    return data as DeltaSyncResponse;
  }
  throw new Error("Server does not speak delta sync — please update it.");
}

export async function checkServer(serverUrl: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetch(`${normUrl(serverUrl)}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.app === "hive-pm-sync" || data?.app === "pulse-pm-sync";
  } catch {
    return false;
  }
}
