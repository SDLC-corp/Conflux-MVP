import { ArrowRight, CircleAlert, Server, Stamp } from "lucide-react";
import { Link } from "react-router-dom";
import { ENV_SCALE, Legend, TrafficChart, useTrafficSeries } from "../components/charts";
import { Badge, Bar, Card, PageHeader, Stat, STAGE_TONE, Table, Td } from "../components/ui";
import { STAGES } from "../data/types";
import { liveMetrics } from "../lib/metrics";
import { fmtNum, relTime } from "../lib/util";
import { useStore } from "../store";

export function Overview() {
  const { state, tick, apiById } = useStore();
  const env = state.env;
  const scale = ENV_SCALE[env];
  const live = state.apis.filter((a) => a.deployments[env]);
  const metrics = live.map((a) => ({ api: a, m: liveMetrics(a, tick) }));
  const totalRpm = metrics.reduce((s, x) => s + x.m.rpm * scale, 0);
  const p95 = totalRpm ? Math.round(metrics.reduce((s, x) => s + x.m.p95 * x.m.rpm * scale, 0) / totalRpm) : 0;
  const err = totalRpm ? metrics.reduce((s, x) => s + x.m.errorRate * x.m.rpm * scale, 0) / totalRpm : 0;
  const slaBreaches = metrics.filter((x) => x.m.availability < x.api.slaTarget).length;
  const data = useTrafficSeries(state.apis, env, tick);

  const pending = state.approvals.filter((a) => a.status === "pending");
  const openAlerts = state.alerts.filter((a) => a.status !== "resolved");
  const nodes = state.nodes.filter((n) => n.env === env);

  return (
    <>
      <PageHeader
        eyebrow={`console.conflux · ${env}`}
        title="Every API. One control plane."
        subtitle="Real-time view of traffic, reliability and change across every gateway, environment and team."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Requests / min" value={fmtNum(Math.round(totalRpm))} delta="▲ 6.2%" tone="good" hint={`${live.length} live APIs in ${env}`} />
        <Stat label="P95 latency" value={`${p95} ms`} delta="▼ 11 ms" tone="good" hint="Weighted across routes" />
        <Stat label="Error rate" value={`${err.toFixed(2)}%`} delta={err < 0.5 ? "SLA on track" : "Above budget"} tone={err < 0.5 ? "good" : "bad"} hint="5xx + gateway rejections" />
        <Stat
          label="SLA compliance"
          value={`${metrics.length - slaBreaches}/${metrics.length}`}
          delta={slaBreaches ? `${slaBreaches} at risk` : "All met"}
          tone={slaBreaches ? "bad" : "good"}
          hint="APIs meeting availability target"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Gateway traffic · last 60 min"
          action={
            <Legend
              items={[
                { label: "2xx", color: "#818cf8" },
                { label: "4xx", color: "#f59e0b" },
                { label: "5xx", color: "#ef4444" },
              ]}
            />
          }
        >
          <TrafficChart data={data} />
        </Card>

        <Card title="Lifecycle pipeline" action={<Link to="/apis" className="text-xs text-brand-2 hover:underline">All APIs</Link>}>
          <ul className="space-y-2.5">
            {STAGES.map((s) => {
              const n = state.apis.filter((a) => a.stage === s.key).length;
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <Badge tone={STAGE_TONE[s.key]} className="w-24 justify-center">
                    {s.label}
                  </Badge>
                  <div className="flex-1">
                    <Bar value={n} max={Math.max(1, state.apis.length / 2)} />
                  </div>
                  <span className="w-5 text-right text-sm tabular-nums text-ink-2">{n}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Top APIs by traffic" pad={false} action={<Link to="/monitoring" className="text-xs text-brand-2 hover:underline">Monitoring</Link>}>
          <Table head={["API", "Req/min", "P95", "Errors", "Availability / SLA"]}>
            {metrics
              .sort((a, b) => b.m.rpm - a.m.rpm)
              .slice(0, 6)
              .map(({ api, m }) => (
                <tr key={api.id} className="hover:bg-panel-2/50">
                  <Td>
                    <Link to={`/apis/${api.id}`} className="font-medium hover:text-brand-2">
                      {api.slug}
                    </Link>
                    <div className="mono text-[11px] text-ink-3">
                      v{api.deployments[env]} · {api.protocol}
                    </div>
                  </Td>
                  <Td className="tabular-nums">{fmtNum(Math.round(m.rpm * scale))}</Td>
                  <Td className={m.p95 > 250 ? "tabular-nums text-amber-300" : "tabular-nums"}>{m.p95} ms</Td>
                  <Td className={m.errorRate > 1 ? "tabular-nums text-red-300" : "tabular-nums"}>{m.errorRate}%</Td>
                  <Td>
                    <span className={m.availability >= api.slaTarget ? "text-green-400" : "text-red-300"}>{m.availability}%</span>
                    <span className="text-ink-3"> / {api.slaTarget}%</span>
                  </Td>
                </tr>
              ))}
          </Table>
          {metrics.length === 0 && <div className="p-6 text-center text-sm text-ink-3">No APIs deployed to {env} yet.</div>}
        </Card>

        <div className="space-y-4">
          <Card title={<span className="flex items-center gap-2"><Stamp size={14} /> Pending approvals</span>} action={<Link to="/governance" className="text-xs text-brand-2 hover:underline">Review</Link>}>
            {pending.length === 0 ? (
              <p className="text-sm text-ink-3">Nothing waiting. 🎉</p>
            ) : (
              <ul className="space-y-3">
                {pending.slice(0, 4).map((p) => (
                  <li key={p.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Badge tone="amber">{p.type}</Badge>
                      <span className="truncate text-ink-2">{apiById(p.apiId)?.slug}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-3">
                      {p.requestedBy} · {relTime(p.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={<span className="flex items-center gap-2"><CircleAlert size={14} /> Active alerts</span>} action={<Link to="/monitoring" className="text-xs text-brand-2 hover:underline">Incidents</Link>}>
            {openAlerts.length === 0 ? (
              <p className="text-sm text-ink-3">No active alerts.</p>
            ) : (
              <ul className="space-y-2.5">
                {openAlerts.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.severity === "critical" ? "bg-bad" : a.severity === "warning" ? "bg-warn" : "bg-cyan"}`} />
                    <div className="min-w-0">
                      <div className="text-ink-2">{a.title}</div>
                      <div className="text-xs text-ink-3">
                        {a.status === "acknowledged" ? "Acknowledged" : "Routed"} → {a.routedTo}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><Server size={14} /> Gateway nodes · {env}</span>} action={<Link to="/deployment" className="text-xs text-brand-2 hover:underline">Deployment</Link>}>
          <ul className="space-y-3">
            {nodes.map((n) => (
              <li key={n.id} className="flex items-center gap-3 text-sm">
                <span className={`h-2 w-2 rounded-full ${n.status === "healthy" ? "bg-ok" : "bg-warn pulse-dot"}`} />
                <span className="mono w-40 truncate text-xs">{n.name}</span>
                <span className="hidden w-28 truncate text-xs text-ink-3 sm:block">{n.mode}</span>
                <div className="flex-1">
                  <Bar value={n.cpu} tone={n.cpu > 70 ? "warn" : "ok"} />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-ink-3">{n.cpu}%</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Recent activity" action={<Link to="/governance?tab=audit" className="flex items-center gap-1 text-xs text-brand-2 hover:underline">Audit trail <ArrowRight size={12} /></Link>}>
          <ul className="space-y-3">
            {state.audit.slice(0, 6).map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-line text-[10px] font-semibold text-ink-2">
                  {e.actor.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="text-ink-2">
                    <span className="text-ink">{e.actor}</span> {e.action.charAt(0).toLowerCase() + e.action.slice(1)} · <span className="mono text-xs text-brand-2">{e.target}</span>
                  </div>
                  <div className="text-xs text-ink-3">{relTime(e.ts)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
