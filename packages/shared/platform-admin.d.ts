export declare const PLATFORM_ADMIN_ROLES: readonly ["super_admin", "operations_admin", "finance_admin", "support_admin", "developer", "read_only"];
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];
export declare const PLATFORM_ADMIN_PERMISSIONS: readonly ["dashboard:view", "businesses:view", "businesses:manage", "employees:view", "employees:manage", "platform_users:view", "platform_users:manage", "subscriptions:view", "subscriptions:manage", "payments:view", "devices:view", "devices:manage", "sync:view", "sync:retry", "errors:view", "errors:manage", "health:view", "reports:view", "support:view", "support:manage", "settings:view", "settings:manage", "audit:view"];
export type PlatformAdminPermission = (typeof PLATFORM_ADMIN_PERMISSIONS)[number];
export declare const PLATFORM_ADMIN_ROLE_PERMISSIONS: Record<PlatformAdminRole, PlatformAdminPermission[]>;
export declare const PLATFORM_ADMIN_ROLE_LABELS: Record<PlatformAdminRole, string>;
export declare function isPlatformAdminRole(value: unknown): value is PlatformAdminRole;
export declare function hasPlatformAdminPermission(role: unknown, permission: PlatformAdminPermission): boolean;
export declare function getPlatformAdminPermissions(role: unknown): PlatformAdminPermission[];
