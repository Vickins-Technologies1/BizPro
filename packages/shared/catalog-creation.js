"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATALOG_BUSINESS_TYPES = exports.CATALOG_INDUSTRY_KEYS = exports.CATALOG_ENTITY_TYPES = void 0;
exports.resolveCatalogIndustry = resolveCatalogIndustry;
exports.getSupportedCatalogEntityTypes = getSupportedCatalogEntityTypes;
exports.getDefaultCatalogEntityType = getDefaultCatalogEntityType;
exports.resolveCatalogCreationConfig = resolveCatalogCreationConfig;
exports.resolveCatalogCreationContext = resolveCatalogCreationContext;
exports.isCatalogEntityType = isCatalogEntityType;
const constants_1 = require("./constants");
const industries_1 = require("./industries");
exports.CATALOG_ENTITY_TYPES = ["product", "service", "menu_item", "part"];
const F = (key, label, help, required = false) => ({
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
];
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
];
const SERVICE_FIELDS = [
    F("name", "Service name", "Use the name customers and staff will recognize.", true),
    F("description", "Description"),
    F("category", "Service category"),
    F("sellingPrice", "Service price", "The fee charged for this service.", true),
    F("pricingModel", "Pricing model"),
    F("hourlyPrice", "Hourly rate"),
    F("duration", "Estimated duration"),
    F("assignedStaff", "Assigned staff")
];
const MENU_ITEM_FIELDS = [
    F("name", "Item name", "Use the name shown to guests and the kitchen.", true),
    F("category", "Menu category"),
    F("description", "Description"),
    F("sellingPrice", "Selling price", "The price shown on the menu.", true),
    F("unit", "Serving unit", "Examples: plate, cup, or portion.", true),
    F("variants", "Variants"),
    F("addOns", "Add-ons"),
    F("recipeIngredients", "Recipe ingredients")
];
function configFor(entityType, industryKey) {
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
function industryForBusinessType(businessType) {
    if (!businessType || !(0, industries_1.isBusinessType)(businessType))
        return null;
    return (0, industries_1.listIndustryModules)().find((module) => module.businessTypes.some((option) => option.value === businessType))?.key ?? null;
}
function resolveCatalogIndustry(input = {}) {
    if (input.industryKey != null && !(0, industries_1.isIndustryKey)(input.industryKey))
        return null;
    const mappedIndustry = industryForBusinessType(input.businessType);
    if (input.businessType != null && !(0, industries_1.isBusinessType)(input.businessType))
        return null;
    if (input.industryKey && mappedIndustry && input.industryKey !== mappedIndustry)
        return null;
    const industryKey = input.industryKey ?? mappedIndustry;
    return industryKey ? { industryKey, businessType: input.businessType ?? null } : null;
}
function getSupportedCatalogEntityTypes(input = {}) {
    const resolved = resolveCatalogIndustry(input);
    if (!resolved)
        return [];
    const { industryKey, businessType } = resolved;
    if (industryKey === "food_beverage")
        return ["menu_item"];
    if (industryKey === "hospitality")
        return [];
    if (industryKey === "beauty")
        return ["service", "product"];
    if (industryKey === "healthcare")
        return businessType === "pharmacy" ? ["product", "service"] : ["service"];
    if (industryKey === "automotive")
        return businessType === "auto_parts" ? ["part"] : ["part", "service"];
    if (industryKey === "services" || industryKey === "professional_services")
        return ["service"];
    if (industryKey === "retail")
        return ["product", "service"];
    return ["product"];
}
function getDefaultCatalogEntityType(input = {}) {
    const types = getSupportedCatalogEntityTypes(input);
    return types[0] ?? null;
}
function resolveCatalogCreationConfig(input = {}) {
    const resolved = resolveCatalogIndustry(input);
    if (!resolved)
        return null;
    const entityType = input.entityType ? exports.CATALOG_ENTITY_TYPES.find((candidate) => candidate === input.entityType) : getDefaultCatalogEntityType(resolved);
    if (!entityType || !getSupportedCatalogEntityTypes(resolved).includes(entityType))
        return null;
    return configFor(entityType, resolved.industryKey);
}
function resolveCatalogCreationContext(input = {}) {
    if (!input.industryKey && !input.businessType)
        return { status: "missing", message: "Business industry is still loading. Try again once the workspace is ready." };
    const resolved = resolveCatalogIndustry(input);
    if (!resolved)
        return { status: "invalid", message: "This business has an invalid industry configuration. Open Settings to resolve the business setup before creating catalog records." };
    const supportedEntityTypes = getSupportedCatalogEntityTypes(resolved);
    if (!supportedEntityTypes.length)
        return { status: "invalid", message: "This industry does not use the product catalog. Use its Rooms or Operations workflow instead." };
    const defaultEntityType = getDefaultCatalogEntityType(resolved);
    const config = resolveCatalogCreationConfig({ ...resolved, entityType: input.entityType ?? defaultEntityType });
    if (!config)
        return { status: "invalid", message: "The selected catalog entity is not supported for this business." };
    return { status: "ready", context: { ...resolved, supportedEntityTypes, defaultEntityType, config } };
}
function isCatalogEntityType(value) {
    return typeof value === "string" && exports.CATALOG_ENTITY_TYPES.includes(value);
}
exports.CATALOG_INDUSTRY_KEYS = industries_1.INDUSTRY_KEYS;
exports.CATALOG_BUSINESS_TYPES = constants_1.BUSINESS_TYPES;
