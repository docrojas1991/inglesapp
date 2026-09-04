import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { PhraseState } from "./lib/types";
import { STATE_LABELS } from "./lib/data";

/* ---------------- primitives ---------------- */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "ghost" | "outline" | "gold" | "danger" | "dark";
export function Button({
  children, onClick, variant = "primary", size = "md", disabled, className, type = "button", title,
}: {
  children: ReactNode; onClick?: () => void; variant?: BtnVariant; size?: "sm" | "md" | "lg";
  disabled?: boolean; className?: string; type?: "button" | "submit"; title?: string;
}) {
  const v: Record<BtnVariant, string> = {
    primary: "bg-pine-600 text-white hover:bg-pine-700 shadow-lift",
    gold: "bg-gold-400 text-pine-900 hover:bg-gold-300 shadow-lift",
    ghost: "bg-transparent text-pine-700 hover:bg-pine-50 dark:text-pine-300 dark:hover:bg-carbon2",
    outline: "border border-line bg-panel text-ink hover:border-pine-400 hover:text-pine-700 dark:border-nline dark:bg-carbon dark:text-snow dark:hover:border-pine-500",
    danger: "bg-clay-500 text-white hover:bg-clay-600",
    dark: "bg-ink text-paper hover:bg-pine-900 dark:bg-snow dark:text-night dark:hover:bg-pine-100",
  };
  const s = {
    sm: "text-xs px-3 py-1.5 rounded-lg gap-1.5",
    md: "text-sm px-4 py-2.5 rounded-xl gap-2",
    lg: "text-base px-6 py-3.5 rounded-xl gap-2.5",
  }[size];
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "btn-press focus-ring inline-flex items-center justify-center font-semibold tracking-tight select-none",
        v[variant], s,
        disabled && "opacity-45 pointer-events-none",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        "rounded-2xl border border-line bg-panel shadow-lift dark:border-nline dark:bg-carbon",
        onClick && "cursor-pointer btn-press hover:-translate-y-0.5 hover:shadow-pop",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Chip({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "pine" | "gold" | "clay" | "med" | "ink"; className?: string }) {
  const t = {
    neutral: "bg-paper text-mute border-line dark:bg-carbon2 dark:text-faint dark:border-nline",
    pine: "bg-pine-50 text-pine-700 border-pine-200 dark:bg-pine-900/40 dark:text-pine-300 dark:border-pine-800",
    gold: "bg-gold-100 text-gold-600 border-gold-300/60 dark:bg-gold-400/10 dark:text-gold-300 dark:border-gold-400/20",
    clay: "bg-clay-100 text-clay-600 border-clay-400/40 dark:bg-clay-500/10 dark:text-clay-400 dark:border-clay-500/25",
    med: "bg-med-100 text-med-600 border-med-400/40 dark:bg-med-500/10 dark:text-med-400 dark:border-med-500/25",
    ink: "bg-ink text-paper border-ink dark:bg-snow dark:text-night dark:border-snow",
  }[tone];
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", t, className)}>
      {children}
    </span>
  );
}

export const STATE_TONES: Record<PhraseState, { cls: string; dot: string }> = {
  NEW: { cls: "bg-paper text-mute border-line dark:bg-carbon2 dark:text-faint dark:border-nline", dot: "bg-faint" },
  LEARNING: { cls: "bg-gold-100 text-gold-600 border-gold-300/60 dark:bg-gold-400/10 dark:text-gold-300 dark:border-gold-400/20", dot: "bg-gold-400" },
  REVIEWING: { cls: "bg-[#fdf0e3] text-[#b45f1e] border-[#eecfae] dark:bg-[#b45f1e]/15 dark:text-[#eab077] dark:border-[#b45f1e]/30", dot: "bg-[#d98d1e]" },
  STRUGGLING: { cls: "bg-clay-100 text-clay-600 border-clay-400/40 dark:bg-clay-500/10 dark:text-clay-400 dark:border-clay-500/25", dot: "bg-clay-500" },
  NEEDS_REVIEW: { cls: "bg-[#e9f1fa] text-med-600 border-med-400/40 dark:bg-med-500/10 dark:text-med-400 dark:border-med-500/25", dot: "bg-med-500" },
  STRONG: { cls: "bg-pine-100 text-pine-700 border-pine-200 dark:bg-pine-900/40 dark:text-pine-300 dark:border-pine-800", dot: "bg-pine-500" },
  MASTERED: { cls: "bg-pine-600 text-white border-pine-600 dark:bg-pine-600 dark:border-pine-600", dot: "bg-white" },
  LONG_TERM_MASTERED: { cls: "bg-ink text-gold-300 border-ink dark:bg-snow dark:text-pine-800 dark:border-snow", dot: "bg-gold-400" },
};

export function StateChip({ state, className }: { state: PhraseState; className?: string }) {
  const t = STATE_TONES[state];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide", t.cls, className)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", t.dot)} />
      {STATE_LABELS[state]}
    </span>
  );
}

