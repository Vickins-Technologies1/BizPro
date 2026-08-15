process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "CommonJS",
  moduleResolution: "Node"
});
require("ts-node/register/transpile-only");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const sharedEntry = path.resolve(repoRoot, "packages", "shared", "src", "index.ts");

const secureState = {
  session: null,
  deviceId: "device-1",
  themeMode: "light",
  offlineQueue: null
};

const apiState = {
  online: false,
  categories: [],
  customers: [],
  callLog: []
};

const moduleLoader = require("module");
const originalLoad = moduleLoader._load;

moduleLoader._load = function patchedLoad(request, parent, isMain) {
  if (request === "@/storage/secure") {
    return {
      secureStore: {
        getSession: async () => secureState.session,
        setSession: async (value) => {
          secureState.session = value;
        },
        clearSession: async () => {
          secureState.session = null;
        },
        getDeviceId: async () => secureState.deviceId,
        setDeviceId: async (value) => {
          secureState.deviceId = value;
        },
        getThemeMode: async () => secureState.themeMode,
        setThemeMode: async (value) => {
          secureState.themeMode = value;
        },
        getOfflineQueue: async () => secureState.offlineQueue,
        setOfflineQueue: async (value) => {
          secureState.offlineQueue = value;
        },
        clearOfflineQueue: async () => {
          secureState.offlineQueue = null;
        }
      }
    };
  }

  if (request === "@/services/apiClient") {
    return {
      authMe: async () => {
        if (!apiState.online) {
          throw new TypeError("Network request failed");
        }
        const parsed = JSON.parse(secureState.session || "{}");
        return {
          user: parsed.user,
          business: parsed.business,
          branches: parsed.branches || []
        };
      },
      registerBusiness: async () => {
        throw new Error("Not used in smoke test");
      },
      loginBusiness: async () => {
        throw new Error("Not used in smoke test");
      },
      listCategories: async () => apiState.categories.map((category) => ({ ...category })),
      listBrands: async () => [],
      listProducts: async () => [],
      listCustomers: async (branchId) =>
        apiState.customers
          .filter((customer) => !branchId || customer.branchId === branchId || customer.branchId == null)
          .map((customer) => ({ ...customer })),
      listSuppliers: async () => [],
      listSales: async () => [],
      listExpenses: async () => [],
      getReportsSummary: async () => ({
        date: "2026-08-07",
        salesCount: 0,
        salesTotal: 0,
        profitTotal: 0,
        expensesTotal: 0,
        outstandingReceivables: 0,
        lowStockCount: 0
      }),
      getTopProducts: async () => [],
      getPaymentBreakdown: async () => [],
      createCategory: async (input) => {
        apiState.callLog.push({ method: "createCategory", input });
        if (!apiState.online) {
          throw new TypeError("Network request failed");
        }
        const existing = apiState.categories.find((category) => category.externalId && category.externalId === input.externalId);
        if (existing) {
          return { ...existing };
        }
        const created = {
          id: input.externalId || input.id || `server-${apiState.categories.length + 1}`,
          externalId: input.externalId || null,
          businessId: input.businessId,
          name: input.name,
          color: input.color ?? null,
          sortOrder: input.sortOrder ?? 0
        };
        apiState.categories = [created, ...apiState.categories.filter((category) => category.id !== created.id)];
        return created;
      },
      createBrand: async () => {
        throw new Error("Not used in smoke test");
      },
      createProduct: async () => {
        throw new Error("Not used in smoke test");
      },
      createSupplier: async () => {
        throw new Error("Not used in smoke test");
      },
      adjustProductStock: async () => {
        throw new Error("Not used in smoke test");
      },
      createCustomer: async (input) => {
        apiState.callLog.push({ method: "createCustomer", input });
        if (!apiState.online) {
          throw new TypeError("Network request failed");
        }
        const existing = apiState.customers.find((customer) => customer.externalId && customer.externalId === input.externalId);
        if (existing) {
          return { ...existing };
        }
        const created = {
          id: input.externalId || input.id || `server-customer-${apiState.customers.length + 1}`,
          externalId: input.externalId || null,
          businessId: input.businessId,
          branchId: input.branchId ?? null,
          groupId: input.groupId ?? null,
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          creditLimit: input.creditLimit ?? 0,
          loyaltyPoints: input.loyaltyPoints ?? 0,
          notes: input.notes ?? null,
          balance: input.balance ?? 0,
          attachments: Array.isArray(input.attachments) ? input.attachments : [],
          deletedAt: null
        };
        apiState.customers = [created, ...apiState.customers.filter((customer) => customer.id !== created.id)];
        return created;
      },
      recordCustomerPayment: async () => {
        throw new Error("Not used in smoke test");
      },
      createExpense: async () => {
        throw new Error("Not used in smoke test");
      },
      createSale: async () => {
        throw new Error("Not used in smoke test");
      }
    };
  }

  if (request === "@/services/receiptService") {
    return {
      buildReceiptArtifacts: () => ({
        text: "receipt",
        html: "<html></html>",
        fileName: "receipt.pdf",
        servedBy: "Staff"
      })
    };
  }

  if (request === "@/theme/tokens") {
    return {
      tokens: {
        colors: {
          background: "#fff",
          backgroundAlt: "#eee",
          surface: "#fff",
          surfaceAlt: "#f8f8f8",
          border: "#ddd",
          primary: "#2563EB",
          primaryStrong: "#1D4ED8",
          success: "#059669",
          warning: "#D97706",
          danger: "#DC2626",
          text: "#111",
          textSecondary: "#333",
          textMuted: "#666",
          overlay: "rgba(0,0,0,0.5)"
        }
      },
      setThemeTokens: () => undefined
    };
  }

  if (request === "@/utils/id") {
    let counter = 0;
    return {
      createId: () => `id-${++counter}`,
      createEventId: () => `evt-${++counter}`
    };
  }

  if (request === "@/utils/date") {
    return {
      dateKey: () => "2026-08-07"
    };
  }

  if (request === "@shared") {
    return originalLoad.call(this, sharedEntry, parent, isMain);
  }

  if (request.startsWith("@shared/")) {
    const suffix = request.slice("@shared/".length);
    return originalLoad.call(this, path.resolve(repoRoot, "packages", "shared", "src", suffix), parent, isMain);
  }

  if (request.startsWith("@/")) {
    const resolved = resolveMobileAlias(request.slice(2));
    if (resolved) {
      return originalLoad.call(this, resolved, parent, isMain);
    }
  }

  return originalLoad.call(this, request, parent, isMain);
};

