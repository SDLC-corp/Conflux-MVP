import { Check, Download, Fingerprint, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, Button, Card, cx, Empty, Input, PageHeader, Select, Stat, Table, Tabs, Td, Toggle } from "../components/ui";
import type { AuditCategory, AuditEvent } from "../data/types";
import { can, runGovernanceChecks } from "../lib/rules";
import { downloadFile, fmtDateTime, hash, relTime, toCsv } from "../lib/util";
import { useStore } from "../store";

type Tab = "approvals" | "audit" | "standards" | "compliance";

export function Governance() {
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "approvals";
  const pending = state.approvals.filter((a) => a.status === "pending").length;
  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Approvals, standards & audit"
        subtitle="Policy templates, naming standards, approval workflows and change management — with an immutable, tamper-evident audit trail across environments."
      />
      <Tabs<Tab>
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { key: "approvals", label: <>Approvals {pending > 0 && <Badge tone="amber" className="ml-1">{pending}</Badge>}</> },
          { key: "audit", label: "Audit trail" },
          { key: "standards", label: "Standards" },
          { key: "compliance", label: "Compliance report" },
        ]}
      />
      <div className="mt-5">
        {tab === "approvals" && <Approvals />}
        {tab === "audit" && <Audit />}
        {tab === "standards" && <Standards />}
        {tab === "compliance" && <Compliance />}
      </div>
    </>
  );
}

