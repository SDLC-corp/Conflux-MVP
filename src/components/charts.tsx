import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Api, Env } from "../data/types";
import { series, type Point } from "../lib/metrics";
import { fmtNum } from "../lib/util";

export const ENV_SCALE: Record<Env, number> = { production: 1, staging: 0.035, dev: 0.004 };

export function useTrafficSeries(apis: Api[], env: Env, tick: number, minutes = 60): Point[] {
  // tick is included so the chart advances with the live simulator
  void tick;
  const live = new Set(apis.filter((a) => a.deployments[env]).map((a) => a.id));
  const s = ENV_SCALE[env];
  return series(apis, Date.now(), minutes, live).map((p) => ({
    ...p,
    ok: Math.round(p.ok * s),
    c4xx: Math.round(p.c4xx * s),
    c5xx: Math.round(p.c5xx * s),
  }));
}

const axis = { stroke: "#6b7491", fontSize: 11, tickLine: false, axisLine: false } as const;

function TipBox({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line-2 bg-panel px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-medium text-ink">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-ink-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="tabular-nums text-ink">
            {fmtNum(p.value)}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrafficChart({ data, height = 240 }: { data: Point[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gOk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#232c44" vertical={false} />
        <XAxis dataKey="t" {...axis} interval={9} />
        <YAxis {...axis} tickFormatter={fmtNum} width={52} />
        <Tooltip content={<TipBox />} cursor={{ stroke: "#2e3854" }} />
        <Area type="monotone" dataKey="ok" name="2xx" stroke="#818cf8" strokeWidth={1.5} fill="url(#gOk)" isAnimationActive={false} />
        <Area type="monotone" dataKey="c4xx" name="4xx" stroke="#f59e0b" strokeWidth={1.5} fill="#f59e0b" fillOpacity={0.12} isAnimationActive={false} />
        <Area type="monotone" dataKey="c5xx" name="5xx" stroke="#ef4444" strokeWidth={1.5} fill="#ef4444" fillOpacity={0.15} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LatencyChart({ data, height = 200, threshold }: { data: Point[]; height?: number; threshold?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232c44" vertical={false} />
        <XAxis dataKey="t" {...axis} interval={9} />
        <YAxis {...axis} width={52} tickFormatter={(v: number) => `${Math.round(v)}ms`} domain={[0, (max: number) => Math.max(max * 1.2, threshold ? threshold * 1.1 : 0)]} />
        <Tooltip content={<TipBox unit=" ms" />} cursor={{ stroke: "#2e3854" }} />
        <Line type="monotone" dataKey="p95" name="p95 latency" stroke="#22d3ee" strokeWidth={1.75} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex items-center gap-3 text-xs text-ink-3">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
