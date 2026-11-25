import type { Api } from "../data/types";

/**
 * Deterministic-ish traffic simulator. Each published API gets a baseline profile; a time series
 * is derived from a seeded noise function so charts are stable across renders but still "live"
 * (the latest minute changes every tick).
 */

export interface ApiProfile {
  rpm: number;
  p95: number;
  errorRate: number; // percent
  availability: number; // percent
}

const PROFILES: Record<string, ApiProfile> = {
  api_payments: { rpm: 52_000, p95: 92, errorRate: 0.09, availability: 99.98 },
  api_orders: { rpm: 61_000, p95: 74, errorRate: 0.12, availability: 99.95 },
  api_catalog: { rpm: 48_000, p95: 238, errorRate: 0.21, availability: 99.72 },
  api_identity: { rpm: 14_500, p95: 61, errorRate: 0.05, availability: 99.99 },
  api_inventory: { rpm: 7_200, p95: 18, errorRate: 0.02, availability: 99.97 },
  api_legacy_billing: { rpm: 1_520, p95: 410, errorRate: 4.1, availability: 98.9 },
};

export function profileFor(api: Api): ApiProfile {
  if (PROFILES[api.id]) return PROFILES[api.id];
  const live = !!api.deployments.production;
  let h = 0;
  for (const c of api.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return live
    ? { rpm: 2000 + (h % 9000), p95: 40 + (h % 90), errorRate: 0.05 + (h % 20) / 100, availability: 99.9 + (h % 9) / 100 }
    : { rpm: 0, p95: 0, errorRate: 0, availability: 100 };
}

function noise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export interface Point {
  t: string;
  ts: number;
  ok: number;
  c4xx: number;
  c5xx: number;
  p95: number;
}

/** 60 points (one per minute) ending at `now`. */
export function series(apis: Api[], now: number, minutes = 60, live?: Set<string>): Point[] {
  const active = apis.filter((a) => (live ? live.has(a.id) : !!a.deployments.production));
  const pts: Point[] = [];
  const endMin = Math.floor(now / 60000);
  for (let i = minutes - 1; i >= 0; i--) {
    const m = endMin - i;
    let ok = 0,
      c4 = 0,
      c5 = 0,
      latW = 0,
      rpmSum = 0;
    active.forEach((a, idx) => {
      const p = profileFor(a);
      const wave = 1 + 0.12 * Math.sin((m + idx * 7) / 9) + 0.08 * (noise(m * 13 + idx) - 0.5);
      const rpm = p.rpm * wave;
      const err = (p.errorRate / 100) * (1 + 1.5 * (noise(m * 7 + idx * 3) > 0.93 ? 1 : 0));
      const c5part = rpm * err * 0.45;
      const c4part = rpm * (0.011 + 0.004 * noise(m + idx * 11));
      ok += rpm - c5part - c4part;
      c4 += c4part;
      c5 += c5part;
      latW += p.p95 * (1 + 0.15 * (noise(m * 3 + idx) - 0.4)) * rpm;
      rpmSum += rpm;
    });
    const d = new Date(m * 60000);
    pts.push({
      t: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      ts: m * 60000,
      ok: Math.round(ok),
      c4xx: Math.round(c4),
      c5xx: Math.round(c5),
      p95: rpmSum ? Math.round(latW / rpmSum) : 0,
    });
  }
  return pts;
}

/** Point-in-time metrics for a single API, with jitter per tick. */
export function liveMetrics(api: Api, tick: number) {
  const p = profileFor(api);
  const j = (k: number) => 1 + (noise(tick * 17 + k + api.id.length * 3) - 0.5) * 0.1;
  return {
    rpm: Math.round(p.rpm * j(1)),
    p95: Math.round(p.p95 * j(2)),
    errorRate: +(p.errorRate * j(3)).toFixed(2),
    availability: p.availability,
  };
}

export const CONSUMER_GEO = [
  { region: "North America", share: 46 },
  { region: "Europe", share: 31 },
  { region: "Asia Pacific", share: 15 },
  { region: "Latin America", share: 6 },
  { region: "Other", share: 2 },
];
