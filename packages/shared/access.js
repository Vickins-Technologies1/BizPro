"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_ACCESS = exports.ROLE_PRESETS = exports.ACCESS_PERMISSIONS = void 0;
exports.formatRoleLabel = formatRoleLabel;
exports.getRolePermissions = getRolePermissions;
exports.getEffectivePermissions = getEffectivePermissions;
exports.hasRolePermission = hasRolePermission;
exports.hasPermission = hasPermission;
exports.formatPermissionLabel = formatPermissionLabel;
const constants_1 = require("./constants");
exports.ACCESS_PERMISSIONS = [
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
];
exports.ROLE_PRESETS = [
    {
        role: "owner",
        label: "Owner",
        description: "Full administrative control over the business.",
        permissions: [...exports.ACCESS_PERMISSIONS]
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
exports.ROLE_ACCESS = Object.fromEntries(exports.ROLE_PRESETS.map((preset) => [preset.role, [...preset.permissions]]));
function formatRoleLabel(role) {
    if (role === "owner")
        return "Owner";
    if (role === "manager")
        return "Manager";
    if (role === "supervisor")
        return "Supervisor";
    if (role === "cashier")
        return "Cashier";
    if (role === "waiter")
        return "Waiter";
    if (role === "receptionist")
        return "Receptionist";
    if (role === "stylist")
        return "Stylist";
    if (role === "mechanic")
        return "Mechanic";
    if (role === "pharmacist")
        return "Pharmacist";
    if (typeof role === "string" && role.trim()) {
        return role
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase())
            .trim();
    }
    return "Cashier";
}
function getRolePermissions(role) {
    if (typeof role !== "string")
        return exports.ROLE_ACCESS.cashier;
    if (constants_1.USER_ROLES.includes(role)) {
        return exports.ROLE_ACCESS[role];
    }
    return exports.ROLE_ACCESS.cashier;
}
function getEffectivePermissions(input) {
    if (typeof input === "string" || input == null) {
        return getRolePermissions(input);
    }
    const rolePermissions = getRolePermissions(input.role);
    if ((input.role ?? "cashier") === "owner")
        return rolePermissions;
    if (input.permissions !== undefined && input.permissions !== null)
        return input.permissions;
    return rolePermissions;
}
function hasRolePermission(role, permission) {
    return getRolePermissions(role).includes(permission);
}
function hasPermission(input, permission) {
    return getEffectivePermissions(input).includes(permission);
}
function formatPermissionLabel(permission) {
    return permission
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (char) => char.toUpperCase())
        .trim();
}
