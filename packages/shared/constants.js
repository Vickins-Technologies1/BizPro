"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_DATE_FORMAT = exports.TRIAL_DAYS = exports.PLAN_NAMES = exports.PLAN_EMPLOYEE_LIMITS = exports.PLAN_PRICING = exports.CURRENCY_DEFAULT = exports.INVENTORY_UNITS = exports.SYNC_ACTIONS = exports.PAYMENT_STATUSES = exports.PAYMENT_METHODS = exports.USER_ROLES = exports.PLAN_TIERS = exports.BUSINESS_TYPES = void 0;
exports.BUSINESS_TYPES = [
    "retail_shop",
    "boutique",
    "cosmetics",
    "accessories",
    "wines_spirits",
    "hardware",
    "agrovet",
    "restaurant",
    "cafe",
    "bakery",
    "bar",
    "salon",
    "spa",
    "hotel",
    "lodge",
    "clinic",
    "pharmacy",
    "dental_clinic",
    "farm",
    "feed_store",
    "garage",
    "auto_parts",
    "service_center",
    "tyre_business",
    "body_shop",
    "general_service",
    "consultancy",
    "agency",
    "law_firm",
    "accounting_firm",
];
exports.PLAN_TIERS = ["command", "pro", "elite", "enterprise"];
exports.USER_ROLES = [
    "owner",
    "manager",
    "supervisor",
    "cashier",
    "waiter",
    "receptionist",
    "stylist",
    "mechanic",
    "pharmacist"
];
exports.PAYMENT_METHODS = ["cash", "mpesa", "bank", "card", "cheque", "other", "credit"];
exports.PAYMENT_STATUSES = [
    "paid",
    "partial",
    "pending_confirmation",
    "credit",
    "unpaid",
    "reconciled",
    "manual_mpesa",
];
exports.SYNC_ACTIONS = [
    "create",
    "update",
    "delete",
    "upsert",
    "reconcile",
];
exports.INVENTORY_UNITS = [
    "pcs",
    "box",
    "pack",
    "kg",
    "g",
    "litre",
    "ml",
    "dozen"
];
exports.CURRENCY_DEFAULT = "KES";
exports.PLAN_PRICING = {
    command: 700,
    pro: 1200,
    elite: 1800,
    enterprise: 2500,
};
exports.PLAN_EMPLOYEE_LIMITS = {
    command: 2,
    pro: 5,
    elite: 8,
    enterprise: 10,
};
exports.PLAN_NAMES = {
    command: "Command",
    pro: "Pro",
    elite: "Elite",
    enterprise: "Enterprise",
};
exports.TRIAL_DAYS = 30;
exports.LOCAL_DATE_FORMAT = "yyyy-MM-dd";
