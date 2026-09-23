import type { ParentProps } from "solid-js";

export function ProgressBar(props: { value: number; color?: string }) {
  return (
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-hive-700/60">
      <div
        class="h-full rounded-full transition-all duration-500"
        style={{ width: `${props.value}%`, background: props.color ?? "#f59e0b" }}
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
        <circle cx="20" cy="20" r={r} fill="none" style={{ stroke: "var(--color-hive-700)" }} stroke-width="5" />
        <circle
          cx="20" cy="20" r={r} fill="none"
          stroke={props.color ?? "#f59e0b"}
          stroke-width="5" stroke-linecap="round"
          stroke-dasharray={`${c}`} stroke-dashoffset={`${off}`}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <span class="absolute text-[11px] font-bold text-cream-100">{props.value}%</span>
    </div>
  );
}

export function Modal(props: ParentProps & { onClose: () => void; wide?: boolean }) {
  return (
    <div class="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-3 sm:p-4" onClick={props.onClose}>
      <div class="absolute inset-0 bg-black/70" />
      <div
        onClick={(e) => e.stopPropagation()}
        class={`anim-pop relative my-auto w-full ${props.wide ? "max-w-lg" : "max-w-md"} max-h-[90dvh] overflow-y-auto rounded-2xl border border-hive-600 bg-hive-850 shadow-xl shadow-black/50`}
      >
        <div class="honeycomb-bg honeycomb-fade pointer-events-none absolute inset-x-0 top-0 h-20 opacity-60" />
        <div class="relative">{props.children}</div>
      </div>
    </div>
  );
}

export function Field(props: ParentProps & { label: string }) {
  return (
    <label class="block">
      <span class="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-cream-500">{props.label}</span>
      {props.children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-hive-600 bg-hive-900 px-3 py-2 text-sm text-cream-100 placeholder:text-cream-500/60 outline-none focus:border-honey-500";

export function Empty(props: { icon: string; title: string; hint: string }) {
  return (
    <div class="grid place-items-center rounded-2xl border border-dashed border-hive-600 bg-hive-900 px-6 py-10 text-center">
      <div class="hex grid h-12 w-12 place-items-center bg-hive-800 text-2xl">{props.icon}</div>
      <div class="mt-3 font-semibold text-cream-100">{props.title}</div>
      <div class="mt-1 max-w-xs text-sm text-cream-500">{props.hint}</div>
    </div>
  );
}
