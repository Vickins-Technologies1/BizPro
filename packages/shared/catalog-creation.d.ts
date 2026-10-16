import { type IndustryKey } from "./industries";
export declare const CATALOG_ENTITY_TYPES: readonly ["product", "service", "menu_item", "part"];
export type CatalogEntityType = (typeof CATALOG_ENTITY_TYPES)[number];
export type CatalogFieldKey = "name" | "description" | "category" | "sku" | "barcode" | "unit" | "buyingPrice" | "sellingPrice" | "stockOnHand" | "lowStockThreshold" | "supplier" | "brand" | "duration" | "assignedStaff" | "pricingModel" | "hourlyPrice" | "variants" | "addOns" | "recipeIngredients" | "compatibility" | "batchNumber" | "expiryDate" | "serialNumber";
export type CatalogFormField = {
    key: CatalogFieldKey;
    label: string;
    required?: boolean;
    help?: string;
};
export type CatalogCreationConfig = {
    entityType: CatalogEntityType;
    formKey: "retail_product" | "restaurant_menu_item" | "beauty_service" | "clinical_service" | "automotive_service" | "professional_service" | "service" | "part";
    title: string;
    description: string;
    itemLabel: string;
    fields: readonly CatalogFormField[];
    supportsInventory: boolean;
    defaultUnit: string;
};
export type CatalogCreationContext = {
    industryKey: IndustryKey;
    businessType: string | null;
    supportedEntityTypes: readonly CatalogEntityType[];
    defaultEntityType: CatalogEntityType;
    config: CatalogCreationConfig;
};
export type CatalogCreationResolution = {
    status: "ready";
    context: CatalogCreationContext;
} | {
    status: "missing";
    message: string;
} | {
    status: "invalid";
    message: string;
};
type CatalogContextInput = {
    industryKey?: string | null | undefined;
    businessType?: string | null | undefined;
    entityType?: string | null | undefined;
};
export declare function resolveCatalogIndustry(input?: CatalogContextInput): {
    industryKey: IndustryKey;
    businessType: string | null;
} | null;
export declare function getSupportedCatalogEntityTypes(input?: CatalogContextInput): readonly CatalogEntityType[];
export declare function getDefaultCatalogEntityType(input?: CatalogContextInput): CatalogEntityType | null;
export declare function resolveCatalogCreationConfig(input?: CatalogContextInput): CatalogCreationConfig | null;
export declare function resolveCatalogCreationContext(input?: CatalogContextInput): CatalogCreationResolution;
export declare function isCatalogEntityType(value: unknown): value is CatalogEntityType;
export declare const CATALOG_INDUSTRY_KEYS: readonly ["retail", "food_beverage", "beauty", "hospitality", "healthcare", "agriculture", "automotive", "services", "professional_services"];
export declare const CATALOG_BUSINESS_TYPES: readonly ["retail_shop", "boutique", "cosmetics", "accessories", "wines_spirits", "hardware", "agrovet", "restaurant", "cafe", "bakery", "bar", "salon", "spa", "hotel", "lodge", "clinic", "pharmacy", "dental_clinic", "farm", "feed_store", "garage", "auto_parts", "service_center", "tyre_business", "body_shop", "general_service", "consultancy", "agency", "law_firm", "accounting_firm"];
export {};
