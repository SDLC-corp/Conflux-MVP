import { ArrowLeft, Check, ChevronRight, CircleAlert, ExternalLink, GitCommitHorizontal, Plus, Rocket, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, Code, cx, Empty, Field, Input, MethodBadge, Modal, Select, StageBadge, Tabs, Textarea } from "../components/ui";
import { ENVS, STAGES, type Api, type Endpoint, type Env, type HttpMethod } from "../data/types";
import { blockingFailures, can, runGovernanceChecks, type CheckResult } from "../lib/rules";
import { fmtDateTime, relTime, uid } from "../lib/util";
import { useStore } from "../store";

type Tab = "overview" | "endpoints" | "versions" | "environments" | "activity";

export function ApiDetail() {
  const { id } = useParams();
  const { state, apiById } = useStore();
  const api = apiById(id);
  const [tab, setTab] = useState<Tab>("overview");
  if (!api)
    return (
      <Empty title="API not found">
        <Link to="/apis" className="text-brand-2">
          Back to APIs
        </Link>
      </Empty>
    );
  const pendingCount = state.approvals.filter((a) => a.apiId === api.id && a.status === "pending").length;

  return (
    <>
      <Link to="/apis" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
        <ArrowLeft size={13} /> APIs & Lifecycle
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{api.name}</h1>
            <StageBadge stage={api.stage} />
            <Badge>{api.protocol}</Badge>
            <Badge tone="indigo">{api.classification}</Badge>
          </div>
          <div className="mono mt-1.5 text-xs text-ink-3">
            {api.slug} · {api.basePath} · v{api.activeVersion} · owned by {api.owner}
          </div>
        </div>
        <LifecycleActions api={api} />
      </div>

      <Stepper api={api} />

      <div className="mt-5">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "endpoints", label: `Endpoints (${api.endpoints.length})` },
            { key: "versions", label: `Versions (${api.versions.length})` },
            { key: "environments", label: <>Environments {pendingCount > 0 && <Badge tone="amber" className="ml-1">{pendingCount}</Badge>}</> },
            { key: "activity", label: "Activity" },
          ]}
        />
      </div>
      <div className="mt-5" key={api.id}>
        {tab === "overview" && <OverviewTab api={api} />}
        {tab === "endpoints" && <EndpointsTab api={api} />}
        {tab === "versions" && <VersionsTab api={api} />}
        {tab === "environments" && <EnvironmentsTab api={api} />}
        {tab === "activity" && <ActivityTab api={api} />}
      </div>
    </>
  );
}

