export type Env = "dev" | "staging" | "production";
export const ENVS: Env[] = ["dev", "staging", "production"];

export type Role = "Platform Admin" | "API Owner" | "Approver" | "Developer" | "Auditor";
export const ROLES: Role[] = ["Platform Admin", "API Owner", "Approver", "Developer", "Auditor"];

export type Stage = "draft" | "review" | "approved" | "published" | "deprecated" | "retired";
export const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: "draft", label: "Draft", hint: "Design the spec, clone or import OpenAPI" },
  { key: "review", label: "Review", hint: "Automated naming & policy checks" },
  { key: "approved", label: "Approve", hint: "Approval workflow & change management" },
  { key: "published", label: "Publish", hint: "Promote across dev, staging, production" },
  { key: "deprecated", label: "Deprecate", hint: "Sunset on a schedule" },
  { key: "retired", label: "Retire", hint: "Archived, history retained" },
];

export type Protocol = "REST" | "SOAP" | "GraphQL" | "gRPC" | "WebSocket" | "Async";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Endpoint {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  requestBody?: string;
  responseBody: string;
  status: number;
  scope?: string;
}

export interface ApiVersion {
  version: string;
  createdAt: string;
  notes: string;
}

export interface Api {
  id: string;
  name: string;
  slug: string;
  description: string;
  owner: string;
  protocol: Protocol;
  basePath: string;
  classification: "public" | "partner" | "internal";
  tags: string[];
  stage: Stage;
  versions: ApiVersion[];
  activeVersion: string;
  /** version deployed per environment (absent = not deployed) */
  deployments: Partial<Record<Env, string>>;
  policyTemplateId: string | null;
  endpoints: Endpoint[];
  slaTarget: number;
  sunsetDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type RouteStrategy = "Direct" | "Canary" | "Blue-Green" | "Weighted";

export interface Route {
  id: string;
  apiId: string;
  path: string;
  upstream: string;
  strategy: RouteStrategy;
  stableVersion: string;
  candidateVersion: string | null;
  candidateWeight: number;
  /** Blue-green: which color is live */
  liveColor: "blue" | "green";
  rateLimit: number;
  cacheTtl: number;
  compression: boolean;
  cors: boolean;
  retries: number;
  timeoutMs: number;
  circuitThreshold: number;
  circuitState: "Closed" | "Open" | "Half-open";
  transforms: string[];
  status: "Healthy" | "Throttling" | "Degraded";
}

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  version: number;
  authMethod: "oauth2" | "oidc" | "api_key" | "jwt" | "saml" | "mtls" | "ldap";
  tokenValidation: "jwt" | "introspection" | "none";
  fallback: "mtls" | "api_key" | "none";
  authzModel: "rbac" | "scope" | "claims";
  scopes: string[];
  rateLimitPerMin: number;
  quotaPerDay: number;
  geoRestrictions: string[];
  ipAllow: string[];
  ipDeny: string[];
  botProtection: boolean;
  waf: boolean;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  value: string;
  env: "sandbox" | "production";
  createdAt: string;
  status: "active" | "revoked";
}

export interface ConsumerApp {
  id: string;
  name: string;
  org: string;
  description: string;
  subscriptions: { apiId: string; plan: "Sandbox" | "Standard" | "Enterprise"; status: "active" | "pending" }[];
  keys: ApiKey[];
  quotaPerDay: number;
  createdAt: string;
}

export type ApprovalType = "Publish" | "Promote to production" | "New version" | "Deprecate" | "Policy change" | "Subscription";

export interface ApprovalRequest {
  id: string;
  apiId: string;
  type: ApprovalType;
  detail: string;
  requestedBy: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  decidedBy?: string;
  decidedAt?: string;
  comment?: string;
  /** payload used when approved */
  payload?: Record<string, string>;
}

export type AuditCategory = "config" | "security" | "lifecycle" | "access" | "deploy" | "governance";

export interface AuditEvent {
  id: string;
  ts: string;
  actor: string;
  role: Role;
  action: string;
  target: string;
  category: AuditCategory;
  env: Env | "global";
  hash: string;
  prevHash: string;
}

export interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  apiId: string | null;
  ts: string;
  status: "open" | "acknowledged" | "resolved";
  routedTo: string;
}

export interface AlertRule {
  id: string;
  name: string;
  apiId: string | "*";
  metric: "p95_latency" | "error_rate" | "availability" | "rpm";
  op: ">" | "<";
  threshold: number;
  channel: string;
  enabled: boolean;
}

export interface GatewayNode {
  id: string;
  name: string;
  region: string;
  cluster: string;
  env: Env;
  mode: "Cloud" | "On-premise" | "Hybrid edge";
  provider: "AWS" | "Azure" | "Google Cloud" | "Data center";
  status: "healthy" | "degraded" | "draining";
  version: string;
  cpu: number;
}

export interface Release {
  id: string;
  apiId: string;
  version: string;
  env: Env;
  ts: string;
  by: string;
  kind: "deploy" | "rollback" | "promote";
}

export interface Integration {
  id: string;
  name: string;
  category: "Identity" | "ITSM" | "Observability" | "Cloud" | "CI/CD" | "Messaging";
  connected: boolean;
}

export interface GovernanceRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: "blocking" | "warning";
}

export interface Secret {
  id: string;
  name: string;
  kind: "TLS certificate" | "Client secret" | "Signing key";
  expiresAt: string;
  usedBy: number;
}

export interface User {
  name: string;
  email: string;
  role: Role;
  team: string;
}

export interface AppState {
  user: User;
  env: Env;
  apis: Api[];
  routes: Route[];
  policies: PolicyTemplate[];
  apps: ConsumerApp[];
  approvals: ApprovalRequest[];
  audit: AuditEvent[];
  alerts: Alert[];
  alertRules: AlertRule[];
  nodes: GatewayNode[];
  releases: Release[];
  integrations: Integration[];
  rules: GovernanceRule[];
  secrets: Secret[];
}
