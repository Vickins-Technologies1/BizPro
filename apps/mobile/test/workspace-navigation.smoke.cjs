process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "CommonJS",
  moduleResolution: "Node"
});
require("ts-node/register/transpile-only");

const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const originalLoad = Module._load;
let systemScheme = "light";
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const sharedEntry = path.resolve(repoRoot, "packages", "shared", "src", "index.ts");

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "@shared") return originalLoad.call(this, sharedEntry, parent, isMain);
  if (request === "react-native") return { Appearance: { getColorScheme: () => systemScheme } };
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const { resolveBusinessTypeConfig } = require("@shared");
  const { getAvailableWorkspaceRoutes, isWorkspaceTabRoute, layoutMobileWorkspaceRoutes } = require("../src/navigation/workspaceRoutes.ts");
  const retail = resolveBusinessTypeConfig({ businessType: "retail_shop" });
  const cashier = { role: "cashier", permissions: ["manageSales", "createSales", "manageCustomers", "manageSettings"] };
  const cashierRoutes = getAvailableWorkspaceRoutes(retail.navigation.primaryRoutes, retail, cashier);
  assert.equal(cashierRoutes.includes("POS"), true, "cashiers can access the configured sales workflow");
  assert.equal(cashierRoutes.includes("Customers"), true, "customer capability and permission permit the customer route");
  assert.equal(cashierRoutes.includes("Catalog"), false, "catalog route requires an inventory or add-products permission");
  assert.equal(cashierRoutes.includes("Reports"), false, "restricted reporting routes stay hidden");

  const mobileLayout = layoutMobileWorkspaceRoutes(["Dashboard", "POS", "Catalog", "Customers", "Finance", "Reports", "More"]);
  assert.deepEqual(mobileLayout.tabRoutes, ["Dashboard", "POS", "Catalog", "Customers", "More"]);
  assert.deepEqual(mobileLayout.overflowRoutes, ["Finance", "Reports"]);
  assert.equal(mobileLayout.tabRoutes.length <= 5, true, "small-phone navigation stays capped at five destinations");
  assert.equal(isWorkspaceTabRoute("Customers"), true);
  assert.equal(isWorkspaceTabRoute("Launchpad"), false);

  const { resolveThemeMode } = require("../src/theme/tokens.ts");
  systemScheme = "dark";
  assert.equal(resolveThemeMode("system"), "dark");
  assert.equal(resolveThemeMode("light"), "light", "explicit light mode overrides system appearance");
  systemScheme = "light";
  assert.equal(resolveThemeMode("system"), "light");

  console.log("Workspace route permissions, compact mobile navigation, and theme resolution passed.");
} finally {
  Module._load = originalLoad;
}
