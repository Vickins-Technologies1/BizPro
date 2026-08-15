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
  "manageSettings",
  "manageAppointments",
  "manageBookings",
  "manageTables",
  "manageWorkOrders",
  "managePharmacy",
  "dispenseMedicines"
] as const;

export type AccessPermission = (typeof ACCESS_PERMISSIONS)[number];

export type RolePreset = {
  role: UserRole;
  label: string;
  description: string;
  permissions: AccessPermission[];
};

export const ROLE_PRESETS: RolePreset[] = [
  {
    role: "owner",
    label: "Owner",
    description: "Full administrative control over the business.",
    permissions: [...ACCESS_PERMISSIONS]
  },
  {
    role: "manager",
    label: "Manager",
    description: "Broad operational access for day-to-day management.",
    permissions: [
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
    ]
  },
  {
    role: "supervisor",
    label: "Supervisor",
    description: "Oversee operations, approvals, and performance reporting.",
    permissions: [
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
      "viewFinancialReports"
    ]
  },
  {
    role: "cashier",
    label: "Cashier",
    description: "Sell, receive payments, and handle customer balances.",
    permissions: ["manageSales", "createSales", "manageCustomers", "manageSettings"]
  },
  {
    role: "waiter",
    label: "Waiter",
    description: "Handle service orders, tables, and customer-facing sales flow.",
    permissions: ["viewDashboard", "manageSales", "createSales", "manageCustomers", "manageTables", "manageBookings"]
  },
  {
    role: "receptionist",
    label: "Receptionist",
    description: "Manage front-desk customers, bookings, and appointments.",
    permissions: ["viewDashboard", "manageCustomers", "manageAppointments", "manageBookings", "createSales"]
  },
  {
    role: "stylist",
    label: "Stylist",
    description: "Manage client appointments and service sales.",
    permissions: ["viewDashboard", "manageSales", "createSales", "manageCustomers", "manageAppointments", "manageBookings"]
  },
  {
    role: "mechanic",
    label: "Mechanic",
    description: "Track jobs, parts, and service orders in the workshop.",
    permissions: ["viewDashboard", "manageSales", "createSales", "manageCustomers", "manageInventory", "manageWorkOrders"]
  },
  {
    role: "pharmacist",
    label: "Pharmacist",
    description: "Handle dispensary sales, stock, and medicine workflows.",
    permissions: [
      "viewDashboard",
      "manageSales",
      "createSales",
      "manageCustomers",
      "manageInventory",
      "managePharmacy",
      "dispenseMedicines",
      "viewFinancialReports"
    ]
  }
];

export const ROLE_ACCESS: Record<UserRole, AccessPermission[]> = Object.fromEntries(
  ROLE_PRESETS.map((preset) => [preset.role, [...preset.permissions]])
) as Record<UserRole, AccessPermission[]>;

export function formatRoleLabel(role?: UserRole | string | null) {
  if (role === "owner") return "Owner";
  if (role === "manager") return "Manager";
  if (role === "supervisor") return "Supervisor";
  if (role === "cashier") return "Cashier";
  if (role === "waiter") return "Waiter";
  if (role === "receptionist") return "Receptionist";
  if (role === "stylist") return "Stylist";
  if (role === "mechanic") return "Mechanic";
  if (role === "pharmacist") return "Pharmacist";
  if (typeof role === "string" && role.trim()) {
    return role
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }
  return "Cashier";
}

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
