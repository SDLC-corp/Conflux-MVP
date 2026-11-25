<div align="center">

<img src="public/logo.svg" width="72" alt="Conflux logo" />

# Conflux MVP: Open-Source Enterprise API Management Platform

**Every API. One control plane.**

An API gateway console, developer portal, API lifecycle manager and API governance tool in one React + TypeScript app.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
![Status](https://img.shields.io/badge/status-MVP-6366f1)

[Features](#-features) · [Screenshots](#-screenshots) · [Workflows](#-key-workflows) · [Product vs MVP](#-conflux-product-vs-this-mvp) · [Quick start](#-quick-start) · [Architecture](#-architecture)

<img src="docs/screenshots/01-overview.png" alt="Conflux API management dashboard showing requests per minute, P95 latency, error rate, SLA compliance and live gateway traffic" width="100%" />

</div>

---

## About

**Conflux MVP** is a working, clickable minimum viable product of [**Conflux by SDLC Corp**](https://sdlccorp.com/products/conflux/), an enterprise **API management platform**. It shows how one console can **publish, secure, monitor, govern and scale APIs** across cloud, on-premise and hybrid deployments.

It is built for:

- **Platform teams and architects** evaluating an API control plane.
- **API product owners** who need an **API lifecycle** (draft → review → approve → publish → version → retire).
- **Security, risk and audit teams** who need **API governance**, **policy-as-code** and a **tamper-evident audit trail**.
- **Developers (API consumers)** who want a self-service **developer portal** with a sandbox and instant API keys.

It brings together the pieces teams usually buy separately: an **API gateway** with canary deployment, blue-green deployment, traffic splitting, rate limiting and circuit breakers; **API security** with OAuth 2.0, OpenID Connect, JWT, mTLS and RBAC; **API analytics and monitoring** with SLA tracking and distributed tracing; and an **API catalog** with OpenAPI (Swagger) docs, an API sandbox and API key management. Teams comparing Kong, Apigee, MuleSoft, Azure API Management or AWS API Gateway can use it to see what a single hybrid cloud and on-premise API control plane looks like.

The whole app runs in the browser with realistic demo data, so you can try it in under a minute with no backend.

---

## ✨ Features

### 🔀 API Gateway & traffic management
- Route table for **REST, SOAP, GraphQL, gRPC, WebSocket and async APIs**
- **Progressive delivery**: canary releases, weighted traffic splitting, blue-green deployments and version routing
- **Resilience policies**: retries, timeouts and a circuit breaker on each route
- **Rate limiting**, response caching, compression and CORS
- **Transformation engine**: header, URL and payload transform rules
- Animated **"life of a request"** trace through authenticate → policies → transform → route → upstream

### 🛡️ API security
- Reusable, versioned **security policy templates**
- Authentication: **OAuth 2.0, OpenID Connect, JWT, API keys, SAML, mTLS, LDAP**
- Authorization: **RBAC**, scope-based and claims-based
- Threat protection: **rate limits, quotas, geo restrictions, IP allow/deny lists, WAF and bot protection**
- Live **policy-as-code (YAML)** view
- Certificate and secret expiry tracking, with rotation

### 🔁 API lifecycle management
- Six-stage pipeline: **Draft → Review → Approve → Publish → Deprecate → Retire**
- Create an API from scratch, **clone** an existing one, or **import an OpenAPI / Swagger spec**
- **Automated governance checks** at review (naming standards, versioning, policy attached and more)
- Environment promotion **dev → staging → production**, with **change approval** for production
- Side-by-side **API versioning** and **one-click rollback**

### 📜 API governance & compliance
- Approval workflows for publishing, production promotion and subscriptions
- Toggleable **naming standards and policy checks** (blocking or warning)
- **Hash-chained, tamper-evident audit log** with one-click integrity verification
- Audit export (CSV/JSON) and a **compliance evidence pack**

### 📈 API analytics & monitoring
- Real-time dashboards: requests/min, **P95 latency**, error rate and availability
- **SLA monitoring** with error budgets and CSV reports
- **Incident dashboard** (acknowledge/resolve) and **alert rules** checked against live metrics
- **Distributed tracing** waterfall
- Consumer analytics: top consumers, failed requests and usage by region

### 👩‍💻 Developer portal
- Searchable **API catalog**
- OpenAPI documentation and spec download
- Interactive **sandbox "Try it"** console with realistic `401`, `403`, `400` and `2xx` responses
- **SDK code samples** (cURL, JavaScript, Python, Java)
- **Self-service API keys** (sandbox and production), subscriptions with plans, and per-app usage and quota

### ☁️ Deployment & integrations
- Cloud (AWS, Azure, Google Cloud), **on-premise** and **hybrid edge** gateway nodes
- Release history, GitOps-style config export and a sample CLI view
- Integration catalog: Okta, Azure AD, Keycloak, LDAP, ServiceNow, Jira, Datadog, Prometheus, Grafana, Splunk, GitHub, GitLab, Azure DevOps, Jenkins, Kafka and RabbitMQ

### 👥 Role-based access control
Five personas change what you see and can do: **Platform Admin, API Owner, Approver, Developer and Auditor**.

---

## 📸 Screenshots

### Control plane overview
Live KPIs, gateway traffic by status class, the lifecycle pipeline, pending approvals and active alerts.

![API management dashboard overview](docs/screenshots/01-overview.png)

### API lifecycle management

| APIs by lifecycle stage | API detail with stage stepper |
|---|---|
| ![API lifecycle pipeline with six stages](docs/screenshots/02-apis-lifecycle.png) | ![API detail page with governance standards](docs/screenshots/03-api-detail.png) |
| **Environment promotion and rollback** | **Governance checks block a non-compliant API** |
| ![Dev, staging and production promotion](docs/screenshots/04-api-environments.png) | ![Automated API governance checks](docs/screenshots/05-governance-checks-blocked.png) |

**Import an OpenAPI / Swagger specification**

![Import OpenAPI spec to create an API draft](docs/screenshots/06-import-openapi.png)

### API gateway

| Request trace through the gateway | Canary release and resilience settings |
|---|---|
| ![API gateway request pipeline trace](docs/screenshots/07-gateway-request-trace.png) | ![Canary deployment traffic split and circuit breaker](docs/screenshots/08-gateway-canary-drawer.png) |

### API security

| Policy template editor | Policy as code (YAML) |
|---|---|
| ![API security policy template editor](docs/screenshots/09-security-policies.png) | ![API security policy as YAML](docs/screenshots/10-security-policy-yaml.png) |

### Monitoring & analytics

| Real-time dashboards | SLA monitoring |
|---|---|
| ![API monitoring dashboard](docs/screenshots/11-monitoring-dashboards.png) | ![API SLA monitoring with error budget](docs/screenshots/12-monitoring-sla.png) |
| **Incidents and alert rules** | **Distributed tracing** |
| ![API incident dashboard and alert rules](docs/screenshots/13-monitoring-incidents.png) | ![Distributed tracing waterfall](docs/screenshots/14-monitoring-traces.png) |

### Governance & audit

| Approval workflow | Tamper-evident audit trail |
|---|---|
| ![API approval workflow queue](docs/screenshots/15-governance-approvals.png) | ![Hash-chained audit log verified](docs/screenshots/16-governance-audit-trail.png) |

### Deployment & role-based access

| Hybrid deployment and gateway nodes | Persona switcher (RBAC) |
|---|---|
| ![Cloud, on-premise and hybrid API gateway deployment](docs/screenshots/17-deployment.png) | ![Role-based access control persona switcher](docs/screenshots/18-rbac-persona-switcher.png) |

### Developer portal

| API catalog | API documentation |
|---|---|
| ![Developer portal API catalog](docs/screenshots/19-portal-catalog.png) | ![API reference documentation](docs/screenshots/20-portal-docs.png) |
| **Sandbox "Try it" console** | **SDK samples** |
| ![API sandbox playground returning 201 Created](docs/screenshots/21-portal-sandbox-try-it.png) | ![SDK code samples](docs/screenshots/22-portal-sdks.png) |
| **Apps, API keys and usage** | **Mobile-responsive portal** |
| ![Self-service API key management](docs/screenshots/23-apps-and-keys.png) | <img src="docs/screenshots/24-mobile-portal.png" alt="Mobile developer portal" width="260" /> |

---

## 🔄 Key workflows

### 1. API lifecycle: from draft to production

```mermaid
flowchart LR
    A[Draft<br/>design, clone or<br/>import OpenAPI] -->|Submit for review| B{Governance<br/>checks}
    B -->|blocking failure| A
    B -->|all blocking checks pass| C[Review<br/>approval request created]
    C -->|Approver rejects| A
    C -->|Approver approves| D[Approved]
    D -->|Deploy| E[dev → staging]
    E -->|Promote| F{Change approval}
    F -->|approved| G[Production<br/>Published]
    G -->|New version| E
    G -->|Rollback| G
    G -->|Deprecate + sunset date| H[Deprecated]
    H -->|Retire| I[Retired<br/>routes removed, history kept]
```

**Try it:** open **APIs & Lifecycle → Loyalty Points API**, then select **Approve → Publish to staging → Promote to production**. Approve the change request in **Governance**.

### 2. Governance gate: blocking a non-compliant API

```mermaid
sequenceDiagram
    actor Owner as API Owner
    participant C as Conflux
    participant G as Governance engine
    participant A as Audit log
    Owner->>C: Submit "fraud-scoring" for review
    C->>G: Run 7 standards (slug, base path, policy, semver, docs…)
    G-->>C: ❌ "Security policy attached" failed (blocking)
    C->>A: Log "Review blocked"
    C-->>Owner: Show failing checks
    Owner->>C: Attach "PCI / Sensitive Data" template and resubmit
    G-->>C: ✅ All blocking checks pass
    C->>A: Log "Submitted for review" (hash-chained)
```

### 3. Progressive delivery: canary release

```mermaid
flowchart LR
    Client([Client]) --> GW[Conflux Gateway]
    GW --> Auth[Authenticate<br/>OAuth2 · JWT · mTLS]
    Auth --> Pol[Policies<br/>rate limit · quota · WAF]
    Pol --> Tx[Transform]
    Tx --> R{Route<br/>canary split}
    R -->|90%| S[v2.3.0 stable]
    R -->|10%| N[v2.4.0 canary]
```

**Try it:** open **API Gateway**, select **/v2/payments**, move the canary from 10% to 25% and **Apply to gateways**. Then select **Send test request** to watch one request travel the pipeline.

### 4. Developer onboarding: from zero to first API call

```mermaid
flowchart LR
    A[Browse API catalog] --> B[Read OpenAPI docs]
    B --> C[Register app]
    C --> D[Subscribe<br/>Sandbox = instant<br/>Standard/Enterprise = approval]
    D --> E[Generate sandbox key]
    E --> F[Try it in sandbox<br/>201 Created]
    F --> G[Production key after<br/>approved subscription]
```

**Try it:** switch to the **Developer** persona, open **Payments API → Try it · Sandbox** and select **Send request**.

### 5. Audit and compliance

```mermaid
flowchart LR
    X[Any change: config, security,<br/>deploy, access, approval] --> E[Audit event<br/>actor · role · env · target]
    E --> H["hash = H(prevHash + event)"]
    H --> L[(Append-only chain)]
    L --> V[Verify integrity]
    L --> R[CSV / JSON export]
    L --> P[Compliance evidence pack]
```

---

## ⚖️ Conflux product vs this MVP

This table compares the capabilities described on the [Conflux product page](https://sdlccorp.com/products/conflux/) with what this MVP implements.

**Legend:** ✅ Implemented & interactive · 🟡 Implemented with simulated data or behaviour · ❌ Not in the MVP

### API Gateway

| Capability (Conflux) | MVP | Notes |
|---|:-:|---|
| REST, SOAP, GraphQL, gRPC, WebSocket, async APIs | 🟡 | All protocols are modelled and configurable; no real traffic is proxied |
| Canary, blue-green, version routing, weighted splitting | ✅ | Full configuration UI; test requests follow the configured split |
| Circuit breakers, retries, timeouts | ✅ | Per-route configuration and circuit-state reset |
| Connection pooling | ❌ | Not included |
| Request/response transformation, URL rewriting | 🟡 | Rules are defined and audited but not executed |
| Response caching, compression, CORS | ✅ | Configuration only |
| Large payload support | ❌ | Not included |

### Security

| Capability (Conflux) | MVP | Notes |
|---|:-:|---|
| OAuth 2.0, OIDC, JWT, API keys, SAML, mTLS, LDAP, Active Directory | 🟡 | Selectable in policy templates; no identity provider is called |
| RBAC with resource-, scope- and claims-based permissions | ✅ | 5 role personas gate the UI; scopes and models set per policy |
| Rate limiting, throttling, quotas | ✅ | Configured per policy and route; a throttled route returns `429` in test requests |
| DDoS and bot protection, WAF integration | 🟡 | Toggles and blocked-request stats only |
| IP allow/deny lists, geo restrictions | ✅ | Editable per policy template |
| Encryption, certificate and secret management | 🟡 | Expiry tracking and rotation are simulated |
| Policy defined once, enforced everywhere | ✅ | Templates attach to many APIs; "Enforced on N APIs" count; versioned saves |

### Developer portal

| Capability (Conflux) | MVP | Notes |
|---|:-:|---|
| Self-service API catalog with search | ✅ | Search and protocol filters |
| OpenAPI docs, version history, sample code | ✅ | Custom docs renderer, spec download, changelog, 4-language samples |
| Interactive playground / sandbox | 🟡 | Validates key, subscription and JSON; responses are mocked |
| Sandbox keys, key generation, credential management | ✅ | Generate, reveal, copy and revoke |
| Subscription workflows | ✅ | Sandbox is instant; paid plans go through approval |
| SDK downloads | 🟡 | Install commands and snippets; no packages are generated |
| Per-consumer usage dashboards | 🟡 | Traffic, quota and errors from simulated data |

### Lifecycle & governance

| Capability (Conflux) | MVP | Notes |
|---|:-:|---|
| Draft, review, approve, publish, version, deprecate, retire | ✅ | Full state machine with guards |
| Clone existing API / import OpenAPI | ✅ | OpenAPI import accepts JSON (YAML is not supported yet) |
| Automated naming and policy checks | ✅ | 7 configurable standards, blocking or warning |
| Configurable approval workflows, change management | 🟡 | Built-in approval queue; no ServiceNow/Jira ticket is created |
| Environment promotion and one-click rollback | ✅ | dev → staging → production, with release history |
| Scheduled deprecation | 🟡 | Sunset date shown to consumers; retirement is manual |
| Policy templates, API classification | ✅ | Public, partner and internal |
| Immutable, tamper-evident audit trail | 🟡 | Real hash chain with verification, but stored in browser `localStorage` |
| Configurable log retention | ❌ | Not included |
| Audit export and compliance reports | ✅ | CSV/JSON audit export and a JSON evidence pack |

### Analytics & monitoring

| Capability (Conflux) | MVP | Notes |
|---|:-:|---|
| Real-time usage, latency, error and availability dashboards | 🟡 | Live-updating charts from a traffic simulator |
| Slice by API, consumer, geography | 🟡 | By API and consumer; geography is static demo data |
| SLA monitoring with alerts before breach | ✅ | Error budgets, CSV export, availability alert rules |
| Alerting and routing | 🟡 | Rules are evaluated live; no notifications are sent |
| Incident dashboard, node-level gateway status | ✅ | Acknowledge/resolve; node health and CPU |
| Distributed tracing | 🟡 | Synthetic trace waterfalls |
| Log aggregation | ❌ | Not included |
| Custom dashboards, scheduled report exports | ❌ | Reports export on demand only |

### Platform, deployment & integrations

| Capability (Conflux) | MVP | Notes |
|---|:-:|---|
| Cloud (AWS, Azure, GCP), on-premise, hybrid | 🟡 | Inventory and topology views; nothing is provisioned |
| Kubernetes/Docker, multi-region, multi-cluster | 🟡 | Shown as node, region and cluster metadata |
| Okta, Azure AD, ServiceNow, Jira, Datadog, GitHub, Kafka and more | 🟡 | Connect/disconnect toggles only |
| GitOps, IaC, config export/import, CLI | 🟡 | Config export works; CLI is illustrative; no import |
| Multi-tenant control plane | ❌ | Single demo tenant (`acme-corp`) |
| 99.9%+ availability, zero-downtime deployments | ❌ | Operational guarantees of the real platform; not applicable to a front-end MVP |
| 24×7 support, training, documentation | ❌ | Services offered by SDLC Corp |

**Summary:** every module on the Conflux product page has a working screen in this MVP. Configuration, workflows, RBAC, governance and the audit trail are fully interactive. Traffic, telemetry and third-party integrations are simulated in the browser.

---

## 🚀 Quick start

**Requirements:** Node.js 18+ and npm.

```bash
git clone <your-repo-url> conflux-mvp
cd conflux-mvp
npm install
npm run dev        # → http://localhost:5173
```

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |

Demo data and all your changes are saved in `localStorage`. Use the **↺** button in the top bar to reset.

### Five-minute demo script

1. **Governance gate:** APIs & Lifecycle → *Fraud Scoring* → **Submit for review**. It is blocked because no policy is attached. Attach one, save and resubmit.
2. **Lifecycle:** *Loyalty Points API* → **Approve → Publish to staging → Promote to production** → approve the request in **Governance**.
3. **Canary:** API Gateway → `/v2/payments` → set 25% → **Apply** → **Send test request**.
4. **Developer experience:** switch persona to **Developer** → Payments API → **Try it** → `201 Created`.
5. **Audit:** Governance → Audit trail → **Verify integrity** → export CSV.

---

## 🧱 Architecture

```
src/
├── data/
│   ├── types.ts        # Domain model: Api, Route, PolicyTemplate, ConsumerApp, AuditEvent…
│   └── seed.ts         # Demo tenant: 10 APIs, 6 routes, 3 policies, 7 gateway nodes…
├── lib/
│   ├── rules.ts        # RBAC permission matrix + governance check engine
│   ├── metrics.ts      # Deterministic traffic/latency simulator
│   └── util.ts         # Hashing, formatting, CSV export, key generation
├── store.tsx           # Central state, all actions, hash-chained audit log, persistence
├── components/
│   ├── Layout.tsx      # App shell, env switcher, persona switcher, Ctrl+K search
│   ├── ui.tsx          # Design system: Card, Button, Badge, Modal, Drawer, Table…
│   └── charts.tsx      # Recharts traffic & latency charts
└── pages/              # Overview, Apis, ApiDetail, Gateway, Security, Monitoring,
                        # Governance, Deployment, Portal, PortalApi, Apps
```

**Tech stack:** React 18 · TypeScript (strict) · Vite 5 · Tailwind CSS 4 · Recharts · React Router 6 · lucide-react.

**Design choices:**
- Data changes go through one `commit()` function, which appends the audit event in the same state update as the change, so the log can't drift from the data.
- Each audit event stores `hash(prevHash + event)`, so editing or deleting a past event breaks verification.
- The metrics simulator is deterministic per minute, so charts stay stable between renders but still move every 3 seconds.

### Path to production

| MVP layer | Production replacement |
|---|---|
| `store.tsx` actions | REST/GraphQL calls to a control-plane service (Postgres for config, append-only store for audit) |
| `lib/metrics.ts` | Gateway telemetry via OpenTelemetry → Prometheus / ClickHouse |
| Route & policy config | Pushed to a data-plane gateway (e.g. Envoy) via xDS or GitOps |
| Persona switcher | SSO via OIDC/SAML (Okta, Azure AD, Keycloak) with server-side RBAC |
| Sandbox responses | Mock server generated from OpenAPI examples |

---

## 🗺️ Roadmap

- [ ] Backend control-plane API and persistent multi-tenant storage
- [ ] YAML OpenAPI import and Swagger UI / Redoc rendering
- [ ] Real alert delivery (Slack, PagerDuty, ServiceNow)
- [ ] Custom dashboard builder and scheduled report exports
- [ ] Config import and GitOps sync
- [ ] Light theme

---

## 🔗 Links

- **Conflux product page:** https://sdlccorp.com/products/conflux/
- **Talk to sales / request a demo:** sales@sdlccorp.com

<sub>Conflux MVP is an open-source API management dashboard and React admin dashboard built with TypeScript, Vite and Tailwind CSS, covering API lifecycle management, API governance, API versioning, audit logs and compliance reporting for multi-tenant enterprise API programs. Built as an MVP of Conflux by SDLC Corp. Product names and trademarks belong to their respective owners.</sub>
