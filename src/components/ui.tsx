import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { Stage } from "../data/types";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ children, className, title, action, pad = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; pad?: boolean }) {
  return (
    <section className={cx("rounded-xl border border-line bg-panel", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
export function Button({ variant = "secondary", size = "md", className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      {...rest}
      className={cx(
        "focus-ring inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-brand text-white hover:bg-brand-2",
        variant === "secondary" && "border border-line-2 bg-panel-2 text-ink hover:border-ink-3",
        variant === "ghost" && "text-ink-2 hover:bg-panel-2 hover:text-ink",
        variant === "danger" && "border border-bad/40 bg-bad/10 text-red-300 hover:bg-bad/20",
        variant === "success" && "border border-ok/40 bg-ok/10 text-green-300 hover:bg-ok/20",
        className,
      )}
    >
      {children}
    </button>
  );
}

const tones = {
  gray: "bg-ink-3/15 text-ink-2 border-ink-3/30",
  green: "bg-ok/10 text-green-300 border-ok/30",
  amber: "bg-warn/10 text-amber-300 border-warn/30",
  red: "bg-bad/10 text-red-300 border-bad/30",
  indigo: "bg-brand/15 text-indigo-300 border-brand/30",
  cyan: "bg-cyan/10 text-cyan-300 border-cyan/30",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const STAGE_TONE: Record<Stage, Tone> = {
  draft: "gray",
  review: "amber",
  approved: "cyan",
  published: "green",
  deprecated: "amber",
  retired: "gray",
};
export const StageBadge = ({ stage }: { stage: Stage }) => (
  <Badge tone={STAGE_TONE[stage]} dot>
    {stage[0].toUpperCase() + stage.slice(1)}
  </Badge>
);

export function Stat({ label, value, delta, tone, hint }: { label: string; value: ReactNode; delta?: ReactNode; tone?: "good" | "bad" | "neutral"; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tabular-nums text-ink">{value}</div>
        {delta && <div className={cx("text-xs font-medium", tone === "good" ? "text-green-400" : tone === "bad" ? "text-red-400" : "text-ink-2")}>{delta}</div>}
      </div>
      {hint && <div className="mt-1 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[8vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={cx("slide-in w-full rounded-xl border border-line-2 bg-panel shadow-2xl", wide ? "max-w-3xl" : "max-w-lg")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-semibold">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="focus-ring rounded p-1 text-ink-3 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50" onMouseDown={onClose}>
      <aside className="slide-in absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-line-2 bg-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-semibold">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="focus-ring rounded p-1 text-ink-3 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </aside>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-3">{hint}</span>}
    </label>
  );
}

const inputBase = "focus-ring rounded-lg border border-line-2 bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-brand";
/** Full width unless the caller supplies its own width utility. */
const inputCls = (extra?: string) => cx(inputBase, !/(^|\s)(w-|min-w-|max-w-|flex-1)/.test(extra ?? "") && "w-full", extra);
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={inputCls(p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls(p.className), "mono text-xs")} />;
export const Select = ({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cx(inputCls(p.className), "pr-8")}>
    {children}
  </select>
);

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("focus-ring relative h-5 w-9 shrink-0 rounded-full transition disabled:opacity-40", checked ? "bg-brand" : "bg-line-2")}
    >
      <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cx(
            "focus-ring -mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition",
            value === t.key ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink-2",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-wider text-brand-2">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <div className="font-medium text-ink">{title}</div>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-3">{children}</div>}
    </div>
  );
}

export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return <pre className={cx("mono overflow-x-auto rounded-lg border border-line bg-bg p-3 text-xs leading-relaxed text-ink-2", className)}>{children}</pre>;
}

export const MethodBadge = ({ method }: { method: string }) => {
  const c: Record<string, string> = {
    GET: "text-cyan-300 bg-cyan/10",
    POST: "text-green-300 bg-ok/10",
    PUT: "text-amber-300 bg-warn/10",
    PATCH: "text-amber-300 bg-warn/10",
    DELETE: "text-red-300 bg-bad/10",
  };
  return <span className={cx("mono inline-block w-14 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold", c[method] ?? "bg-line text-ink-2")}>{method}</span>;
};

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-3">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cx("px-4 py-3 align-middle", className)}>{children}</td>;

export function Bar({ value, max = 100, tone = "brand" }: { value: number; max?: number; tone?: "brand" | "ok" | "warn" | "bad" }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const c = { brand: "bg-brand", ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={cx("h-full rounded-full transition-all", c)} style={{ width: `${pct}%` }} />
    </div>
  );
}