function resolveMobileAlias(relativePath) {
  const basePath = path.resolve(repoRoot, "apps", "mobile", "src", relativePath);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function loadStore() {
  const storePath = path.resolve(repoRoot, "apps", "mobile", "src", "store", "useAppStore.ts");
  delete require.cache[require.resolve(storePath)];
  return require(storePath).useAppStore;
}

async function main() {
  resetEnvironment();
  await testQueueDedupe();

  const store1 = loadStore();
  await store1.getState().bootstrap();

  const queuedCategory = await store1.getState().addCategory({
    businessId: "business-1",
    name: "Snacks",
    color: null,
    sortOrder: 1
  });

  assert.equal(queuedCategory.id, "id-1");
  assert.equal(store1.getState().pendingSync, 1);
  assert.equal(apiState.categories.length, 0);

  await store1.getState().setSelectedBranchId("branch-a");
  const branchACustomer = await store1.getState().addCustomer({
    businessId: "business-1",
    branchId: "branch-a",
    groupId: null,
    name: "Branch A Customer",
    phone: null,
    email: null,
    notes: null,
    balance: 0,
    creditLimit: 0,
    loyaltyPoints: 0,
    attachments: []
  });
  assert.equal(branchACustomer.branchId, "branch-a");

  await store1.getState().setSelectedBranchId("branch-b");
  const branchBCustomer = await store1.getState().addCustomer({
    businessId: "business-1",
    branchId: "branch-b",
    groupId: null,
    name: "Branch B Customer",
    phone: null,
    email: null,
    notes: null,
    balance: 0,
    creditLimit: 0,
    loyaltyPoints: 0,
    attachments: []
  });
  assert.equal(branchBCustomer.branchId, "branch-b");

  const queuedAfterCreate = JSON.parse(secureState.offlineQueue || "{\"entries\":[]}");
  assert.equal(queuedAfterCreate.entries.length, 3);
  assert.equal(queuedAfterCreate.entries.filter((entry) => entry.businessId === "business-1").length, 3);
  assert.equal(JSON.parse(secureState.session || "{}").selectedBranchId, "branch-b");

  const store2 = loadStore();
  await store2.getState().bootstrap();

  assert.equal(store2.getState().selectedBranchId, "branch-b");
  assert.equal(store2.getState().pendingSync, 3);
  assert.equal(store2.getState().categories[0]?.name, "Snacks");
  assert.equal(store2.getState().customers.length, 1);
  assert.equal(store2.getState().customers[0]?.name, "Branch B Customer");

  apiState.online = true;
  await store2.getState().syncNow();

  assert.equal(JSON.parse(secureState.offlineQueue || "{\"entries\":[]}").entries.length, 0);
  assert.equal(store2.getState().pendingSync, 0);
  assert.equal(store2.getState().categories[0]?.name, "Snacks");
  assert.equal(store2.getState().customers.length, 1);
  assert.equal(store2.getState().customers[0]?.name, "Branch B Customer");
  assert.equal(apiState.categories[0]?.name, "Snacks");
  assert.equal(apiState.customers.length, 2);

  console.log("Mobile offline queue smoke test passed.");
}

async function testQueueDedupe() {
  const offlineQueue = require(path.resolve(repoRoot, "apps", "mobile", "src", "services", "offlineQueue.ts"));
  await offlineQueue.enqueueAction({
    id: "sale-queue-1",
    businessId: "business-dedupe",
    kind: "createSale",
    dedupeKey: "createSale:business-dedupe:branch-a:sale-external-1",
    payload: {
      businessId: "business-dedupe",
      externalId: "sale-external-1",
      branchId: "branch-a",
      customerId: null,
      paymentMethod: "cash",
      paymentStatus: "paid",
      amountPaid: 100,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 100,
      notes: null,
      receiptNumber: "R-0001",
      subtotal: 100,
      balanceDue: 0,
      items: [
        {
          productId: "product-1",
          productName: "Tea",
          quantity: 1,
          unitPrice: 100,
          costPrice: 50,
          lineDiscount: 0,
          lineTotal: 100
        }
      ]
    }
  });

  await offlineQueue.enqueueAction({
    id: "sale-queue-2",
    businessId: "business-dedupe",
    kind: "createSale",
    dedupeKey: "createSale:business-dedupe:branch-a:sale-external-1",
    payload: {
      businessId: "business-dedupe",
      externalId: "sale-external-1",
      branchId: "branch-a",
      customerId: null,
      paymentMethod: "cash",
      paymentStatus: "paid",
      amountPaid: 100,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 100,
      notes: null,
      receiptNumber: "R-0001",
      subtotal: 100,
      balanceDue: 0,
      items: [
        {
          productId: "product-1",
          productName: "Tea",
          quantity: 1,
          unitPrice: 100,
          costPrice: 50,
          lineDiscount: 0,
          lineTotal: 100
        }
      ]
    }
  });

  const dedupedQueue = await offlineQueue.listQueuedActions("business-dedupe");
  assert.equal(dedupedQueue.length, 1);
  assert.equal(dedupedQueue[0]?.id, "sale-queue-1");
  await offlineQueue.clearBusinessActions("business-dedupe");
}

function resetEnvironment() {
  secureState.session = JSON.stringify({
    user: {
      id: "user-1",
      fullName: "Test User",
      role: "owner",
      businessId: "business-1"
    },
    business: {
      id: "business-1",
      name: "Biz Pro Demo",
      businessType: "retail_shop",
      planTier: "standard",
      billingStatus: "trial",
      currency: "KES"
    },
    branches: [
      { id: "branch-a", name: "Branch A", isDefault: true },
      { id: "branch-b", name: "Branch B", isDefault: false }
    ],
    accessToken: "token-1"
  });
  secureState.offlineQueue = null;
  apiState.online = false;
  apiState.categories = [];
  apiState.customers = [];
  apiState.callLog = [];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
