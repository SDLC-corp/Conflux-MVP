import { BellPlus, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar as RBar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ENV_SCALE, LatencyChart, Legend, TrafficChart, useTrafficSeries } from "../components/charts";
import { Badge, Bar, Button, Card, cx, Field, Input, Modal, PageHeader, Select, Table, Tabs, Td, Toggle } from "../components/ui";
import type { AlertRule, Api } from "../data/types";
import { CONSUMER_GEO, liveMetrics, profileFor } from "../lib/metrics";
import { can } from "../lib/rules";
import { downloadFile, fmtNum, relTime, toCsv } from "../lib/util";
import { useStore } from "../store";

type Tab = "dashboards" | "sla" | "incidents" | "traces" | "consumers";

export function Monitoring() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>("dashboards");
  const open = state.alerts.filter((a) => a.status === "open").length;
  return (
    <>
      <PageHeader
        eyebrow="Analytics & Monitoring"
        title="Know your APIs like your uptime depends on it"
        subtitle="Real-time usage, latency, errors and SLAs — sliced by API, consumer and geography — with alerting and distributed tracing."
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "dashboards", label: "Dashboards" },
          { key: "sla", label: "SLA monitoring" },
          { key: "incidents", label: <>Incidents {open > 0 && <Badge tone="red" className="ml-1">{open}</Badge>}</> },
          { key: "traces", label: "Distributed tracing" },
          { key: "consumers", label: "Consumer analytics" },
        ]}
      />
      <div className="mt-5">
        {tab === "dashboards" && <Dashboards />}
        {tab === "sla" && <Sla />}
        {tab === "incidents" && <Incidents />}
        {tab === "traces" && <Traces />}
        {tab === "consumers" && <Consumers />}
      </div>
    </>
  );
}

