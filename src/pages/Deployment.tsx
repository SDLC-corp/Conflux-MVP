import { Building2, Cloud, Download, Network, Terminal } from "lucide-react";
import { Badge, Bar, Button, Card, Code, cx, PageHeader, Table, Td } from "../components/ui";
import { ENVS, type Integration } from "../data/types";
import { can } from "../lib/rules";
import { downloadFile, fmtDateTime } from "../lib/util";
import { useStore } from "../store";

export function Deployment() {
  const { state, apiById, toggleIntegration, logAudit } = useStore();
  const admin = can(state.user.role, "admin");

  const exportConfig = () => {
    const cfg = {
      apiVersion: "conflux.io/v1",
      kind: "ControlPlaneExport",
      exportedAt: new Date().toISOString(),
      apis: state.apis.map(({ id, slug, basePath, protocol, activeVersion, deployments, policyTemplateId }) => ({ id, slug, basePath, protocol, activeVersion, deployments, policyTemplateId })),
      routes: state.routes,
      policies: state.policies,
      alertRules: state.alertRules,
    };
    downloadFile("conflux-config.json", JSON.stringify(cfg, null, 2), "application/json");
    logAudit("Exported control-plane configuration (GitOps)", "conflux-config.json", "config");
  };

  const modes = [
    { key: "Cloud", icon: <Cloud size={18} />, desc: "AWS, Azure or Google Cloud — auto scaling, HA, zero-downtime upgrades." },
    { key: "On-premise", icon: <Building2 size={18} />, desc: "Full platform in your data center — backup, restore and DR built in." },
    { key: "Hybrid edge", icon: <Network size={18} />, desc: "Gateways at the edge and in VPCs, one control plane, synchronized environments." },
  ] as const;

  const groups: Integration["category"][] = ["Identity", "ITSM", "Observability", "Cloud", "CI/CD", "Messaging"];

  return (
    <>
      <PageHeader
        eyebrow="Deployment"
        title="Runs where your architecture says it should"
        subtitle="Cloud-native, Kubernetes and Docker packaging, multi-region and multi-cluster — managed from one control plane."
        actions={
          <Button onClick={exportConfig}>
            <Download size={14} /> Export config
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        {ENVS.map((e) => {
          const nodes = state.nodes.filter((n) => n.env === e);
          const apis = state.apis.filter((a) => a.deployments[e]);
          return (
            <Card key={e} title={<span className="capitalize">{e}</span>} action={nodes.every((n) => n.status === "healthy") ? <Badge tone="green" dot>Healthy</Badge> : <Badge tone="amber" dot>Degraded</Badge>}>
              <div className="flex gap-6">
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{nodes.length}</div>
                  <div className="text-xs text-ink-3">gateway nodes</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{apis.length}</div>
                  <div className="text-xs text-ink-3">APIs deployed</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{new Set(nodes.map((n) => n.region)).size}</div>
                  <div className="text-xs text-ink-3">regions</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {modes.map((m) => {
          const n = state.nodes.filter((x) => x.mode === m.key);
          return (
            <div key={m.key} className="rounded-xl border border-line bg-panel p-4">
              <div className="flex items-center gap-2 font-medium">
                <span className="text-brand-2">{m.icon}</span> {m.key === "Hybrid edge" ? "Hybrid" : m.key}
                <Badge className="ml-auto">{n.length} nodes</Badge>
              </div>
              <p className="mt-2 text-sm text-ink-3">{m.desc}</p>
            </div>
          );
        })}
      </div>

      <Card className="mt-4" title="Gateway nodes" pad={false}>
        <Table head={["Node", "Environment", "Mode / provider", "Region · cluster", "Version", "CPU", "Status"]}>
          {state.nodes.map((n) => (
            <tr key={n.id}>
              <Td className="mono text-xs">{n.name}</Td>
              <Td className="capitalize text-ink-2">{n.env}</Td>
              <Td className="text-xs text-ink-2">
                {n.mode} · {n.provider}
              </Td>
              <Td className="mono text-xs text-ink-3">
                {n.region} · {n.cluster}
              </Td>
              <Td className="mono text-xs">{n.version}</Td>
              <Td>
                <div className="flex w-28 items-center gap-2">
                  <Bar value={n.cpu} tone={n.cpu > 70 ? "warn" : "ok"} />
                  <span className="text-xs tabular-nums text-ink-3">{n.cpu}%</span>
                </div>
              </Td>
              <Td>
                <Badge tone={n.status === "healthy" ? "green" : "amber"} dot>
                  {n.status}
                </Badge>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Release history" pad={false}>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {state.releases.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Badge tone={r.kind === "rollback" ? "amber" : r.kind === "promote" ? "green" : "indigo"}>{r.kind}</Badge>
                <span className="mono text-xs">
                  {apiById(r.apiId)?.slug} v{r.version}
                </span>
                <span className="capitalize text-ink-2">→ {r.env}</span>
                <span className="ml-auto text-xs text-ink-3">
                  {r.by} · {fmtDateTime(r.ts)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Terminal size={14} /> DevOps-native by default</span>}>
          <p className="mb-3 text-sm text-ink-2">GitOps workflows, Infrastructure as Code, config export/import and deployment pipelines.</p>
          <Code>{`$ conflux login --tenant acme-corp
$ conflux apply -f ./apis/payments-api.yaml --env staging
✔ 4 routes, 1 policy template synced
$ conflux promote payments-api --version 2.4.0 --env production
⏳ change request opened — awaiting approval
$ conflux rollback payments-api --env production
✔ production → v2.3.0 (zero downtime)`}</Code>
        </Card>
      </div>

      <Card className="mt-4" title="Integration framework" action={<span className="text-xs text-ink-3">{state.integrations.filter((i) => i.connected).length} connected</span>}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{g}</div>
              <ul className="space-y-1.5">
                {state.integrations
                  .filter((i) => i.category === g)
                  .map((i) => (
                    <li key={i.id} className="flex items-center justify-between rounded-lg border border-line bg-bg px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span className={cx("h-1.5 w-1.5 rounded-full", i.connected ? "bg-ok" : "bg-line-2")} />
                        {i.name}
                      </span>
                      <Button size="sm" variant={i.connected ? "ghost" : "secondary"} disabled={!admin} onClick={() => toggleIntegration(i.id)}>
                        {i.connected ? "Disconnect" : "Connect"}
                      </Button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
