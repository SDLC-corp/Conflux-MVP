import type { Api, GovernanceRule, Role } from "../data/types";

export type Permission =
  | "api.edit"
  | "api.submit"
  | "approve"
  | "gateway.edit"
  | "policy.edit"
  | "deploy"
  | "portal.use"
  | "audit.export"
  | "admin";

const MATRIX: Record<Role, Permission[]> = {
  "Platform Admin": ["api.edit", "api.submit", "approve", "gateway.edit", "policy.edit", "deploy", "portal.use", "audit.export", "admin"],
  "API Owner": ["api.edit", "api.submit", "gateway.edit", "deploy", "portal.use"],
  Approver: ["approve", "portal.use", "audit.export"],
  Developer: ["portal.use"],
  Auditor: ["audit.export"],
};

export const can = (role: Role, p: Permission) => MATRIX[role].includes(p);

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  "Platform Admin": "Full control of gateway, security, governance and deployments",
  "API Owner": "Designs APIs, manages routes and requests promotions",
  Approver: "Reviews and approves lifecycle and change requests",
  Developer: "API consumer — portal, sandbox and credentials",
  Auditor: "Read-only access with audit trail and report exports",
};

export interface CheckResult {
  rule: GovernanceRule;
  passed: boolean;
  message: string;
}

export function runGovernanceChecks(api: Api, rules: GovernanceRule[]): CheckResult[] {
  return rules
    .filter((r) => r.enabled)
    .map((rule) => {
      let passed = true;
      let message = "OK";
      switch (rule.id) {
        case "g1":
          passed = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(api.slug);
          message = passed ? `"${api.slug}" is kebab-case` : `"${api.slug}" is not kebab-case`;
          break;
        case "g2":
          passed = api.protocol !== "REST" || /^\/v\d+(\/|$)/.test(api.basePath);
          message = passed ? `Base path ${api.basePath}` : `Base path "${api.basePath}" lacks a /v{n} prefix`;
          break;
        case "g3":
          passed = !!api.policyTemplateId;
          message = passed ? "Policy template attached" : "No security policy template attached";
          break;
        case "g4":
          passed = api.versions.every((v) => /^\d+\.\d+\.\d+$/.test(v.version));
          message = passed ? "All versions are semver" : "One or more versions are not semver";
          break;
        case "g5":
          passed = api.endpoints.length > 0 && api.endpoints.every((e) => e.summary.trim().length > 0);
          message = passed ? `${api.endpoints.length} documented endpoint(s)` : "Missing endpoints or summaries";
          break;
        case "g6":
          passed = api.description.trim().length >= 30;
          message = passed ? "Description OK" : `Description is ${api.description.trim().length} chars (min 30)`;
          break;
        case "g7":
          passed = api.owner.trim().length > 0;
          message = passed ? `Owned by ${api.owner}` : "No owning team";
          break;
      }
      return { rule, passed, message };
    });
}

export const blockingFailures = (results: CheckResult[]) =>
  results.filter((r) => !r.passed && r.rule.severity === "blocking");
