import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createSeed } from "./data/seed";
import type {
  Alert,
  AlertRule,
  Api,
  ApprovalType,
  AppState,
  AuditCategory,
  ConsumerApp,
  Env,
  PolicyTemplate,
  Role,
  Route,
  User,
} from "./data/types";
import { blockingFailures, runGovernanceChecks, type CheckResult } from "./lib/rules";
import { bumpVersion, hash, randomKey, uid } from "./lib/util";

const STORAGE_KEY = "conflux-mvp-state-v1";

export const PERSONAS: Record<Role, User> = {
  "Platform Admin": { name: "Avery Chen", email: "avery.chen@acme.io", role: "Platform Admin", team: "Platform Engineering" },
  "API Owner": { name: "Sam Rivera", email: "sam.rivera@acme.io", role: "API Owner", team: "Payments Platform" },
  Approver: { name: "Morgan Diaz", email: "morgan.diaz@acme.io", role: "Approver", team: "Architecture Review Board" },
  Developer: { name: "Riley Brooks", email: "riley@acme-retail.com", role: "Developer", team: "Acme Retail" },
  Auditor: { name: "Casey Nguyen", email: "casey.nguyen@acme.io", role: "Auditor", team: "Risk & Compliance" },
};

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    /* ignore corrupt storage */
  }
  return createSeed();
}

type Toast = { id: string; kind: "success" | "error" | "info"; text: string };

interface Store {
  state: AppState;
  tick: number;
  toasts: Toast[];
  toast: (text: string, kind?: Toast["kind"]) => void;
  setRole: (r: Role) => void;
  setEnv: (e: Env) => void;
  resetDemo: () => void;
  apiById: (id: string | null | undefined) => Api | undefined;

  createApi: (a: Omit<Api, "id" | "createdAt" | "updatedAt" | "stage" | "deployments">) => string;
  updateApi: (id: string, patch: Partial<Api>, action?: string) => void;
  submitForReview: (id: string) => CheckResult[];
  deployApi: (id: string, env: Env) => void;
  createVersion: (id: string, kind: "major" | "minor" | "patch", notes: string) => string;
  rollback: (id: string, env: Env) => void;
  deprecateApi: (id: string, sunsetDate: string) => void;
  retireApi: (id: string) => void;
  decideApproval: (id: string, approve: boolean, comment: string) => void;
  requestApproval: (apiId: string, type: ApprovalType, detail: string, payload?: Record<string, string>) => void;

  updateRoute: (id: string, patch: Partial<Route>, action: string) => void;
  createRoute: (r: Omit<Route, "id">) => void;
  deleteRoute: (id: string) => void;

  updatePolicy: (id: string, patch: Partial<PolicyTemplate>) => void;
  createPolicy: (p: Omit<PolicyTemplate, "id" | "version" | "updatedAt">) => string;

  createApp: (a: Pick<ConsumerApp, "name" | "description">) => string;
  generateKey: (appId: string, env: "sandbox" | "production") => string;
  revokeKey: (appId: string, keyId: string) => void;
  subscribe: (appId: string, apiId: string, plan: "Sandbox" | "Standard" | "Enterprise") => void;

