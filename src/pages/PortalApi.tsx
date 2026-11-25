import { AlertTriangle, ArrowLeft, Check, Copy, Download, KeyRound, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Badge, Button, Card, Code, cx, Empty, Field, MethodBadge, Select, Tabs, Textarea } from "../components/ui";
import type { Api, Endpoint } from "../data/types";
import { downloadFile, maskKey, relTime } from "../lib/util";
import { useStore } from "../store";

type Tab = "docs" | "try" | "sdks" | "changelog";

export function PortalApi() {
  const { id } = useParams();
  const { apiById } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "docs";
  const api = apiById(id);
  if (!api || !["published", "deprecated"].includes(api.stage))
    return (
      <Empty title="API not available in the catalog">
        <Link to="/portal" className="text-brand-2">
          Back to catalog
        </Link>
      </Empty>
    );

  const downloadSpec = () => {
    const spec = {
      openapi: "3.0.3",
      info: { title: api.name, version: api.deployments.production ?? api.activeVersion, description: api.description },
      servers: [{ url: `https://api.acme.io${api.basePath}` }, { url: `https://sandbox.api.acme.io${api.basePath}` }],
      paths: api.endpoints.reduce<Record<string, Record<string, unknown>>>((acc, e) => {
        acc[e.path] = acc[e.path] ?? {};
        acc[e.path][e.method.toLowerCase()] = {
          summary: e.summary,
          security: e.scope ? [{ oauth2: [e.scope] }] : undefined,
          requestBody: e.requestBody ? { content: { "application/json": { example: JSON.parse(e.requestBody) } } } : undefined,
          responses: { [e.status]: { description: "Success", content: { "application/json": { example: JSON.parse(e.responseBody) } } } },
        };
        return acc;
      }, {}),
    };
    downloadFile(`${api.slug}-openapi.json`, JSON.stringify(spec, null, 2), "application/json");
  };

  return (
    <>
      <Link to="/portal" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
        <ArrowLeft size={13} /> API Catalog
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{api.name}</h1>
            <Badge tone={api.stage === "deprecated" ? "amber" : "green"} dot>
              v{api.deployments.production ?? api.activeVersion} · {api.stage === "deprecated" ? "Deprecated" : "Published"}
            </Badge>
            <Badge>{api.protocol}</Badge>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-2">{api.description}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadSpec}>
            <Download size={14} /> OpenAPI spec
          </Button>
          <SubscribeButton api={api} />
        </div>
      </div>
      {api.stage === "deprecated" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/10 px-4 py-2.5 text-sm text-amber-200">
          <AlertTriangle size={15} /> This API is deprecated and will be retired {api.sunsetDate ? `on ${new Date(api.sunsetDate).toLocaleDateString()}` : "soon"}. Plan your migration.
        </div>
      )}
      <Tabs<Tab>
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { key: "docs", label: "Documentation" },
          { key: "try", label: "Try it · Sandbox" },
          { key: "sdks", label: "SDKs & samples" },
          { key: "changelog", label: "Changelog" },
        ]}
      />
      <div className="mt-5">
        {tab === "docs" && <Docs api={api} />}
        {tab === "try" && <TryIt api={api} />}
        {tab === "sdks" && <Sdks api={api} />}
        {tab === "changelog" && (
          <Card pad={false} title="Version history">
            <ul className="divide-y divide-line">
              {[...api.versions].reverse().map((v) => (
                <li key={v.version} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="mono w-16 font-medium">v{v.version}</span>
                  {api.deployments.production === v.version && <Badge tone="green">Production</Badge>}
                  <span className="flex-1 text-ink-2">{v.notes}</span>
                  <span className="text-xs text-ink-3">{relTime(v.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

function SubscribeButton({ api }: { api: Api }) {
  const { state, subscribe } = useStore();
  const [open, setOpen] = useState(false);
  const myApps = state.apps.filter((a) => state.user.role !== "Developer" || a.org === state.user.team);
  const [appId, setAppId] = useState(myApps[0]?.id ?? "");
  const [plan, setPlan] = useState<"Sandbox" | "Standard" | "Enterprise">("Sandbox");
  if (api.stage === "deprecated") return null;
  return (
    <div className="relative">
      <Button variant="primary" onClick={() => setOpen((o) => !o)}>
        Subscribe
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="slide-in absolute right-0 z-40 mt-2 w-72 space-y-3 rounded-xl border border-line-2 bg-panel p-4 shadow-2xl">
            {myApps.length === 0 ? (
              <p className="text-sm text-ink-2">
                Register an app first in{" "}
                <Link to="/apps" className="text-brand-2">
                  My Apps
                </Link>
                .
              </p>
            ) : (
              <>
                <Field label="Application">
                  <Select value={appId} onChange={(e) => setAppId(e.target.value)}>
                    {myApps.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Plan" hint={plan === "Sandbox" ? "Instant access to sandbox" : "Requires approval from the API owner"}>
                  <Select value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)}>
                    <option>Sandbox</option>
                    <option>Standard</option>
                    <option>Enterprise</option>
                  </Select>
                </Field>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    subscribe(appId, api.id, plan);
                    setOpen(false);
                  }}
                >
                  {plan === "Sandbox" ? "Subscribe" : "Request access"}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Docs({ api }: { api: Api }) {
  const { state } = useStore();
  const policy = state.policies.find((p) => p.id === api.policyTemplateId);
  const [open, setOpen] = useState<string | null>(api.endpoints[0]?.id ?? null);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-2">
        {api.endpoints.map((e) => (
          <div key={e.id} className="overflow-hidden rounded-xl border border-line bg-panel">
            <button onClick={() => setOpen(open === e.id ? null : e.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-panel-2/50" aria-expanded={open === e.id}>
              <MethodBadge method={e.method} />
              <span className="mono text-sm">{e.path}</span>
              <span className="ml-auto hidden text-sm text-ink-2 sm:block">{e.summary}</span>
            </button>
            {open === e.id && (
              <div className="grid gap-4 border-t border-line p-4 md:grid-cols-2">
                <div>
                  <div className="mb-1.5 text-xs font-medium text-ink-3">Request {e.scope && <Badge className="ml-1">scope: {e.scope}</Badge>}</div>
                  <Code>{e.requestBody ?? "// no request body"}</Code>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-ink-3">Response · {e.status}</div>
                  <Code>{e.responseBody}</Code>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <Card title="Access">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-ink-3">Base URL</dt>
            <dd className="mono break-all text-xs">https://api.acme.io{api.basePath}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Sandbox URL</dt>
            <dd className="mono break-all text-xs">https://sandbox.api.acme.io{api.basePath}</dd>
          </div>
          {policy && (
            <>
              <div>
                <dt className="text-xs text-ink-3">Authentication</dt>
                <dd>{policy.authMethod === "oauth2" ? "OAuth 2.0 (client credentials) or API key in sandbox" : policy.authMethod.toUpperCase()}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Rate limit</dt>
                <dd>{policy.rateLimitPerMin.toLocaleString()} req/min</dd>
              </div>
            </>
          )}
          <div>
            <dt className="text-xs text-ink-3">Owner</dt>
            <dd>{api.owner}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

function TryIt({ api }: { api: Api }) {
  const { state, generateKey, toast } = useStore();
  const myApps = state.apps.filter((a) => state.user.role !== "Developer" || a.org === state.user.team);
  const keys = myApps.flatMap((a) => a.keys.filter((k) => k.env === "sandbox" && k.status === "active").map((k) => ({ ...k, app: a })));
  const [epId, setEpId] = useState(api.endpoints[0]?.id);
  const ep = api.endpoints.find((e) => e.id === epId) as Endpoint;
  const [keyId, setKeyId] = useState(keys[0]?.id ?? "");
  const [body, setBody] = useState(ep?.requestBody ?? "");
  const [res, setRes] = useState<{ status: number; ms: number; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const key = keys.find((k) => k.id === keyId);
  const [pendingValue, setPendingValue] = useState<string | null>(null);

  // Select a freshly generated key once it appears in state.
  useEffect(() => {
    if (!pendingValue) return;
    const k = keys.find((x) => x.value === pendingValue);
    if (k) {
      setKeyId(k.id);
      setPendingValue(null);
    }
  }, [keys, pendingValue]);

  const send = () => {
    setLoading(true);
    setRes(null);
    setTimeout(() => {
      const ms = 40 + Math.round(Math.random() * 90);
      let out: { status: number; body: unknown };
      if (!key) out = { status: 401, body: { error: "unauthorized", message: "Missing or invalid API key. Generate a sandbox key to continue." } };
      else if (!key.app.subscriptions.some((s) => s.apiId === api.id && s.status === "active"))
        out = { status: 403, body: { error: "forbidden", message: `Application "${key.app.name}" is not subscribed to ${api.slug}. Subscribe (Sandbox plan is instant).` } };
      else {
        try {
          if (ep.requestBody && body.trim()) JSON.parse(body);
          out = { status: ep.status, body: JSON.parse(ep.responseBody) };
        } catch {
          out = { status: 400, body: { error: "invalid_request", message: "Request body is not valid JSON." } };
        }
      }
      setRes({ status: out.status, ms, body: JSON.stringify(out.body, null, 2) });
      setLoading(false);
    }, 350);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Request" action={<Badge tone="cyan">TRY IT · SANDBOX</Badge>}>
        <div className="space-y-4">
          <Field label="Endpoint">
            <Select
              value={epId}
              onChange={(e) => {
                setEpId(e.target.value);
                setBody(api.endpoints.find((x) => x.id === e.target.value)?.requestBody ?? "");
                setRes(null);
              }}
            >
              {api.endpoints.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.method} {e.path}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sandbox key">
            <div className="flex gap-2">
              <Select value={keyId} onChange={(e) => setKeyId(e.target.value)} className="flex-1">
                <option value="">— No key —</option>
                {keys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.app.name} · {maskKey(k.value)}
                  </option>
                ))}
              </Select>
              <Button
                disabled={!myApps.length}
                onClick={() => {
                  const app = myApps.find((a) => a.subscriptions.some((s) => s.apiId === api.id && s.status === "active")) ?? myApps[0];
                  setPendingValue(generateKey(app.id, "sandbox"));
                  toast(`Sandbox key generated for ${app.name}`);
                }}
              >
                <KeyRound size={14} /> Generate sandbox key
              </Button>
            </div>
          </Field>
          {ep?.requestBody !== undefined && (
            <Field label="Body (JSON)">
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
          )}
          <Code>{`${ep?.method} https://sandbox.api.acme.io${ep?.path}
Authorization: Bearer ${key ? maskKey(key.value) : "<missing>"}
Content-Type: application/json`}</Code>
          <Button variant="primary" onClick={send} disabled={loading}>
            <Send size={14} /> {loading ? "Sending…" : "Send request"}
          </Button>
        </div>
      </Card>
      <Card title="Response" action={res && <span className={cx("mono text-xs", res.status < 300 ? "text-green-400" : "text-red-300")}>{res.status} · {res.ms} ms</span>}>
        {res ? <Code className="min-h-[200px]">{res.body}</Code> : <Empty title="No response yet">Pick an endpoint, select a sandbox key and send the request.</Empty>}
      </Card>
    </div>
  );
}

function Sdks({ api }: { api: Api }) {
  const ep = api.endpoints[0];
  const [lang, setLang] = useState<"curl" | "javascript" | "python" | "java">("curl");
  const [copied, setCopied] = useState(false);
  const url = `https://sandbox.api.acme.io${ep.path}`;
  const body = ep.requestBody ? ep.requestBody.replace(/\n\s*/g, " ") : "";
  const snippets = {
    curl: `curl -X ${ep.method} "${url}" \\
  -H "Authorization: Bearer $CONFLUX_KEY" \\
  -H "Content-Type: application/json"${body ? ` \\\n  -d '${body}'` : ""}`,
    javascript: `import { ${api.name.replace(/[^A-Za-z]/g, "")}Client } from "@acme/${api.slug}";

const client = new ${api.name.replace(/[^A-Za-z]/g, "")}Client({ apiKey: process.env.CONFLUX_KEY, env: "sandbox" });
const res = await client.request("${ep.method}", "${ep.path}"${body ? `, ${body}` : ""});
console.log(res);`,
    python: `import os, requests

res = requests.${ep.method.toLowerCase()}(
    "${url}",
    headers={"Authorization": f"Bearer {os.environ['CONFLUX_KEY']}"},${body ? `\n    json=${body.replace(/true/g, "True").replace(/false/g, "False")},` : ""}
)
print(res.status_code, res.json())`,
    java: `HttpRequest req = HttpRequest.newBuilder()
    .uri(URI.create("${url}"))
    .header("Authorization", "Bearer " + System.getenv("CONFLUX_KEY"))
    .method("${ep.method}", ${body ? `HttpRequest.BodyPublishers.ofString("${body.replace(/"/g, '\\"')}")` : "HttpRequest.BodyPublishers.noBody()"})
    .build();
HttpResponse<String> res = HttpClient.newHttpClient().send(req, BodyHandlers.ofString());`,
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Card
        title={`Sample · ${ep.method} ${ep.path}`}
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard?.writeText(snippets[lang]);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
          </Button>
        }
      >
        <div className="mb-3 flex gap-1">
          {(Object.keys(snippets) as (keyof typeof snippets)[]).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={cx("focus-ring rounded-md px-2.5 py-1 text-xs capitalize", lang === l ? "bg-brand/20 text-ink" : "text-ink-3 hover:text-ink-2")}>
              {l}
            </button>
          ))}
        </div>
        <Code>{snippets[lang]}</Code>
      </Card>
      <Card title="SDK downloads">
        <ul className="space-y-2 text-sm">
          {[
            ["TypeScript / Node", `npm i @acme/${api.slug}`],
            ["Python", `pip install acme-${api.slug}`],
            ["Java", `com.acme:${api.slug}:${api.activeVersion}`],
            ["Go", `go get acme.io/sdk/${api.slug}`],
          ].map(([l, cmd]) => (
            <li key={l} className="rounded-lg border border-line bg-bg p-2.5">
              <div className="text-xs font-medium">{l}</div>
              <div className="mono mt-0.5 break-all text-[11px] text-ink-3">{cmd}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