function Stepper({ api }: { api: Api }) {
  const idx = STAGES.findIndex((s) => s.key === api.stage);
  return (
    <ol className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-6">
      {STAGES.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        return (
          <li key={s.key} className={cx("bg-panel px-3 py-2.5", current && "bg-brand/10")}>
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  done ? "bg-ok text-white" : current ? "bg-brand text-white" : "bg-line-2 text-ink-3",
                )}
              >
                {done ? <Check size={11} /> : i + 1}
              </span>
              <span className={cx("text-sm", current ? "font-medium text-ink" : done ? "text-ink-2" : "text-ink-3")}>{s.label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function LifecycleActions({ api }: { api: Api }) {
  const { state, submitForReview, deployApi, decideApproval, deprecateApi, retireApi } = useStore();
  const role = state.user.role;
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [deprecateOpen, setDeprecateOpen] = useState(false);
  const pendingPublish = state.approvals.find((a) => a.apiId === api.id && a.type === "Publish" && a.status === "pending");
  const pendingProd = state.approvals.some((a) => a.apiId === api.id && a.type === "Promote to production" && a.status === "pending");

  const preview = () => setChecks(runGovernanceChecks(api, state.rules));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {api.stage === "draft" && can(role, "api.submit") && (
        <>
          <Button onClick={preview}>Run policy checks</Button>
          <Button
            variant="primary"
            onClick={() => {
              const r = submitForReview(api.id);
              if (blockingFailures(r).length) setChecks(r);
            }}
          >
            Submit for review <ChevronRight size={14} />
          </Button>
        </>
      )}
      {api.stage === "review" && (
        <>
          <Badge tone="amber">Awaiting approval</Badge>
          {pendingPublish && can(role, "approve") && (
            <>
              <Button variant="danger" onClick={() => decideApproval(pendingPublish.id, false, "Changes requested")}>
                <X size={14} /> Reject
              </Button>
              <Button variant="success" onClick={() => decideApproval(pendingPublish.id, true, "")}>
                <Check size={14} /> Approve
              </Button>
            </>
          )}
        </>
      )}
      {api.stage === "approved" && can(role, "deploy") && (
        <Button variant="primary" onClick={() => deployApi(api.id, api.deployments.staging ? "production" : "staging")}>
          <Rocket size={14} /> Publish to {api.deployments.staging ? "production" : "staging"}
        </Button>
      )}
      {api.stage === "published" && can(role, "deploy") && api.deployments.staging && api.deployments.production !== api.deployments.staging && (
        pendingProd ? (
          <Badge tone="amber">Production promotion awaiting approval</Badge>
        ) : (
          <Button onClick={() => deployApi(api.id, "production")}>
            <Rocket size={14} /> Promote v{api.deployments.staging} to production
          </Button>
        )
      )}
      {api.stage === "published" && can(role, "api.edit") && (
        <>
          <Button onClick={() => setDeprecateOpen(true)}>Deprecate</Button>
          <Button variant="primary" onClick={() => setVersionOpen(true)}>
            <GitCommitHorizontal size={14} /> New version
          </Button>
        </>
      )}
      {api.stage === "deprecated" && can(role, "api.edit") && (
        <Button variant="danger" onClick={() => confirm(`Retire ${api.slug}? Routes will be removed; history is kept.`) && retireApi(api.id)}>
          Retire & archive
        </Button>
      )}
      {(api.stage === "published" || api.stage === "deprecated") && (
        <Link to={`/portal/${api.id}`}>
          <Button variant="ghost">
            <ExternalLink size={14} /> View in portal
          </Button>
        </Link>
      )}

      <Modal open={!!checks} onClose={() => setChecks(null)} title="Governance & policy checks" footer={<Button onClick={() => setChecks(null)}>Close</Button>}>
        {checks && <ChecksList checks={checks} />}
      </Modal>
      <NewVersionModal api={api} open={versionOpen} onClose={() => setVersionOpen(false)} />
      <Modal
        open={deprecateOpen}
        onClose={() => setDeprecateOpen(false)}
        title={`Deprecate ${api.slug}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeprecateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const el = document.getElementById("sunset") as HTMLInputElement;
                deprecateApi(api.id, new Date(el.value).toISOString());
                setDeprecateOpen(false);
              }}
            >
              Deprecate
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-ink-2">Consumers will see a deprecation banner and the sunset date in the Developer Portal. Traffic keeps flowing until you retire the API.</p>
        <Field label="Sunset date">
          <Input id="sunset" type="date" defaultValue={new Date(Date.now() + 86400000 * 90).toISOString().slice(0, 10)} />
        </Field>
      </Modal>
    </div>
  );
}

export function ChecksList({ checks }: { checks: CheckResult[] }) {
  const blocking = blockingFailures(checks).length;
  return (
    <>
      <div className={cx("mb-4 rounded-lg border p-3 text-sm", blocking ? "border-bad/30 bg-bad/10 text-red-200" : "border-ok/30 bg-ok/10 text-green-200")}>
        {blocking ? `${blocking} blocking issue(s) must be fixed before review.` : `All blocking checks passed (${checks.filter((c) => c.passed).length}/${checks.length}).`}
      </div>
      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c.rule.id} className="flex items-start gap-2.5 text-sm">
            {c.passed ? <Check size={16} className="mt-0.5 shrink-0 text-green-400" /> : <CircleAlert size={16} className={cx("mt-0.5 shrink-0", c.rule.severity === "blocking" ? "text-red-400" : "text-amber-400")} />}
            <div>
              <div className="flex items-center gap-2">
                {c.rule.name}
                {!c.passed && <Badge tone={c.rule.severity === "blocking" ? "red" : "amber"}>{c.rule.severity}</Badge>}
              </div>
              <div className="text-xs text-ink-3">{c.message}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function NewVersionModal({ api, open, onClose }: { api: Api; open: boolean; onClose: () => void }) {
  const { createVersion } = useStore();
  const [kind, setKind] = useState<"major" | "minor" | "patch">("minor");
  const [notes, setNotes] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create new version"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              createVersion(api.id, kind, notes || `${kind} release`);
              setNotes("");
              onClose();
            }}
          >
            Create & deploy to dev
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Release type" hint={`Current latest: v${api.versions[api.versions.length - 1].version}`}>
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="patch">Patch — bug fixes</option>
            <option value="minor">Minor — backwards-compatible features</option>
            <option value="major">Major — breaking changes</option>
          </Select>
        </Field>
        <Field label="Release notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What changed?" />
        </Field>
        <p className="text-xs text-ink-3">The new version runs side-by-side with existing versions. Shift traffic gradually from the Gateway with canary or weighted routing.</p>
      </div>
    </Modal>
  );
}

function OverviewTab({ api }: { api: Api }) {
  const { state, updateApi } = useStore();
  const editable = can(state.user.role, "api.edit") && api.stage !== "retired";
  const pick = (a: Api) => ({
    name: a.name,
    slug: a.slug,
    description: a.description,
    basePath: a.basePath,
    owner: a.owner,
    policyTemplateId: a.policyTemplateId,
    slaTarget: a.slaTarget,
    tags: a.tags,
    classification: a.classification,
  });
  const [edits, setEdits] = useState(() => pick(api));
  const form = { ...api, ...edits };
  const setForm = (f: Api) => setEdits(pick(f));
  const dirty = JSON.stringify(edits) !== JSON.stringify(pick(api));
  const checks = runGovernanceChecks(form, state.rules);
  const policy = state.policies.find((p) => p.id === form.policyTemplateId);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card
        className="lg:col-span-2"
        title="Definition"
        action={
          editable &&
          dirty && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setForm(api)}>
                Discard
              </Button>
              <Button size="sm" variant="primary" onClick={() => updateApi(api.id, edits, "Updated API definition")}>
                Save changes
              </Button>
            </div>
          )
        }
      >
        <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Slug" hint="Lowercase kebab-case">
            <Input className="mono" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
          <Field label="Base path">
            <Input className="mono" value={form.basePath} onChange={(e) => setForm({ ...form, basePath: e.target.value })} />
          </Field>
          <Field label="Owning team">
            <Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          </Field>
          <Field label="Security policy template">
            <Select value={form.policyTemplateId ?? ""} onChange={(e) => setForm({ ...form, policyTemplateId: e.target.value || null })}>
              <option value="">— None —</option>
              {state.policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (v{p.version})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="SLA availability target (%)">
            <Input type="number" step="0.01" min={90} max={100} value={form.slaTarget} onChange={(e) => setForm({ ...form, slaTarget: +e.target.value })} />
          </Field>
          <Field label="Tags" hint="Comma separated">
            <Input value={form.tags.join(", ")} onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
          </Field>
          <Field label="Classification">
            <Select value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value as Api["classification"] })}>
              <option value="internal">Internal</option>
              <option value="partner">Partner</option>
              <option value="public">Public</option>
            </Select>
          </Field>
        </fieldset>
        {api.sunsetDate && api.stage === "deprecated" && (
          <div className="mt-4 rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm text-amber-200">Deprecated — sunset on {new Date(api.sunsetDate).toLocaleDateString()}.</div>
        )}
      </Card>
      <div className="space-y-4">
        <Card title="Governance standards">
          <ChecksList checks={checks} />
        </Card>
        <Card title="Security policy">
          {policy ? (
            <div className="space-y-1.5 text-sm">
              <div className="font-medium">{policy.name}</div>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="indigo">{policy.authMethod}</Badge>
                <Badge tone="indigo">{policy.authzModel}</Badge>
                <Badge>{policy.rateLimitPerMin.toLocaleString()}/min</Badge>
                {policy.waf && <Badge tone="green">WAF</Badge>}
                {policy.botProtection && <Badge tone="green">Bot protection</Badge>}
              </div>
              <Link to="/security" className="inline-block pt-1 text-xs text-brand-2 hover:underline">
                Open in Security →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-amber-300">No policy attached — required before review.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function EndpointsTab({ api }: { api: Api }) {
  const { state, updateApi } = useStore();
  const editable = can(state.user.role, "api.edit") && (api.stage === "draft" || api.stage === "published");
  const [adding, setAdding] = useState(false);
  const [ep, setEp] = useState<Partial<Endpoint>>({ method: "GET", path: api.basePath, summary: "", status: 200, responseBody: '{\n  "ok": true\n}' });

  return (
    <Card
      pad={false}
      title="Endpoints"
      action={
        editable && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={13} /> Add endpoint
          </Button>
        )
      }
    >
      {api.endpoints.length === 0 && <Empty title="No endpoints yet">Add endpoints or import an OpenAPI spec.</Empty>}
      <ul className="divide-y divide-line">
        {api.endpoints.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-3">
            <MethodBadge method={e.method} />
            <span className="mono flex-1 truncate text-sm">{e.path}</span>
            <span className="hidden flex-1 truncate text-sm text-ink-2 md:block">{e.summary || <span className="text-red-300">Missing summary</span>}</span>
            {e.scope && <Badge>{e.scope}</Badge>}
            <span className="mono text-xs text-ink-3">{e.status}</span>
            {editable && (
              <button
                aria-label="Delete endpoint"
                className="rounded p-1 text-ink-3 hover:text-red-300"
                onClick={() => updateApi(api.id, { endpoints: api.endpoints.filter((x) => x.id !== e.id) }, `Removed endpoint ${e.method} ${e.path}`)}
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add endpoint"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const full = { ...ep, id: uid("e") } as Endpoint;
                updateApi(api.id, { endpoints: [...api.endpoints, full] }, `Added endpoint ${full.method} ${full.path}`);
                setAdding(false);
              }}
            >
              Add
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Method">
            <Select value={ep.method} onChange={(e) => setEp({ ...ep, method: e.target.value as HttpMethod })}>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-3">
            <Field label="Path">
              <Input className="mono" value={ep.path} onChange={(e) => setEp({ ...ep, path: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Summary">
              <Input value={ep.summary} onChange={(e) => setEp({ ...ep, summary: e.target.value })} />
            </Field>
          </div>
          <Field label="Status">
            <Input type="number" value={ep.status} onChange={(e) => setEp({ ...ep, status: +e.target.value })} />
          </Field>
          <div className="sm:col-span-4">
            <Field label="Example response (JSON)">
              <Textarea rows={5} value={ep.responseBody} onChange={(e) => setEp({ ...ep, responseBody: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function VersionsTab({ api }: { api: Api }) {
  const { state, updateApi } = useStore();
  return (
    <Card pad={false} title="Versions · side-by-side">
      <ul className="divide-y divide-line">
        {[...api.versions].reverse().map((v) => {
          const envs = ENVS.filter((e) => api.deployments[e] === v.version);
          return (
            <li key={v.version} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="mono w-20 font-medium">v{v.version}</span>
              {v.version === api.activeVersion && <Badge tone="indigo">Latest</Badge>}
              <span className="flex-1 text-sm text-ink-2">{v.notes}</span>
              <div className="flex gap-1">
                {envs.map((e) => (
                  <Badge key={e} tone={e === "production" ? "green" : "cyan"}>
                    {e}
                  </Badge>
                ))}
              </div>
              <span className="text-xs text-ink-3">{relTime(v.createdAt)}</span>
              {v.version !== api.activeVersion && can(state.user.role, "api.edit") && (
                <Button size="sm" variant="ghost" onClick={() => updateApi(api.id, { activeVersion: v.version }, `Set working version to ${v.version}`)}>
                  Set as working
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function EnvironmentsTab({ api }: { api: Api }) {
  const { state, deployApi, rollback, decideApproval } = useStore();
  const role = state.user.role;
  const canDeploy = can(role, "deploy") && api.stage !== "retired" && api.stage !== "review";
  const pending = state.approvals.filter((a) => a.apiId === api.id && a.status === "pending");
  const releases = state.releases.filter((r) => r.apiId === api.id);
  const allowed = (e: Env) => e === "dev" || api.stage === "approved" || api.stage === "published" || api.stage === "deprecated";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {ENVS.map((e, i) => {
          const v = api.deployments[e];
          const prev = i > 0 ? api.deployments[ENVS[i - 1]] : api.activeVersion;
          const canPromote = canDeploy && allowed(e) && prev && prev !== v;
          const vIdx = api.versions.findIndex((x) => x.version === v);
          return (
            <Card key={e} title={<span className="capitalize">{e}</span>} action={v ? <Badge tone="green" dot>Running</Badge> : <Badge>Not deployed</Badge>}>
              <div className="mono text-2xl font-semibold">{v ? `v${v}` : "—"}</div>
              <div className="mt-1 text-xs text-ink-3">{i === 0 ? "Source: working version" : `Promotes from ${ENVS[i - 1]}`}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="primary" disabled={!canPromote} onClick={() => deployApi(api.id, e)} title={!allowed(e) ? "API must be approved first" : undefined}>
                  <Rocket size={13} /> {i === 0 ? "Deploy" : "Promote"} {prev && prev !== v ? `v${prev}` : ""}
                </Button>
                {canDeploy && vIdx > 0 && (
                  <Button size="sm" onClick={() => rollback(api.id, e)}>
                    <RotateCcw size={13} /> Roll back
                  </Button>
                )}
              </div>
              {e === "production" && <p className="mt-3 text-[11px] text-ink-3">Production promotions go through change approval.</p>}
            </Card>
          );
        })}
      </div>
      {pending.length > 0 && (
        <Card title="Pending change requests">
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 text-sm">
                <Badge tone="amber">{p.type}</Badge>
                <span className="flex-1 text-ink-2">{p.detail}</span>
                <span className="text-xs text-ink-3">
                  {p.requestedBy} · {relTime(p.createdAt)}
                </span>
                {can(role, "approve") && (
                  <>
                    <Button size="sm" variant="danger" onClick={() => decideApproval(p.id, false, "")}>
                      Reject
                    </Button>
                    <Button size="sm" variant="success" onClick={() => decideApproval(p.id, true, "")}>
                      Approve
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Release history" pad={false}>
        {releases.length === 0 ? (
          <Empty title="No releases yet" />
        ) : (
          <ul className="divide-y divide-line">
            {releases.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Badge tone={r.kind === "rollback" ? "amber" : r.kind === "promote" ? "green" : "indigo"}>{r.kind}</Badge>
                <span className="mono">v{r.version}</span>
                <span className="text-ink-3">→</span>
                <span className="capitalize">{r.env}</span>
                <span className="flex-1 text-right text-xs text-ink-3">
                  {r.by} · {fmtDateTime(r.ts)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Code>{`# GitOps / CI equivalent
$ conflux promote ${api.slug} --version ${api.activeVersion} --env production
✔ policy checks passed   ✔ change request ${pending[0]?.id ?? "CR-auto"} linked`}</Code>
    </div>
  );
}

function ActivityTab({ api }: { api: Api }) {
  const { state } = useStore();
  const events = state.audit.filter((e) => e.target === api.slug || e.target === api.basePath);
  return (
    <Card pad={false} title="Audit history">
      {events.length === 0 ? (
        <Empty title="No activity recorded yet" />
      ) : (
        <ul className="divide-y divide-line">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <Badge>{e.category}</Badge>
              <span className="flex-1">{e.action}</span>
              <span className="text-xs text-ink-3">
                {e.actor} ({e.role}) · {fmtDateTime(e.ts)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
