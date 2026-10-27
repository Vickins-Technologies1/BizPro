import { hasPermission, type AccessPermission, type WorkspaceRoute } from "@shared";

type WorkspaceUser = Parameters<typeof hasPermission>[0];
type BusinessConfig = ReturnType<typeof import("@shared").resolveBusinessTypeConfig>;

const permissionByRoute: Partial<Record<WorkspaceRoute, AccessPermission>> = {
  Dashboard: "viewDashboard",
  POS: "createSales",
  Customers: "manageCustomers",
  Employees: "manageEmployees",
  Reports: "viewReports",
  Finance: "manageExpenses",
  Insights: "viewReports",
  Settings: "manageSettings",
  Operations: "manageOperations"
};

export function getAvailableWorkspaceRoutes(
  routes: readonly WorkspaceRoute[],
  config: BusinessConfig,
  user: WorkspaceUser
) {
  return routes.filter((routeName) => {
    let capabilityAvailable = true;
    if (routeName === "Catalog") capabilityAvailable = config.capabilities.catalog;
    if (routeName === "POS") capabilityAvailable = config.capabilities.pos;
    if (routeName === "Customers") capabilityAvailable = config.capabilities.customers;
    if (routeName === "Operations") capabilityAvailable = config.capabilities.orders || config.capabilities.appointments || config.capabilities.workOrders || config.capabilities.projects || config.capabilities.tasks;
    if (routeName === "Finance") capabilityAvailable = config.capabilities.payments;
    return capabilityAvailable && isWorkspaceRouteAuthorized(routeName, user);
  });
}

export function layoutMobileWorkspaceRoutes(routes: readonly WorkspaceRoute[]) {
  const primaryRoutes = routes.filter((routeName) => routeName !== "More");
  if (primaryRoutes.length <= 4) {
    return { tabRoutes: [...routes], overflowRoutes: [] as WorkspaceRoute[] };
  }
  return {
    tabRoutes: [...primaryRoutes.slice(0, 4), "More" as const],
    overflowRoutes: primaryRoutes.slice(4)
  };
}

export function isWorkspaceTabRoute(routeName: string): routeName is WorkspaceRoute {
  return ["Dashboard", "POS", "Catalog", "Customers", "Employees", "Reports", "Finance", "Insights", "Settings", "Operations"].includes(routeName);
}

function isWorkspaceRouteAuthorized(routeName: WorkspaceRoute, user: WorkspaceUser) {
  const requiredPermission = permissionByRoute[routeName];
  if (routeName === "More") return true;
  if (routeName === "POS") return hasPermission(user, "createSales") || hasPermission(user, "manageSales");
  if (routeName === "Catalog") return hasPermission(user, "manageInventory") || hasPermission(user, "addProducts");
  if (routeName === "Finance") return hasPermission(user, "manageExpenses") || hasPermission(user, "viewReports");
  if (routeName === "Operations") return ["manageOperations", "manageAppointments", "manageBookings", "manageTables", "manageWorkOrders", "managePharmacy", "dispenseMedicines"]
    .some((permission) => hasPermission(user, permission as AccessPermission));
  if (!requiredPermission) return true;
  return hasPermission(user, requiredPermission);
}
