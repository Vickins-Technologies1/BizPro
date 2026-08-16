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
export type DashboardMetricKey = "salesTotal" | "inventoryValue" | "customersCount" | "lowStockCount" | "ordersCount" | "kitchenQueueCount" | "tablesCount" | "appointmentsCount" | "stylistsCount" | "repairsCount" | "mechanicsCount" | "partsCount" | "revenueTotal" | "clientsCount" | "patientsCount" | "foliosCount" | "occupancyCount" | "projectsCount" | "retainersCount" | "receivablesCount" | "jobsCount" | "staffCount";
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
export declare function isIndustryKey(value: string): value is IndustryKey;
export declare function isBusinessType(value: string): value is BusinessType;
export {};
