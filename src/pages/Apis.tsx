import { Copy, FileCode2, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, Button, Card, cx, Field, Input, Modal, PageHeader, Select, StageBadge, STAGE_TONE, Table, Td, Textarea } from "../components/ui";
import { STAGES, type Api, type Endpoint, type HttpMethod, type Protocol, type Stage } from "../data/types";
import { can } from "../lib/rules";
import { relTime, slugify } from "../lib/util";
import { useStore } from "../store";

export function Apis() {
  const { state } = useStore();
  const [stage, setStage] = useState<Stage | "all">("all");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const role = state.user.role;

  const list = useMemo(
    () =>
      state.apis.filter(
        (a) =>
          (stage === "all" || a.stage === stage) &&
          (!q || `${a.name} ${a.slug} ${a.owner} ${a.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [state.apis, stage, q],
  );

  return (
    <>
      <PageHeader
        eyebrow="Lifecycle Management"
        title="APIs & Lifecycle"
        subtitle="Ship APIs with process, not paperwork. Draft → Review → Approve → Publish → Version → Retire, with policy checks and approvals built in."
        actions={
          can(role, "api.edit") && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={15} /> New API
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STAGES.map((s, i) => {
          const n = state.apis.filter((a) => a.stage === s.key).length;
          const active = stage === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setStage(active ? "all" : s.key)}
              className={cx(
                "focus-ring rounded-xl border p-3 text-left transition",
                active ? "border-brand bg-brand/10" : "border-line bg-panel hover:border-line-2",
              )}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Stage {i + 1}</div>
              <div className="mt-0.5 flex items-baseline justify-between">
                <span className="text-sm font-medium">{s.label}</span>
                <span className="text-lg font-semibold tabular-nums">{n}</span>
              </div>
              <div className="mt-1 hidden text-[11px] leading-tight text-ink-3 md:block">{s.hint}</div>
            </button>
          );
        })}
      </div>

      <Card
        pad={false}
        title={
          <span>
            {stage === "all" ? "All APIs" : `${STAGES.find((s) => s.key === stage)?.label} APIs`} <span className="text-ink-3">({list.length})</span>
          </span>
        }
        action={<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, owner, tag…" className="h-8 w-56 py-1" aria-label="Filter APIs" />}
      >
        <Table head={["API", "Protocol", "Owner", "Stage", "Version", "Environments", "Updated"]}>
          {list.map((a) => (
            <tr key={a.id} className="hover:bg-panel-2/50">
              <Td>
                <Link to={`/apis/${a.id}`} className="font-medium hover:text-brand-2">
                  {a.name}
                </Link>
                <div className="mono text-[11px] text-ink-3">{a.basePath}</div>
              </Td>
              <Td>
                <Badge>{a.protocol}</Badge>
              </Td>
              <Td className="text-ink-2">{a.owner}</Td>
              <Td>
                <StageBadge stage={a.stage} />
              </Td>
              <Td className="mono text-xs">v{a.activeVersion}</Td>
              <Td>
                <div className="flex gap-1">
                  {(["dev", "staging", "production"] as const).map((e) => (
                    <span
                      key={e}
                      title={a.deployments[e] ? `${e}: v${a.deployments[e]}` : `${e}: not deployed`}
                      className={cx(
                        "mono rounded px-1.5 py-0.5 text-[10px]",
                        a.deployments[e] ? (e === "production" ? "bg-ok/15 text-green-300" : "bg-brand/15 text-indigo-300") : "bg-line/60 text-ink-3",
                      )}
                    >
                      {e === "production" ? "prod" : e === "staging" ? "stg" : "dev"}
                    </span>
                  ))}
                </div>
              </Td>
              <Td className="whitespace-nowrap text-xs text-ink-3">{relTime(a.updatedAt)}</Td>
            </tr>
          ))}
        </Table>
        {list.length === 0 && <div className="p-8 text-center text-sm text-ink-3">No APIs match this filter.</div>}
      </Card>

      <CreateApiModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

const SAMPLE_OPENAPI = JSON.stringify(
  {
    openapi: "3.0.3",
    info: { title: "Returns API", version: "1.0.0", description: "Initiate and track product returns and exchanges for online orders." },
    servers: [{ url: "https://api.acme.io/v1/returns" }],
    paths: {
      "/v1/returns": {
        post: { summary: "Create a return", responses: { "201": { description: "Created" } } },
        get: { summary: "List returns", responses: { "200": { description: "OK" } } },
      },
      "/v1/returns/{id}": { get: { summary: "Get a return", responses: { "200": { description: "OK" } } } },
    },
  },
  null,
  2,
);

type Mode = "blank" | "clone" | "import";

function CreateApiModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, createApi, toast } = useStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("blank");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("REST");
  const [basePath, setBasePath] = useState("/v1/");
  const [owner, setOwner] = useState(state.user.team);
  const [classification, setClassification] = useState<Api["classification"]>("internal");
  const [cloneId, setCloneId] = useState(state.apis[0]?.id ?? "");
  const [spec, setSpec] = useState("");
  const [specError, setSpecError] = useState("");

  const reset = () => {
    setName("");
    setDescription("");
    setBasePath("/v1/");
    setSpec("");
    setSpecError("");
    setMode("blank");
  };

  const submit = () => {
    let endpoints: Endpoint[] = [];
    let version = "1.0.0";
    let n = name,
      d = description,
      bp = basePath,
      policy: string | null = null,
      proto = protocol,
      tags: string[] = [];

    if (mode === "clone") {
      const src = state.apis.find((a) => a.id === cloneId)!;
      endpoints = src.endpoints.map((e) => ({ ...e }));
      n = n || `${src.name} (copy)`;
      d = d || src.description;
      bp = basePath !== "/v1/" ? basePath : src.basePath;
      policy = src.policyTemplateId;
      proto = src.protocol;
      tags = [...src.tags];
    }
    if (mode === "import") {
      try {
        const doc = JSON.parse(spec);
        if (!doc.openapi && !doc.swagger) throw new Error("Missing `openapi` or `swagger` field");
        n = n || doc.info?.title || "Imported API";
        d = d || doc.info?.description || "";
        version = /^\d+\.\d+\.\d+$/.test(doc.info?.version ?? "") ? doc.info.version : "1.0.0";
        const paths = Object.keys(doc.paths ?? {});
        if (doc.servers?.[0]?.url) {
          try {
            bp = new URL(doc.servers[0].url).pathname.replace(/\/$/, "") || bp;
          } catch {
            /* relative server url */
          }
        } else if (paths[0]) bp = "/" + paths[0].split("/").filter(Boolean).slice(0, 2).join("/");
        endpoints = paths.flatMap((p, pi) =>
          Object.entries(doc.paths[p] as Record<string, { summary?: string; operationId?: string; responses?: Record<string, unknown> }>)
            .filter(([m]) => ["get", "post", "put", "patch", "delete"].includes(m))
            .map(([m, op], oi) => {
              const status = parseInt(Object.keys(op.responses ?? { 200: 1 })[0], 10) || 200;
              return {
                id: `e${pi}_${oi}`,
                method: m.toUpperCase() as HttpMethod,
                path: p,
                summary: op.summary ?? op.operationId ?? "",
                status,
                responseBody: JSON.stringify({ ok: true }, null, 2),
              };
            }),
        );
      } catch (e) {
        setSpecError(`Could not parse spec: ${(e as Error).message}`);
        return;
      }
    }
    if (!n.trim()) return toast("Name is required", "error");
    const id = createApi({
      name: n.trim(),
      slug: slugify(n),
      description: d,
      owner,
      protocol: proto,
      basePath: bp,
      classification,
      tags,
      versions: [{ version, createdAt: new Date().toISOString(), notes: mode === "import" ? "Imported from OpenAPI" : "Initial draft" }],
      activeVersion: version,
      policyTemplateId: policy,
      endpoints,
      slaTarget: 99.9,
    });
    toast(`Draft "${n}" created`);
    reset();
    onClose();
    navigate(`/apis/${id}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create API"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Create draft
          </Button>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-3 gap-2">
        {(
          [
            ["blank", "Design from scratch", <Sparkles size={16} key="s" />],
            ["clone", "Clone existing API", <Copy size={16} key="c" />],
            ["import", "Import OpenAPI", <FileCode2 size={16} key="f" />],
          ] as const
        ).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            className={cx("focus-ring flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm", mode === k ? "border-brand bg-brand/10" : "border-line hover:border-line-2")}
          >
            <span className="text-brand-2">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {mode === "clone" && (
          <div className="sm:col-span-2">
            <Field label="Source API">
              <Select value={cloneId} onChange={(e) => setCloneId(e.target.value)}>
                {state.apis.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (v{a.activeVersion})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        {mode === "import" && (
          <div className="sm:col-span-2">
            <Field
              label="OpenAPI 3 / Swagger document (JSON)"
              hint={
                <button className="text-brand-2 hover:underline" onClick={() => setSpec(SAMPLE_OPENAPI)}>
                  Load sample spec
                </button>
              }
            >
              <Textarea rows={9} value={spec} onChange={(e) => { setSpec(e.target.value); setSpecError(""); }} placeholder='{ "openapi": "3.0.3", "info": {...}, "paths": {...} }' />
            </Field>
            {specError && <p className="mt-1 text-xs text-red-300">{specError}</p>}
          </div>
        )}
        <Field label={mode === "blank" ? "Name" : "Name (optional override)"} hint={name && <>Slug: <span className="mono">{slugify(name)}</span></>}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Returns API" />
        </Field>
        <Field label="Owning team">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
        </Field>
        {mode === "blank" && (
          <>
            <Field label="Protocol">
              <Select value={protocol} onChange={(e) => setProtocol(e.target.value as Protocol)}>
                {["REST", "GraphQL", "gRPC", "SOAP", "WebSocket", "Async"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field label="Base path">
              <Input value={basePath} onChange={(e) => setBasePath(e.target.value)} className="mono" />
            </Field>
          </>
        )}
        <Field label="Classification">
          <Select value={classification} onChange={(e) => setClassification(e.target.value as Api["classification"])}>
            <option value="internal">Internal</option>
            <option value="partner">Partner</option>
            <option value="public">Public</option>
          </Select>
        </Field>
        {mode !== "import" && (
          <div className="sm:col-span-2">
            <Field label="Description">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this API do and who is it for?" />
            </Field>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-ink-3">
        New APIs start in <Badge tone={STAGE_TONE.draft}>Draft</Badge>. Submitting for review runs the governance standards automatically.
      </p>
    </Modal>
  );
}
