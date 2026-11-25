import {
  Activity,
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  CircleAlert,
  Cloud,
  GitBranch,
  Info,
  KeyRound,
  LayoutDashboard,
  Menu,
  Network,
  RotateCcw,
  Search,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ENVS, ROLES } from "../data/types";
import { can, ROLE_DESCRIPTIONS } from "../lib/rules";
import { PERSONAS, useStore } from "../store";
import { cx, StageBadge } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

export function Layout() {
  const { state, toasts } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobileOpen(false), [loc.pathname]);

  const role = state.user.role;
  const pending = state.approvals.filter((a) => a.status === "pending").length;
  const openAlerts = state.alerts.filter((a) => a.status === "open").length;

  const consoleNav: NavItem[] = [
    { to: "/", label: "Overview", icon: <LayoutDashboard size={16} /> },
    { to: "/apis", label: "APIs & Lifecycle", icon: <GitBranch size={16} /> },
    { to: "/gateway", label: "API Gateway", icon: <Network size={16} /> },
    { to: "/security", label: "Security", icon: <ShieldCheck size={16} /> },
    { to: "/monitoring", label: "Monitoring", icon: <Activity size={16} />, badge: openAlerts },
    { to: "/governance", label: "Governance", icon: <Stamp size={16} />, badge: pending },
    { to: "/deployment", label: "Deployment", icon: <Cloud size={16} /> },
  ];
  const portalNav: NavItem[] = [
    { to: "/portal", label: "API Catalog", icon: <BookOpen size={16} /> },
    { to: "/apps", label: "My Apps & Keys", icon: <KeyRound size={16} /> },
  ];
  const showConsole = role !== "Developer";

  const sidebar = (
    <nav className="flex h-full flex-col gap-6 p-3" aria-label="Primary">
      <div className="flex items-center gap-2.5 px-2 pt-1">
        <img src="/logo.svg" alt="" className="h-7 w-7" />
        <div>
          <div className="text-[15px] font-semibold leading-none tracking-tight">Conflux</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-3">API control plane</div>
        </div>
      </div>
      {showConsole && <NavGroup title="Console" items={consoleNav} />}
      {can(role, "portal.use") && <NavGroup title="Developer Portal" items={portalNav} />}
      <div className="mt-auto rounded-lg border border-line bg-panel-2 p-3 text-xs text-ink-3">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-ink-2">
          <Boxes size={13} /> Conflux 5.4 · Multi-tenant
        </div>
        Tenant <span className="text-ink-2">acme-corp</span> · 3 regions
      </div>
    </nav>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-panel lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="h-full w-64 border-r border-line bg-panel" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "slide-in pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-xl",
              t.kind === "success" && "border-ok/30 bg-[#0f2a1c] text-green-200",
              t.kind === "error" && "border-bad/30 bg-[#2c1215] text-red-200",
              t.kind === "info" && "border-brand/30 bg-[#171a3a] text-indigo-200",
            )}
          >
            {t.kind === "success" ? <Check size={16} className="mt-0.5 shrink-0" /> : t.kind === "error" ? <CircleAlert size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function NavGroup({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div>
      <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">{title}</div>
      <ul className="space-y-0.5">
        {items.map((i) => (
          <li key={i.to}>
            <NavLink
              to={i.to}
              end={i.to === "/"}
              className={({ isActive }) =>
                cx(
                  "focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                  isActive ? "bg-brand/15 text-ink" : "text-ink-2 hover:bg-panel-2 hover:text-ink",
                )
              }
            >
              <span className="text-ink-3">{i.icon}</span>
              <span className="flex-1">{i.label}</span>
              {!!i.badge && <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold leading-4 text-white">{i.badge}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { state, setEnv, setRole, resetDemo } = useStore();
  const [roleOpen, setRoleOpen] = useState(false);
  const degraded = state.nodes.filter((n) => n.env === state.env && n.status !== "healthy").length;
  const navigate = useNavigate();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel/80 px-4 backdrop-blur sm:px-6">
      <button className="focus-ring rounded p-1.5 text-ink-2 lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu size={18} />
      </button>
      {state.user.role === "Developer" ? (
        <span className="mono hidden text-xs text-ink-3 md:block">developers.acme.io</span>
      ) : (
      <>
      <div className="hidden items-center gap-2 text-xs text-ink-3 md:flex">
        <span className="mono">console.conflux</span>
        <span>·</span>
        <div className="flex rounded-lg border border-line bg-bg p-0.5" role="radiogroup" aria-label="Environment">
          {ENVS.map((e) => (
            <button
              key={e}
              role="radio"
              aria-checked={state.env === e}
              onClick={() => setEnv(e)}
              className={cx(
                "focus-ring rounded-md px-2.5 py-1 text-xs font-medium capitalize transition",
                state.env === e ? (e === "production" ? "bg-bad/15 text-red-300" : e === "staging" ? "bg-warn/15 text-amber-300" : "bg-cyan/15 text-cyan-300") : "text-ink-3 hover:text-ink-2",
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className={cx("hidden items-center gap-1.5 text-xs xl:flex", degraded ? "text-amber-300" : "text-green-400")}>
        <span className={cx("pulse-dot h-2 w-2 rounded-full", degraded ? "bg-warn" : "bg-ok")} />
        {degraded ? `${degraded} gateway node${degraded > 1 ? "s" : ""} degraded` : "All gateways healthy"}
      </div>
      </>
      )}

      <div className="flex flex-1 justify-end">
        <GlobalSearch onPick={(id) => navigate(state.user.role === "Developer" ? `/portal/${id}` : `/apis/${id}`)} />
      </div>

      <button onClick={resetDemo} title="Reset demo data" aria-label="Reset demo data" className="focus-ring rounded-lg p-2 text-ink-3 hover:bg-panel-2 hover:text-ink">
        <RotateCcw size={16} />
      </button>

      <div className="relative">
        <button onClick={() => setRoleOpen((o) => !o)} className="focus-ring flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-panel-2" aria-haspopup="menu" aria-expanded={roleOpen}>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand to-cyan text-[11px] font-semibold text-white">
            {state.user.name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div className="hidden text-left sm:block">
            <div className="text-xs font-medium leading-tight">{state.user.name}</div>
            <div className="text-[10px] leading-tight text-ink-3">{state.user.role}</div>
          </div>
          <ChevronDown size={14} className="text-ink-3" />
        </button>
        {roleOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setRoleOpen(false)} />
            <div role="menu" className="slide-in absolute right-0 z-40 mt-2 w-80 rounded-xl border border-line-2 bg-panel p-1.5 shadow-2xl">
              <div className="px-2.5 pb-2 pt-1.5 text-[11px] text-ink-3">Switch persona to explore role-based access (RBAC)</div>
              {ROLES.map((r) => (
                <button
                  key={r}
                  role="menuitem"
                  onClick={() => {
                    setRole(r);
                    setRoleOpen(false);
                    navigate(r === "Developer" ? "/portal" : "/");
                  }}
                  className={cx("flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-panel-2", state.user.role === r && "bg-brand/10")}
                >
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-line-2 text-[10px] font-semibold">
                    {PERSONAS[r].name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {r} {state.user.role === r && <Check size={13} className="text-brand-2" />}
                    </div>
                    <div className="text-[11px] text-ink-3">
                      {PERSONAS[r].name} · {ROLE_DESCRIPTIONS[r]}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

function GlobalSearch({ onPick }: { onPick: (id: string) => void }) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pool = state.user.role === "Developer" ? state.apis.filter((a) => a.stage === "published" || a.stage === "deprecated") : state.apis;
    if (!s) return [];
    return pool.filter((a) => [a.name, a.slug, a.basePath, a.owner, ...a.tags].join(" ").toLowerCase().includes(s)).slice(0, 7);
  }, [q, state.apis, state.user.role]);

  return (
    <div className="relative w-full max-w-xs">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            onPick(results[0].id);
            setQ("");
            ref.current?.blur();
          }
          if (e.key === "Escape") ref.current?.blur();
        }}
        placeholder={`Search ${state.apis.length} APIs…`}
        aria-label="Search APIs"
        className="focus-ring h-8 w-full rounded-lg border border-line bg-bg pl-8 pr-12 text-sm placeholder:text-ink-3 focus:border-brand"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1 text-[10px] text-ink-3 sm:block">Ctrl K</kbd>
      {open && q && (
        <div className="absolute z-40 mt-1.5 w-full rounded-lg border border-line-2 bg-panel p-1 shadow-2xl">
          {results.length === 0 && <div className="px-3 py-2 text-xs text-ink-3">No APIs match “{q}”</div>}
          {results.map((a) => (
            <button
              key={a.id}
              onMouseDown={() => {
                onPick(a.id);
                setQ("");
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left hover:bg-panel-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm">{a.name}</div>
                <div className="mono truncate text-[11px] text-ink-3">{a.basePath}</div>
              </div>
              <StageBadge stage={a.stage} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
