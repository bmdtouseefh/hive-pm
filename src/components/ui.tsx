import type { ParentProps } from "solid-js";

export function ProgressBar(props: { value: number; color?: string; class?: string }) {
  return (
    <div class={`h-1.5 w-full overflow-hidden rounded-full bg-zinc-700/60 ${props.class ?? ""}`}>
      <div
        class="h-full rounded-full transition-all duration-500"
        style={{ width: `${props.value}%`, background: props.color ?? "#6366f1" }}
      />
    </div>
  );
}

export function Ring(props: { value: number; size?: number; color?: string }) {
  const size = props.size ?? 44;
  const r = 16;
  const c = 2 * Math.PI * r;
  const off = c - (props.value / 100) * c;
  return (
    <div class="relative grid shrink-0 place-items-center" style={{ width: `${size}px`, height: `${size}px` }}>
      <svg width={size} height={size} viewBox="0 0 40 40" class="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#3f3f46" stroke-width="5" />
        <circle
          cx="20" cy="20" r={r} fill="none"
          stroke={props.color ?? "#6366f1"}
          stroke-width="5" stroke-linecap="round"
          stroke-dasharray={`${c}`} stroke-dashoffset={`${off}`}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <span class="absolute text-[11px] font-bold text-white">{props.value}%</span>
    </div>
  );
}

export function Modal(props: ParentProps & { onClose: () => void; wide?: boolean }) {
  return (
    <div class="fixed inset-0 z-50 grid place-items-center p-4" onClick={props.onClose}>
      <div class="absolute inset-0 bg-black/60" />
      <div
        onClick={(e) => e.stopPropagation()}
        class={`anim-pop relative w-full ${props.wide ? "max-w-lg" : "max-w-md"} overflow-hidden rounded-2xl border border-zinc-700 bg-[#202227] shadow-xl`}
      >
        <div class="relative">{props.children}</div>
      </div>
    </div>
  );
}

export function Field(props: ParentProps & { label: string }) {
  return (
    <label class="block">
      <span class="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{props.label}</span>
      {props.children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-zinc-500";

export function Empty(props: { icon: string; title: string; hint: string }) {
  return (
    <div class="grid place-items-center rounded-2xl border border-dashed border-zinc-700 bg-[#1d1f25] px-6 py-10 text-center">
      <div class="mb-2 text-3xl">{props.icon}</div>
      <div class="font-semibold text-white">{props.title}</div>
      <div class="mt-1 max-w-xs text-sm text-zinc-400">{props.hint}</div>
    </div>
  );
}

export function Kbd(props: { children: string }) {
  return <kbd class="rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">{props.children}</kbd>;
}
