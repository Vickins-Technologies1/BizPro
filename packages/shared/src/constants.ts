export const BUSINESS_TYPES = [
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
] as const;

export const PLAN_TIERS = ["command", "pro", "elite", "enterprise"] as const;

export const USER_ROLES = [
  "owner",
  "manager",
  "supervisor",
  "cashier",
  "waiter",
  "receptionist",
  "stylist",
  "mechanic",
  "pharmacist"
] as const;

export const PAYMENT_METHODS = ["cash", "mpesa", "bank", "card", "cheque", "other", "credit"] as const;

export const PAYMENT_STATUSES = [
  "paid",
  "partial",
  "pending_confirmation",
  "credit",
  "unpaid",
  "reconciled",
  "manual_mpesa",
] as const;

export const SYNC_ACTIONS = [
  "create",
  "update",
  "delete",
  "upsert",
  "reconcile",
] as const;

export const INVENTORY_UNITS = [
  "pcs",
  "box",
  "pack",
  "kg",
  "g",
  "litre",
  "ml",
  "dozen"
] as const;

export const CURRENCY_DEFAULT = "KES";
export const PLAN_PRICING = {
  command: 700,
  pro: 1200,
  elite: 1800,
  enterprise: 2500,
} as const;

export const PLAN_EMPLOYEE_LIMITS = {
  command: 2,
  pro: 5,
  elite: 8,
  enterprise: 10,
} as const;

export const PLAN_NAMES = {
  command: "Command",
  pro: "Pro",
  elite: "Elite",
  enterprise: "Enterprise",
} as const;

export const TRIAL_DAYS = 30;

export const LOCAL_DATE_FORMAT = "yyyy-MM-dd";
