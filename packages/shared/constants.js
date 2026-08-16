"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_DATE_FORMAT = exports.PLAN_PRICING = exports.CURRENCY_DEFAULT = exports.INVENTORY_UNITS = exports.SYNC_ACTIONS = exports.PAYMENT_STATUSES = exports.PAYMENT_METHODS = exports.USER_ROLES = exports.PLAN_TIERS = exports.BUSINESS_TYPES = void 0;
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
    "general_service",
    "consultancy",
    "agency",
    "law_firm",
    "accounting_firm",
];
exports.PLAN_TIERS = ["lite", "standard", "pro"];
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
exports.PAYMENT_METHODS = ["cash", "mpesa", "bank", "credit"];
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
    lite: 300,
    standard: 600,
    pro: 1000,
};
exports.LOCAL_DATE_FORMAT = "yyyy-MM-dd";