  setAlertStatus: (id: string, status: Alert["status"]) => void;
  addAlertRule: (r: Omit<AlertRule, "id">) => void;
  toggleAlertRule: (id: string) => void;
  toggleIntegration: (id: string) => void;
  toggleGovRule: (id: string) => void;
  rotateSecret: (id: string) => void;
  logAudit: (action: string, target: string, category: AuditCategory, env?: Env | "global") => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const [tick, setTick] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const toast = useCallback((text: string, kind: Toast["kind"] = "success") => {
    const id = uid("t");
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  /** Apply a mutation and append a hash-chained audit event in the same update. */
  const commit = useCallback(
    (fn: (s: AppState) => AppState, audit?: { action: string; target: string; category: AuditCategory; env?: Env | "global" }) => {
      setState((prev) => {
        let next = fn(prev);
        if (audit) {
          const prevHash = next.audit[0]?.hash ?? "0000000000000000";
          const ev = {
            id: uid("au"),
            ts: new Date().toISOString(),
            actor: next.user.name,
            role: next.user.role,
            action: audit.action,
            target: audit.target,
            category: audit.category,
            env: audit.env ?? "global",
          };
          next = { ...next, audit: [{ ...ev, prevHash, hash: hash(prevHash + JSON.stringify(ev)) }, ...next.audit] };
        }
        return next;
      });
    },
    [],
  );

  const mapApi = (s: AppState, id: string, fn: (a: Api) => Api): AppState => ({
    ...s,
    apis: s.apis.map((a) => (a.id === id ? { ...fn(a), updatedAt: new Date().toISOString() } : a)),
  });

  const store = useMemo<Store>(() => {
    const get = () => stateRef.current;
    const apiById = (id: string | null | undefined) => get().apis.find((a) => a.id === id);
    const slugOf = (id: string) => apiById(id)?.slug ?? id;

    const deployNow = (s: AppState, apiId: string, env: Env, version: string, kind: "deploy" | "promote" | "rollback"): AppState => {
      const next = mapApi(s, apiId, (a) => ({
        ...a,
        deployments: { ...a.deployments, [env]: version },
        stage: a.stage === "approved" && env !== "dev" ? "published" : a.stage,
      }));
      return {
        ...next,
        releases: [{ id: uid("rl"), apiId, version, env, ts: new Date().toISOString(), by: s.user.name, kind }, ...next.releases],
      };
    };

    const requestApproval: Store["requestApproval"] = (apiId, type, detail, payload) => {
      commit(
        (s) => ({
          ...s,
          approvals: [
            { id: uid("apr"), apiId, type, detail, requestedBy: s.user.name, createdAt: new Date().toISOString(), status: "pending", payload },
            ...s.approvals,
          ],
        }),
        { action: `Requested approval: ${type}`, target: slugOf(apiId), category: "governance" },
      );
    };

    return {
      state,
      tick,
      toasts,
      toast,
      apiById,
      setRole: (role) => {
        setState((s) => ({ ...s, user: PERSONAS[role] }));
        toast(`Signed in as ${PERSONAS[role].name} (${role})`, "info");
      },
      setEnv: (env) => setState((s) => ({ ...s, env })),
      resetDemo: () => {
        localStorage.removeItem(STORAGE_KEY);
        setState(createSeed());
        toast("Demo data reset", "info");
      },

      createApi: (a) => {
        const id = uid("api");
        const now = new Date().toISOString();
        commit(
          (s) => ({ ...s, apis: [{ ...a, id, stage: "draft", deployments: {}, createdAt: now, updatedAt: now }, ...s.apis] }),
          { action: "Created API draft", target: a.slug, category: "lifecycle" },
        );
        return id;
      },
      updateApi: (id, patch, action = "Updated API definition") =>
        commit((s) => mapApi(s, id, (a) => ({ ...a, ...patch })), { action, target: slugOf(id), category: "config" }),

      submitForReview: (id) => {
        const api = apiById(id)!;
        const results = runGovernanceChecks(api, get().rules);
        const failures = blockingFailures(results);
        const passed = results.filter((r) => r.passed).length;
        if (failures.length) {
          commit((s) => s, {
            action: `Review blocked: ${failures.length} blocking check(s) failed`,
            target: api.slug,
            category: "governance",
          });
          toast(`${failures.length} blocking governance check(s) failed`, "error");
          return results;
        }
        commit(
          (s) => ({
            ...mapApi(s, id, (a) => ({ ...a, stage: "review" })),
            approvals: [
              {
                id: uid("apr"),
                apiId: id,
                type: "Publish",
                detail: `Publish ${api.name} v${api.activeVersion} to the catalog`,
                requestedBy: s.user.name,
                createdAt: new Date().toISOString(),
                status: "pending",
              },
              ...s.approvals,
            ],
          }),
          { action: `Submitted for review (${passed}/${results.length} checks passed)`, target: api.slug, category: "lifecycle" },
        );
        toast("Submitted for review — approval request created");
        return results;
      },

      deployApi: (id, env) => {
        const api = apiById(id)!;
        const version = api.activeVersion;
        if (env === "production") {
          const already = get().approvals.some((r) => r.apiId === id && r.type === "Promote to production" && r.status === "pending");
          if (already) return toast("A production promotion is already awaiting approval", "info");
          requestApproval(id, "Promote to production", `Promote ${api.slug} v${version} → production`, { env, version });
          toast("Production promotion requires approval — request submitted", "info");
          return;
        }
        commit((s) => deployNow(s, id, env, version, env === "dev" ? "deploy" : "promote"), {
          action: `Deployed v${version}`,
          target: api.slug,
          category: "deploy",
          env,
        });
        toast(`${api.slug} v${version} deployed to ${env}`);
      },

      createVersion: (id, kind, notes) => {
        const api = apiById(id)!;
        const latest = api.versions[api.versions.length - 1].version;
        const v = bumpVersion(latest, kind);
        commit(
          (s) => {
            const next = mapApi(s, id, (a) => ({
              ...a,
              versions: [...a.versions, { version: v, createdAt: new Date().toISOString(), notes }],
              activeVersion: v,
            }));
            return deployNow(next, id, "dev", v, "deploy");
          },
          { action: `Created version ${v} and deployed to dev`, target: api.slug, category: "lifecycle", env: "dev" },
        );
        toast(`Version ${v} created and deployed to dev`);
        return v;
      },

      rollback: (id, env) => {
        const api = apiById(id)!;
        const cur = api.deployments[env];
        const idx = api.versions.findIndex((v) => v.version === cur);
        if (idx <= 0) return toast("No earlier version to roll back to", "error");
        const prev = api.versions[idx - 1].version;
        commit(
          (s) => {
            let next = deployNow(s, id, env, prev, "rollback");
            // reset canary routes pointing at the rolled-back version
            next = {
              ...next,
              routes: next.routes.map((r) =>
                r.apiId === id && r.candidateVersion === cur ? { ...r, candidateWeight: 0, stableVersion: prev, strategy: "Direct", candidateVersion: null } : r,
              ),
            };
            return next;
          },
          { action: `Rolled back ${cur} → ${prev}`, target: api.slug, category: "deploy", env },
        );
        toast(`Rolled back ${api.slug} in ${env} to v${prev}`);
      },

      deprecateApi: (id, sunsetDate) => {
        commit((s) => mapApi(s, id, (a) => ({ ...a, stage: "deprecated", sunsetDate })), {
          action: `Deprecated (sunset ${new Date(sunsetDate).toLocaleDateString()})`,
          target: slugOf(id),
          category: "lifecycle",
        });
        toast("API deprecated — consumers will see the sunset notice");
      },
      retireApi: (id) => {
        commit(
          (s) => ({
            ...mapApi(s, id, (a) => ({ ...a, stage: "retired", deployments: {} })),
            routes: s.routes.filter((r) => r.apiId !== id),
          }),
          { action: "Retired and archived (routes removed, history retained)", target: slugOf(id), category: "lifecycle" },
        );
        toast("API retired and archived");
      },

      requestApproval,

      decideApproval: (id, approve, comment) => {
        const req = get().approvals.find((r) => r.id === id);
        if (!req) return;
        commit(
          (s) => {
            let next: AppState = {
              ...s,
              approvals: s.approvals.map((r) =>
                r.id === id
                  ? { ...r, status: approve ? "approved" : "rejected", decidedBy: s.user.name, decidedAt: new Date().toISOString(), comment }
                  : r,
              ),
            };
            if (!approve) {
              if (req.type === "Publish") next = mapApi(next, req.apiId, (a) => ({ ...a, stage: "draft" }));
              if (req.type === "Subscription" && req.payload?.appId)
                next = {
                  ...next,
                  apps: next.apps.map((a) =>
                    a.id === req.payload!.appId ? { ...a, subscriptions: a.subscriptions.filter((x) => x.apiId !== req.apiId) } : a,
                  ),
                };
              return next;
            }
            switch (req.type) {
              case "Publish":
                next = mapApi(next, req.apiId, (a) => ({ ...a, stage: "approved" }));
                break;
              case "Promote to production": {
                const version = req.payload?.version ?? next.apis.find((a) => a.id === req.apiId)!.activeVersion;
                next = deployNow(next, req.apiId, "production", version, "promote");
                next = {
                  ...next,
                  routes: next.routes.map((r) =>
                    r.apiId === req.apiId && r.candidateVersion === version
                      ? { ...r, stableVersion: version, candidateVersion: null, candidateWeight: 0, strategy: "Direct" }
                      : r,
                  ),
                };
                break;
              }
              case "Subscription":
                next = {
                  ...next,
                  apps: next.apps.map((a) =>
                    a.id === req.payload?.appId
                      ? { ...a, subscriptions: a.subscriptions.map((x) => (x.apiId === req.apiId ? { ...x, status: "active" } : x)) }
                      : a,
                  ),
                };
                break;
            }
            return next;
          },
          {
            action: `${approve ? "Approved" : "Rejected"} ${req.type.toLowerCase()} request${comment ? ` — "${comment}"` : ""}`,
            target: slugOf(req.apiId),
            category: "governance",
            env: req.type === "Promote to production" ? "production" : "global",
          },
        );
        toast(approve ? "Request approved" : "Request rejected", approve ? "success" : "info");
      },

      updateRoute: (id, patch, action) => {
        const r = get().routes.find((x) => x.id === id);
        commit((s) => ({ ...s, routes: s.routes.map((x) => (x.id === id ? { ...x, ...patch } : x)) }), {
          action,
          target: r?.path ?? id,
          category: "config",
          env: get().env,
        });
      },
      createRoute: (r) => {
        commit((s) => ({ ...s, routes: [...s.routes, { ...r, id: uid("rt") }] }), {
          action: `Created route → ${r.upstream}`,
          target: r.path,
          category: "config",
          env: get().env,
        });
        toast(`Route ${r.path} created`);
      },
      deleteRoute: (id) => {
        const r = get().routes.find((x) => x.id === id);
        commit((s) => ({ ...s, routes: s.routes.filter((x) => x.id !== id) }), {
          action: "Deleted route",
          target: r?.path ?? id,
          category: "config",
          env: get().env,
        });
        toast("Route deleted", "info");
      },

      updatePolicy: (id, patch) => {
        const p = get().policies.find((x) => x.id === id)!;
        commit(
          (s) => ({
            ...s,
            policies: s.policies.map((x) => (x.id === id ? { ...x, ...patch, version: x.version + 1, updatedAt: new Date().toISOString() } : x)),
          }),
          { action: `Updated policy template → v${p.version + 1}`, target: p.name, category: "security" },
        );
        toast(`Policy "${p.name}" saved as v${p.version + 1}`);
      },
      createPolicy: (p) => {
        const id = uid("pol");
        commit((s) => ({ ...s, policies: [...s.policies, { ...p, id, version: 1, updatedAt: new Date().toISOString() }] }), {
          action: "Created policy template",
          target: p.name,
          category: "security",
        });
        toast(`Policy template "${p.name}" created`);
        return id;
      },

      createApp: (a) => {
        const id = uid("app");
        commit(
          (s) => ({
            ...s,
            apps: [
              ...s.apps,
              { ...a, id, org: s.user.team, subscriptions: [], keys: [], quotaPerDay: 100_000, createdAt: new Date().toISOString() },
            ],
          }),
          { action: "Registered application", target: a.name, category: "access" },
        );
        toast(`Application "${a.name}" registered`);
        return id;
      },
      generateKey: (appId, env) => {
        const value = randomKey(env === "sandbox" ? "cfx_test" : "cfx_live");
        const app = get().apps.find((a) => a.id === appId);
        commit(
          (s) => ({
            ...s,
            apps: s.apps.map((a) =>
              a.id === appId ? { ...a, keys: [...a.keys, { id: uid("k"), value, env, createdAt: new Date().toISOString(), status: "active" }] } : a,
            ),
          }),
          { action: `Generated ${env} key`, target: app?.name ?? appId, category: "access" },
        );
        return value;
      },
      revokeKey: (appId, keyId) => {
        const app = get().apps.find((a) => a.id === appId);
        commit(
          (s) => ({
            ...s,
            apps: s.apps.map((a) => (a.id === appId ? { ...a, keys: a.keys.map((k) => (k.id === keyId ? { ...k, status: "revoked" } : k)) } : a)),
          }),
          { action: "Revoked API key", target: app?.name ?? appId, category: "access" },
        );
        toast("Key revoked", "info");
      },
      subscribe: (appId, apiId, plan) => {
        const app = get().apps.find((a) => a.id === appId)!;
        if (app.subscriptions.some((x) => x.apiId === apiId)) return toast("Already subscribed", "info");
        const status = plan === "Sandbox" ? "active" : "pending";
        commit(
          (s) => {
            let next: AppState = {
              ...s,
              apps: s.apps.map((a) => (a.id === appId ? { ...a, subscriptions: [...a.subscriptions, { apiId, plan, status }] } : a)),
            };
            if (status === "pending") {
              next = {
                ...next,
                approvals: [
                  {
                    id: uid("apr"),
                    apiId,
                    type: "Subscription",
                    detail: `${app.name} requests ${plan} access to ${slugOf(apiId)}`,
                    requestedBy: s.user.name,
                    createdAt: new Date().toISOString(),
                    status: "pending",
                    payload: { appId },
                  },
                  ...next.approvals,
                ],
              };
            }
            return next;
          },
          { action: `Subscribed ${app.name} (${plan})`, target: slugOf(apiId), category: "access" },
        );
        toast(status === "active" ? "Subscribed — sandbox access is active" : "Subscription requested — pending approval");
      },

      setAlertStatus: (id, status) => {
        const a = get().alerts.find((x) => x.id === id);
        commit((s) => ({ ...s, alerts: s.alerts.map((x) => (x.id === id ? { ...x, status } : x)) }), {
          action: `Alert ${status}`,
          target: a?.title ?? id,
          category: "config",
          env: "production",
        });
      },
      addAlertRule: (r) => {
        commit((s) => ({ ...s, alertRules: [...s.alertRules, { ...r, id: uid("ar") }] }), {
          action: "Created alert rule",
          target: r.name,
          category: "config",
        });
        toast(`Alert rule "${r.name}" created`);
      },
      toggleAlertRule: (id) => commit((s) => ({ ...s, alertRules: s.alertRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) })),
      toggleIntegration: (id) => {
        const i = get().integrations.find((x) => x.id === id)!;
        commit((s) => ({ ...s, integrations: s.integrations.map((x) => (x.id === id ? { ...x, connected: !x.connected } : x)) }), {
          action: i.connected ? "Disconnected integration" : "Connected integration",
          target: i.name,
          category: "config",
        });
        toast(`${i.name} ${i.connected ? "disconnected" : "connected"}`, i.connected ? "info" : "success");
      },
      toggleGovRule: (id) => {
        const r = get().rules.find((x) => x.id === id)!;
        commit((s) => ({ ...s, rules: s.rules.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)) }), {
          action: `${r.enabled ? "Disabled" : "Enabled"} governance standard`,
          target: r.name,
          category: "governance",
        });
      },
      rotateSecret: (id) => {
        const sec = get().secrets.find((x) => x.id === id)!;
        commit(
          (s) => ({
            ...s,
            secrets: s.secrets.map((x) => (x.id === id ? { ...x, expiresAt: new Date(Date.now() + 86400000 * 365).toISOString() } : x)),
          }),
          { action: "Rotated secret", target: sec.name, category: "security" },
        );
        toast(`${sec.name} rotated — valid for 365 days`);
      },
      logAudit: (action, target, category, env) => commit((s) => s, { action, target, category, env }),
    };
  }, [state, tick, toasts, toast, commit]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}
