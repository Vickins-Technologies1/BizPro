import { USER_ROLES } from "./constants";
import type { UserRole } from "./types";

export const ACCESS_PERMISSIONS = [
  "viewDashboard",
  "manageSales",
  "createSales",
  "refundSales",
  "manageInventory",
  "addProducts",
  "editProducts",
  "deleteProducts",
  "viewReports",
  "manageCustomers",
  "manageSuppliers",
  "manageEmployees",
  "manageExpenses",
  "viewFinancialReports",
  "manageSettings"
] as const;

export type AccessPermission = (typeof ACCESS_PERMISSIONS)[number];

export const ROLE_ACCESS: Record<UserRole, AccessPermission[]> = {
  owner: [...ACCESS_PERMISSIONS],
  manager: [
    "viewDashboard",
    "manageSales",
    "createSales",
    "refundSales",
    "manageInventory",
    "addProducts",
    "editProducts",
    "viewReports",
    "manageCustomers",
    "manageSuppliers",
    "manageExpenses",
    "viewFinancialReports",
    "manageSettings"
  ],
  cashier: ["manageSales", "createSales", "manageCustomers", "manageSettings"]
};

export function getRolePermissions(role: UserRole | string | null | undefined) {
  if (typeof role !== "string") return ROLE_ACCESS.cashier;
  if ((USER_ROLES as readonly string[]).includes(role)) {
    return ROLE_ACCESS[role as UserRole];
  }
  return ROLE_ACCESS.cashier;
}

export function getEffectivePermissions(
  input: { role?: UserRole | string | null; permissions?: AccessPermission[] | null } | UserRole | string | null | undefined
) {
  if (typeof input === "string" || input == null) {
    return getRolePermissions(input);
  }

  const rolePermissions = getRolePermissions(input.role);
  if ((input.role ?? "cashier") === "owner") return rolePermissions;
  if (input.permissions !== undefined && input.permissions !== null) return input.permissions;
  return rolePermissions;
}

export function hasRolePermission(role: UserRole | string | null | undefined, permission: AccessPermission) {
  return getRolePermissions(role).includes(permission);
}

export function hasPermission(
  input: { role?: UserRole | string | null; permissions?: AccessPermission[] | null } | UserRole | string | null | undefined,
  permission: AccessPermission
) {
  return getEffectivePermissions(input).includes(permission);
}

export function formatPermissionLabel(permission: AccessPermission) {
  return permission
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}
