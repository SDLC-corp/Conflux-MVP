import { ArrowRightLeft, Play, Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { ENV_SCALE } from "../components/charts";
import { Badge, Button, Card, cx, Drawer, Field, Input, Modal, PageHeader, Select, Stat, Table, Td, Toggle } from "../components/ui";
import type { Route, RouteStrategy } from "../data/types";
import { liveMetrics } from "../lib/metrics";
import { can } from "../lib/rules";
import { fmtNum } from "../lib/util";
import { useStore } from "../store";

const statusTone = { Healthy: "green", Throttling: "amber", Degraded: "red" } as const;

export function Gateway() {
  const { state, tick, apiById } = useStore();
  const [editing, setEditing] = useState<Route | null>(null);
  const [adding, setAdding] = useState(false);
  const editable = can(state.user.role, "gateway.edit");
  const scale = ENV_SCALE[state.env];

  const routes = state.routes;
  const inbound = routes.reduce((s, r) => {
    const a = apiById(r.apiId);
    return s + (a && a.deployments[state.env] ? liveMetrics(a, tick).rpm * scale : 0);
  }, 0);

  return (
    <>
      <PageHeader
        eyebrow="API Gateway"
        title="Routing & traffic control"
        subtitle="High-performance routing, transformation, caching and progressive delivery for REST, SOAP, GraphQL, gRPC, WebSocket and async APIs."
        actions={
          editable && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus size={15} /> Add route
            </Button>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Inbound" value={`${fmtNum(Math.round(inbound))} rpm`} hint={`${state.env} gateways`} />
        <Stat label="Routes" value={routes.length} hint={`${new Set(routes.map((r) => r.apiId)).size} APIs`} />
        <Stat label="Progressive releases" value={routes.filter((r) => r.strategy !== "Direct").length} hint="Canary · blue-green · weighted" />
        <Stat
          label="Circuit breakers"
          value={routes.filter((r) => r.circuitState !== "Closed").length ? `${routes.filter((r) => r.circuitState !== "Closed").length} tripped` : "All closed"}
          tone={routes.some((r) => r.circuitState !== "Closed") ? "bad" : "good"}
          hint="Per-route resilience"
        />
      </div>

      <RequestTrace />

      <Card className="mt-4" pad={false} title="Routes" action={<span className="text-xs text-ink-3">Click a route to configure</span>}>
        <Table head={["Route", "Upstream", "Release strategy", "Rate limit", "Resilience", "Status"]}>
          {routes.map((r) => {
            const api = apiById(r.apiId);
            return (
              <tr key={r.id} onClick={() => setEditing(r)} className="cursor-pointer hover:bg-panel-2/50">
                <Td>
                  <div className="mono text-sm font-medium">{r.path}</div>
                  <div className="text-[11px] text-ink-3">{api?.slug ?? "—"}</div>
                </Td>
                <Td className="mono max-w-[220px] truncate text-xs text-ink-2">{r.upstream}</Td>
                <Td>
                  <StrategyCell r={r} />
                </Td>
                <Td className="tabular-nums text-ink-2">{r.rateLimit.toLocaleString()}/min</Td>
                <Td className="text-xs text-ink-2">
                  <span className={cx(r.circuitState !== "Closed" && "text-amber-300")}>Circuit {r.circuitState}</span>
                  <div className="text-ink-3">
                    {r.retries} retries · {r.timeoutMs >= 1000 ? `${r.timeoutMs / 1000}s` : `${r.timeoutMs}ms`}
                  </div>
                </Td>
                <Td>
                  <Badge tone={statusTone[r.status]} dot>
                    {r.status}
                  </Badge>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        {["REST", "SOAP", "GraphQL", "gRPC", "WebSocket", "Async APIs"].map((p) => (
          <Badge key={p} tone="indigo">
            {p}
          </Badge>
        ))}
      </div>

      {editing && <RouteDrawer key={editing.id} route={editing} editable={editable} onClose={() => setEditing(null)} />}
      <AddRouteModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function StrategyCell({ r }: { r: Route }) {
  if (r.strategy === "Canary" || r.strategy === "Weighted")
    return (
      <div className="w-40">
        <div className="mb-1 flex justify-between text-[11px]">
          <span className="text-ink-2">
            {r.strategy} · v{r.candidateVersion}
          </span>
          <span className="tabular-nums text-cyan-300">{r.candidateWeight}%</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-brand/60">
          <div className="ml-auto bg-cyan" style={{ width: `${r.candidateWeight}%` }} />
        </div>
      </div>
    );
  if (r.strategy === "Blue-Green")
    return (
      <span className="text-xs">
        Blue-Green · <span className={r.liveColor === "blue" ? "text-blue-300" : "text-green-300"}>{r.liveColor} live</span>
      </span>
    );
  return <span className="text-xs text-ink-3">Direct · v{r.stableVersion}</span>;
}

const STEPS = [
  { name: "Client request", detail: "REST · gRPC · GraphQL" },
  { name: "Authenticate", detail: "OAuth 2.0 · JWT · mTLS" },
  { name: "Apply policies", detail: "Rate limit · quota · WAF" },
  { name: "Transform", detail: "Headers · payload · URL" },
  { name: "Route", detail: "Canary · split · balance" },
  { name: "Upstream", detail: "Cached · traced · logged" },
];

function RequestTrace() {
  const { state, logAudit } = useStore();
  const [routeId, setRouteId] = useState(state.routes[0]?.id ?? "");
  const [run, setRun] = useState<{ traceId: string; ms: number[]; status: number; served: string; step: number } | null>(null);

  const send = () => {
    const r = state.routes.find((x) => x.id === routeId);
    if (!r) return;
    const blocked = r.status === "Throttling" && Math.random() < 0.35;
    const ms = [0, 6 + Math.round(Math.random() * 6), 1 + Math.round(Math.random() * 3), r.transforms.length ? 3 + Math.round(Math.random() * 3) : 0, 2 + Math.round(Math.random() * 2), 30 + Math.round(Math.random() * 60)];
    const canary = r.candidateVersion && Math.random() * 100 < r.candidateWeight;
    const served = canary ? `v${r.candidateVersion} (canary)` : r.strategy === "Blue-Green" ? `${r.liveColor} · v${r.stableVersion}` : `v${r.stableVersion}`;
    const traceId = `${Math.random().toString(16).slice(2, 6)}-${Math.random().toString(16).slice(2, 6)}`;
    const t = { traceId, ms: blocked ? ms.slice(0, 3) : ms, status: blocked ? 429 : 200, served, step: 0 };
    setRun(t);
    t.ms.forEach((_, i) => setTimeout(() => setRun((cur) => (cur && cur.traceId === traceId ? { ...cur, step: i + 1 } : cur)), 180 * (i + 1)));
    if (blocked) logAudit("Rate limit enforced (429) on test request", r.path, "security", state.env);
  };

  const total = run ? run.ms.reduce((a, b) => a + b, 0) : 0;

  return (
    <Card
      className="mt-4"
      title={<span className="flex items-center gap-2"><Zap size={14} className="text-cyan" /> The life of a request</span>}
      action={
        <div className="flex items-center gap-2">
          <Select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="h-8 w-44 py-1 text-xs" aria-label="Route to test">
            {state.routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.path}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="primary" onClick={send}>
            <Play size={12} /> Send test request
          </Button>
        </div>
      }
    >
      <ol className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {STEPS.map((s, i) => {
          const reached = run && run.step > i && i < run.ms.length;
          const failed = run && run.status === 429 && i === 2 && run.step > i;
          const skipped = run && i >= run.ms.length;
          return (
            <li
              key={s.name}
              className={cx(
                "rounded-lg border p-3 transition-all duration-200",
                failed ? "border-bad/50 bg-bad/10" : reached ? "border-brand/50 bg-brand/10" : "border-line bg-bg",
                skipped && "opacity-40",
              )}
            >
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                <span>{i + 1}</span>
                {reached && <span className={cx("mono normal-case", failed ? "text-red-300" : "text-cyan-300")}>{i === 0 ? "0 ms" : `+${run!.ms[i]} ms`}</span>}
              </div>
              <div className="mt-1 text-sm font-medium">{i === 5 && run?.status === 200 && reached ? "200 OK" : failed ? "429 Too Many" : s.name}</div>
              <div className="text-[11px] text-ink-3">{s.detail}</div>
            </li>
          );
        })}
      </ol>
      <div className="mono mt-3 text-xs text-ink-3">
        {run ? (
          <>
            trace_id <span className="text-ink-2">{run.traceId}</span> · status{" "}
            <span className={run.status === 200 ? "text-green-400" : "text-red-300"}>{run.status}</span> · total <span className="text-ink-2">{total} ms</span>
            {run.status === 200 && (
              <>
                {" "}
                · served by <span className="text-cyan-300">{run.served}</span>
              </>
            )}
          </>
        ) : (
          "Send a test request to trace it through the gateway pipeline."
        )}
      </div>
    </Card>
  );
}

function RouteDrawer({ route, editable, onClose }: { route: Route; editable: boolean; onClose: () => void }) {
  const { apiById, updateRoute, deleteRoute, toast } = useStore();
  const api = apiById(route.apiId);
  const [r, setR] = useState<Route>(route);
  const [newTransform, setNewTransform] = useState("");
  const set = <K extends keyof Route>(k: K, v: Route[K]) => setR((x) => ({ ...x, [k]: v }));
  const versions = api?.versions.map((v) => v.version) ?? [];

  const save = () => {
    const changes: string[] = [];
    if (r.strategy !== route.strategy) changes.push(`strategy → ${r.strategy}`);
    if (r.candidateWeight !== route.candidateWeight) changes.push(`${r.strategy.toLowerCase()} weight → ${r.candidateWeight}%`);
    if (r.liveColor !== route.liveColor) changes.push(`switched live to ${r.liveColor}`);
    if (r.rateLimit !== route.rateLimit) changes.push(`rate limit → ${r.rateLimit}/min`);
    if (r.retries !== route.retries || r.timeoutMs !== route.timeoutMs || r.circuitThreshold !== route.circuitThreshold) changes.push("resilience policy updated");
    if (r.cacheTtl !== route.cacheTtl) changes.push(`cache TTL → ${r.cacheTtl}s`);
    if (JSON.stringify(r.transforms) !== JSON.stringify(route.transforms)) changes.push("transforms updated");
    if (!changes.length) changes.push("Updated route");
    const status: Route["status"] = r.circuitState === "Open" ? "Degraded" : r.rateLimit < 3000 && api?.id === "api_catalog" ? "Throttling" : route.status === "Throttling" && r.rateLimit > route.rateLimit ? "Healthy" : route.status;
    updateRoute(route.id, { ...r, status }, changes.join(", ").replace(/^./, (c) => c.toUpperCase()));
    toast(`Route ${route.path} updated — zero-downtime config push to all gateway nodes`);
    onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="mono">
          {route.path} <span className="font-sans text-xs font-normal text-ink-3">· {api?.slug}</span>
        </span>
      }
      footer={
        editable ? (
          <>
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                if (confirm(`Delete route ${route.path}?`)) {
                  deleteRoute(route.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={14} />
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              Apply to gateways
            </Button>
          </>
        ) : (
          <span className="text-xs text-ink-3">Read-only for your role</span>
        )
      }
    >
      <fieldset disabled={!editable} className="space-y-6">
        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-3">Progressive delivery</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Strategy">
              <Select
                value={r.strategy}
                onChange={(e) => {
                  const s = e.target.value as RouteStrategy;
                  setR((x) => ({
                    ...x,
                    strategy: s,
                    candidateVersion: s === "Direct" ? null : x.candidateVersion ?? versions[versions.length - 1] ?? null,
                    candidateWeight: s === "Direct" || s === "Blue-Green" ? 0 : x.candidateWeight || 10,
                  }));
                }}
              >
                <option>Direct</option>
                <option>Canary</option>
                <option>Weighted</option>
                <option>Blue-Green</option>
              </Select>
            </Field>
            <Field label="Stable version">
              <Select value={r.stableVersion} onChange={(e) => set("stableVersion", e.target.value)}>
                {versions.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
            </Field>
          </div>
          {(r.strategy === "Canary" || r.strategy === "Weighted") && (
            <div className="mt-4 rounded-lg border border-line bg-bg p-4">
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <Field label={r.strategy === "Canary" ? "Canary version" : "Weighted version"}>
                  <Select value={r.candidateVersion ?? ""} onChange={(e) => set("candidateVersion", e.target.value)}>
                    {versions.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-indigo-300">
                  v{r.stableVersion} stable · {100 - r.candidateWeight}%
                </span>
                <span className="text-cyan-300">
                  v{r.candidateVersion} · {r.candidateWeight}%
                </span>
              </div>
              <input type="range" min={0} max={100} step={5} value={r.candidateWeight} onChange={(e) => set("candidateWeight", +e.target.value)} className="w-full accent-cyan-400" aria-label="Traffic weight" />
              <div className="mt-3 flex flex-wrap gap-2">
                {[1, 10, 25, 50, 100].map((w) => (
                  <Button key={w} size="sm" type="button" variant={r.candidateWeight === w ? "primary" : "secondary"} onClick={() => set("candidateWeight", w)}>
                    {w}%
                  </Button>
                ))}
                <Button size="sm" type="button" variant="ghost" onClick={() => setR((x) => ({ ...x, candidateWeight: 0 }))}>
                  Abort canary
                </Button>
              </div>
            </div>
          )}
          {r.strategy === "Blue-Green" && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-line bg-bg p-4">
              {(["blue", "green"] as const).map((c) => (
                <div key={c} className={cx("flex-1 rounded-lg border p-3 text-center text-sm", r.liveColor === c ? (c === "blue" ? "border-blue-400 bg-blue-500/10" : "border-green-400 bg-green-500/10") : "border-line opacity-60")}>
                  <div className="font-medium capitalize">{c}</div>
                  <div className="text-xs text-ink-3">{r.liveColor === c ? "Live · 100%" : "Idle / staged"}</div>
                </div>
              ))}
              <Button type="button" onClick={() => set("liveColor", r.liveColor === "blue" ? "green" : "blue")}>
                <ArrowRightLeft size={14} /> Switch
              </Button>
            </div>
          )}
        </section>

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-3">Resilience policies</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Retries">
              <Input type="number" min={0} max={10} value={r.retries} onChange={(e) => set("retries", +e.target.value)} />
            </Field>
            <Field label="Timeout (ms)">
              <Input type="number" min={100} step={100} value={r.timeoutMs} onChange={(e) => set("timeoutMs", +e.target.value)} />
            </Field>
            <Field label="Circuit threshold (% errors)">
              <Input type="number" min={1} max={100} value={r.circuitThreshold} onChange={(e) => set("circuitThreshold", +e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            Circuit state: <Badge tone={r.circuitState === "Closed" ? "green" : r.circuitState === "Open" ? "red" : "amber"}>{r.circuitState}</Badge>
            {r.circuitState !== "Closed" && (
              <Button size="sm" type="button" onClick={() => set("circuitState", "Closed")}>
                Reset circuit
              </Button>
            )}
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-3">Traffic & performance</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rate limit (req/min)">
              <Input type="number" min={1} step={100} value={r.rateLimit} onChange={(e) => set("rateLimit", +e.target.value)} />
            </Field>
            <Field label="Response cache TTL (s)" hint="0 disables caching">
              <Input type="number" min={0} value={r.cacheTtl} onChange={(e) => set("cacheTtl", +e.target.value)} />
            </Field>
            <Field label="Upstream">
              <Input className="mono text-xs" value={r.upstream} onChange={(e) => set("upstream", e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex gap-6 text-sm">
            <label className="flex items-center gap-2">
              <Toggle checked={r.compression} onChange={(v) => set("compression", v)} label="Compression" /> Compression
            </label>
            <label className="flex items-center gap-2">
              <Toggle checked={r.cors} onChange={(v) => set("cors", v)} label="CORS" /> CORS
            </label>
          </div>
        </section>

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-3">Transformation engine</h4>
          <ul className="space-y-1.5">
            {r.transforms.map((t, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
                <span className="mono text-xs text-ink-3">{i + 1}</span>
                <span className="flex-1">{t}</span>
                <button type="button" aria-label="Remove transform" className="text-ink-3 hover:text-red-300" onClick={() => set("transforms", r.transforms.filter((_, j) => j !== i))}>
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
            {r.transforms.length === 0 && <li className="text-sm text-ink-3">No transforms — requests pass through unchanged.</li>}
          </ul>
          <div className="mt-2 flex gap-2">
            <Input value={newTransform} onChange={(e) => setNewTransform(e.target.value)} placeholder="e.g. Add header X-Tenant: acme" list="transform-presets" />
            <datalist id="transform-presets">
              <option value="Add header X-Request-Id" />
              <option value="Strip header Authorization upstream" />
              <option value="Rewrite /v1 → /internal/v1" />
              <option value="JSON → XML request body" />
              <option value="Mask PII fields: email, phone" />
            </datalist>
            <Button
              type="button"
              onClick={() => {
                if (newTransform.trim()) {
                  set("transforms", [...r.transforms, newTransform.trim()]);
                  setNewTransform("");
                }
              }}
            >
              Add
            </Button>
          </div>
        </section>
      </fieldset>
    </Drawer>
  );
}

function AddRouteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, createRoute } = useStore();
  const candidates = state.apis.filter((a) => a.stage !== "retired");
  const [apiId, setApiId] = useState(candidates[0]?.id ?? "");
  const [upstream, setUpstream] = useState("https://service.internal:8080");
  const [rateLimit, setRateLimit] = useState(1000);
  const api = state.apis.find((a) => a.id === apiId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add route"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!api}
            onClick={() => {
              createRoute({
                apiId,
                path: api!.basePath,
                upstream,
                strategy: "Direct",
                stableVersion: api!.activeVersion,
                candidateVersion: null,
                candidateWeight: 0,
                liveColor: "blue",
                rateLimit,
                cacheTtl: 0,
                compression: true,
                cors: false,
                retries: 2,
                timeoutMs: 2500,
                circuitThreshold: 50,
                circuitState: "Closed",
                transforms: [],
                status: "Healthy",
              });
              onClose();
            }}
          >
            Create route
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="API" hint={api && <span className="mono">Path: {api.basePath}</span>}>
          <Select value={apiId} onChange={(e) => setApiId(e.target.value)}>
            {candidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.stage})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Upstream URL">
          <Input className="mono" value={upstream} onChange={(e) => setUpstream(e.target.value)} />
        </Field>
        <Field label="Rate limit (req/min)">
          <Input type="number" value={rateLimit} onChange={(e) => setRateLimit(+e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
