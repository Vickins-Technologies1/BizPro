import type { PlatformAdminPermission } from "@vbo/shared";

const PATH_PART = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}$/;
type ProxyRule = { method: string; pattern: RegExp; permission: PlatformAdminPermission };

const PROXY_RULES: ProxyRule[] = [
  { method: "GET", pattern: /^platform-admin\/dashboard$/, permission: "dashboard:view" },
  { method: "GET", pattern: /^platform-admin\/businesses(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159})?$/, permission: "businesses:view" },
  { method: "GET", pattern: /^platform-admin\/businesses\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}\/activity$/, permission: "businesses:view" },
  { method: "PATCH", pattern: /^platform-admin\/businesses\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}$/, permission: "businesses:manage" },
  { method: "POST", pattern: /^platform-admin\/businesses\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}\/(?:suspend|restore)$/, permission: "businesses:manage" },
  { method: "GET", pattern: /^platform-admin\/businesses\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}\/employees$/, permission: "employees:view" },
  { method: "POST", pattern: /^platform-admin\/businesses\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}\/employees$/, permission: "employees:manage" },
  { method: "PATCH", pattern: /^platform-admin\/businesses\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}\/employees\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}(?:\/(?:suspend|restore|reset-credentials))?$/, permission: "employees:manage" },
  { method: "DELETE", pattern: /^platform-admin\/businesses\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}\/employees\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}$/, permission: "employees:manage" },
  { method: "GET", pattern: /^platform-admin\/subscriptions(?:\/plans)?$/, permission: "subscriptions:view" },
  { method: "GET", pattern: /^platform-admin\/payments$/, permission: "payments:view" },
  { method: "POST", pattern: /^platform-admin\/subscriptions\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}\/(?:plan|extend)$/, permission: "subscriptions:manage" },
  { method: "GET", pattern: /^platform-admin\/devices$/, permission: "devices:view" },
  { method: "POST", pattern: /^platform-admin\/devices\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}\/revoke$/, permission: "devices:manage" },
  { method: "GET", pattern: /^platform-admin\/sync\/events$/, permission: "sync:view" },
  { method: "POST", pattern: /^platform-admin\/sync\/events\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}\/retry$/, permission: "sync:retry" },
  { method: "POST", pattern: /^platform-admin\/errors\/ingest$/, permission: "dashboard:view" },
  { method: "GET", pattern: /^platform-admin\/(?:errors|incidents)$/, permission: "errors:view" },
  { method: "GET", pattern: /^platform-admin\/errors\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}$/, permission: "errors:view" },
  { method: "PATCH", pattern: /^platform-admin\/errors\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}$/, permission: "errors:manage" },
  { method: "POST", pattern: /^platform-admin\/errors\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}\/notes$/, permission: "errors:manage" },
  { method: "GET", pattern: /^platform-admin\/(?:health|api-metrics)$/, permission: "health:view" },
  { method: "GET", pattern: /^platform-admin\/reports(?:\/[A-Za-z0-9_-]+)?$/, permission: "reports:view" },
  { method: "GET", pattern: /^platform-admin\/support\/tickets$/, permission: "support:view" },
  { method: "POST", pattern: /^platform-admin\/support\/tickets$/, permission: "support:manage" },
  { method: "PATCH", pattern: /^platform-admin\/support\/tickets\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}$/, permission: "support:manage" },
  { method: "POST", pattern: /^platform-admin\/support\/tickets\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}\/notes$/, permission: "support:manage" },
  { method: "GET", pattern: /^platform-admin\/settings$/, permission: "settings:view" },
  { method: "PATCH", pattern: /^platform-admin\/settings$/, permission: "settings:manage" },
  { method: "GET", pattern: /^platform-admin\/audit$/, permission: "audit:view" },
  { method: "GET", pattern: /^platform-admin\/audit\/login-events$/, permission: "audit:view" },
  { method: "GET", pattern: /^platform-admin\/admin-users$/, permission: "platform_users:view" },
  { method: "POST", pattern: /^platform-admin\/admin-users$/, permission: "platform_users:manage" },
  { method: "PATCH", pattern: /^platform-admin\/admin-users\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}$/, permission: "platform_users:manage" },
  { method: "POST", pattern: /^platform-admin\/admin-users\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,159}\/revoke-sessions$/, permission: "platform_users:manage" }
];

export function isAllowedProxyPathParts(pathParts: string[]) {
  return pathParts.length > 0 && pathParts.every((part) => PATH_PART.test(part) && part !== "." && part !== "..");
}

export function isAllowedProxyRoute(method: string, path: string) {
  return PROXY_RULES.some((candidate) => candidate.method === method.toUpperCase() && candidate.pattern.test(path));
}

export function getProxyRoutePermission(method: string, path: string) {
  return PROXY_RULES.find((candidate) => candidate.method === method.toUpperCase() && candidate.pattern.test(path))?.permission ?? null;
}
