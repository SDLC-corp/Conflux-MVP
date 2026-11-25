import { FileLock2, KeyRound, Plus, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Card, Code, cx, Field, Input, PageHeader, Select, Stat, Table, Tabs, Td, Toggle } from "../components/ui";
import type { PolicyTemplate } from "../data/types";
import { can } from "../lib/rules";
import { relTime } from "../lib/util";
import { useStore } from "../store";

export function toYaml(p: PolicyTemplate, slug = "policy"): string {
  const list = (a: string[]) => (a.length ? `[${a.join(", ")}]` : "[]");
  return `# ${slug}.yaml — ${p.name} (v${p.version})
security:
  authentication:
    method: ${p.authMethod}
    token_validation: ${p.tokenValidation}
    fallback: ${p.fallback}
  authorization:
    model: ${p.authzModel}
    scopes: ${list(p.scopes)}
  protection:
    rate_limit: ${p.rateLimitPerMin}/min
    quota: ${p.quotaPerDay >= 1_000_000 ? `${p.quotaPerDay / 1_000_000}M` : p.quotaPerDay}/day
    geo_restrictions: ${p.geoRestrictions.length ? `enforced ${list(p.geoRestrictions)}` : "none"}
    ip_allow: ${list(p.ipAllow)}
    ip_deny: ${list(p.ipDeny)}
    bot_protection: ${p.botProtection ? "on" : "off"}
    waf: ${p.waf ? "integrated" : "off"}
  encryption:
    in_transit: tls1.3
    at_rest: aes-256`;
}

