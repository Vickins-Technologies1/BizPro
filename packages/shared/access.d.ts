import type { UserRole } from "./types";
export declare const ACCESS_PERMISSIONS: readonly ["viewDashboard", "manageSales", "createSales", "refundSales", "manageInventory", "addProducts", "editProducts", "deleteProducts", "viewReports", "manageCustomers", "manageSuppliers", "manageEmployees", "manageExpenses", "viewFinancialReports", "manageSettings", "manageAppointments", "manageBookings", "manageTables", "manageWorkOrders", "managePharmacy", "dispenseMedicines"];
export type AccessPermission = (typeof ACCESS_PERMISSIONS)[number];
export type RolePreset = {
    role: UserRole;
    label: string;
    description: string;
    permissions: AccessPermission[];
};
export declare const ROLE_PRESETS: RolePreset[];
export declare const ROLE_ACCESS: Record<UserRole, AccessPermission[]>;
export declare function formatRoleLabel(role?: UserRole | string | null): string;
export declare function getRolePermissions(role: UserRole | string | null | undefined): ("viewDashboard" | "manageSales" | "createSales" | "refundSales" | "manageInventory" | "addProducts" | "editProducts" | "deleteProducts" | "viewReports" | "manageCustomers" | "manageSuppliers" | "manageEmployees" | "manageExpenses" | "viewFinancialReports" | "manageSettings" | "manageAppointments" | "manageBookings" | "manageTables" | "manageWorkOrders" | "managePharmacy" | "dispenseMedicines")[];
export declare function getEffectivePermissions(input: {
    role?: UserRole | string | null;
    permissions?: AccessPermission[] | null;
} | UserRole | string | null | undefined): ("viewDashboard" | "manageSales" | "createSales" | "refundSales" | "manageInventory" | "addProducts" | "editProducts" | "deleteProducts" | "viewReports" | "manageCustomers" | "manageSuppliers" | "manageEmployees" | "manageExpenses" | "viewFinancialReports" | "manageSettings" | "manageAppointments" | "manageBookings" | "manageTables" | "manageWorkOrders" | "managePharmacy" | "dispenseMedicines")[];
export declare function hasRolePermission(role: UserRole | string | null | undefined, permission: AccessPermission): boolean;
export declare function hasPermission(input: {
    role?: UserRole | string | null;
    permissions?: AccessPermission[] | null;
} | UserRole | string | null | undefined, permission: AccessPermission): boolean;
export declare function formatPermissionLabel(permission: AccessPermission): string;
