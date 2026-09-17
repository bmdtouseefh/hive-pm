const URL_KEY = "pulse-pm-sync-server";
const AUTO_KEY = "pulse-pm-auto-sync";

export function getSyncServer(): string {
  return (localStorage.getItem(URL_KEY) || "").trim().replace(/\/+$/, "");
}

export function setSyncServer(url: string) {
  const clean = url.trim().replace(/\/+$/, "");
  if (clean) localStorage.setItem(URL_KEY, clean);
  else localStorage.removeItem(URL_KEY);
}

export function getAutoSync(): boolean {
  const v = localStorage.getItem(AUTO_KEY);
  return v === null ? true : v === "1";
}

export function setAutoSync(on: boolean) {
  localStorage.setItem(AUTO_KEY, on ? "1" : "0");
}

/** POST our payload, get the merged payload back. One round trip syncs both sides. */
export async function pushPull(serverUrl: string, payloadJson: string, timeoutMs = 8000): Promise<string> {
  const res = await fetch(`${serverUrl.replace(/\/+$/, "")}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payloadJson,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Sync server replied ${res.status}`);
  return await res.text();
}

export async function checkServer(serverUrl: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetch(`${serverUrl.replace(/\/+$/, "")}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.app === "pulse-pm-sync";
  } catch {
    return false;
  }
}