export function Security() {
  const { state, updatePolicy, createPolicy, rotateSecret } = useStore();
  const editable = can(state.user.role, "policy.edit");
  const [selId, setSelId] = useState(state.policies[0]?.id);
  const sel = state.policies.find((p) => p.id === selId) ?? state.policies[0];
  const enforcedCount = (id: string) => state.apis.filter((a) => a.policyTemplateId === id && a.stage !== "retired").length;
  const totalEnforced = state.apis.filter((a) => a.policyTemplateId && a.stage !== "retired").length;
  const expiring = state.secrets.filter((s) => new Date(s.expiresAt).getTime() - Date.now() < 86400000 * 30).length;

  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Security as policy, not as an afterthought"
        subtitle="Define authentication, authorization and threat protection once — enforce it across every API, environment and gateway node."
        actions={
          editable && (
            <Button
              variant="primary"
              onClick={() =>
                setSelId(
                  createPolicy({
                    name: "New policy template",
                    description: "Describe when to use this template.",
                    authMethod: "oauth2",
                    tokenValidation: "jwt",
                    fallback: "none",
                    authzModel: "scope",
                    scopes: [],
                    rateLimitPerMin: 1000,
                    quotaPerDay: 1_000_000,
                    geoRestrictions: [],
                    ipAllow: [],
                    ipDeny: [],
                    botProtection: true,
                    waf: true,
                  }),
                )
              }
            >
              <Plus size={15} /> New template
            </Button>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Policy templates" value={state.policies.length} hint="Versioned · auditable · reusable" />
        <Stat label="APIs enforced" value={`${totalEnforced}/${state.apis.filter((a) => a.stage !== "retired").length}`} hint="With a template attached" />
        <Stat label="Blocked · 24h" value="18,402" delta="WAF 61% · bots 27%" hint="Rate limit, WAF & bot rules" />
        <Stat label="Expiring secrets" value={expiring} tone={expiring ? "bad" : "good"} delta={expiring ? "< 30 days" : "None"} hint="Certificates & keys" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card title="Policy templates" pad={false}>
          <ul className="divide-y divide-line">
            {state.policies.map((p) => (
              <li key={p.id}>
                <button onClick={() => setSelId(p.id)} className={cx("w-full px-4 py-3 text-left hover:bg-panel-2/60", sel?.id === p.id && "bg-brand/10")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="mono text-[11px] text-ink-3">v{p.version}</span>
                  </div>
                  <div className="mt-1 text-xs text-ink-3">
                    Enforced on {enforcedCount(p.id)} API{enforcedCount(p.id) === 1 ? "" : "s"} · {relTime(p.updatedAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {sel && <PolicyEditor key={sel.id + sel.version} policy={sel} editable={editable} enforced={enforcedCount(sel.id)} onSave={(p) => updatePolicy(sel.id, p)} />}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><FileLock2 size={14} /> Certificates & secrets</span>} pad={false}>
          <Table head={["Name", "Type", "Expires", "Used by", ""]}>
            {state.secrets.map((s) => {
              const days = Math.round((new Date(s.expiresAt).getTime() - Date.now()) / 86400000);
              return (
                <tr key={s.id}>
                  <Td className="mono text-xs">{s.name}</Td>
                  <Td className="text-xs text-ink-2">{s.kind}</Td>
                  <Td>
                    <Badge tone={days < 30 ? "red" : days < 90 ? "amber" : "green"}>{days}d</Badge>
                  </Td>
                  <Td className="text-xs text-ink-3">{s.usedBy} routes</Td>
                  <Td>
                    {editable && (
                      <Button size="sm" variant="ghost" onClick={() => rotateSecret(s.id)}>
                        <RefreshCw size={12} /> Rotate
                      </Button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Card>
        <Card title={<span className="flex items-center gap-2"><ShieldCheck size={14} /> Supported controls</span>}>
          <div className="space-y-4 text-sm">
            {[
              ["Authentication", ["OAuth 2.0", "OpenID Connect", "JWT", "API keys", "SAML", "Mutual TLS", "LDAP", "Active Directory"]],
              ["Authorization", ["RBAC", "Resource-level", "Scope-based", "Claims-based"]],
              ["Threat protection", ["Rate limiting", "Throttling", "Quotas", "DDoS protection", "Bot protection", "WAF integration"]],
              ["Access controls", ["IP allow/deny lists", "Geo restrictions", "Token validation at every hop"]],
            ].map(([title, items]) => (
              <div key={title as string}>
                <div className="mb-1.5 text-xs font-medium text-ink-3">{title as string}</div>
                <div className="flex flex-wrap gap-1.5">
                  {(items as string[]).map((i) => (
                    <Badge key={i} tone="indigo">
                      {i}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function PolicyEditor({ policy, editable, enforced, onSave }: { policy: PolicyTemplate; editable: boolean; enforced: number; onSave: (p: Partial<PolicyTemplate>) => void }) {
  const [p, setP] = useState(policy);
  const [tab, setTab] = useState<"form" | "yaml">("form");
  const dirty = useMemo(() => JSON.stringify(p) !== JSON.stringify(policy), [p, policy]);
  const set = <K extends keyof PolicyTemplate>(k: K, v: PolicyTemplate[K]) => setP((x) => ({ ...x, [k]: v }));
  const csv = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {policy.name} <Badge tone="green">Enforced on {enforced} APIs</Badge>
          <Badge>Versioned · Auditable · Reusable</Badge>
        </span>
      }
      action={
        editable && (
          <div className="flex gap-2">
            {dirty && (
              <Button size="sm" variant="ghost" onClick={() => setP(policy)}>
                Discard
              </Button>
            )}
            <Button size="sm" variant="primary" disabled={!dirty} onClick={() => onSave(p)}>
              Save as v{policy.version + 1}
            </Button>
          </div>
        )
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "form", label: "Editor" },
          { key: "yaml", label: "Policy as code (YAML)" },
        ]}
      />
      <div className="mt-4">
        {tab === "yaml" ? (
          <Code className="text-[12px]">{toYaml(p, policy.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}</Code>
        ) : (
          <fieldset disabled={!editable} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Template name">
                <Input value={p.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Description">
                <Input value={p.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
                <KeyRound size={12} /> Authentication & authorization
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Method">
                  <Select value={p.authMethod} onChange={(e) => set("authMethod", e.target.value as PolicyTemplate["authMethod"])}>
                    {["oauth2", "oidc", "jwt", "api_key", "saml", "mtls", "ldap"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Token validation">
                  <Select value={p.tokenValidation} onChange={(e) => set("tokenValidation", e.target.value as PolicyTemplate["tokenValidation"])}>
                    {["jwt", "introspection", "none"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Fallback">
                  <Select value={p.fallback} onChange={(e) => set("fallback", e.target.value as PolicyTemplate["fallback"])}>
                    {["mtls", "api_key", "none"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Authorization model">
                  <Select value={p.authzModel} onChange={(e) => set("authzModel", e.target.value as PolicyTemplate["authzModel"])}>
                    {["rbac", "scope", "claims"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Scopes" hint="Comma separated">
                  <Input className="mono text-xs" value={p.scopes.join(", ")} onChange={(e) => set("scopes", csv(e.target.value))} />
                </Field>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
                <ShieldAlert size={12} /> Threat protection & access control
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Rate limit (req/min)">
                  <Input type="number" value={p.rateLimitPerMin} onChange={(e) => set("rateLimitPerMin", +e.target.value)} />
                </Field>
                <Field label="Quota (req/day)">
                  <Input type="number" value={p.quotaPerDay} onChange={(e) => set("quotaPerDay", +e.target.value)} />
                </Field>
                <Field label="Geo allow-list (ISO codes)" hint="Empty = no geo restriction">
                  <Input className="mono text-xs" value={p.geoRestrictions.join(", ")} onChange={(e) => set("geoRestrictions", csv(e.target.value.toUpperCase()))} />
                </Field>
                <Field label="IP allow-list (CIDR)">
                  <Input className="mono text-xs" value={p.ipAllow.join(", ")} onChange={(e) => set("ipAllow", csv(e.target.value))} />
                </Field>
                <Field label="IP deny-list (CIDR)">
                  <Input className="mono text-xs" value={p.ipDeny.join(", ")} onChange={(e) => set("ipDeny", csv(e.target.value))} />
                </Field>
                <div className="flex items-end gap-6 pb-2 text-sm">
                  <label className="flex items-center gap-2">
                    <Toggle checked={p.botProtection} onChange={(v) => set("botProtection", v)} label="Bot protection" /> Bot protection
                  </label>
                  <label className="flex items-center gap-2">
                    <Toggle checked={p.waf} onChange={(v) => set("waf", v)} label="WAF" /> WAF
                  </label>
                </div>
              </div>
            </div>
          </fieldset>
        )}
      </div>
    </Card>
  );
}
