import { Check, Copy, Eye, EyeOff, KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Bar, Button, Card, cx, Empty, Field, Input, Modal, PageHeader, Stat } from "../components/ui";
import type { ConsumerApp } from "../data/types";
import { liveMetrics } from "../lib/metrics";
import { fmtNum, maskKey, relTime } from "../lib/util";
import { useStore } from "../store";

export function Apps() {
  const { state, createApp } = useStore();
  const apps = state.apps.filter((a) => state.user.role !== "Developer" || a.org === state.user.team);
  const [selId, setSelId] = useState(apps[0]?.id);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const sel = apps.find((a) => a.id === selId) ?? apps[0];

  return (
    <>
      <PageHeader
        eyebrow="Developer Portal"
        title="My Apps & Keys"
        subtitle="Self-service credentials: register apps, subscribe to APIs, manage keys and see your own usage — no tickets, no waiting."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> Register app
          </Button>
        }
      />
      {apps.length === 0 ? (
        <Card>
          <Empty icon={<KeyRound size={22} />} title="No applications yet">
            Register an app to get sandbox credentials.
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Card pad={false} title="Applications">
            <ul className="divide-y divide-line">
              {apps.map((a) => (
                <li key={a.id}>
                  <button onClick={() => setSelId(a.id)} className={cx("w-full px-4 py-3 text-left hover:bg-panel-2/60", sel?.id === a.id && "bg-brand/10")}>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-ink-3">
                      {a.org} · {a.subscriptions.length} APIs · {a.keys.filter((k) => k.status === "active").length} keys
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {sel && <AppDetail key={sel.id} app={sel} />}
        </div>
      )}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Register application"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() => {
                setSelId(createApp({ name: name.trim(), description: desc }));
                setName("");
                setDesc("");
                setCreating(false);
              }}
            >
              Register
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="App name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Store Locator" />
          </Field>
          <Field label="Description">
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

function AppDetail({ app }: { app: ConsumerApp }) {
  const { state, tick, apiById, generateKey, revokeKey, toast } = useStore();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const hasProdPlan = app.subscriptions.some((s) => s.plan !== "Sandbox" && s.status === "active");

  const rpm = app.subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => {
      const a = apiById(s.apiId);
      return sum + (a?.deployments.production ? liveMetrics(a, tick).rpm * 0.2 : 0);
    }, 0);
  const today = Math.round(rpm * 60 * (new Date().getHours() + 1));
  const quotaPct = Math.min(100, (rpm * 60 * 24 * 0.6 * 100) / app.quotaPerDay);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Requests / min" value={fmtNum(Math.round(rpm))} hint="Your traffic only" />
        <Stat label="Requests today" value={fmtNum(today)} />
        <Stat label="Errors today" value={fmtNum(Math.round(today * 0.0012))} hint="4xx + 5xx" />
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-3">Daily quota</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums">{Math.round(quotaPct)}%</div>
          <div className="mt-2">
            <Bar value={quotaPct} tone={quotaPct > 80 ? "warn" : "brand"} />
          </div>
          <div className="mt-1 text-xs text-ink-3">of {fmtNum(app.quotaPerDay)}/day</div>
        </div>
      </div>

      <Card
        title="Credentials"
        pad={false}
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { generateKey(app.id, "sandbox"); toast("Sandbox key generated"); }}>
              <KeyRound size={13} /> Sandbox key
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!hasProdPlan}
              title={!hasProdPlan ? "Requires an approved Standard or Enterprise subscription" : undefined}
              onClick={() => { generateKey(app.id, "production"); toast("Production key generated — store it securely"); }}
            >
              <KeyRound size={13} /> Production key
            </Button>
          </div>
        }
      >
        {app.keys.length === 0 ? (
          <Empty title="No keys yet">Generate a sandbox key to start testing.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {app.keys.map((k) => (
              <li key={k.id} className={cx("flex flex-wrap items-center gap-3 px-4 py-3", k.status === "revoked" && "opacity-50")}>
                <Badge tone={k.env === "production" ? "green" : "cyan"}>{k.env}</Badge>
                <span className="mono flex-1 truncate text-xs">{revealed[k.id] ? k.value : maskKey(k.value)}</span>
                <span className="text-xs text-ink-3">created {relTime(k.createdAt)}</span>
                {k.status === "active" ? (
                  <>
                    <button aria-label={revealed[k.id] ? "Hide key" : "Reveal key"} className="rounded p-1 text-ink-3 hover:text-ink" onClick={() => setRevealed({ ...revealed, [k.id]: !revealed[k.id] })}>
                      {revealed[k.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      aria-label="Copy key"
                      className="rounded p-1 text-ink-3 hover:text-ink"
                      onClick={() => {
                        navigator.clipboard?.writeText(k.value);
                        setCopied(k.id);
                        setTimeout(() => setCopied(null), 1200);
                      }}
                    >
                      {copied === k.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                    <Button size="sm" variant="danger" onClick={() => confirm("Revoke this key? Requests using it will fail immediately.") && revokeKey(app.id, k.id)}>
                      Revoke
                    </Button>
                  </>
                ) : (
                  <Badge tone="red">revoked</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Subscriptions" pad={false} action={<Link to="/portal" className="text-xs text-brand-2 hover:underline">Browse catalog</Link>}>
        {app.subscriptions.length === 0 ? (
          <Empty title="Not subscribed to any API">Find an API in the catalog and subscribe.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {app.subscriptions.map((s) => {
              const a = apiById(s.apiId);
              return (
                <li key={s.apiId} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Link to={`/portal/${s.apiId}`} className="flex-1 font-medium hover:text-brand-2">
                    {a?.name}
                  </Link>
                  <Badge tone="indigo">{s.plan}</Badge>
                  <Badge tone={s.status === "active" ? "green" : "amber"} dot>
                    {s.status === "active" ? "Active" : "Pending approval"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {state.user.role !== "Developer" && <p className="text-xs text-ink-3">Viewing all tenant applications as {state.user.role}.</p>}
    </div>
  );
}
