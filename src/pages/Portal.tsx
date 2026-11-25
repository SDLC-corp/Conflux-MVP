import { BookOpen, Code2, FlaskConical, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, cx, Empty, Input } from "../components/ui";
import type { Protocol } from "../data/types";
import { useStore } from "../store";

export function Portal() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [proto, setProto] = useState<Protocol | "all">("all");
  const catalog = state.apis.filter((a) => a.stage === "published" || a.stage === "deprecated");
  const protocols = Array.from(new Set(catalog.map((a) => a.protocol)));
  const list = useMemo(
    () =>
      catalog.filter(
        (a) => (proto === "all" || a.protocol === proto) && (!q || `${a.name} ${a.description} ${a.tags.join(" ")} ${a.basePath}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [catalog, q, proto],
  );

  return (
    <>
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-brand/20 via-panel to-cyan/10 p-6 sm:p-8">
        <div className="text-xs font-medium uppercase tracking-wider text-brand-2">Developer Portal</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Find an API. Try it. Ship.</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-2">Self-service catalog with live OpenAPI docs, an interactive sandbox, sample code and instant credentials — no tickets, no waiting.</p>
        <div className="relative mt-5 max-w-lg">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${catalog.length} APIs`} className="h-11 pl-9 text-base" aria-label="Search catalog" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["all", ...protocols] as const).map((p) => (
            <button key={p} onClick={() => setProto(p)} className={cx("focus-ring rounded-full border px-3 py-1 text-xs", proto === p ? "border-brand bg-brand/20 text-ink" : "border-line text-ink-2 hover:border-line-2")}>
              {p === "all" ? "All protocols" : p}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <Empty icon={<Search size={22} />} title="No APIs found">
          Try a different search term or protocol.
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => (
            <article key={a.id} className="group flex flex-col rounded-xl border border-line bg-panel p-5 transition hover:border-brand/50">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/portal/${a.id}`} className="font-semibold group-hover:text-brand-2">
                  {a.name}
                </Link>
                <Badge tone={a.stage === "deprecated" ? "amber" : "green"} dot>
                  v{a.deployments.production ?? a.activeVersion} · {a.stage === "deprecated" ? "Deprecated" : "Published"}
                </Badge>
              </div>
              <div className="mono mt-1 text-[11px] text-ink-3">
                {a.protocol} · {a.basePath}
              </div>
              <p className="mt-3 flex-1 text-sm text-ink-2">{a.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {a.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
              <div className="mt-4 flex gap-1 border-t border-line pt-3 text-xs">
                {[
                  ["docs", "OpenAPI", <BookOpen size={12} key="b" />],
                  ["try", "Sandbox", <FlaskConical size={12} key="f" />],
                  ["sdks", "SDKs", <Code2 size={12} key="c" />],
                ].map(([tab, label, icon]) => (
                  <Link key={tab as string} to={`/portal/${a.id}?tab=${tab}`} className="flex items-center gap-1 rounded-md px-2 py-1 text-ink-2 hover:bg-panel-2 hover:text-ink">
                    {icon}
                    {label}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
