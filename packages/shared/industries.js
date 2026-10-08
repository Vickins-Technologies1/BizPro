"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INDUSTRY_KEYS = void 0;
exports.registerIndustryModule = registerIndustryModule;
exports.getIndustryModule = getIndustryModule;
exports.listIndustryModules = listIndustryModules;
exports.resolveIndustryKey = resolveIndustryKey;
exports.resolveIndustryModule = resolveIndustryModule;
exports.resolveBusinessTypeConfig = resolveBusinessTypeConfig;
exports.getBusinessTypeCapabilities = getBusinessTypeCapabilities;
exports.hasBusinessCapability = hasBusinessCapability;
exports.isIndustryKey = isIndustryKey;
exports.isBusinessType = isBusinessType;
const constants_1 = require("./constants");
exports.INDUSTRY_KEYS = [
    "retail",
    "food_beverage",
    "beauty",
    "hospitality",
    "healthcare",
    "agriculture",
    "automotive",
    "services",
    "professional_services",
];
const INDUSTRY_MODULE_REGISTRY = {};
const BUSINESS_TYPE_TO_INDUSTRY = {};
function register(module) {
    INDUSTRY_MODULE_REGISTRY[module.key] = module;
    for (const option of module.businessTypes) {
        BUSINESS_TYPE_TO_INDUSTRY[option.value] = module.key;
    }
    return module;
}
function registerIndustryModule(module) {
    return register(module);
}
function getIndustryModule(key) {
    if (!key)
        return null;
    return isIndustryKey(key) ? INDUSTRY_MODULE_REGISTRY[key] ?? null : null;
}
function listIndustryModules() {
    return exports.INDUSTRY_KEYS.map((key) => INDUSTRY_MODULE_REGISTRY[key]).filter((module) => Boolean(module));
}
function resolveIndustryKey(input = {}) {
    if (input.industryKey && isIndustryKey(input.industryKey)) {
        return input.industryKey;
    }
    if (input.businessType && isBusinessType(input.businessType)) {
        return BUSINESS_TYPE_TO_INDUSTRY[input.businessType] ?? input.fallback ?? "services";
    }
    return input.fallback ?? "services";
}
function resolveIndustryModule(input = {}) {
    const key = resolveIndustryKey(input);
    return getIndustryModule(key) ?? getIndustryModule(input.fallback ?? "services") ?? listIndustryModules()[0];
}
const BUSINESS_TYPE_OVERRIDES = {
    law_firm: {
        capabilities: { catalog: true, products: true, inventory: false, pos: false, services: true, projects: true, matters: true, tasks: true, timeTracking: true, appointments: false, invoices: true, payments: true, expenses: true, customers: true, suppliers: false },
        terminology: { catalog: "Services", catalogItem: "Service", customers: "Clients", transaction: "Matter", staff: "Team" },
        navigation: { catalogLabel: "Services", posLabel: "Invoices", customersLabel: "Clients", catalogDescription: "Billable legal services and fee arrangements", primaryRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "More"], sidebarRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "Employees", "Finance", "Insights", "Settings", "More"] },
        operatingModel: "project",
        workspace: { primaryAction: "Open matter", primaryEntity: "Matter", activityLabel: "Matters", catalogMode: "services" },
        workflow: { headline: "Client to collection", steps: ["Client", "Matter", "Tasks, time, and expenses", "Invoice", "Payment"] },
        onboarding: ["Matter types", "Fee arrangements", "Team", "Invoice terms"],
        roles: ["Owner", "Partner", "Manager", "Associate"]
    },
    accounting_firm: {
        capabilities: { catalog: true, products: true, inventory: false, pos: false, services: true, projects: true, matters: false, tasks: true, timeTracking: true, appointments: false, invoices: true, payments: true, expenses: true, customers: true, suppliers: false },
        terminology: { catalog: "Services", catalogItem: "Service", customers: "Clients", transaction: "Engagement", staff: "Team" },
        navigation: { catalogLabel: "Services", posLabel: "Invoices", customersLabel: "Clients", catalogDescription: "Billable accounting services and fee arrangements", primaryRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "More"] },
        operatingModel: "project",
        workspace: { primaryAction: "Start engagement", primaryEntity: "Engagement", activityLabel: "Engagements", catalogMode: "services" },
        workflow: { headline: "Engagement to collection", steps: ["Client", "Engagement", "Services and tasks", "Billing", "Payment"] }
    },
    general_service: {
        capabilities: { catalog: true, products: true, inventory: false, pos: false, services: true, workOrders: true, tasks: true, appointments: true, invoices: true, payments: true, expenses: true, customers: true, suppliers: false },
        terminology: { catalog: "Services", catalogItem: "Service", customers: "Clients", transaction: "Job", staff: "Staff" },
        navigation: { catalogLabel: "Services", posLabel: "Invoices", customersLabel: "Clients", catalogDescription: "Services, pricing models, durations, and availability", primaryRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "More"], sidebarRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "Employees", "Finance", "Insights", "Settings", "More"] },
        operatingModel: "service",
        workspace: { primaryAction: "New job", primaryEntity: "Job", activityLabel: "Jobs", catalogMode: "services" },
        workflow: { headline: "Client to payment", steps: ["Client", "Job or service", "Assigned staff", "Work", "Completion", "Invoice", "Payment"] },
        onboarding: ["Services", "Staff", "Job statuses", "Invoice terms"],
        roles: ["Owner", "Manager", "Coordinator", "Staff"]
    },
    agency: {
        capabilities: { catalog: true, products: true, inventory: false, pos: false, services: true, projects: true, workOrders: true, tasks: true, appointments: true, invoices: true, payments: true, expenses: true, customers: true, suppliers: false },
        terminology: { catalog: "Services", catalogItem: "Service", customers: "Clients", transaction: "Project", staff: "Team" },
        navigation: { catalogLabel: "Services", posLabel: "Invoices", customersLabel: "Clients", catalogDescription: "Creative and professional services, pricing, and availability", primaryRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "More"] },
        operatingModel: "project",
        workspace: { primaryAction: "Start project", primaryEntity: "Project", activityLabel: "Projects", catalogMode: "services" }
    },
    auto_parts: {
        capabilities: { catalog: true, products: true, inventory: true, pos: true, barcode: true, purchasing: true, suppliers: true, customers: true, workOrders: false, jobCards: false, vehicles: false, services: false, appointments: false },
        terminology: { catalog: "Parts", catalogItem: "Part", customers: "Customers", transaction: "Sale", staff: "Team" },
        navigation: { catalogLabel: "Parts", posLabel: "Sales", customersLabel: "Customers", catalogDescription: "Parts, fitment, stock, pricing, and suppliers" },
        operatingModel: "commerce",
        workspace: { primaryAction: "Record parts sale", primaryEntity: "Sale", activityLabel: "Parts sales", catalogMode: "parts" }
    },
    service_center: {
        capabilities: { catalog: true, products: true, inventory: true, pos: true, workOrders: true, jobCards: true, vehicles: true, services: true, appointments: true, customers: true, purchasing: true, suppliers: true, barcode: false },
        terminology: { catalog: "Parts & Services", catalogItem: "Part or service", customers: "Customers", transaction: "Job card", staff: "Technicians" },
        navigation: { catalogLabel: "Parts & Services", posLabel: "Invoices", customersLabel: "Customers", catalogDescription: "Parts, labour, service packages, and workshop stock" },
        operatingModel: "work_order",
        workspace: { primaryAction: "Open job card", primaryEntity: "Job card", activityLabel: "Job cards", catalogMode: "parts" }
    },
    tyre_business: {
        capabilities: { catalog: true, products: true, inventory: true, pos: true, workOrders: true, jobCards: true, vehicles: true, services: true, appointments: true, customers: true, purchasing: true, suppliers: true, barcode: true },
        terminology: { catalog: "Tyres & Services", catalogItem: "Tyre or service", customers: "Customers", transaction: "Job card", staff: "Technicians" },
        navigation: { catalogLabel: "Tyres & Services", posLabel: "Invoices", customersLabel: "Customers", catalogDescription: "Tyres, fitment services, stock, and compatibility" },
        operatingModel: "work_order",
        workspace: { primaryAction: "Open job card", primaryEntity: "Job card", activityLabel: "Job cards", catalogMode: "parts" }
    },
    body_shop: {
        capabilities: { catalog: true, products: true, inventory: true, pos: true, workOrders: true, jobCards: true, vehicles: true, services: true, appointments: true, customers: true, purchasing: true, suppliers: true, barcode: false },
        terminology: { catalog: "Parts & Labour", catalogItem: "Part or labour", customers: "Customers", transaction: "Job card", staff: "Technicians" },
        navigation: { catalogLabel: "Parts & Labour", posLabel: "Invoices", customersLabel: "Customers", catalogDescription: "Repair parts, labour, estimates, and workshop stock" },
        operatingModel: "work_order",
        workspace: { primaryAction: "Open job card", primaryEntity: "Job card", activityLabel: "Job cards", catalogMode: "parts" }
    },
    clinic: {
        capabilities: { catalog: true, products: true, inventory: false, pos: false, patients: true, customers: true, services: true, appointments: true, reservations: true, invoices: true, payments: true, suppliers: false, pharmacy: false, barcode: false, purchasing: false },
        terminology: { catalog: "Services", catalogItem: "Service", customers: "Patients", transaction: "Visit", staff: "Providers" },
        navigation: { catalogLabel: "Services", posLabel: "Billing", customersLabel: "Patients", catalogDescription: "Clinical services, duration, pricing, and availability", primaryRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "More"], sidebarRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "Employees", "Finance", "Insights", "Settings", "More"] },
        operatingModel: "care",
        workspace: { primaryAction: "New appointment", primaryEntity: "Appointment", activityLabel: "Appointments", catalogMode: "services" },
        workflow: { headline: "Patient to payment", steps: ["Patient", "Appointment or walk-in", "Visit", "Consultation or treatment", "Billing", "Payment"] },
        onboarding: ["Services", "Providers", "Appointment schedule", "Visit workflow"],
        roles: ["Owner", "Manager", "Reception", "Provider"]
    },
    dental_clinic: {
        capabilities: { catalog: true, products: true, inventory: false, pos: false, patients: true, customers: true, services: true, appointments: true, reservations: true, invoices: true, payments: true, suppliers: false, pharmacy: false, barcode: false, purchasing: false },
        terminology: { catalog: "Treatments", catalogItem: "Treatment", customers: "Patients", transaction: "Visit", staff: "Providers" },
        navigation: { catalogLabel: "Treatments", posLabel: "Billing", customersLabel: "Patients", catalogDescription: "Treatments, duration, pricing, and availability", primaryRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "More"] },
        operatingModel: "care",
        workspace: { primaryAction: "New appointment", primaryEntity: "Appointment", activityLabel: "Appointments", catalogMode: "services" },
        workflow: { headline: "Patient to payment", steps: ["Patient", "Appointment", "Visit", "Treatment", "Billing", "Payment"] }
    },
    hotel: {
        capabilities: { catalog: true, products: false, inventory: false, pos: false, rooms: true, guests: true, reservations: true, appointments: true, services: true, housekeeping: true, invoices: true, payments: true, expenses: true, customers: true },
        terminology: { catalog: "Rooms", catalogItem: "Room", customers: "Guests", transaction: "Reservation", staff: "Staff" },
        navigation: { catalogLabel: "Rooms", posLabel: "Folio charges", customersLabel: "Guests", catalogDescription: "Rooms, room types, rates, and availability", primaryRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "More"], sidebarRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "Employees", "Finance", "Insights", "Settings", "More"] },
        operatingModel: "hospitality",
        workspace: { primaryAction: "New reservation", primaryEntity: "Reservation", activityLabel: "Reservations", catalogMode: "resources" },
        workflow: { headline: "Reservation to check-out", steps: ["Guest", "Reservation", "Check-in", "Stay and charges", "Payment", "Check-out"] },
        onboarding: ["Room types", "Rooms", "Rates", "Housekeeping statuses"],
        roles: ["Owner", "Manager", "Front desk", "Housekeeping"]
    },
    lodge: {
        capabilities: { catalog: true, products: false, inventory: false, pos: false, rooms: true, guests: true, reservations: true, appointments: true, services: true, housekeeping: true, invoices: true, payments: true, expenses: true, customers: true },
        terminology: { catalog: "Rooms", catalogItem: "Room", customers: "Guests", transaction: "Reservation", staff: "Staff" },
        navigation: { catalogLabel: "Rooms", posLabel: "Folio charges", customersLabel: "Guests", catalogDescription: "Rooms, cabins, rates, and availability", primaryRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "More"] },
        operatingModel: "hospitality",
        workspace: { primaryAction: "New reservation", primaryEntity: "Reservation", activityLabel: "Reservations", catalogMode: "resources" },
        workflow: { headline: "Reservation to check-out", steps: ["Guest", "Reservation", "Check-in", "Stay and charges", "Payment", "Check-out"] }
    },
    retail_shop: {
        capabilities: { catalog: true, products: true, inventory: true, pos: true, barcode: true, purchasing: true, customers: true, suppliers: true, invoices: true, expenses: true, payments: true },
        navigation: { catalogLabel: "Products", posLabel: "Sales", customersLabel: "Customers", catalogDescription: "Products, prices, stock, and reorder levels", primaryRoutes: ["Dashboard", "POS", "Catalog", "Customers", "Finance", "Reports", "More"], sidebarRoutes: ["Dashboard", "POS", "Catalog", "Customers", "Employees", "Finance", "Reports", "Insights", "Settings", "More"] },
        operatingModel: "commerce",
        workspace: { primaryAction: "Record sale", primaryEntity: "Sale", activityLabel: "Transactions", catalogMode: "products" }
    },
    restaurant: {
        terminology: { catalog: "Menu", catalogItem: "Menu item", customers: "Guests", transaction: "Order", staff: "Team" },
        capabilities: { menu: true, recipes: true, ingredients: true, orders: true, tables: true, kitchen: true, suppliers: true, barcode: false, appointments: false, workOrders: false, pharmacy: false, projects: false },
        navigation: { catalogLabel: "Menu", posLabel: "Orders", customersLabel: "Guests", catalogDescription: "Menu items, modifiers, and availability", primaryRoutes: ["Dashboard", "POS", "Operations", "Catalog", "Customers", "Finance", "Reports", "More"], sidebarRoutes: ["Dashboard", "POS", "Operations", "Catalog", "Customers", "Employees", "Finance", "Reports", "Insights", "Settings", "More"] },
        workflow: { headline: "Table to payment", steps: ["Table or takeaway", "Create order", "Kitchen", "Serve", "Payment"] },
        onboarding: ["Dining areas", "Tables", "Initial menu", "Kitchen workflow"],
        roles: ["Owner", "Manager", "Cashier", "Waiter", "Kitchen"],
        operatingModel: "service", workspace: { primaryAction: "Open order", primaryEntity: "Order", activityLabel: "Orders", catalogMode: "menu" }
    },
    cafe: {
        terminology: { catalog: "Menu", catalogItem: "Menu item", customers: "Guests", transaction: "Order", staff: "Team" },
        capabilities: { menu: true, recipes: true, ingredients: true, orders: true, tables: true, kitchen: true, suppliers: true, barcode: false, appointments: false, workOrders: false, pharmacy: false, projects: false },
        navigation: { catalogLabel: "Menu", posLabel: "Orders", customersLabel: "Guests", catalogDescription: "Menu items and quick-service availability", primaryRoutes: ["Dashboard", "POS", "Operations", "Catalog", "More"] },
        operatingModel: "service", workspace: { primaryAction: "Open order", primaryEntity: "Order", activityLabel: "Orders", catalogMode: "menu" }
    },
    bakery: {
        terminology: { catalog: "Bake list", catalogItem: "Baked good", customers: "Customers", transaction: "Order", staff: "Team" },
        capabilities: { menu: true, recipes: true, ingredients: true, orders: true, tables: false, kitchen: true, suppliers: true, barcode: false, appointments: false, workOrders: false, pharmacy: false, projects: false },
        navigation: { catalogLabel: "Bake list", posLabel: "Orders", customersLabel: "Customers", catalogDescription: "Baked goods, batches, and availability", primaryRoutes: ["Dashboard", "POS", "Operations", "Catalog", "More"] },
        operatingModel: "production", workspace: { primaryAction: "Create production order", primaryEntity: "Order", activityLabel: "Production orders", catalogMode: "lots" }
    },
    bar: {
        terminology: { catalog: "Drinks", catalogItem: "Drink", customers: "Guests", transaction: "Tab", staff: "Team" },
        capabilities: { menu: true, recipes: false, ingredients: true, orders: true, tables: true, kitchen: false, suppliers: true, barcode: false, appointments: false, workOrders: false, pharmacy: false, projects: false },
        navigation: { catalogLabel: "Drinks", posLabel: "Tabs", customersLabel: "Guests", catalogDescription: "Drinks, tabs, and service availability", primaryRoutes: ["Dashboard", "POS", "Operations", "Catalog", "More"] },
        operatingModel: "hospitality", workspace: { primaryAction: "Open tab", primaryEntity: "Tab", activityLabel: "Open tabs", catalogMode: "menu" }
    },
    salon: {
        terminology: { catalog: "Services", catalogItem: "Service", customers: "Clients", transaction: "Appointment", staff: "Staff" },
        capabilities: { appointments: true, customers: true, catalog: true, products: true, services: true, pos: true, inventory: false, barcode: false, purchasing: false, orders: false, tables: false, kitchen: false, workOrders: false, pharmacy: false, projects: false, suppliers: false },
        navigation: { catalogLabel: "Services", posLabel: "Checkout", customersLabel: "Clients", catalogDescription: "Services, durations, and pricing", primaryRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "Employees", "Finance", "Reports", "More"], sidebarRoutes: ["Dashboard", "Operations", "POS", "Catalog", "Customers", "Employees", "Finance", "Reports", "Insights", "Settings", "More"] },
        workflow: { headline: "Client to completion", steps: ["Client", "Appointment", "Staff", "Service", "Payment"] },
        fields: [{ key: "duration", label: "Service duration", type: "duration", required: true }, { key: "assignedStaff", label: "Assigned staff", type: "text" }],
        onboarding: ["Services", "Staff", "Booking calendar", "Appointment duration"],
        roles: ["Owner", "Manager", "Reception", "Stylist"], operatingModel: "appointment", workspace: { primaryAction: "Book appointment", primaryEntity: "Appointment", activityLabel: "Appointments", catalogMode: "services" }
    },
    spa: {
        terminology: { catalog: "Treatments", catalogItem: "Treatment", customers: "Clients", transaction: "Booking", staff: "Therapists" },
        capabilities: { appointments: true, customers: true, catalog: true, products: true, services: true, pos: true, inventory: false, barcode: false, purchasing: false, orders: false, tables: false, kitchen: false, workOrders: false, pharmacy: false, projects: false, suppliers: false },
        navigation: { catalogLabel: "Treatments", posLabel: "Checkout", customersLabel: "Clients", catalogDescription: "Treatments, durations, and pricing", primaryRoutes: ["Dashboard", "Operations", "Catalog", "Customers", "Employees", "Finance", "Reports", "More"] },
        operatingModel: "appointment", workspace: { primaryAction: "Book treatment", primaryEntity: "Booking", activityLabel: "Bookings", catalogMode: "services" }
    },
    pharmacy: {
        terminology: { catalog: "Medicines", catalogItem: "Medicine", customers: "Patients", transaction: "Dispensing", staff: "Pharmacists" },
        capabilities: { pharmacy: true, inventory: true, barcode: true, purchasing: true, customers: true, catalog: true, appointments: false, orders: false, tables: false, kitchen: false, workOrders: false, projects: false },
        navigation: { catalogLabel: "Medicines", posLabel: "Dispense", customersLabel: "Patients", catalogDescription: "Medicines, batches, expiry, and stock", primaryRoutes: ["Dashboard", "POS", "Catalog", "Customers", "More"] },
        fields: [{ key: "batchNumber", label: "Batch number", type: "text", required: true }, { key: "expiryDate", label: "Expiry date", type: "text", required: true }],
        onboarding: ["Dispensing workflow", "Expiry tracking", "Suppliers", "Pharmacy staff"],
        roles: ["Owner", "Manager", "Pharmacist", "Cashier"], operatingModel: "care", workspace: { primaryAction: "Start dispensing", primaryEntity: "Dispensing", activityLabel: "Dispensing", catalogMode: "products" }
    },
    hardware: {
        terminology: { catalog: "Stock", catalogItem: "Product", customers: "Customers", transaction: "Sale", staff: "Team" },
        capabilities: { inventory: true, barcode: true, purchasing: true, catalog: true, customers: true, appointments: false, orders: false, tables: false, kitchen: false, workOrders: false, pharmacy: false, projects: false },
        navigation: { catalogLabel: "Stock", posLabel: "Sales", customersLabel: "Customers", catalogDescription: "SKUs, units, variants, and reorder levels" },
        fields: [{ key: "sku", label: "SKU", type: "text", required: true }, { key: "unit", label: "Unit of measure", type: "text", required: true }, { key: "reorderLevel", label: "Reorder level", type: "number" }],
        operatingModel: "commerce", workspace: { primaryAction: "Start sale", primaryEntity: "Sale", activityLabel: "Sales", catalogMode: "products" }
    },
    garage: {
        terminology: { catalog: "Parts", catalogItem: "Part", customers: "Vehicle owners", transaction: "Job", staff: "Mechanics" },
        capabilities: { workOrders: true, inventory: true, catalog: true, customers: true, purchasing: true, barcode: false, appointments: true, orders: false, tables: false, kitchen: false, pharmacy: false, projects: false },
        navigation: { catalogLabel: "Parts", posLabel: "Checkout", customersLabel: "Vehicle owners", catalogDescription: "Parts, labour, and workshop stock", primaryRoutes: ["Dashboard", "Operations", "POS", "Catalog", "More"], sidebarRoutes: ["Dashboard", "Operations", "POS", "Catalog", "Customers", "Employees", "Finance", "Insights", "Settings", "More"] },
        workflow: { headline: "Job card to handover", steps: ["Open job", "Inspect vehicle", "Add parts and labour", "Complete work", "Payment"] },
        onboarding: ["Service bays", "Mechanics", "Job card statuses", "Parts catalog"],
        roles: ["Owner", "Manager", "Reception", "Mechanic"], operatingModel: "work_order", workspace: { primaryAction: "Open job card", primaryEntity: "Job", activityLabel: "Job cards", catalogMode: "parts" }
    },
    consultancy: {
        terminology: { catalog: "Services", catalogItem: "Service", customers: "Clients", transaction: "Invoice", staff: "Team" },
        capabilities: { projects: true, customers: true, catalog: true, products: false, services: true, pos: false, inventory: false, barcode: false, purchasing: false, appointments: true, orders: false, tables: false, kitchen: false, workOrders: false, pharmacy: false, suppliers: false, invoices: true, matters: false, tasks: true, timeTracking: true },
        navigation: { catalogLabel: "Services", posLabel: "Invoices", customersLabel: "Clients", catalogDescription: "Billable services, retainers, and scopes", primaryRoutes: ["Dashboard", "Operations", "POS", "Catalog", "More"] },
        workflow: { headline: "Engagement to collection", steps: ["Engagement", "Scope", "Invoice", "Payment", "Follow-up"] },
        onboarding: ["Service catalog", "Retainer settings", "Team", "Invoice terms"],
        roles: ["Owner", "Manager", "Consultant"], operatingModel: "project", workspace: { primaryAction: "Start engagement", primaryEntity: "Engagement", activityLabel: "Engagements", catalogMode: "services" }
    }
};
function resolveBusinessTypeConfig(input = {}) {
    const module = resolveIndustryModule(input);
    const businessType = isBusinessType(input.businessType ?? "") ? input.businessType : module.businessTypes[0]?.value ?? "general_service";
    const baseCapabilities = {
        catalog: true,
        products: module.key !== "services" && module.key !== "professional_services",
        inventory: module.key !== "services" && module.key !== "professional_services",
        pos: module.key !== "services" && module.key !== "professional_services",
        barcode: module.key === "retail" || module.key === "healthcare" || module.key === "agriculture" || module.key === "automotive",
        purchasing: module.key !== "services" && module.key !== "professional_services",
        menu: module.key === "food_beverage",
        recipes: module.key === "food_beverage",
        ingredients: module.key === "food_beverage" || module.key === "agriculture",
        customers: true,
        patients: module.key === "healthcare",
        guests: module.key === "food_beverage" || module.key === "hospitality",
        appointments: module.key === "beauty" || module.key === "healthcare" || module.key === "services" || module.key === "professional_services",
        services: module.key === "beauty" || module.key === "healthcare" || module.key === "automotive" || module.key === "services" || module.key === "professional_services",
        orders: module.key === "food_beverage",
        tables: module.key === "food_beverage",
        kitchen: module.key === "food_beverage",
        rooms: module.key === "hospitality",
        reservations: module.key === "hospitality" || module.key === "beauty" || module.key === "healthcare",
        housekeeping: module.key === "hospitality",
        vehicles: module.key === "automotive",
        workOrders: module.key === "automotive" || module.key === "services",
        jobCards: module.key === "automotive",
        technicians: module.key === "automotive",
        pharmacy: module.key === "healthcare" && businessType === "pharmacy",
        projects: module.key === "professional_services",
        matters: module.key === "professional_services" && ["law_firm", "accounting_firm"].includes(businessType),
        tasks: module.key === "professional_services" || module.key === "services",
        timeTracking: module.key === "professional_services" || module.key === "services" || module.key === "automotive",
        invoices: true,
        expenses: true,
        staffScheduling: module.key !== "retail",
        suppliers: module.key !== "services" && module.key !== "professional_services",
        payments: true
    };
    const override = BUSINESS_TYPE_OVERRIDES[businessType] ?? {};
    const defaultTerminology = module.key === "food_beverage"
        ? { catalog: "Menu", catalogItem: "Menu item", customers: "Guests", transaction: "Order", staff: "Team" }
        : module.key === "beauty" || module.key === "services" || module.key === "professional_services"
            ? { catalog: "Services", catalogItem: "Service", customers: "Clients", transaction: "Job", staff: "Staff" }
            : { catalog: "Products", catalogItem: "Product", customers: "Customers", transaction: "Sale", staff: "Team" };
    const terminology = { ...defaultTerminology, ...(override.terminology ?? {}) };
    const defaultNavigation = {
        catalogLabel: terminology.catalog,
        posLabel: terminology.transaction + "s",
        customersLabel: terminology.customers,
        catalogDescription: `${terminology.catalog}, pricing, and availability`,
        primaryRoutes: ["Dashboard", "POS", "Catalog", "Reports", "More"],
        sidebarRoutes: ["Dashboard", "POS", "Catalog", "Customers", "Employees", "Finance", "Insights", "Settings", "More"]
    };
    const navigation = { ...defaultNavigation, ...(override.navigation ?? {}) };
    const operatingModel = override.operatingModel ?? defaultOperatingModel(module.key);
    const workspace = {
        ...defaultWorkspace(operatingModel, terminology),
        ...(override.workspace ?? {})
    };
    return {
        businessType,
        industryKey: module.key,
        label: module.businessTypes.find((option) => option.value === businessType)?.label ?? module.label,
        terminology,
        capabilities: { ...baseCapabilities, ...(override.capabilities ?? {}) },
        workflow: override.workflow ?? { headline: `${terminology.catalogItem} to payment`, steps: module.salesWorkflow.steps },
        fields: override.fields ?? [],
        navigation,
        operatingModel,
        workspace,
        reports: module.reports,
        onboarding: override.onboarding ?? [terminology.catalog, terminology.customers, terminology.staff],
        roles: override.roles ?? ["Owner", "Manager", "Cashier"]
    };
}
function defaultOperatingModel(industryKey) {
    switch (industryKey) {
        case "food_beverage": return "service";
        case "beauty": return "appointment";
        case "hospitality": return "hospitality";
        case "healthcare": return "care";
        case "agriculture": return "production";
        case "automotive": return "work_order";
        case "services": return "service";
        case "professional_services": return "project";
        default: return "commerce";
    }
}
function defaultWorkspace(model, terminology) {
    switch (model) {
        case "appointment": return { primaryAction: "Book appointment", primaryEntity: "Appointment", activityLabel: "Appointments", catalogMode: "services" };
        case "work_order": return { primaryAction: "Open job", primaryEntity: "Job", activityLabel: "Jobs", catalogMode: "parts" };
        case "hospitality": return { primaryAction: "Open folio", primaryEntity: "Folio", activityLabel: "Open folios", catalogMode: "resources" };
        case "care": return { primaryAction: "Open visit", primaryEntity: "Visit", activityLabel: "Visits", catalogMode: "services" };
        case "production": return { primaryAction: "Record production", primaryEntity: "Production run", activityLabel: "Production", catalogMode: "lots" };
        case "project": return { primaryAction: "Start project", primaryEntity: "Project", activityLabel: "Projects", catalogMode: "services" };
        case "service": return { primaryAction: `Create ${terminology.transaction.toLowerCase()}`, primaryEntity: terminology.transaction, activityLabel: `${terminology.transaction}s`, catalogMode: "services" };
        default: return { primaryAction: "Start sale", primaryEntity: "Sale", activityLabel: "Sales", catalogMode: "products" };
    }
}
function getBusinessTypeCapabilities(input) {
    return resolveBusinessTypeConfig(input).capabilities;
}
function hasBusinessCapability(input, capability) {
    const capabilities = "capabilities" in input ? input.capabilities : resolveBusinessTypeConfig(input).capabilities;
    return Boolean(capabilities[capability]);
}
function isIndustryKey(value) {
    return exports.INDUSTRY_KEYS.includes(value);
}
function isBusinessType(value) {
    return constants_1.BUSINESS_TYPES.includes(value);
}
function typeOption(value, label, description) {
    return { value, label, description };
}
function dashboardWidget(widget) {
    return widget;
}
register({
    key: "retail",
    label: "Retail",
    description: "Broad store operations for goods-first businesses that sell physical products quickly.",
    businessTypes: [
        typeOption("retail_shop", "Retail Shop", "General retail and fast-moving stock."),
        typeOption("hardware", "Hardware Store", "Tools, building supplies, and durable goods."),
    ],
    dashboard: {
        headline: "Retail operations at a glance",
        summary: "Track tills, stock movement, and margin pressure in one place.",
        widgets: [
            dashboardWidget({ key: "retail-sales", label: "Today's Sales", metric: "salesTotal", tone: "primary", icon: "cash-outline", description: "Sales closed today." }),
            dashboardWidget({ key: "retail-transactions", label: "Transactions", metric: "transactionsCount", tone: "primary", icon: "receipt-outline", description: "Sales transactions in the selected range." }),
            dashboardWidget({ key: "retail-gross-profit", label: "Gross Profit", metric: "grossProfit", tone: "success", icon: "trending-up-outline", description: "Sales less product cost." }),
            dashboardWidget({ key: "retail-inventory", label: "Inventory Value", metric: "inventoryValue", tone: "success", icon: "cube-outline", description: "Stock value on hand." }),
            dashboardWidget({ key: "retail-customers", label: "Customers", metric: "customersCount", tone: "primary", icon: "people-outline", description: "Active customer records." }),
            dashboardWidget({ key: "retail-low-stock", label: "Low Stock", metric: "lowStockCount", tone: "warning", icon: "warning-outline", description: "Items below threshold." })
        ],
    },
    features: ["Barcode selling", "Category merchandising", "Multi-branch stock control", "Promotions and bundles"],
    permissions: ["viewDashboard", "manageSales", "createSales", "refundSales", "manageInventory", "addProducts", "editProducts", "deleteProducts", "viewReports", "manageCustomers"],
    reports: ["Sales summary", "Stock valuation", "Low stock watchlist", "Product performance"],
    inventory: {
        label: "Retail inventory",
        focus: "Keep shelf stock, reorder points, and product variants visible.",
        controls: ["Reorder alerts", "Variant tracking", "Stock corrections", "Barcode lookup"],
    },
    salesWorkflow: {
        steps: ["Scan items", "Review basket", "Apply discount", "Take payment", "Print receipt"],
    },
    analytics: {
        focus: "Sell-through and basket health",
        metrics: ["Average basket size", "Sell-through rate", "Stockout risk", "Gross margin"],
    },
});
register({
    key: "food_beverage",
    label: "Food & Beverage",
    description: "Service-led ordering and stock control for restaurants, cafes, bars, and fast casual venues.",
    businessTypes: [
        typeOption("restaurant", "Restaurant", "Table service, takeaway, and food counters."),
        typeOption("cafe", "Cafe", "Coffee, pastries, and light service."),
        typeOption("bakery", "Bakery", "Fresh baked goods and daily production."),
        typeOption("bar", "Bar", "Drinks-led service and fast tabs."),
    ],
    dashboard: {
        headline: "Service and kitchen flow",
        summary: "Balance live orders, stock consumption, and daily covers.",
        widgets: [
            dashboardWidget({ key: "fnb-kitchen", label: "Kitchen", metric: "kitchenQueueCount", tone: "warning", icon: "restaurant-outline", description: "Orders awaiting service." }),
            dashboardWidget({ key: "fnb-orders", label: "Orders", metric: "ordersCount", tone: "primary", icon: "receipt-outline", description: "Orders in the selected range." }),
            dashboardWidget({ key: "fnb-tables", label: "Tables", metric: "tablesCount", tone: "success", icon: "grid-outline", description: "Tables or service stations in use." }),
            dashboardWidget({ key: "fnb-revenue", label: "Revenue", metric: "revenueTotal", tone: "primary", icon: "cash-outline", description: "Revenue in the selected range." }),
            dashboardWidget({ key: "fnb-shortages", label: "Ingredient Shortages", metric: "lowStockCount", tone: "warning", icon: "warning-outline", description: "Ingredients below their par level." }),
            dashboardWidget({ key: "fnb-transactions", label: "Transactions", metric: "transactionsCount", tone: "primary", icon: "card-outline", description: "Payments and completed transactions." })
        ],
    },
    features: ["Menu modifiers", "Table orders", "Kitchen tickets", "Recipe depletion"],
    permissions: ["viewDashboard", "manageSales", "createSales", "refundSales", "manageInventory", "addProducts", "editProducts", "viewReports", "manageCustomers", "manageExpenses"],
    reports: ["Sales by service period", "Popular menu items", "Waste and spoilage", "Food cost trend"],
    inventory: {
        label: "Ingredient inventory",
        focus: "Track ingredients, recipes, and wastage before stock runs thin.",
        controls: ["Recipe deductions", "Prep batches", "Waste logging", "Par level alerts"],
    },
    salesWorkflow: {
        steps: ["Create order", "Send to kitchen", "Serve table", "Settle bill", "Close shift"],
    },
    analytics: {
        focus: "Covers, average ticket, and food cost",
        metrics: ["Average ticket", "Table turnover", "Food cost ratio", "Waste ratio"],
    },
});
register({
    key: "beauty",
    label: "Beauty",
    description: "Appointment-aware retail and services for salons, spas, and beauty shops.",
    businessTypes: [
        typeOption("boutique", "Boutique", "Fashion and personal style retail."),
        typeOption("cosmetics", "Cosmetics", "Beauty products and personal care items."),
        typeOption("accessories", "Accessories", "Complementary fashion and lifestyle products."),
        typeOption("salon", "Salon", "Hair, nail, and grooming services."),
        typeOption("spa", "Spa", "Wellness, treatment, and relaxation services."),
    ],
    dashboard: {
        headline: "Appointments and retail in sync",
        summary: "Blend bookings, retail sales, and client retention signals.",
        widgets: [
            dashboardWidget({ key: "beauty-appointments", label: "Appointments", metric: "appointmentsCount", tone: "primary", icon: "calendar-outline", description: "Scheduled appointments." }),
            dashboardWidget({ key: "beauty-stylists", label: "Stylists", metric: "stylistsCount", tone: "success", icon: "cut-outline", description: "Staff active on the floor." }),
            dashboardWidget({ key: "beauty-revenue", label: "Revenue", metric: "revenueTotal", tone: "primary", icon: "cash-outline", description: "Retail and service revenue." }),
            dashboardWidget({ key: "beauty-clients", label: "Clients", metric: "clientsCount", tone: "warning", icon: "people-outline", description: "Client base and repeat traffic." })
        ],
    },
    features: ["Appointment pipeline", "Service add-ons", "Client notes", "Retail upsells"],
    permissions: ["viewDashboard", "manageSales", "createSales", "refundSales", "manageInventory", "addProducts", "editProducts", "viewReports", "manageCustomers"],
    reports: ["Bookings summary", "Retail vs service mix", "Client repeat rate", "Top stylists or services"],
    inventory: {
        label: "Beauty stock",
        focus: "Track retail products, consumables, and backbar usage.",
        controls: ["Service consumption", "Retail restock", "Bundle kits", "Expiry-aware stock"],
    },
    salesWorkflow: {
        steps: ["Book client", "Add service", "Attach products", "Take payment", "Close visit"],
    },
    analytics: {
        focus: "Retention and service mix",
        metrics: ["Repeat visits", "Service attachment rate", "Average booking value", "Retail conversion"],
    },
});
register({
    key: "hospitality",
    label: "Hospitality",
    description: "Guest-first operations for hotels, lodges, lounges, and mixed hospitality venues.",
    businessTypes: [
        typeOption("wines_spirits", "Wine & Spirits", "Beverage retail with hospitality-style service."),
        typeOption("hotel", "Hotel", "Rooms, stays, and front desk operations."),
        typeOption("lodge", "Lodge", "Guest accommodation and local hospitality."),
    ],
    dashboard: {
        headline: "Guest operations control",
        summary: "Monitor occupancy, spend, and guest service movement together.",
        widgets: [
            dashboardWidget({ key: "hospitality-occupancy", label: "Occupancy", metric: "occupancyCount", tone: "primary", icon: "bed-outline", description: "Rooms or stays in use." }),
            dashboardWidget({ key: "hospitality-arrivals", label: "Arrivals", metric: "appointmentsCount", tone: "success", icon: "log-in-outline", description: "Guests expected to check in." }),
            dashboardWidget({ key: "hospitality-departures", label: "Departures", metric: "jobsCount", tone: "warning", icon: "log-out-outline", description: "Guests expected to check out." }),
            dashboardWidget({ key: "hospitality-guests", label: "Current Guests", metric: "foliosCount", tone: "primary", icon: "people-outline", description: "Active guest stays and folios." }),
            dashboardWidget({ key: "hospitality-rooms", label: "Available Rooms", metric: "roomsCount", tone: "success", icon: "bed-outline", description: "Rooms ready to sell." }),
            dashboardWidget({ key: "hospitality-folios", label: "Folios", metric: "foliosCount", tone: "warning", icon: "document-text-outline", description: "Open guest accounts." }),
            dashboardWidget({ key: "hospitality-staff", label: "Staff", metric: "staffCount", tone: "success", icon: "people-outline", description: "Assigned team members." }),
            dashboardWidget({ key: "hospitality-revenue", label: "Revenue", metric: "revenueTotal", tone: "primary", icon: "cash-outline", description: "Revenue in the selected range." })
        ],
    },
    features: ["Reservation handling", "Room or table folios", "Guest notes", "Service charge handling"],
    permissions: ["viewDashboard", "manageSales", "createSales", "refundSales", "manageInventory", "addProducts", "viewReports", "manageCustomers", "manageSettings"],
    reports: ["Occupancy summary", "Guest spend", "Service charge report", "Revenue by outlet"],
    inventory: {
        label: "Hospitality stock",
        focus: "Manage room supplies, bar stock, and service consumables.",
        controls: ["Outlet stock", "House usage", "Loss tracking", "Reorder flags"],
    },
    salesWorkflow: {
        steps: ["Open folio", "Add services", "Capture charges", "Settle account", "Close stay"],
    },
    analytics: {
        focus: "Occupancy and guest spend",
        metrics: ["Occupancy rate", "Average daily rate", "Guest spend", "Outlet revenue mix"],
    },
});
register({
    key: "healthcare",
    label: "Healthcare",
    description: "Care-oriented billing and inventory for clinics, practices, and dispensaries.",
    businessTypes: [
        typeOption("clinic", "Clinic", "Primary care and patient visits."),
        typeOption("pharmacy", "Pharmacy", "Prescription and over-the-counter dispensing."),
        typeOption("dental_clinic", "Dental Clinic", "Dental care and treatment billing."),
    ],
    dashboard: {
        headline: "Care and billing overview",
        summary: "Keep patient flow, service billing, and stock checks visible.",
        widgets: [
            dashboardWidget({ key: "healthcare-patients", label: "Patients", metric: "patientsCount", tone: "primary", icon: "person-outline", description: "Patient records on file." }),
            dashboardWidget({ key: "healthcare-appointments", label: "Appointments", metric: "appointmentsCount", tone: "success", icon: "calendar-outline", description: "Booked visits in the period." }),
            dashboardWidget({ key: "healthcare-visits", label: "Visits", metric: "ordersCount", tone: "warning", icon: "clipboard-outline", description: "Visits and consultations in the period." }),
            dashboardWidget({ key: "healthcare-providers", label: "Providers", metric: "staffCount", tone: "success", icon: "medkit-outline", description: "Providers and care staff." }),
            dashboardWidget({ key: "healthcare-billing", label: "Outstanding Billing", metric: "receivablesCount", tone: "warning", icon: "wallet-outline", description: "Patient balances awaiting payment." }),
            dashboardWidget({ key: "healthcare-revenue", label: "Revenue", metric: "revenueTotal", tone: "primary", icon: "cash-outline", description: "Collections and service income." })
        ],
    },
    features: ["Visit-based billing", "Patient notes", "Dispensary control", "Service follow-up"],
    permissions: ["viewDashboard", "manageSales", "createSales", "refundSales", "manageInventory", "addProducts", "viewReports", "manageCustomers", "manageSettings"],
    reports: ["Patient billing", "Dispensary usage", "Service mix", "Revenue by provider"],
    inventory: {
        label: "Clinical inventory",
        focus: "Track medicines, consumables, and controlled stock with tighter thresholds.",
        controls: ["Batch tracking", "Expiry alerts", "Controlled items", "Dispensary depletion"],
    },
    salesWorkflow: {
        steps: ["Open visit", "Add services or items", "Confirm charges", "Take payment", "Close visit"],
    },
    analytics: {
        focus: "Throughput and stock availability",
        metrics: ["Visit volume", "Average charge", "Stock cover days", "Repeat visit rate"],
    },
});
register({
    key: "agriculture",
    label: "Agriculture",
    description: "Input, produce, and seasonal inventory control for farms and agribusiness operators.",
    businessTypes: [
        typeOption("agrovet", "Agrovet", "Inputs, seed, feed, and farm supplies."),
        typeOption("farm", "Farm", "Production, harvest, and seasonal selling."),
        typeOption("feed_store", "Feed Store", "Animal feed and farm consumables."),
    ],
    dashboard: {
        headline: "Field and stock visibility",
        summary: "Track seasonal demand, farm inputs, and produce movement together.",
        widgets: [
            dashboardWidget({ key: "agriculture-lots", label: "Produce Lots", metric: "ordersCount", tone: "primary", icon: "leaf-outline", description: "Harvest or produce lots tracked." }),
            dashboardWidget({ key: "agriculture-stock", label: "Input Stock", metric: "inventoryValue", tone: "success", icon: "cube-outline", description: "Seeds, feed, and stock value." }),
            dashboardWidget({ key: "agriculture-customers", label: "Customers", metric: "customersCount", tone: "warning", icon: "people-outline", description: "Customers and buyers served." }),
            dashboardWidget({ key: "agriculture-revenue", label: "Revenue", metric: "revenueTotal", tone: "primary", icon: "cash-outline", description: "Sales in the selected range." })
        ],
    },
    features: ["Input packs", "Produce lots", "Seasonal planning", "Yield tracking"],
    permissions: ["viewDashboard", "manageSales", "createSales", "manageInventory", "addProducts", "viewReports", "manageCustomers", "manageExpenses"],
    reports: ["Input usage", "Produce sales", "Seasonal yield", "Stock by lot"],
    inventory: {
        label: "Farm inventory",
        focus: "Track seeds, feed, chemicals, and produce lots with seasonal visibility.",
        controls: ["Lot tracking", "Season planning", "Input depletion", "Field stock"],
    },
    salesWorkflow: {
        steps: ["Select produce", "Record lot", "Capture payment", "Issue receipt", "Update inventory"],
    },
    analytics: {
        focus: "Yield, seasonality, and turnover",
        metrics: ["Yield per lot", "Seasonal turnover", "Input burn rate", "Produce margin"],
    },
});
register({
    key: "automotive",
    label: "Automotive",
    description: "Parts, service, and workshop operations for garages and vehicle service businesses.",
    businessTypes: [
        typeOption("garage", "Garage", "Vehicle repair and workshop operations."),
        typeOption("auto_parts", "Auto Parts", "Vehicle parts, spares, and accessories."),
        typeOption("service_center", "Service Center", "Routine maintenance and service bays."),
        typeOption("tyre_business", "Tyre Business", "Tyre sales, fitting, balancing, and repairs."),
        typeOption("body_shop", "Body Shop", "Collision repair, paint, and bodywork."),
    ],
    dashboard: {
        headline: "Workshop and parts flow",
        summary: "Keep bays, parts, and service jobs coordinated without losing margin.",
        widgets: [
            dashboardWidget({ key: "automotive-repairs", label: "Repairs", metric: "repairsCount", tone: "primary", icon: "build-outline", description: "Repair orders in the period." }),
            dashboardWidget({ key: "automotive-mechanics", label: "Mechanics", metric: "mechanicsCount", tone: "success", icon: "construct-outline", description: "Available workshop staff." }),
            dashboardWidget({ key: "automotive-parts", label: "Parts", metric: "partsCount", tone: "warning", icon: "settings-outline", description: "Parts and spares catalogued." }),
            dashboardWidget({ key: "automotive-revenue", label: "Revenue", metric: "revenueTotal", tone: "primary", icon: "cash-outline", description: "Workshop revenue in range." })
        ],
    },
    features: ["Job cards", "Parts catalog", "Service reminders", "Vehicle history"],
    permissions: ["viewDashboard", "manageSales", "createSales", "refundSales", "manageInventory", "addProducts", "viewReports", "manageCustomers", "manageSettings"],
    reports: ["Workshop revenue", "Parts usage", "Repeat service rate", "Job turnaround"],
    inventory: {
        label: "Parts inventory",
        focus: "Track spare parts, consumables, and workshop stock by fitment.",
        controls: ["Fitment tagging", "Job depletion", "Service parts", "Low stock flags"],
    },
    salesWorkflow: {
        steps: ["Open job", "Add parts", "Add labour", "Take payment", "Close repair order"],
    },
    analytics: {
        focus: "Bay productivity and parts margin",
        metrics: ["Job turnaround", "Parts margin", "Repeat repairs", "Bay utilisation"],
    },
});
register({
    key: "services",
    label: "Services",
    description: "General service businesses that sell labour, jobs, or bundled service work.",
    businessTypes: [
        typeOption("general_service", "General Service", "Flexible labour, support, or field service work."),
    ],
    dashboard: {
        headline: "Service business control",
        summary: "Monitor jobs, invoices, and collections with minimal clutter.",
        widgets: [
            dashboardWidget({ key: "services-jobs", label: "Jobs", metric: "jobsCount", tone: "primary", icon: "briefcase-outline", description: "Active jobs or service tickets." }),
            dashboardWidget({ key: "services-upcoming", label: "Upcoming Work", metric: "appointmentsCount", tone: "success", icon: "calendar-outline", description: "Scheduled work and appointments." }),
            dashboardWidget({ key: "services-completed", label: "Completed Jobs", metric: "completedJobsCount", tone: "warning", icon: "checkmark-circle-outline", description: "Completed jobs in the selected period." }),
            dashboardWidget({ key: "services-clients", label: "Clients", metric: "clientsCount", tone: "success", icon: "people-outline", description: "Active client records." }),
            dashboardWidget({ key: "services-unpaid", label: "Unpaid Invoices", metric: "receivablesCount", tone: "danger", icon: "wallet-outline", description: "Outstanding client invoices." }),
            dashboardWidget({ key: "services-staff", label: "Staff", metric: "staffCount", tone: "warning", icon: "person-outline", description: "Team capacity available." }),
            dashboardWidget({ key: "services-revenue", label: "Revenue", metric: "revenueTotal", tone: "primary", icon: "cash-outline", description: "Service revenue collected." })
        ],
    },
    features: ["Job estimates", "Invoice capture", "Client follow-up", "Service bundles"],
    permissions: ["viewDashboard", "manageSales", "createSales", "refundSales", "viewReports", "manageCustomers", "manageSettings"],
    reports: ["Invoice summary", "Outstanding balances", "Client activity", "Service revenue"],
    inventory: {
        label: "Service catalog",
        focus: "Keep service items, billable extras, and stock dependencies clear.",
        controls: ["Service pricing", "Job extras", "Time tracking", "Bundle offers"],
    },
    salesWorkflow: {
        steps: ["Create estimate", "Confirm work", "Capture payment", "Issue receipt", "Follow up"],
    },
    analytics: {
        focus: "Utilisation and collection speed",
        metrics: ["Utilisation rate", "Average invoice", "Collection speed", "Repeat bookings"],
    },
});
register({
    key: "professional_services",
    label: "Professional Services",
    description: "High-trust billing and project-style operations for consultants, firms, and agencies.",
    businessTypes: [
        typeOption("consultancy", "Consultancy", "Advisory, strategy, and expert services."),
        typeOption("agency", "Agency", "Creative, digital, and delivery-led services."),
        typeOption("law_firm", "Law Firm", "Legal services and client retainers."),
        typeOption("accounting_firm", "Accounting Firm", "Accounting, audit, and financial services."),
    ],
    dashboard: {
        headline: "Projects and retainers",
        summary: "Track client engagements, receivables, and delivery health in one view.",
        widgets: [
            dashboardWidget({ key: "pro-projects", label: "Projects", metric: "projectsCount", tone: "primary", icon: "folder-open-outline", description: "Open client projects." }),
            dashboardWidget({ key: "pro-tasks", label: "Billable Work", metric: "billableWorkCount", tone: "success", icon: "time-outline", description: "Active billable tasks and time work." }),
            dashboardWidget({ key: "pro-deadlines", label: "Upcoming Deadlines", metric: "deadlinesCount", tone: "warning", icon: "calendar-outline", description: "Projects and matters with scheduled work." }),
            dashboardWidget({ key: "pro-retainers", label: "Retainers", metric: "retainersCount", tone: "success", icon: "repeat-outline", description: "Active retainer clients." }),
            dashboardWidget({ key: "pro-receivables", label: "Receivables", metric: "receivablesCount", tone: "warning", icon: "wallet-outline", description: "Outstanding client balances." }),
            dashboardWidget({ key: "pro-revenue", label: "Revenue", metric: "revenueTotal", tone: "primary", icon: "cash-outline", description: "Billings and cash collected." })
        ],
    },
    features: ["Project billing", "Retainers", "Time-based work", "Client statements"],
    permissions: ["viewDashboard", "manageSales", "createSales", "viewReports", "manageCustomers", "manageSettings"],
    reports: ["Retainer summary", "Receivables aging", "Project profitability", "Client statement"],
    inventory: {
        label: "Service resources",
        focus: "Plan billable capacity, retainer scopes, and service deliverables.",
        controls: ["Scope control", "Retainer tracking", "Milestone billing", "Time entries"],
    },
    salesWorkflow: {
        steps: ["Log engagement", "Prepare invoice", "Capture payment", "Update client account", "Close milestone"],
    },
    analytics: {
        focus: "Profitability and cash collection",
        metrics: ["Project margin", "Retainer renewal rate", "Receivables aging", "Billable utilisation"],
    },
});