function Dashboards() {
  const { state, tick } = useStore();
  const live = state.apis.filter((a) => a.deployments[state.env]);
  const [apiId, setApiId] = useState<string>("all");
  const subset = apiId === "all" ? state.apis : state.apis.filter((a) => a.id === apiId);
  const data = useTrafficSeries(subset, state.env, tick);
  const scale = ENV_SCALE[state.env];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={apiId} onChange={(e) => setApiId(e.target.value)} className="w-64" aria-label="Filter by API">
          <option value="all">All APIs ({live.length} live in {state.env})</option>
          {live.map((a) => (
            <option key={a.id} value={a.id}>
              {a.slug}
            </option>
          ))}
        </Select>
        <span className="text-xs text-ink-3">Auto-refreshing every 3s</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Throughput by status class" action={<Legend items={[{ label: "2xx", color: "#818cf8" }, { label: "4xx", color: "#f59e0b" }, { label: "5xx", color: "#ef4444" }]} />}>
          <TrafficChart data={data} height={220} />
        </Card>
        <Card title="P95 latency" action={<Badge tone="cyan">Threshold 250 ms</Badge>}>
          <LatencyChart data={data} height={220} threshold={250} />
        </Card>
      </div>
      <Card title="Per-API health" pad={false}>
        <Table head={["API", "Req/min", "P95", "Error rate", "Availability", "Gateway route"]}>
          {live.map((a) => {
            const m = liveMetrics(a, tick);
            const route = state.routes.find((r) => r.apiId === a.id);
            return (
              <tr key={a.id}>
                <Td className="font-medium">{a.slug}</Td>
                <Td className="tabular-nums">{fmtNum(Math.round(m.rpm * scale))}</Td>
                <Td className={cx("tabular-nums", m.p95 > 250 && "text-amber-300")}>{m.p95} ms</Td>
                <Td className={cx("tabular-nums", m.errorRate > 1 && "text-red-300")}>{m.errorRate}%</Td>
                <Td className="tabular-nums">{m.availability}%</Td>
                <Td>{route ? <Badge tone={route.status === "Healthy" ? "green" : route.status === "Throttling" ? "amber" : "red"}>{route.status}</Badge> : <span className="text-xs text-ink-3">No route</span>}</Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}

function slaRows(apis: Api[]) {
  return apis
    .filter((a) => a.deployments.production)
    .map((a) => {
      const p = profileFor(a);
      const budget = 100 - a.slaTarget; // allowed downtime %
      const used = Math.max(0, 100 - p.availability);
      const remaining = budget > 0 ? Math.max(0, Math.round((1 - used / budget) * 100)) : 0;
      return { api: a, availability: p.availability, target: a.slaTarget, remaining, met: p.availability >= a.slaTarget };
    });
}

function Sla() {
  const { state, logAudit } = useStore();
  const rows = slaRows(state.apis);
  const exportReport = () => {
    downloadFile(
      `conflux-sla-report-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows.map((r) => ({ api: r.api.slug, owner: r.api.owner, target_pct: r.target, actual_pct: r.availability, error_budget_remaining_pct: r.remaining, status: r.met ? "met" : "breached" }))),
      "text/csv",
    );
    logAudit("Exported SLA report", "SLA overview", "governance");
  };
  return (
    <Card
      pad={false}
      title="SLA overview · current quarter"
      action={
        <Button size="sm" onClick={exportReport}>
          <Download size={13} /> Export report
        </Button>
      }
    >
      <Table head={["API", "Owner", "Target", "Actual", "Error budget remaining", "Status"]}>
        {rows.map((r) => (
          <tr key={r.api.id}>
            <Td className="font-medium">{r.api.slug}</Td>
            <Td className="text-ink-2">{r.api.owner}</Td>
            <Td className="tabular-nums">{r.target}%</Td>
            <Td className={cx("tabular-nums font-medium", r.met ? "text-green-400" : "text-red-300")}>{r.availability}%</Td>
            <Td>
              <div className="flex w-48 items-center gap-2">
                <Bar value={r.remaining} tone={r.remaining > 50 ? "ok" : r.remaining > 20 ? "warn" : "bad"} />
                <span className="w-10 text-right text-xs tabular-nums text-ink-3">{r.remaining}%</span>
              </div>
            </Td>
            <Td>
              <Badge tone={r.met ? "green" : "red"} dot>
                {r.met ? "On track" : "Breached"}
              </Badge>
            </Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

const METRIC_LABEL: Record<AlertRule["metric"], string> = { p95_latency: "P95 latency (ms)", error_rate: "Error rate (%)", availability: "Availability (%)", rpm: "Requests / min" };

function Incidents() {
  const { state, tick, setAlertStatus, toggleAlertRule, apiById } = useStore();
  const [adding, setAdding] = useState(false);
  const canEdit = can(state.user.role, "gateway.edit");

  const evaluate = (r: AlertRule) => {
    const apis = state.apis.filter((a) => a.deployments.production && (r.apiId === "*" || a.id === r.apiId));
    const firing = apis.filter((a) => {
      const m = liveMetrics(a, tick);
      const v = r.metric === "p95_latency" ? m.p95 : r.metric === "error_rate" ? m.errorRate : r.metric === "availability" ? m.availability : m.rpm;
      return r.op === ">" ? v > r.threshold : v < r.threshold;
    });
    return firing.map((a) => a.slug);
  };

  return (
    <div className="space-y-4">
      <Card title="Incident dashboard" pad={false}>
        <ul className="divide-y divide-line">
          {state.alerts.map((a) => (
            <li key={a.id} className={cx("flex flex-wrap items-center gap-3 px-4 py-3", a.status === "resolved" && "opacity-55")}>
              <Badge tone={a.severity === "critical" ? "red" : a.severity === "warning" ? "amber" : "cyan"}>{a.severity}</Badge>
              <div className="min-w-0 flex-1">
                <div className="text-sm">{a.title}</div>
                <div className="text-xs text-ink-3">
                  Routed to {a.routedTo} · {relTime(a.ts)}
                  {a.apiId && ` · ${apiById(a.apiId)?.slug}`}
                </div>
              </div>
              <Badge tone={a.status === "open" ? "red" : a.status === "acknowledged" ? "amber" : "green"}>{a.status}</Badge>
              {a.status === "open" && (
                <Button size="sm" onClick={() => setAlertStatus(a.id, "acknowledged")}>
                  Acknowledge
                </Button>
              )}
              {a.status !== "resolved" && (
                <Button size="sm" variant="success" onClick={() => setAlertStatus(a.id, "resolved")}>
                  Resolve
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card
        title="Alert rules"
        pad={false}
        action={
          canEdit && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <BellPlus size={13} /> New rule
            </Button>
          )
        }
      >
        <Table head={["Rule", "Scope", "Condition", "Channel", "Live evaluation", "Enabled"]}>
          {state.alertRules.map((r) => {
            const firing = r.enabled ? evaluate(r) : [];
            return (
              <tr key={r.id}>
                <Td className="font-medium">{r.name}</Td>
                <Td className="text-xs text-ink-2">{r.apiId === "*" ? "All APIs" : apiById(r.apiId)?.slug}</Td>
                <Td className="mono text-xs">
                  {METRIC_LABEL[r.metric]} {r.op} {r.threshold}
                </Td>
                <Td className="text-xs text-ink-2">{r.channel}</Td>
                <Td>{!r.enabled ? <span className="text-xs text-ink-3">Paused</span> : firing.length ? <Badge tone="red" dot>Firing · {firing.join(", ")}</Badge> : <Badge tone="green" dot>OK</Badge>}</Td>
                <Td>
                  <Toggle checked={r.enabled} onChange={() => toggleAlertRule(r.id)} disabled={!canEdit} label={`Toggle ${r.name}`} />
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
      <AddRuleModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddRuleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, addAlertRule } = useStore();
  const [r, setR] = useState<Omit<AlertRule, "id">>({ name: "", apiId: "*", metric: "p95_latency", op: ">", threshold: 200, channel: "Slack #api-alerts", enabled: true });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New alert rule"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!r.name}
            onClick={() => {
              addAlertRule(r);
              onClose();
            }}
          >
            Create rule
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Rule name">
            <Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder="e.g. Orders latency" />
          </Field>
        </div>
        <Field label="Scope">
          <Select value={r.apiId} onChange={(e) => setR({ ...r, apiId: e.target.value })}>
            <option value="*">All APIs</option>
            {state.apis.filter((a) => a.deployments.production).map((a) => (
              <option key={a.id} value={a.id}>
                {a.slug}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Metric">
          <Select value={r.metric} onChange={(e) => setR({ ...r, metric: e.target.value as AlertRule["metric"] })}>
            {Object.entries(METRIC_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Operator">
          <Select value={r.op} onChange={(e) => setR({ ...r, op: e.target.value as AlertRule["op"] })}>
            <option value=">">greater than</option>
            <option value="<">less than</option>
          </Select>
        </Field>
        <Field label="Threshold">
          <Input type="number" step="any" value={r.threshold} onChange={(e) => setR({ ...r, threshold: +e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notify channel">
            <Select value={r.channel} onChange={(e) => setR({ ...r, channel: e.target.value })}>
              {["Slack #api-alerts", "PagerDuty · on-call", "ServiceNow", "Jira", "Email · platform-team"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

interface Span {
  name: string;
  start: number;
  dur: number;
  error?: boolean;
}

function buildTraces(apis: Api[]) {
  const svc: Record<string, string[]> = {
    api_orders: ["orders-svc", "inventory"],
    api_payments: ["payments-svc", "fraud-scoring"],
    api_catalog: ["catalog-gql", "search-index"],
    api_identity: ["identity-svc", "consent-db"],
    api_legacy_billing: ["soap-adapter", "billing-legacy"],
  };
  const out: { id: string; api: Api; path: string; status: number; spans: Span[]; ago: number }[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  apis
    .filter((a) => svc[a.id])
    .forEach((a, i) => {
      for (let k = 0; k < 2; k++) {
        const [s1, s2] = svc[a.id];
        const gw = 4 + Math.round(rnd() * 4);
        const auth = 6 + Math.round(rnd() * 5);
        const main = Math.round(profileFor(a).p95 * (0.35 + rnd() * 0.25));
        const down = Math.round(main * (0.4 + rnd() * 0.2));
        const err = a.id === "api_legacy_billing" && k === 0;
        out.push({
          id: `${(1000 + i * 37 + k * 911).toString(16)}-${(5000 + i * 13 + k).toString(16)}`,
          api: a,
          path: a.endpoints[k % a.endpoints.length].method + " " + a.endpoints[k % a.endpoints.length].path,
          status: err ? 502 : 200,
          ago: i * 3 + k * 2 + 1,
          spans: [
            { name: "gateway", start: 0, dur: gw + auth + main + 2 },
            { name: "auth", start: gw, dur: auth },
            { name: s1, start: gw + auth + 1, dur: main, error: err },
            { name: s2, start: gw + auth + 1 + Math.round(main * 0.3), dur: down, error: err },
          ],
        });
      }
    });
  return out;
}

function Traces() {
  const { state } = useStore();
  const traces = useMemo(() => buildTraces(state.apis), [state.apis]);
  const [sel, setSel] = useState(traces[0]?.id);
  const t = traces.find((x) => x.id === sel) ?? traces[0];
  if (!t) return null;
  const total = t.spans[0].dur;
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card title="Recent traces" pad={false}>
        <ul className="max-h-[480px] divide-y divide-line overflow-y-auto">
          {traces.map((x) => (
            <li key={x.id}>
              <button onClick={() => setSel(x.id)} className={cx("w-full px-4 py-2.5 text-left hover:bg-panel-2/60", x.id === t.id && "bg-brand/10")}>
                <div className="flex items-center justify-between">
                  <span className="mono text-xs">{x.path}</span>
                  <Badge tone={x.status < 400 ? "green" : "red"}>{x.status}</Badge>
                </div>
                <div className="mono mt-0.5 text-[11px] text-ink-3">
                  {x.id} · {x.spans[0].dur} ms · {x.ago}m ago
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={<span className="mono">Distributed trace · {t.path}</span>} action={<span className="mono text-xs text-ink-3">trace_id {t.id}</span>}>
        <div className="space-y-3">
          {t.spans.map((s, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr_60px] items-center gap-3 text-sm">
              <span className={cx("mono truncate text-xs", i > 0 && "pl-3", s.error && "text-red-300")}>{s.name}</span>
              <div className="relative h-5 rounded bg-bg">
                <div
                  className={cx("absolute top-0 h-full rounded", s.error ? "bg-bad/70" : i === 0 ? "bg-brand/70" : "bg-cyan/60")}
                  style={{ left: `${(s.start / total) * 100}%`, width: `${Math.max(1.5, (s.dur / total) * 100)}%` }}
                />
              </div>
              <span className="mono text-right text-xs tabular-nums text-ink-2">{s.dur} ms</span>
            </div>
          ))}
        </div>
        <div className="mono mt-4 flex justify-between border-t border-line pt-2 text-[11px] text-ink-3">
          <span>0 ms</span>
          <span>{Math.round(total / 2)} ms</span>
          <span>{total} ms</span>
        </div>
        {t.status >= 400 && <div className="mt-4 rounded-lg border border-bad/30 bg-bad/10 p-3 text-sm text-red-200">Upstream returned 502 — circuit breaker counted this failure toward its threshold.</div>}
      </Card>
    </div>
  );
}

function Consumers() {
  const { state, tick, apiById } = useStore();
  const rows = state.apps.map((app, i) => {
    const rpm = app.subscriptions.reduce((s, sub) => {
      const a = apiById(sub.apiId);
      return s + (a ? liveMetrics(a, tick).rpm * (0.18 + i * 0.07) : 0);
    }, 0);
    return { app, rpm: Math.round(rpm), failed: Math.round(rpm * 60 * 24 * (0.0009 + i * 0.0006)), quotaUsed: Math.min(98, Math.round(((rpm * 60 * 24) / app.quotaPerDay) * 100) || 4) };
  });
  const colors = ["#818cf8", "#22d3ee", "#a78bfa", "#38bdf8", "#6366f1"];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Top consumers" pad={false}>
        <Table head={["Application", "Req/min", "Failed (24h)", "Daily quota"]}>
          {rows
            .sort((a, b) => b.rpm - a.rpm)
            .map((r) => (
              <tr key={r.app.id}>
                <Td>
                  <div className="font-medium">{r.app.name}</div>
                  <div className="text-[11px] text-ink-3">{r.app.org}</div>
                </Td>
                <Td className="tabular-nums">{fmtNum(r.rpm)}</Td>
                <Td className="tabular-nums text-amber-300">{fmtNum(r.failed)}</Td>
                <Td>
                  <div className="flex w-32 items-center gap-2">
                    <Bar value={r.quotaUsed} tone={r.quotaUsed > 80 ? "warn" : "brand"} />
                    <span className="text-xs tabular-nums text-ink-3">{r.quotaUsed}%</span>
                  </div>
                </Td>
              </tr>
            ))}
        </Table>
      </Card>
      <Card title="Geographic usage">
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={CONSUMER_GEO} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid stroke="#232c44" horizontal={false} />
            <XAxis type="number" unit="%" stroke="#6b7491" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="region" stroke="#a3abc2" fontSize={12} tickLine={false} axisLine={false} width={100} />
            <Tooltip cursor={{ fill: "#161d30" }} contentStyle={{ background: "#111727", border: "1px solid #2e3854", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}%`, "Share"]} />
            <RBar dataKey="share" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {CONSUMER_GEO.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </RBar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
