import { Show, createSignal } from "solid-js";
import { useStore } from "../store";
import { checkServer, getAutoSync, getSyncServer, setAutoSync, setSyncServer } from "../lib/lanSync";
import { Modal, Field, inputCls } from "./ui";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SyncDialog(props: { onClose: () => void }) {
  const { state, actions } = useStore();
  const [pasted, setPasted] = createSignal("");
  const [notice, setNotice] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [serverUrl, setServerUrl] = createSignal(getSyncServer());
  const [autoSync, setAutoSyncState] = createSignal(getAutoSync());
  const [serverBusy, setServerBusy] = createSignal(false);

  const filename = () => `pulse-pm-sync-${new Date().toISOString().slice(0, 10)}.json`;

  const summary = (r: { added: number; updated: number; removed: number }) =>
    `${r.added} new · ${r.updated} updated · ${r.removed} removed`;

  const doSyncNow = async () => {
    setNotice(null);
    setError(null);
    const url = serverUrl().trim();
    if (!url) {
      setError("Enter your home server URL first (e.g. http://192.168.1.50:8091).");
      return;
    }
    setServerBusy(true);
    try {
      setSyncServer(url);
      const ok = await checkServer(url);
      if (!ok) throw new Error("No Pulse sync server there — is it running on your home PC?");
      const r = await actions.syncNow();
      setNotice(`Synced with home server: ${summary(r)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setServerBusy(false);
    }
  };

  const doImport = (json: string) => {
    setNotice(null);
    setError(null);
    try {
      const r = actions.importData(json);
      const parts = [`${r.added} new`, `${r.updated} updated`, `${r.removed} removed`];
      setNotice(`Merged: ${parts.join(" · ")}.`);
      setPasted("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then(doImport).catch(() => setError("Could not read that file."));
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(actions.exportData());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard blocked — use Download instead.");
    }
  };

  return (
    <Modal onClose={props.onClose} wide>
      <div class="p-5">
        <h2 class="text-lg font-extrabold text-white">Sync phone ⇄ PC</h2>
        <p class="text-xs leading-relaxed text-zinc-500">
          At home the app syncs itself with your home server on launch. Away from
          home it just works offline — sync when you're back.
        </p>

        {/* home server */}
        <div class="mt-3 rounded-xl border border-zinc-700 bg-zinc-800 p-3">
          <div class="flex items-center gap-2">
            <div class="text-sm font-bold text-white">Home server (auto)</div>
            <Show when={state.lastSyncAt}>
              <div class="ml-auto text-[11px] text-zinc-400">
                ✓ {new Date(state.lastSyncAt!).toLocaleString()}
                {state.lastSyncSummary ? ` · ${state.lastSyncSummary}` : ""}
              </div>
            </Show>
          </div>
          <div class="mt-2 flex gap-2">
            <input
              class={inputCls}
              value={serverUrl()}
              onInput={(e) => setServerUrl(e.currentTarget.value)}
              placeholder="http://192.168.1.50:8091"
              inputmode="url"
            />
            <button
              onClick={doSyncNow}
              disabled={serverBusy() || !serverUrl().trim()}
              class="shrink-0 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-40"
            >
              {serverBusy() ? "Syncing…" : "Sync now"}
            </button>
          </div>
          <label class="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={autoSync()}
              onChange={(e) => {
                setAutoSync(e.currentTarget.checked);
                setAutoSyncState(e.currentTarget.checked);
              }}
              class="h-4 w-4 accent-indigo-500"
            />
            Sync automatically on launch when the server is reachable
          </label>
        </div>

        <div class="mt-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Manual file sync (no network needed)
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          {/* export */}
          <div class="rounded-xl border border-zinc-700 bg-zinc-800 p-3">
            <div class="text-sm font-bold text-white">1 · From this device</div>
            <div class="mt-0.5 text-[11px] text-zinc-400">
              {state.projects.length} projects · {state.goals.length} goals · {state.tasks.length} tasks
            </div>
            <div class="mt-2 flex gap-2">
              <button
                onClick={() => download(filename(), actions.exportData())}
                class="flex-1 rounded-xl bg-indigo-500 py-2 text-sm font-bold text-white hover:bg-indigo-400"
              >
                ⤓ Save file
              </button>
              <button
                onClick={copyAll}
                class="flex-1 rounded-xl border border-zinc-600 bg-zinc-700 py-2 text-sm font-bold text-zinc-100 hover:bg-zinc-600"
              >
                {copied() ? "✓ Copied" : "⧉ Copy"}
              </button>
            </div>
          </div>

          {/* import */}
          <div class="rounded-xl border border-zinc-700 bg-zinc-800 p-3">
            <div class="text-sm font-bold text-white">2 · Into this device</div>
            <div class="mt-0.5 text-[11px] text-zinc-400">Merges the other device's file into this one.</div>
            <label class="mt-2 block cursor-pointer rounded-xl border border-dashed border-zinc-600 py-2.5 text-center text-sm font-semibold text-zinc-300 hover:border-zinc-400 hover:text-white">
              ⤒ Choose sync file…
              <input
                type="file"
                accept=".json,application/json"
                class="hidden"
                onChange={(e) => {
                  onFile(e.currentTarget.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>

        <Field label="Or paste sync JSON directly">
          <textarea
            class={`${inputCls} font-mono text-xs`}
            rows={3}
            value={pasted()}
            onInput={(e) => setPasted(e.currentTarget.value)}
            placeholder='Paste the file contents here…'
          />
        </Field>
        <div class="mt-2 flex gap-2">
          <button
            onClick={() => pasted().trim() && doImport(pasted())}
            disabled={!pasted().trim()}
            class="flex-1 rounded-xl bg-indigo-500 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-40"
          >
            Merge pasted data
          </button>
          <button onClick={props.onClose} class="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700">
            Close
          </button>
        </div>

        <Show when={notice()}>
          <div class="mt-3 rounded-xl border border-emerald-800 bg-emerald-950/60 px-3 py-2 text-xs text-emerald-200">
            {notice()}
          </div>
        </Show>
        <Show when={error()}>
          <div class="mt-3 rounded-xl border border-rose-800 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
            {error()}
          </div>
        </Show>
      </div>
    </Modal>
  );
}
