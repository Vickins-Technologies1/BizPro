export declare const BUSINESS_TYPES: readonly ["retail_shop", "boutique", "cosmetics", "accessories", "wines_spirits", "hardware", "agrovet", "restaurant", "cafe", "bakery", "bar", "salon", "spa", "hotel", "lodge", "clinic", "pharmacy", "dental_clinic", "farm", "feed_store", "garage", "auto_parts", "service_center", "general_service", "consultancy", "agency", "law_firm", "accounting_firm"];
export declare const PLAN_TIERS: readonly ["command", "pro", "elite", "enterprise"];
export declare const USER_ROLES: readonly ["owner", "manager", "supervisor", "cashier", "waiter", "receptionist", "stylist", "mechanic", "pharmacist"];
export declare const PAYMENT_METHODS: readonly ["cash", "mpesa", "bank", "card", "cheque", "other", "credit"];
export declare const PAYMENT_STATUSES: readonly ["paid", "partial", "pending_confirmation", "credit", "unpaid", "reconciled", "manual_mpesa"];
export declare const SYNC_ACTIONS: readonly ["create", "update", "delete", "upsert", "reconcile"];
export declare const INVENTORY_UNITS: readonly ["pcs", "box", "pack", "kg", "g", "litre", "ml", "dozen"];
export declare const CURRENCY_DEFAULT = "KES";
export declare const PLAN_PRICING: {
    readonly command: 700;
    readonly pro: 1200;
    readonly elite: 1800;
    readonly enterprise: 2500;
};
export declare const PLAN_EMPLOYEE_LIMITS: {
    readonly command: 2;
    readonly pro: 5;
    readonly elite: 8;
    readonly enterprise: 10;
};
export declare const PLAN_NAMES: {
    readonly command: "Command";
    readonly pro: "Pro";
    readonly elite: "Elite";
    readonly enterprise: "Enterprise";
};
export declare const TRIAL_DAYS = 30;
export declare const LOCAL_DATE_FORMAT = "yyyy-MM-dd";
