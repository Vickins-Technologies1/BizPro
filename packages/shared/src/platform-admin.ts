export const PLATFORM_ADMIN_ROLES = [
  "super_admin",
  "operations_admin",
  "finance_admin",
  "support_admin",
  "developer",
  "read_only"
] as const;

export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

export const PLATFORM_ADMIN_PERMISSIONS = [
  "dashboard:view",
  "businesses:view",
  "businesses:manage",
  "employees:view",
  "employees:manage",
  "platform_users:view",
  "platform_users:manage",
  "subscriptions:view",
  "subscriptions:manage",
  "payments:view",
  "devices:view",
  "devices:manage",
  "sync:view",
  "sync:retry",
  "errors:view",
  "errors:manage",
  "health:view",
  "reports:view",
  "support:view",
  "support:manage",
  "settings:view",
  "settings:manage",
  "audit:view"
] as const;

export type PlatformAdminPermission = (typeof PLATFORM_ADMIN_PERMISSIONS)[number];

const allPermissions = [...PLATFORM_ADMIN_PERMISSIONS];

export const PLATFORM_ADMIN_ROLE_PERMISSIONS: Record<PlatformAdminRole, PlatformAdminPermission[]> = {
  super_admin: allPermissions,
  operations_admin: [
    "dashboard:view", "businesses:view", "businesses:manage", "employees:view", "employees:manage",
    "subscriptions:view", "devices:view", "devices:manage", "sync:view", "sync:retry", "errors:view",
    "health:view", "reports:view", "support:view", "support:manage", "audit:view"
  ],
  finance_admin: [
    "dashboard:view", "businesses:view", "subscriptions:view", "subscriptions:manage", "payments:view",
    "reports:view", "audit:view"
  ],
  support_admin: [
    "dashboard:view", "businesses:view", "employees:view", "employees:manage", "devices:view", "sync:view",
    "errors:view", "support:view", "support:manage", "audit:view"
  ],
  developer: [
    "dashboard:view", "sync:view", "errors:view", "errors:manage", "health:view", "reports:view", "audit:view"
  ],
  read_only: [
    "dashboard:view", "businesses:view", "employees:view", "platform_users:view", "subscriptions:view",
    "payments:view", "devices:view", "sync:view", "errors:view", "health:view", "reports:view",
    "support:view", "settings:view", "audit:view"
  ]
};

export const PLATFORM_ADMIN_ROLE_LABELS: Record<PlatformAdminRole, string> = {
  super_admin: "Super Admin",
  operations_admin: "Operations Admin",
  finance_admin: "Finance Admin",
  support_admin: "Support Admin",
  developer: "Developer",
  read_only: "Read-only Viewer"
};

export function isPlatformAdminRole(value: unknown): value is PlatformAdminRole {
  return typeof value === "string" && (PLATFORM_ADMIN_ROLES as readonly string[]).includes(value);
}

export function hasPlatformAdminPermission(role: unknown, permission: PlatformAdminPermission) {
  return isPlatformAdminRole(role) && PLATFORM_ADMIN_ROLE_PERMISSIONS[role].includes(permission);
}

export function getPlatformAdminPermissions(role: unknown): PlatformAdminPermission[] {
  return isPlatformAdminRole(role) ? [...PLATFORM_ADMIN_ROLE_PERMISSIONS[role]] : [];
}
