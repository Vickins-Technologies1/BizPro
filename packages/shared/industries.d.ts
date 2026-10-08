import type { AccessPermission } from "./access";
import { BUSINESS_TYPES } from "./constants";
export declare const INDUSTRY_KEYS: readonly ["retail", "food_beverage", "beauty", "hospitality", "healthcare", "agriculture", "automotive", "services", "professional_services"];
export type IndustryKey = (typeof INDUSTRY_KEYS)[number];
type BusinessType = (typeof BUSINESS_TYPES)[number];
export type IndustryBusinessTypeOption = {
    value: BusinessType;
    label: string;
    description: string;
};
export type BusinessCapability = "catalog" | "products" | "inventory" | "pos" | "barcode" | "purchasing" | "menu" | "recipes" | "ingredients" | "customers" | "patients" | "guests" | "appointments" | "services" | "orders" | "tables" | "kitchen" | "rooms" | "reservations" | "housekeeping" | "vehicles" | "workOrders" | "jobCards" | "technicians" | "pharmacy" | "projects" | "matters" | "tasks" | "timeTracking" | "invoices" | "expenses" | "staffScheduling" | "suppliers" | "payments";
export type BusinessField = {
    key: string;
    label: string;
    type: "text" | "number" | "currency" | "duration" | "toggle";
    required?: boolean;
    help?: string;
};
export type WorkspaceRoute = "Dashboard" | "POS" | "Catalog" | "Customers" | "Employees" | "Reports" | "Finance" | "Insights" | "Settings" | "Operations" | "More";
/** The operating model is deliberately separate from the industry name.
 * An industry may sell items, deliver appointments, run jobs, host stays, or
 * manage projects. Screens use this model to avoid falling back to retail POS
 * language just because a business has a catalogue or accepts payments.
 */
export type OperatingModel = "commerce" | "service" | "appointment" | "work_order" | "hospitality" | "care" | "production" | "project";
export type BusinessTypeConfig = {
    businessType: BusinessType;
    industryKey: IndustryKey;
    label: string;
    terminology: {
        catalog: string;
        catalogItem: string;
        customers: string;
        transaction: string;
        staff: string;
    };
    capabilities: Readonly<Record<BusinessCapability, boolean>>;
    workflow: {
        headline: string;
        steps: readonly string[];
    };
    fields: readonly BusinessField[];
    navigation: {
        catalogLabel: string;
        posLabel: string;
        customersLabel: string;
        catalogDescription: string;
        primaryRoutes: readonly WorkspaceRoute[];
        sidebarRoutes: readonly WorkspaceRoute[];
    };
    operatingModel: OperatingModel;
    workspace: {
        primaryAction: string;
        primaryEntity: string;
        activityLabel: string;
        catalogMode: "products" | "services" | "menu" | "parts" | "resources" | "lots";
    };
    reports: readonly string[];
    onboarding: readonly string[];
    roles: readonly string[];
};
export type DashboardMetricKey = "salesTotal" | "transactionsCount" | "grossProfit" | "inventoryValue" | "customersCount" | "lowStockCount" | "ordersCount" | "kitchenQueueCount" | "tablesCount" | "appointmentsCount" | "stylistsCount" | "repairsCount" | "mechanicsCount" | "partsCount" | "revenueTotal" | "clientsCount" | "patientsCount" | "foliosCount" | "roomsCount" | "suppliersCount" | "expiringCount" | "completedJobsCount" | "tasksCount" | "billableWorkCount" | "deadlinesCount" | "occupancyCount" | "projectsCount" | "retainersCount" | "receivablesCount" | "jobsCount" | "staffCount";
export type DashboardWidget = {
    key: string;
    label: string;
    metric: DashboardMetricKey;
    tone?: "primary" | "success" | "warning" | "danger";
    icon?: string;
    description?: string;
};
export type IndustryModule = {
    key: IndustryKey;
    label: string;
    description: string;
    businessTypes: readonly IndustryBusinessTypeOption[];
    dashboard: {
        headline: string;
        summary: string;
        widgets: readonly DashboardWidget[];
    };
    features: readonly string[];
    permissions: readonly AccessPermission[];
    reports: readonly string[];
    inventory: {
        label: string;
        focus: string;
        controls: readonly string[];
    };
    salesWorkflow: {
        steps: readonly string[];
    };
    analytics: {
        focus: string;
        metrics: readonly string[];
    };
};
export declare function registerIndustryModule(module: IndustryModule): IndustryModule;
export declare function getIndustryModule(key?: string | null): IndustryModule | null;
export declare function listIndustryModules(): IndustryModule[];
export declare function resolveIndustryKey(input?: {
    industryKey?: string | null | undefined;
    businessType?: string | null | undefined;
    fallback?: IndustryKey;
}): "retail" | "food_beverage" | "beauty" | "hospitality" | "healthcare" | "agriculture" | "automotive" | "services" | "professional_services";
export declare function resolveIndustryModule(input?: {
    industryKey?: string | null | undefined;
    businessType?: string | null | undefined;
    fallback?: IndustryKey;
}): IndustryModule;
export declare function resolveBusinessTypeConfig(input?: {
    businessType?: string | null | undefined;
    industryKey?: string | null | undefined;
}): BusinessTypeConfig;
export declare function getBusinessTypeCapabilities(input: {
    businessType?: string | null;
    industryKey?: string | null;
}): Readonly<Record<BusinessCapability, boolean>>;
export declare function hasBusinessCapability(input: {
    businessType?: string | null;
    industryKey?: string | null;
} | BusinessTypeConfig, capability: BusinessCapability): boolean;
export declare function isIndustryKey(value: string): value is IndustryKey;
export declare function isBusinessType(value: string): value is BusinessType;
export {};
