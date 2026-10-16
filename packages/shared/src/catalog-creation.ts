import { BUSINESS_TYPES } from "./constants";
import { INDUSTRY_KEYS, isBusinessType, isIndustryKey, listIndustryModules, type IndustryKey } from "./industries";

export const CATALOG_ENTITY_TYPES = ["product", "service", "menu_item", "part"] as const;
export type CatalogEntityType = (typeof CATALOG_ENTITY_TYPES)[number];

export type CatalogFieldKey =
  | "name"
  | "description"
  | "category"
  | "sku"
  | "barcode"
  | "unit"
  | "buyingPrice"
  | "sellingPrice"
  | "stockOnHand"
  | "lowStockThreshold"
  | "supplier"
  | "brand"
  | "duration"
  | "assignedStaff"
  | "pricingModel"
  | "hourlyPrice"
  | "variants"
  | "addOns"
  | "recipeIngredients"
  | "compatibility"
  | "batchNumber"
  | "expiryDate"
  | "serialNumber";

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

export type CatalogCreationResolution =
  | { status: "ready"; context: CatalogCreationContext }
  | { status: "missing"; message: string }
  | { status: "invalid"; message: string };

const F = (key: CatalogFieldKey, label: string, help?: string, required = false): CatalogFormField => ({
  key,
  label,
  ...(help ? { help } : {}),
  ...(required ? { required: true } : {})
});

const RETAIL_PRODUCT_FIELDS = [
  F("name", "Product name", "Use the name staff and customers will recognize.", true),
  F("description", "Description"),
  F("category", "Category"),
  F("brand", "Brand"),
  F("sku", "SKU"),
  F("barcode", "Barcode"),
  F("unit", "Stock unit", "Examples: pcs, kg, box, or bottle.", true),
  F("buyingPrice", "Cost price"),
  F("sellingPrice", "Selling price", "What customers pay for one unit.", true),
  F("stockOnHand", "Opening stock"),
  F("lowStockThreshold", "Low-stock threshold"),
  F("supplier", "Supplier"),
  F("batchNumber", "Batch number"),
  F("expiryDate", "Expiry date"),
  F("serialNumber", "Serial number")
] as const;

const PART_FIELDS = [
  F("name", "Part name", "Use the name technicians and customers will recognize.", true),
  F("description", "Description"),
  F("category", "Part category"),
  F("sku", "Part number / SKU"),
  F("barcode", "Barcode"),
  F("unit", "Stock unit", "Usually pcs, set, or kit.", true),
  F("buyingPrice", "Cost price"),
  F("sellingPrice", "Selling price", "What the customer pays for the part.", true),
  F("stockOnHand", "Opening stock"),
  F("lowStockThreshold", "Low-stock threshold"),
  F("supplier", "Supplier"),
  F("compatibility", "Vehicle compatibility"),
  F("serialNumber", "Serial number")
] as const;

const SERVICE_FIELDS = [
  F("name", "Service name", "Use the name customers and staff will recognize.", true),
  F("description", "Description"),
  F("category", "Service category"),
  F("sellingPrice", "Service price", "The fee charged for this service.", true),
  F("pricingModel", "Pricing model"),
  F("hourlyPrice", "Hourly rate"),
  F("duration", "Estimated duration"),
  F("assignedStaff", "Assigned staff")
] as const;

const MENU_ITEM_FIELDS = [
  F("name", "Item name", "Use the name shown to guests and the kitchen.", true),
  F("category", "Menu category"),
  F("description", "Description"),
  F("sellingPrice", "Selling price", "The price shown on the menu.", true),
  F("unit", "Serving unit", "Examples: plate, cup, or portion.", true),
  F("variants", "Variants"),
  F("addOns", "Add-ons"),
  F("recipeIngredients", "Recipe ingredients")
] as const;

function configFor(entityType: CatalogEntityType, industryKey: IndustryKey): CatalogCreationConfig {
  if (entityType === "menu_item") {
    return {
      entityType,
      formKey: "restaurant_menu_item",
      title: "Add menu item",
      description: "Create a guest-facing item with its menu, pricing, and kitchen details.",
      itemLabel: "Menu item",
      fields: MENU_ITEM_FIELDS,
      supportsInventory: false,
      defaultUnit: "serving"
    };
  }
  if (entityType === "part") {
    return {
      entityType,
      formKey: "part",
      title: "Add part",
      description: "Create a stock-tracked part for sales or workshop jobs.",
      itemLabel: "Part",
      fields: PART_FIELDS,
      supportsInventory: true,
      defaultUnit: "pcs"
    };
  }
  if (entityType === "service") {
    const formKey = industryKey === "beauty" ? "beauty_service" : industryKey === "healthcare" ? "clinical_service" : industryKey === "automotive" ? "automotive_service" : industryKey === "professional_services" ? "professional_service" : "service";
    const title = formKey === "clinical_service" ? "Add clinical service" : formKey === "automotive_service" ? "Add automotive service" : formKey === "professional_service" ? "Add professional service" : "Add service";
    const description = formKey === "clinical_service"
      ? "Create a clinical service with its fee, duration, and provider assignment."
      : formKey === "automotive_service"
        ? "Create labour or workshop service pricing separately from physical parts."
        : formKey === "professional_service"
          ? "Create a billable service with its pricing model and delivery team."
          : "Create an appointment-ready service with pricing, duration, and availability details.";
    return { entityType, formKey, title, description, itemLabel: formKey === "clinical_service" ? "Clinical service" : "Service", fields: SERVICE_FIELDS, supportsInventory: false, defaultUnit: "service" };
  }
  return {
    entityType,
    formKey: industryKey === "automotive" ? "part" : "retail_product",
    title: industryKey === "automotive" ? "Add part" : "Add product",
    description: industryKey === "automotive" ? "Create a stock-tracked part with fitment, pricing, and inventory details." : "Create a stock-tracked product with pricing, supplier, and inventory details.",
    itemLabel: industryKey === "automotive" ? "Part" : "Product",
    fields: industryKey === "automotive" ? PART_FIELDS : RETAIL_PRODUCT_FIELDS,
    supportsInventory: true,
    defaultUnit: "pcs"
  };
}

