export const BUSINESS_TYPES = [
  "retail_shop",
  "boutique",
  "cosmetics",
  "accessories",
  "wines_spirits",
  "hardware",
  "agrovet",
  "restaurant",
] as const;

export const PLAN_TIERS = ["lite", "standard", "pro"] as const;

export const USER_ROLES = ["owner", "manager", "cashier"] as const;

export const PAYMENT_METHODS = ["cash", "mpesa", "bank", "credit"] as const;

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

export const CURRENCY_DEFAULT = "KES";
export const PLAN_PRICING = {
  lite: 300,
  standard: 600,
  pro: 1000,
} as const;

export const LOCAL_DATE_FORMAT = "yyyy-MM-dd";