function Approvals() {
  const { state, apiById, decideApproval } = useStore();
  const canApprove = can(state.user.role, "approve");
  const [comments, setComments] = useState<Record<string, string>>({});
  const pending = state.approvals.filter((a) => a.status === "pending");
  const decided = state.approvals.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-4">
      {!canApprove && pending.length > 0 && (
        <div className="rounded-lg border border-brand/30 bg-brand/10 px-4 py-2.5 text-sm text-indigo-200">
          You're viewing as <b>{state.user.role}</b>. Switch to the Approver or Platform Admin persona (top right) to decide requests.
        </div>
      )}
      <Card title={`Pending (${pending.length})`} pad={false}>
        {pending.length === 0 ? (
          <Empty icon={<Check size={22} />} title="Queue is clear">
            New publish, promotion and subscription requests will appear here.
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((r) => {
              const api = apiById(r.apiId);
              const checks = api ? runGovernanceChecks(api, state.rules) : [];
              const passed = checks.filter((c) => c.passed).length;
              return (
                <li key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <Badge tone="amber">{r.type}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{r.detail}</div>
                      <div className="mt-0.5 text-xs text-ink-3">
                        Requested by {r.requestedBy} · {relTime(r.createdAt)} ·{" "}
                        <Link to={`/apis/${r.apiId}`} className="text-brand-2 hover:underline">
                          {api?.slug}
                        </Link>{" "}
                        · policy checks{" "}
                        <span className={passed === checks.length ? "text-green-400" : "text-amber-300"}>
                          {passed}/{checks.length}
                        </span>
                      </div>
                    </div>
                  </div>
                  {canApprove && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Input
                        className="min-w-[200px] flex-1"
                        placeholder="Comment (optional, recorded in audit trail)"
                        value={comments[r.id] ?? ""}
                        onChange={(e) => setComments({ ...comments, [r.id]: e.target.value })}
                      />
                      <Button variant="danger" onClick={() => decideApproval(r.id, false, comments[r.id] ?? "")}>
                        <X size={14} /> Reject
                      </Button>
                      <Button variant="success" onClick={() => decideApproval(r.id, true, comments[r.id] ?? "")}>
                        <Check size={14} /> Approve
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card title="Decision history" pad={false}>
        <Table head={["Request", "API", "Requested by", "Decision", "Decided by", "Comment"]}>
          {decided.map((r) => (
            <tr key={r.id}>
              <Td>
                <Badge>{r.type}</Badge>
              </Td>
              <Td className="mono text-xs">{apiById(r.apiId)?.slug}</Td>
              <Td className="text-ink-2">{r.requestedBy}</Td>
              <Td>
                <Badge tone={r.status === "approved" ? "green" : "red"}>{r.status}</Badge>
              </Td>
              <Td className="text-xs text-ink-2">
                {r.decidedBy} · {r.decidedAt && relTime(r.decidedAt)}
              </Td>
              <Td className="max-w-xs truncate text-xs text-ink-3">{r.comment || "—"}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

function verifyChain(events: AuditEvent[]): { ok: boolean; brokenAt?: string } {
  const chron = [...events].reverse();
  let prev = "0000000000000000";
  for (const e of chron) {
    const body = { id: e.id, ts: e.ts, actor: e.actor, role: e.role, action: e.action, target: e.target, category: e.category, env: e.env };
    if (e.prevHash !== prev || hash(prev + JSON.stringify(body)) !== e.hash) return { ok: false, brokenAt: e.id };
    prev = e.hash;
  }
  return { ok: true };
}

const CATS: AuditCategory[] = ["config", "security", "lifecycle", "access", "deploy", "governance"];

function Audit() {
  const { state, logAudit } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<AuditCategory | "all">("all");
  const [env, setEnv] = useState<string>("all");
  const [verify, setVerify] = useState<{ ok: boolean; brokenAt?: string; at: string } | null>(null);
  const canExport = can(state.user.role, "audit.export");

  const rows = useMemo(
    () =>
      state.audit.filter(
        (e) =>
          (cat === "all" || e.category === cat) &&
          (env === "all" || e.env === env) &&
          (!q || `${e.actor} ${e.action} ${e.target}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [state.audit, cat, env, q],
  );

  const exportAs = (fmt: "csv" | "json") => {
    const data = rows.map((e) => ({ timestamp: e.ts, actor: e.actor, role: e.role, category: e.category, env: e.env, action: e.action, target: e.target, hash: e.hash, prev_hash: e.prevHash }));
    downloadFile(`conflux-audit-${new Date().toISOString().slice(0, 10)}.${fmt}`, fmt === "csv" ? toCsv(data) : JSON.stringify(data, null, 2), fmt === "csv" ? "text/csv" : "application/json");
    logAudit(`Exported audit trail (${rows.length} events, ${fmt.toUpperCase()})`, "Audit trail", "governance");
  };

  return (
    <Card
      pad={false}
      title={`Immutable audit history (${rows.length})`}
      action={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setVerify({ ...verifyChain(state.audit), at: new Date().toISOString() })}>
            <Fingerprint size={13} /> Verify integrity
          </Button>
          {canExport && (
            <>
              <Button size="sm" onClick={() => exportAs("csv")}>
                <Download size={13} /> CSV
              </Button>
              <Button size="sm" onClick={() => exportAs("json")}>
                <Download size={13} /> JSON
              </Button>
            </>
          )}
        </div>
      }
    >
      {verify && (
        <div className={cx("mx-4 mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", verify.ok ? "border-ok/30 bg-ok/10 text-green-200" : "border-bad/30 bg-bad/10 text-red-200")}>
          <ShieldCheck size={15} />
          {verify.ok ? `Hash chain verified — all ${state.audit.length} events intact (checked ${relTime(verify.at)}).` : `Chain broken at event ${verify.brokenAt} — possible tampering.`}
        </div>
      )}
      <div className="flex flex-wrap gap-2 p-4">
        <Input className="w-full max-w-xs" placeholder="Search actor, action, target…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audit trail" />
        <Select className="w-40" value={cat} onChange={(e) => setCat(e.target.value as AuditCategory | "all")} aria-label="Category">
          <option value="all">All categories</option>
          {CATS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select className="w-48" value={env} onChange={(e) => setEnv(e.target.value)} aria-label="Environment">
          <option value="all">All environments</option>
          {["global", "dev", "staging", "production"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>
      <Table head={["Time", "Actor", "Category", "Action", "Target", "Env", "Hash"]}>
        {rows.map((e) => (
          <tr key={e.id}>
            <Td className="whitespace-nowrap text-xs text-ink-3">{fmtDateTime(e.ts)}</Td>
            <Td>
              <div className="text-sm">{e.actor}</div>
              <div className="text-[11px] text-ink-3">{e.role}</div>
            </Td>
            <Td>
              <Badge tone={e.category === "security" ? "red" : e.category === "deploy" ? "green" : e.category === "governance" ? "amber" : e.category === "access" ? "cyan" : "indigo"}>{e.category}</Badge>
            </Td>
            <Td className="max-w-sm text-sm">{e.action}</Td>
            <Td className="mono text-xs text-brand-2">{e.target}</Td>
            <Td className="text-xs text-ink-2">{e.env}</Td>
            <Td className="mono text-[10px] text-ink-3" >
              <span title={`prev ${e.prevHash}`}>{e.hash.slice(0, 10)}…</span>
            </Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function Standards() {
  const { state, toggleGovRule } = useStore();
  const editable = can(state.user.role, "admin");
  const live = state.apis.filter((a) => a.stage !== "retired");
  return (
    <Card title="Naming standards & policy checks" pad={false} action={<span className="text-xs text-ink-3">Run automatically at the Review stage</span>}>
      <ul className="divide-y divide-line">
        {state.rules.map((r) => {
          const failing = live.filter((a) => !runGovernanceChecks(a, [{ ...r, enabled: true }])[0].passed);
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <Toggle checked={r.enabled} onChange={() => toggleGovRule(r.id)} disabled={!editable} label={r.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {r.name} <Badge tone={r.severity === "blocking" ? "red" : "amber"}>{r.severity}</Badge>
                </div>
                <div className="text-xs text-ink-3">{r.description}</div>
              </div>
              <div className="text-right text-xs">
                {failing.length === 0 ? (
                  <span className="text-green-400">All {live.length} APIs compliant</span>
                ) : (
                  <span className="text-amber-300" title={failing.map((a) => a.slug).join(", ")}>
                    {failing.length} non-compliant: {failing.map((a) => a.slug).slice(0, 2).join(", ")}
                    {failing.length > 2 && "…"}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Compliance() {
  const { state, logAudit } = useStore();
  const live = state.apis.filter((a) => a.stage !== "retired");
  const withPolicy = live.filter((a) => a.policyTemplateId).length;
  const fullyCompliant = live.filter((a) => runGovernanceChecks(a, state.rules).every((c) => c.passed)).length;
  const decided = state.approvals.filter((a) => a.decidedAt);
  const avgHrs = decided.length ? decided.reduce((s, a) => s + (new Date(a.decidedAt!).getTime() - new Date(a.createdAt).getTime()) / 3600000, 0) / decided.length : 0;
  const prodChanges = state.audit.filter((e) => e.env === "production").length;
  const byCat = CATS.map((c) => ({ c, n: state.audit.filter((e) => e.category === c).length }));
  const max = Math.max(...byCat.map((x) => x.n), 1);

  const exportReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      tenant: "acme-corp",
      apis_in_scope: live.length,
      apis_with_security_policy: withPolicy,
      apis_fully_compliant: fullyCompliant,
      approvals_decided: decided.length,
      avg_approval_turnaround_hours: +avgHrs.toFixed(1),
      production_changes_logged: prodChanges,
      audit_chain_head: state.audit[0]?.hash,
      environments: state.apis.map((a) => ({ api: a.slug, stage: a.stage, deployments: a.deployments, policy: state.policies.find((p) => p.id === a.policyTemplateId)?.name ?? null })),
    };
    downloadFile(`conflux-compliance-evidence-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(report, null, 2), "application/json");
    logAudit("Exported compliance evidence pack", "Compliance report", "governance");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Policy coverage" value={`${Math.round((withPolicy / live.length) * 100)}%`} hint={`${withPolicy}/${live.length} APIs`} />
        <Stat label="Fully compliant" value={`${fullyCompliant}/${live.length}`} hint="Pass every enabled standard" />
        <Stat label="Approval turnaround" value={`${avgHrs.toFixed(1)} h`} hint={`${decided.length} decisions`} />
        <Stat label="Production changes" value={prodChanges} hint="Logged with actor & hash" />
      </div>
      <Card
        title="Audit-ready reporting"
        action={
          can(state.user.role, "audit.export") && (
            <Button size="sm" variant="primary" onClick={exportReport}>
              <Download size={13} /> Export evidence pack
            </Button>
          )
        }
      >
        <div className="text-xs font-medium uppercase tracking-wider text-ink-3">Change activity by category</div>
        <ul className="mt-3 space-y-2.5">
          {byCat.map(({ c, n }) => (
            <li key={c} className="flex items-center gap-3 text-sm">
              <span className="w-24 capitalize text-ink-2">{c}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-brand" style={{ width: `${(n / max) * 100}%` }} />
              </div>
              <span className="w-8 text-right tabular-nums text-ink-3">{n}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink-3">The evidence pack includes environment state per API, attached security policies, approval metrics and the current audit-chain head hash.</p>
      </Card>
    </div>
  );
}
