"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INDUSTRY_KEYS = void 0;
exports.registerIndustryModule = registerIndustryModule;
exports.getIndustryModule = getIndustryModule;
exports.listIndustryModules = listIndustryModules;
exports.resolveIndustryKey = resolveIndustryKey;
exports.resolveIndustryModule = resolveIndustryModule;
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
            dashboardWidget({ key: "fnb-revenue", label: "Revenue", metric: "revenueTotal", tone: "primary", icon: "cash-outline", description: "Revenue in the selected range." })
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
            dashboardWidget({ key: "healthcare-stock", label: "Stock", metric: "inventoryValue", tone: "warning", icon: "medkit-outline", description: "Clinical stock value." }),
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
            dashboardWidget({ key: "services-clients", label: "Clients", metric: "clientsCount", tone: "success", icon: "people-outline", description: "Active client records." }),
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