function industryForBusinessType(businessType?: string | null) {
  if (!businessType || !isBusinessType(businessType)) return null;
  return listIndustryModules().find((module) => module.businessTypes.some((option) => option.value === businessType))?.key ?? null;
}

type CatalogContextInput = { industryKey?: string | null | undefined; businessType?: string | null | undefined; entityType?: string | null | undefined };

export function resolveCatalogIndustry(input: CatalogContextInput = {}): { industryKey: IndustryKey; businessType: string | null } | null {
  if (input.industryKey != null && !isIndustryKey(input.industryKey)) return null;
  const mappedIndustry = industryForBusinessType(input.businessType);
  if (input.businessType != null && !isBusinessType(input.businessType)) return null;
  if (input.industryKey && mappedIndustry && input.industryKey !== mappedIndustry) return null;
  const industryKey = input.industryKey as IndustryKey | undefined ?? mappedIndustry;
  return industryKey ? { industryKey, businessType: input.businessType ?? null } : null;
}

export function getSupportedCatalogEntityTypes(input: CatalogContextInput = {}): readonly CatalogEntityType[] {
  const resolved = resolveCatalogIndustry(input);
  if (!resolved) return [];
  const { industryKey, businessType } = resolved;
  if (industryKey === "food_beverage") return ["menu_item"];
  if (industryKey === "hospitality") return [];
  if (industryKey === "beauty") return ["service", "product"];
  if (industryKey === "healthcare") return businessType === "pharmacy" ? ["product", "service"] : ["service"];
  if (industryKey === "automotive") return businessType === "auto_parts" ? ["part"] : ["part", "service"];
  if (industryKey === "services" || industryKey === "professional_services") return ["service"];
  if (industryKey === "retail") return ["product", "service"];
  return ["product"];
}

export function getDefaultCatalogEntityType(input: CatalogContextInput = {}): CatalogEntityType | null {
  const types = getSupportedCatalogEntityTypes(input);
  return types[0] ?? null;
}

export function resolveCatalogCreationConfig(input: CatalogContextInput = {}): CatalogCreationConfig | null {
  const resolved = resolveCatalogIndustry(input);
  if (!resolved) return null;
  const entityType = input.entityType ? CATALOG_ENTITY_TYPES.find((candidate) => candidate === input.entityType) : getDefaultCatalogEntityType(resolved);
  if (!entityType || !getSupportedCatalogEntityTypes(resolved).includes(entityType)) return null;
  return configFor(entityType, resolved.industryKey);
}

export function resolveCatalogCreationContext(input: CatalogContextInput = {}): CatalogCreationResolution {
  if (!input.industryKey && !input.businessType) return { status: "missing", message: "Business industry is still loading. Try again once the workspace is ready." };
  const resolved = resolveCatalogIndustry(input);
  if (!resolved) return { status: "invalid", message: "This business has an invalid industry configuration. Open Settings to resolve the business setup before creating catalog records." };
  const supportedEntityTypes = getSupportedCatalogEntityTypes(resolved);
  if (!supportedEntityTypes.length) return { status: "invalid", message: "This industry does not use the product catalog. Use its Rooms or Operations workflow instead." };
  const defaultEntityType = getDefaultCatalogEntityType(resolved)!;
  const config = resolveCatalogCreationConfig({ ...resolved, entityType: input.entityType ?? defaultEntityType });
  if (!config) return { status: "invalid", message: "The selected catalog entity is not supported for this business." };
  return { status: "ready", context: { ...resolved, supportedEntityTypes, defaultEntityType, config } };
}

export function isCatalogEntityType(value: unknown): value is CatalogEntityType {
  return typeof value === "string" && CATALOG_ENTITY_TYPES.includes(value as CatalogEntityType);
}

export const CATALOG_INDUSTRY_KEYS = INDUSTRY_KEYS;
export const CATALOG_BUSINESS_TYPES = BUSINESS_TYPES;