export function ProgressBar({ value, className, tone = "pine" }: { value: number; className?: string; tone?: "pine" | "gold" | "clay" | "med" }) {
  const t = { pine: "bg-pine-500", gold: "bg-gold-400", clay: "bg-clay-500", med: "bg-med-500" }[tone];
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-line/70 dark:bg-nline", className)}>
      <div className={cx("anim-bar h-full rounded-full", t)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 56, stroke = 6, tone = "pine", label, sub }: {
  value: number; size?: number; stroke?: number; tone?: "pine" | "gold" | "med" | "clay"; label?: ReactNode; sub?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const color = tone === "gold" ? "var(--color-gold-400)" : tone === "med" ? "var(--color-med-500)" : tone === "clay" ? "var(--color-clay-500)" : "var(--color-pine-500)";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line dark:stroke-nline" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={color} strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {label}
        {sub && <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-faint">{sub}</span>}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6 dark:bg-black/60" onClick={onClose}>
      <div
        className={cx(
          "anim-pop max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-panel p-6 shadow-pop sm:rounded-3xl dark:border-nline dark:bg-carbon",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx("btn-press focus-ring relative h-6 w-11 rounded-full transition-colors", on ? "bg-pine-600" : "bg-line dark:bg-nline")}
    >
      <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function Segmented<T extends string>({ options, value, onChange, className }: {
  options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div className={cx("inline-flex rounded-xl border border-line bg-paper p-1 dark:border-nline dark:bg-night", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cx(
            "btn-press focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            value === o.id ? "bg-panel text-ink shadow-sm dark:bg-carbon2 dark:text-snow" : "text-mute hover:text-ink dark:text-faint dark:hover:text-snow",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="anim-rise flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center dark:border-nline">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pine-50 text-pine-600 dark:bg-pine-900/40 dark:text-pine-300">{icon}</div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-mute dark:text-faint">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function useCountUp(target: number, duration = 700): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setVal(Math.round(target * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ---------------- charts (hand-rolled SVG) ---------------- */

export function BarChart({ values, labels, tone = "pine", unit = "" }: { values: number[]; labels: string[]; tone?: "pine" | "gold" | "med"; unit?: string }) {
  const max = Math.max(1, ...values);
  const fill = tone === "gold" ? "var(--color-gold-400)" : tone === "med" ? "var(--color-med-500)" : "var(--color-pine-500)";
  return (
    <div className="flex h-32 items-end gap-2">
      {values.map((v, i) => (
        <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] font-bold text-mute opacity-0 transition-opacity group-hover:opacity-100 dark:text-faint">
            {v}{unit}
          </span>
          <div
            className="anim-bar w-full max-w-9 rounded-t-md transition-all group-hover:opacity-80"
            style={{ height: `${Math.max(3, (v / max) * 78)}%`, background: v === 0 ? "var(--color-line)" : fill, animationDelay: `${i * 50}ms` }}
          />
          <span className="text-[10px] font-semibold text-faint">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function AreaLine({ points, height = 90, tone = "pine", suffix = "%" }: { points: number[]; height?: number; tone?: "pine" | "gold"; suffix?: string }) {
  const w = 100;
  const max = Math.max(100, ...points);
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(height - (p / max) * (height - 8) - 2).toFixed(1)}`);
  const line = coords.join(" ");
  const color = tone === "gold" ? "var(--color-gold-400)" : "var(--color-pine-500)";
  const last = points[points.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        <polygon points={`0,${height} ${line} ${w},${height}`} fill={color} opacity={0.12} />
        <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={i * step} cy={height - (p / max) * (height - 8) - 2} r={i === points.length - 1 ? 3 : 1.8} fill={color} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-faint">
        <span>{points.length} sessions ago</span>
        <span className="text-ink dark:text-snow">latest: {last ?? 0}{suffix}</span>
      </div>
    </div>
  );
}

export function Donut({ segments, size = 132, thickness = 16, centerLabel, centerSub }: {
  segments: { value: number; color: string }[]; size?: number; thickness?: number; centerLabel?: ReactNode; centerSub?: ReactNode;
}) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-line/60 dark:stroke-nline" />
        {segments.filter((s) => s.value > 0).map((s, i) => {
          const frac = s.value / total;
          const off = acc;
          acc += frac;
          return (
            <circle
              key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              strokeWidth={thickness} stroke={s.color} strokeLinecap="butt"
              strokeDasharray={`${Math.max(0, frac * c - 1.5)} ${c}`}
              strokeDashoffset={-off * c}
              style={{ transition: "stroke-dasharray 0.7s ease" }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {centerLabel}
        {centerSub && <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-faint">{centerSub}</span>}
      </div>
    </div>
  );
}

export function StatDelta({ value }: { value: number }) {
  return (
    <span className={cx("font-mono text-[11px] font-bold", value >= 0 ? "text-pine-600 dark:text-pine-300" : "text-clay-500 dark:text-clay-400")}>
      {value >= 0 ? "▲" : "▼"} {Math.abs(value)}
    </span>
  );
}
