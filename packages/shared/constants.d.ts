export declare const BUSINESS_TYPES: readonly ["retail_shop", "boutique", "cosmetics", "accessories", "wines_spirits", "hardware", "agrovet", "restaurant", "cafe", "bakery", "bar", "salon", "spa", "hotel", "lodge", "clinic", "pharmacy", "dental_clinic", "farm", "feed_store", "garage", "auto_parts", "service_center", "general_service", "consultancy", "agency", "law_firm", "accounting_firm"];
export declare const PLAN_TIERS: readonly ["lite", "standard", "pro"];
export declare const USER_ROLES: readonly ["owner", "manager", "supervisor", "cashier", "waiter", "receptionist", "stylist", "mechanic", "pharmacist"];
export declare const PAYMENT_METHODS: readonly ["cash", "mpesa", "bank", "credit"];
export declare const PAYMENT_STATUSES: readonly ["paid", "partial", "pending_confirmation", "credit", "unpaid", "reconciled", "manual_mpesa"];
export declare const SYNC_ACTIONS: readonly ["create", "update", "delete", "upsert", "reconcile"];
export declare const INVENTORY_UNITS: readonly ["pcs", "box", "pack", "kg", "g", "litre", "ml", "dozen"];
export declare const CURRENCY_DEFAULT = "KES";
export declare const PLAN_PRICING: {
    readonly lite: 300;
    readonly standard: 600;
    readonly pro: 1000;
};
export declare const LOCAL_DATE_FORMAT = "yyyy-MM-dd";
