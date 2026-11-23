"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLATFORM_ADMIN_ROLE_LABELS = exports.PLATFORM_ADMIN_ROLE_PERMISSIONS = exports.PLATFORM_ADMIN_PERMISSIONS = exports.PLATFORM_ADMIN_ROLES = void 0;
exports.isPlatformAdminRole = isPlatformAdminRole;
exports.hasPlatformAdminPermission = hasPlatformAdminPermission;
exports.getPlatformAdminPermissions = getPlatformAdminPermissions;
exports.PLATFORM_ADMIN_ROLES = [
    "super_admin",
    "operations_admin",
    "finance_admin",
    "support_admin",
    "developer",
    "read_only"
];
exports.PLATFORM_ADMIN_PERMISSIONS = [
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
];
const allPermissions = [...exports.PLATFORM_ADMIN_PERMISSIONS];
exports.PLATFORM_ADMIN_ROLE_PERMISSIONS = {
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
exports.PLATFORM_ADMIN_ROLE_LABELS = {
    super_admin: "Super Admin",
    operations_admin: "Operations Admin",
    finance_admin: "Finance Admin",
    support_admin: "Support Admin",
    developer: "Developer",
    read_only: "Read-only Viewer"
};
function isPlatformAdminRole(value) {
    return typeof value === "string" && exports.PLATFORM_ADMIN_ROLES.includes(value);
}
function hasPlatformAdminPermission(role, permission) {
    return isPlatformAdminRole(role) && exports.PLATFORM_ADMIN_ROLE_PERMISSIONS[role].includes(permission);
}
function getPlatformAdminPermissions(role) {
    return isPlatformAdminRole(role) ? [...exports.PLATFORM_ADMIN_ROLE_PERMISSIONS[role]] : [];
}
