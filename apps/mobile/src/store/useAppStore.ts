import { create } from "zustand";
import type { Brand, Branch, Business, Category, Customer, CustomerAttachment, CustomerGroup, DailySummary, Expense, Payment, Product, Sale, Supplier } from "@shared";
import { secureStore } from "@/storage/secure";
import { createId } from "@/utils/id";
import { dateKey } from "@/utils/date";
import { buildReceiptArtifacts, type ReceiptArtifacts } from "@/services/receiptService";
import { registerBusiness, loginBusiness, authMe, listCategories, listBrands, listProducts, listCustomers, listCustomerGroups, listSuppliers, listSales, listExpenses, createCategory, createBrand, createProduct, createSupplier, adjustProductStock, createCustomer, updateCustomer as apiUpdateCustomer, recordCustomerPayment, createExpense, createSale as apiCreateSale, getReportsSummary, getTopProducts } from "@/services/apiClient";
import { businessSetupSchema, loginSchema } from "@shared";
import { resolveIndustryKey } from "@shared";
import { setThemeTokens, type ThemeMode } from "@/theme/tokens";
import type { AccessPermission } from "@shared";
import {
  countQueuedActions,
  createBrandDraft,
  createCategoryDraft,
  createCustomerDraft,
  createExpenseDraft,
  createPaymentDraft,
  createProductDraft,
  createSupplierDraft,
  createQueuedSaleDraft,
  createQueueId,
  enqueueAction,
  isOfflineError,
  listQueuedActions,
  markActionFailed,
  removeAction
} from "@/services/offlineQueue";
import { setAuthFailureHandler } from "@/services/apiClient";

export interface DashboardSummary extends DailySummary {
  topProducts: Array<{ productId: string; productName: string; quantity: number; total: number }>;
}

type SyncProgress = {
  total: number;
  completed: number;
  currentLabel: string | null;
  currentKind: string | null;
  startedAt: string;
  lastError: string | null;
};

interface AppState {
  ready: boolean;
  loading: boolean;
  authLoading: boolean;
  syncing: boolean;
  themeMode: ThemeMode;
  business: Business | null;
  user: { id: string; fullName: string; role: string; businessId?: string; branchId?: string | null; ownerId?: string | null; roleLabel?: string | null; permissions?: AccessPermission[] | null } | null;
  branches: Branch[];
  selectedBranchId: string | null;
  deviceId: string;
  pendingSync: number;
  syncMessage: string;
  syncProgress: SyncProgress | null;
  dashboard: DashboardSummary | null;
  products: Product[];
  categories: Category[];
  brands: Brand[];
  customers: Customer[];
  customerGroups: CustomerGroup[];
  suppliers: Supplier[];
  sales: Sale[];
  expenses: Expense[];
  error: string | null;
  bootstrap: () => Promise<void>;
  activateSession: (input: { business: Business; session: StoredSession; refreshData?: boolean }) => Promise<void>;
  completeOnboarding: (input: unknown) => Promise<{ business: Business; session: StoredSession }>;
  login: (input: unknown) => Promise<void>;
  logout: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  loadDashboard: () => Promise<void>;
  loadCatalog: () => Promise<void>;
  setSelectedBranchId: (branchId: string | null) => Promise<void>;
  rehydrateQueuedState: () => Promise<void>;
  addCategory: (input: Omit<Category, "id" | "createdAt" | "updatedAt" | "deletedAt">) => Promise<Category>;
  addBrand: (input: Omit<Brand, "id" | "createdAt" | "updatedAt" | "deletedAt" | "isActive"> & { description?: string | null }) => Promise<Brand>;
  addProduct: (input: Omit<Product, "id" | "createdAt" | "updatedAt" | "deletedAt">) => Promise<Product>;
  addSupplier: (input: Omit<Supplier, "id" | "createdAt" | "updatedAt" | "deletedAt" | "isActive"> & { code?: string | null; contactName?: string | null; notes?: string | null; phone?: string | null; email?: string | null }) => Promise<Supplier>;
  adjustStock: (input: { productId: string; quantityDelta: number; unitCost: number; note?: string }) => Promise<Product>;
  addCustomer: (input: Omit<Customer, "id" | "createdAt" | "updatedAt" | "deletedAt" | "balance" | "creditLimit" | "loyaltyPoints" | "attachments"> & { balance?: number; creditLimit?: number; loyaltyPoints?: number; attachments?: CustomerAttachment[] }) => Promise<Customer>;
  updateCustomer: (input: { customerId: string; patch: Partial<Pick<Customer, "groupId" | "name" | "phone" | "email" | "creditLimit" | "loyaltyPoints" | "notes" | "attachments">> & { branchId?: string | null } }) => Promise<Customer>;
  addExpense: (input: Omit<Expense, "id" | "createdAt" | "updatedAt" | "deletedAt">) => Promise<Expense>;
  recordDebtPayment: (input: { customerId: string; amount: number; method: Sale["paymentMethod"]; reference?: string | null; note?: string | null }) => Promise<Payment>;
  createSale: (input: {
    branchId?: string | null;
    customerId?: string | null;
    paymentMethod: Sale["paymentMethod"];
    paymentStatus: Sale["paymentStatus"];
    amountPaid: number;
    discountTotal?: number;
    taxTotal?: number;
    notes?: string | null;
    items: Array<{ productId: string; quantity: number; unitPrice: number; costPrice: number; discount: number }>;
  }) => Promise<{ sale: Sale; receipt: ReceiptArtifacts }>;
  syncNow: () => Promise<void>;
  refreshPendingSync: () => Promise<void>;
}

type StoredSession = {
  user: { id: string; fullName: string; role: string; businessId?: string; branchId?: string | null; ownerId?: string | null; roleLabel?: string | null; permissions?: AccessPermission[] | null };
  business?: Business | null;
  branches?: Branch[];
  selectedBranchId?: string | null;
  accessToken?: string | null;
};

function normalizeSetupValue(value: string) {
  return value.trim();
}

function createReceiptNumber() {
  return `R-${dateKey().replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  return [item, ...items.filter((candidate) => candidate.id !== item.id)];
}

function buildQueueDedupKey(kind: string, businessId: string, ...parts: Array<string | null | undefined>) {
  return [kind, businessId, ...parts.map((part) => (part?.trim ? part.trim() : part ?? "all"))].join(":");
}

function describeQueuedAction(action: { kind: string; payload: Record<string, unknown> }) {
  switch (action.kind) {
    case "createSale":
      return `Sale ${String(action.payload.receiptNumber ?? "")}`.trim();
    case "adjustStock":
      return `Stock adjustment ${String(action.payload.referenceId ?? "")}`.trim();
    case "recordCustomerPayment":
      return `Payment ${String(action.payload.externalId ?? "")}`.trim();
    case "createExpense":
      return `Expense ${String(action.payload.externalId ?? "")}`.trim();
    default:
      return `${action.kind}`.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
}

function patchCustomerRecord(customer: Customer, patch: Partial<Pick<Customer, "groupId" | "name" | "phone" | "email" | "creditLimit" | "loyaltyPoints" | "notes" | "attachments">>) {
  const { groupId, name, phone, email, creditLimit, loyaltyPoints, notes, attachments } = patch;
  return {
    ...customer,
    groupId: groupId === undefined ? customer.groupId ?? null : groupId,
    name: name === undefined ? customer.name : name,
    phone: phone === undefined ? customer.phone ?? null : phone,
    email: email === undefined ? customer.email ?? null : email,
    creditLimit: creditLimit === undefined ? customer.creditLimit : creditLimit,
    loyaltyPoints: loyaltyPoints === undefined ? customer.loyaltyPoints : loyaltyPoints,
    notes: notes === undefined ? customer.notes ?? null : notes,
    attachments: attachments === undefined ? customer.attachments : attachments
  } as Customer;
}

async function readStoredSession(): Promise<StoredSession | null> {
  const raw = await secureStore.getSession();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function deriveSelectedBranchId(user: AppState["user"], branches: Branch[], preferredBranchId?: string | null) {
  if (!user) return null;
  if (user.role === "owner") {
    const preferred = preferredBranchId?.trim() ? preferredBranchId.trim() : preferredBranchId === null ? null : undefined;
    if (preferred !== undefined) {
      if (preferred === null) {
        return branches.length <= 1 ? user.branchId ?? branches[0]?.id ?? null : null;
      }
      if (branches.some((branch) => branch.id === preferred)) {
        return preferred;
      }
    }
    if (branches.length <= 1) {
      return user.branchId ?? branches[0]?.id ?? null;
    }
    return null;
  }
  return user.branchId ?? branches[0]?.id ?? null;
}

async function persistSelectedBranchId(selectedBranchId: string | null) {
  const storedSession = await readStoredSession();
  if (!storedSession) return;
  await secureStore.setSession(JSON.stringify({ ...storedSession, selectedBranchId }));
}

function resolveReadBranchId(state: Pick<AppState, "selectedBranchId" | "user">) {
  if (state.user?.role === "owner") {
    return state.selectedBranchId ?? null;
  }
  return state.selectedBranchId ?? state.user?.branchId ?? null;
}

function resolveWriteBranchId(state: Pick<AppState, "selectedBranchId" | "user" | "branches">, branchId?: string | null) {
  if (branchId?.trim()) return branchId.trim();
  return state.selectedBranchId ?? state.user?.branchId ?? state.branches.find((branch) => branch.isDefault)?.id ?? state.branches[0]?.id ?? null;
}

function shouldApplyQueuedActionToCurrentBranch(action: { payload?: unknown }, selectedBranchId: string | null) {
  if (!selectedBranchId) return true;
  const actionBranchId = (action.payload as { branchId?: string | null } | undefined)?.branchId ?? null;
  return actionBranchId === null || actionBranchId === selectedBranchId;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  loading: false,
  authLoading: true,
  syncing: false,
  themeMode: "light",
  business: null,
  user: null,
  branches: [],
  selectedBranchId: null,
  deviceId: "",
  pendingSync: 0,
  syncMessage: "Cloud only",
  syncProgress: null,
  dashboard: null,
  products: [],
  categories: [],
  brands: [],
  customers: [],
  customerGroups: [],
  suppliers: [],
  sales: [],
  expenses: [],
  error: null,
  bootstrap: async () => {
    set({ loading: true, error: null });
    try {
      const hydrateWorkspace = async () => {
        await Promise.allSettled([get().loadDashboard(), get().loadCatalog(), get().refreshPendingSync()]);
        await get().rehydrateQueuedState();
      };

      const storedThemeMode = await secureStore.getThemeMode();
      const themeMode: ThemeMode = storedThemeMode === "dark" ? "dark" : "light";
      if (!storedThemeMode) {
        await secureStore.setThemeMode(themeMode);
      }
      setThemeTokens(themeMode);

      let deviceId = await secureStore.getDeviceId();
      if (!deviceId) {
        deviceId = createId();
        await secureStore.setDeviceId(deviceId);
      }

      const storedSession = await readStoredSession();
      if (storedSession?.accessToken) {
        try {
          const remote = await authMe();
          const branches = remote.branches ?? storedSession.branches ?? [];
          const selectedBranchId = deriveSelectedBranchId(remote.user, branches, storedSession?.selectedBranchId);
          set({
            themeMode,
            business: remote.business,
            user: remote.user,
            branches,
            selectedBranchId,
            deviceId,
            ready: true,
            authLoading: false
          });
          await hydrateWorkspace();
          return;
        } catch (error) {
          if (isOfflineError(error)) {
            const branches = storedSession.branches ?? [];
            set({
              themeMode,
              business: storedSession.business ?? null,
              user: storedSession.user,
              branches,
              selectedBranchId: deriveSelectedBranchId(storedSession.user, branches, storedSession.selectedBranchId),
              deviceId,
              ready: true,
              authLoading: false
            });
            await hydrateWorkspace();
            return;
          }
          console.warn("[auth] Stored session could not be restored", error);
          await secureStore.clearSession();
        }
      }

      set({
        themeMode,
        business: null,
        user: null,
        branches: [],
        selectedBranchId: null,
        deviceId,
        ready: true,
        authLoading: false
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to initialize app", authLoading: false });
    } finally {
      set({ loading: false });
    }
  },
  activateSession: async ({ business, session, refreshData = true }) => {
    if (!session.user) {
      throw new Error("No signed-in user was provided");
    }
    const branches = session.branches ?? [];
    const selectedBranchId = deriveSelectedBranchId(session.user, branches, session.selectedBranchId);
    await secureStore.setSession(JSON.stringify({ ...session, business, branches, selectedBranchId }));
    set({
      business,
      user: session.user,
      branches,
      selectedBranchId,
      error: null
    });
    if (refreshData) {
      void Promise.allSettled([get().loadDashboard(), get().loadCatalog(), get().refreshPendingSync()]);
    }
  },
  completeOnboarding: async (input) => {
    const parsed = businessSetupSchema.parse(input);
    set({ loading: true, error: null });
    try {
      const ownerName = normalizeSetupValue(parsed.ownerName);
      const phone = normalizeSetupValue(parsed.phone);
      const businessName = normalizeSetupValue(parsed.businessName);
      const branchName = normalizeSetupValue(parsed.branchName);
      const currency = normalizeSetupValue(parsed.currency).toUpperCase();
      const industryKey = resolveIndustryKey({ industryKey: parsed.industryKey, businessType: parsed.businessType });

      const remote = await registerBusiness({
        businessId: createId(),
        branchId: createId(),
        ownerUserId: createId(),
        ownerName,
        phone,
        password: parsed.password,
        businessName,
        industryKey,
        businessType: parsed.businessType,
        planTier: parsed.planTier,
        currency,
        branchName,
        cashierPin: parsed.cashierPin ? normalizeSetupValue(parsed.cashierPin) : null
      });

      const session: StoredSession = {
        user: remote.user,
        accessToken: remote.accessToken,
        branches: remote.branches ?? []
      };

      return { business: remote.business, session };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete onboarding";
      set({ error: message });
      throw error instanceof Error ? error : new Error(message);
    } finally {
      set({ loading: false });
    }
  },
  login: async (input) => {
    const parsed = loginSchema.parse(input);
    set({ authLoading: true, error: null });
    try {
      const business = get().business;
      const remote = await loginBusiness({
        identifier: parsed.identifier.trim(),
        passwordOrPin: parsed.passwordOrPin,
        ...(business?.id ? { businessId: business.id } : {})
      });
      await get().activateSession({
        business: remote.business,
        session: { user: remote.user, accessToken: remote.accessToken, branches: remote.branches ?? [] }
      });
    } finally {
      set({ authLoading: false });
    }
  },
  logout: async () => {
    await secureStore.clearSession();
    set({
      business: null,
      user: null,
      branches: [],
      selectedBranchId: null,
      dashboard: null,
      products: [],
      categories: [],
      brands: [],
      customers: [],
      suppliers: [],
      sales: [],
      expenses: [],
      pendingSync: 0,
      syncing: false,
      syncMessage: "Cloud only",
      syncProgress: null
    });
  },
  setThemeMode: async (mode) => {
    const themeMode: ThemeMode = mode === "dark" ? "dark" : "light";
    setThemeTokens(themeMode);
    set({ themeMode });
    await secureStore.setThemeMode(themeMode);
  },
  loadDashboard: async () => {
    const business = get().business;
    if (!business) return;
    const branchId = resolveReadBranchId(get());
    const [summary, topProducts] = await Promise.all([getReportsSummary(undefined, undefined, branchId), getTopProducts(undefined, undefined, branchId)]);
    set({
      dashboard: {
        ...summary,
        date: dateKey(),
        topProducts
      }
    });
  },
  loadCatalog: async () => {
    const business = get().business;
    if (!business) return;
    const branchId = resolveReadBranchId(get());
    const [categories, brands, products, customers, customerGroups, suppliers, sales, expenses] = await Promise.all([
      listCategories(),
      listBrands(),
      listProducts(branchId),
      listCustomers(branchId),
      listCustomerGroups(branchId),
      listSuppliers(),
      listSales(branchId),
      listExpenses(branchId)
    ]);
    set({ categories, brands, products, customers, customerGroups, suppliers, sales, expenses });
    await get().rehydrateQueuedState();
  },
  setSelectedBranchId: async (branchId) => {
    const state = get();
    const resolvedBranchId =
      state.user?.role === "owner"
        ? branchId
        : state.user?.branchId ?? state.branches.find((branch) => branch.isDefault)?.id ?? state.branches[0]?.id ?? null;
    set({ selectedBranchId: resolvedBranchId });
    await persistSelectedBranchId(resolvedBranchId);
    await Promise.allSettled([get().loadDashboard(), get().loadCatalog(), get().refreshPendingSync()]);
  },
  rehydrateQueuedState: async () => {
    const business = get().business;
    if (!business) return;
    const queuedActions = await listQueuedActions(business.id);
    if (!queuedActions.length) return;
    const selectedBranchId = resolveReadBranchId(get());
    set((state) => {
      let nextCategories = state.categories;
      let nextBrands = state.brands;
      let nextProducts = state.products;
      let nextCustomers = state.customers;
      let nextCustomerGroups = state.customerGroups;
      let nextSuppliers = state.suppliers;
      let nextSales = state.sales;
      let nextExpenses = state.expenses;

      for (const action of queuedActions) {
        if (!shouldApplyQueuedActionToCurrentBranch(action, selectedBranchId)) {
          continue;
        }
        switch (action.kind) {
          case "createCategory":
            nextCategories = upsertById(nextCategories, createCategoryDraft(action.payload));
            break;
          case "createBrand":
            nextBrands = upsertById(nextBrands, createBrandDraft(action.payload));
            break;
          case "createProduct":
            nextProducts = upsertById(nextProducts, createProductDraft(action.payload));
            break;
          case "adjustStock":
            nextProducts = nextProducts.map((product) =>
              product.id === action.payload.productId
                ? { ...product, stockOnHand: Math.max(0, product.stockOnHand + action.payload.quantityDelta) }
                : product
            );
            break;
          case "createCustomer":
            nextCustomers = upsertById(nextCustomers, createCustomerDraft(action.payload));
            break;
          case "updateCustomer":
            nextCustomers = nextCustomers.map((customer) =>
              customer.id === action.payload.customerId ? patchCustomerRecord(customer, action.payload) : customer
            );
            break;
          case "createSupplier":
            nextSuppliers = upsertById(nextSuppliers, createSupplierDraft(action.payload));
            break;
          case "createExpense":
            nextExpenses = upsertById(nextExpenses, createExpenseDraft(action.payload));
            break;
          case "recordCustomerPayment":
            nextCustomers = nextCustomers.map((customer) =>
              customer.id === action.payload.customerId
                ? { ...customer, balance: Math.max(0, customer.balance - Math.abs(action.payload.amount)) }
                : customer
            );
            break;
          case "createSale":
            nextSales = upsertById(nextSales, createQueuedSaleDraft(action.payload));
            nextProducts = nextProducts.map((product) => {
              const soldItem = action.payload.items.find((item) => item.productId === product.id);
              if (!soldItem) return product;
              return {
                ...product,
                stockOnHand: Math.max(0, product.stockOnHand - soldItem.quantity)
              };
            });
            nextCustomers =
              action.payload.customerId && action.payload.balanceDue > 0
                ? nextCustomers.map((customer) =>
                    customer.id === action.payload.customerId ? { ...customer, balance: customer.balance + action.payload.balanceDue } : customer
                  )
                : nextCustomers;
            break;
        }
      }

      return {
        categories: nextCategories,
        brands: nextBrands,
        products: nextProducts,
        customers: nextCustomers,
        customerGroups: nextCustomerGroups,
        suppliers: nextSuppliers,
        sales: nextSales,
        expenses: nextExpenses
      };
    });
  },
  addCategory: async (input) => {
    const businessId = get().business?.id ?? input.businessId;
    if (!businessId) throw new Error("No business loaded");
    const payload = {
      businessId,
      externalId: createId(),
      name: input.name,
      color: input.color ?? null,
      sortOrder: input.sortOrder
    };
    try {
      const category = await createCategory(payload);
      set((state) => ({ categories: upsertById(state.categories, category) }));
      await Promise.allSettled([get().loadCatalog(), get().loadDashboard(), get().refreshPendingSync()]);
      return category;
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }
      await enqueueAction({
        id: createQueueId(),
        businessId,
        kind: "createCategory",
        payload
      });
      const category = createCategoryDraft(payload);
      set((state) => ({
        categories: upsertById(state.categories, category),
        pendingSync: state.pendingSync + 1,
        syncMessage: "Saved locally. Waiting to sync..."
      }));
      return category;
    }
  },
  addBrand: async (input) => {
    const businessId = get().business?.id ?? input.businessId;
    if (!businessId) throw new Error("No business loaded");
    const payload = {
      businessId,
      externalId: createId(),
      name: input.name,
      description: input.description ?? null
    };
    try {
      const brand = await createBrand(payload);
      set((state) => ({ brands: upsertById(state.brands, brand) }));
      await Promise.allSettled([get().loadCatalog(), get().loadDashboard(), get().refreshPendingSync()]);
      return brand;
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }
      await enqueueAction({
        id: createQueueId(),
        businessId,
        kind: "createBrand",
        payload
      });
      const brand = createBrandDraft(payload);
      set((state) => ({
        brands: upsertById(state.brands, brand),
        pendingSync: state.pendingSync + 1,
        syncMessage: "Saved locally. Waiting to sync..."
      }));
      return brand;
    }
  },
  addProduct: async (input) => {
    const businessId = get().business?.id ?? input.businessId;
    const branchId = resolveWriteBranchId(get(), input.branchId ?? null);
    if (!businessId) throw new Error("No business loaded");
    const payload = {
      businessId,
      branchId,
      externalId: createId(),
      categoryId: input.categoryId ?? null,
      brandId: input.brandId ?? null,
      supplierId: input.supplierId ?? null,
      name: input.name,
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
      batchNumber: input.batchNumber ?? null,
      expiryDate: input.expiryDate ?? null,
      serialNumber: input.serialNumber ?? null,
      unit: input.unit,
      buyingPrice: input.buyingPrice,
      sellingPrice: input.sellingPrice,
      stockOnHand: input.stockOnHand,
      lowStockThreshold: input.lowStockThreshold,
      isActive: input.isActive
    };
    try {
      const product = await createProduct(payload);
      set((state) => ({ products: upsertById(state.products, product) }));
      await Promise.allSettled([get().loadCatalog(), get().loadDashboard(), get().refreshPendingSync()]);
      return product;
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }
      await enqueueAction({
        id: createQueueId(),
        businessId,
        kind: "createProduct",
        payload
      });
      const product = createProductDraft(payload);
      set((state) => ({
        products: upsertById(state.products, product),
        pendingSync: state.pendingSync + 1,
        syncMessage: "Saved locally. Waiting to sync..."
      }));
      return product;
    }
  },
  addSupplier: async (input) => {
    const businessId = get().business?.id ?? input.businessId;
    if (!businessId) throw new Error("No business loaded");
    const payload = {
      businessId,
      externalId: createId(),
      categoryId: input.categoryId ?? null,
      code: input.code ?? null,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      contactName: input.contactName ?? null,
      notes: input.notes ?? null,
      isActive: true
    };
    try {
      const supplier = await createSupplier(payload);
      set((state) => ({ suppliers: upsertById(state.suppliers, supplier) }));
      await Promise.allSettled([get().loadCatalog(), get().loadDashboard(), get().refreshPendingSync()]);
      return supplier;
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }
      await enqueueAction({
        id: createQueueId(),
        businessId,
        kind: "createSupplier",
        payload
      });
      const supplier = createSupplierDraft(payload);
      set((state) => ({
        suppliers: upsertById(state.suppliers, supplier),
        pendingSync: state.pendingSync + 1,
        syncMessage: "Saved locally. Waiting to sync..."
      }));
      return supplier;
    }
  },
  adjustStock: async (input) => {
    const businessId = get().business?.id;
    const branchId = resolveWriteBranchId(get());
    if (!businessId) throw new Error("No business loaded");
    const referenceId = createQueueId();
    const payload = {
      businessId,
      branchId,
      productId: input.productId,
      quantityDelta: input.quantityDelta,
      unitCost: input.unitCost,
      note: input.note ?? "Stock adjustment",
      referenceType: "adjustment" as const,
      referenceId
    };
    try {
      const product = await adjustProductStock(payload);
      set((state) => ({ products: state.products.map((candidate) => (candidate.id === product.id ? product : candidate)) }));
      await Promise.allSettled([get().loadCatalog(), get().loadDashboard(), get().refreshPendingSync()]);
      return product;
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }
      await enqueueAction({
        id: createQueueId(),
        businessId,
        kind: "adjustStock",
        dedupeKey: buildQueueDedupKey("adjustStock", businessId, branchId, referenceId),
        payload
      });
      set((state) => ({
        products: state.products.map((candidate) =>
          candidate.id === input.productId
            ? { ...candidate, stockOnHand: Math.max(0, candidate.stockOnHand + input.quantityDelta) }
            : candidate
        ),
        pendingSync: state.pendingSync + 1,
        syncMessage: "Stock update saved locally. Waiting to sync..."
      }));
      const localProduct = get().products.find((candidate) => candidate.id === input.productId);
      if (localProduct) {
        return localProduct;
      }
      return {
        id: input.productId,
        businessId,
        stockOnHand: Math.max(0, input.quantityDelta)
      } as Product;
    }
  },
  addCustomer: async (input) => {
    const businessId = get().business?.id ?? input.businessId;
    const branchId = resolveWriteBranchId(get(), input.branchId ?? null);
    if (!businessId) throw new Error("No business loaded");
    const payload = {
      businessId,
      branchId,
      externalId: createId(),
      groupId: input.groupId ?? null,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
      creditLimit: input.creditLimit ?? 0,
      loyaltyPoints: input.loyaltyPoints ?? 0,
      balance: input.balance ?? 0,
      attachments: input.attachments ?? []
    };
    try {
      const customer = await createCustomer(payload);
      set((state) => ({ customers: upsertById(state.customers, customer) }));
      await Promise.allSettled([get().loadCatalog(), get().loadDashboard(), get().refreshPendingSync()]);
      return customer;
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }
      await enqueueAction({
        id: createQueueId(),
        businessId,
        kind: "createCustomer",
        payload
      });
      const customer = createCustomerDraft(payload);
      set((state) => ({
        customers: upsertById(state.customers, customer),
        pendingSync: state.pendingSync + 1,
        syncMessage: "Saved locally. Waiting to sync..."
      }));
      return customer;
    }
  },
  updateCustomer: async (input) => {
    const businessId = get().business?.id;
    if (!businessId) throw new Error("No business loaded");
    const payload = {
      businessId,
      branchId: resolveWriteBranchId(get()),
      customerId: input.customerId,
      ...(input.patch.groupId !== undefined ? { groupId: input.patch.groupId } : {}),
      ...(input.patch.name !== undefined ? { name: input.patch.name } : {}),
      ...(input.patch.phone !== undefined ? { phone: input.patch.phone ?? null } : {}),
      ...(input.patch.email !== undefined ? { email: input.patch.email ?? null } : {}),
      ...(input.patch.creditLimit !== undefined ? { creditLimit: input.patch.creditLimit } : {}),
      ...(input.patch.loyaltyPoints !== undefined ? { loyaltyPoints: input.patch.loyaltyPoints } : {}),
      ...(input.patch.notes !== undefined ? { notes: input.patch.notes ?? null } : {}),
      ...(input.patch.attachments !== undefined ? { attachments: input.patch.attachments } : {})
    };
    try {
      const customer = await apiUpdateCustomer(input.customerId, payload);
      set((state) => ({ customers: upsertById(state.customers, customer) }));
      await Promise.allSettled([get().loadCatalog(), get().loadDashboard(), get().refreshPendingSync()]);
      return customer;
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }
      await enqueueAction({
        id: createQueueId(),
        businessId,
        kind: "updateCustomer",
        payload
      });
      const nextCustomer = patchCustomerRecord(
        get().customers.find((customer) => customer.id === input.customerId) ?? {
          id: input.customerId,
          businessId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          name: "",
          groupId: null,
          phone: null,
          email: null,
          creditLimit: 0,
          loyaltyPoints: 0,
          notes: null,
          balance: 0,
          attachments: []
        },
        input.patch
      );
      set((state) => ({
        customers: upsertById(state.customers, nextCustomer),
        pendingSync: state.pendingSync + 1,
        syncMessage: "Customer update saved locally. Waiting to sync..."
      }));
      return nextCustomer;
    }
  },
  addExpense: async (input) => {
    const businessId = get().business?.id ?? input.businessId;
    const branchId = resolveWriteBranchId(get(), input.branchId ?? null);
    if (!businessId) throw new Error("No business loaded");
    const payload = {
      businessId,
      branchId,
      externalId: createId(),
      categoryId: input.categoryId ?? null,
      amount: input.amount,
      note: input.note,
      expenseDate: input.expenseDate,
      recordedById: input.recordedById ?? null
    };
    try {
      const expense = await createExpense(payload);
      set((state) => ({ expenses: upsertById(state.expenses, expense) }));
      await Promise.allSettled([get().loadDashboard(), get().loadCatalog(), get().refreshPendingSync()]);
      return expense;
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }
      await enqueueAction({
        id: createQueueId(),
        businessId,
        kind: "createExpense",
        payload
      });
      const expense = createExpenseDraft(payload);
      set((state) => ({
        expenses: upsertById(state.expenses, expense),
        pendingSync: state.pendingSync + 1,
        syncMessage: "Saved locally. Waiting to sync..."
      }));
      return expense;
    }
  },
  recordDebtPayment: async (input) => {
    const businessId = get().business?.id;
    const branchId = resolveWriteBranchId(get());
    if (!businessId) throw new Error("No business loaded");
    const payload = {
      businessId,
      branchId,
      customerId: input.customerId,
      externalId: createId(),
      amount: input.amount,
      method: input.method,
      reference: input.reference ?? null,
      note: input.note ?? null
    };
    try {
      const payment = await recordCustomerPayment(input.customerId, payload);
      set((state) => ({
        customers: state.customers.map((customer) =>
          customer.id === input.customerId ? { ...customer, balance: Math.max(0, customer.balance - Math.abs(input.amount)) } : customer
        )
      }));
      await Promise.allSettled([get().loadDashboard(), get().loadCatalog(), get().refreshPendingSync()]);
      return payment;
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }
      await enqueueAction({
        id: createQueueId(),
        businessId,
        kind: "recordCustomerPayment",
        payload
      });
      const payment = createPaymentDraft(payload);
      set((state) => ({
        customers: state.customers.map((customer) =>
          customer.id === input.customerId ? { ...customer, balance: Math.max(0, customer.balance - Math.abs(input.amount)) } : customer
        ),
        pendingSync: state.pendingSync + 1,
        syncMessage: "Payment saved locally. Waiting to sync..."
      }));
      return payment;
    }
  },
  createSale: async (input) => {
    const business = get().business;
    if (!business) throw new Error("No business loaded");
    const branchId = resolveWriteBranchId(get(), input.branchId ?? null);
    const externalId = createId();
    const receiptNumber = createReceiptNumber();
    const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discountTotal = input.discountTotal ?? input.items.reduce((sum, item) => sum + item.discount, 0);
    const taxTotal = input.taxTotal ?? 0;
    const grandTotal = subtotal - discountTotal + taxTotal;
    const balanceDue = Math.max(0, grandTotal - input.amountPaid);
    const payload = {
      businessId: business.id,
      externalId,
      branchId,
      customerId: input.customerId ?? null,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      amountPaid: input.amountPaid,
      discountTotal,
      taxTotal,
      grandTotal,
      notes: input.notes ?? null,
      receiptNumber,
      subtotal,
      balanceDue,
      items: input.items.map((item) => {
        const product = get().products.find((candidate) => candidate.id === item.productId);
        return {
          productId: product?.serverId ?? item.productId,
          productName: product?.name ?? item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
          lineDiscount: item.discount,
          lineTotal: item.unitPrice * item.quantity - item.discount
        };
      })
    };
    try {
      const sale = await apiCreateSale(payload);
      await Promise.allSettled([get().loadCatalog(), get().loadDashboard(), get().refreshPendingSync()]);
      const servedBy = get().user?.fullName?.trim() || get().user?.roleLabel?.trim() || get().user?.role || "Staff";
      const receipt = buildReceiptArtifacts(sale, sale.items, business.currency, servedBy, business.name);
      return { sale, receipt };
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }
      await enqueueAction({
        id: createQueueId(),
        businessId: business.id,
        kind: "createSale",
        dedupeKey: buildQueueDedupKey("createSale", business.id, branchId, externalId),
        payload
      });
      const sale = createQueuedSaleDraft(payload);
      set((state) => ({
        sales: upsertById(state.sales, sale),
        products: state.products.map((candidate) => {
          const soldItem = input.items.find((item) => item.productId === candidate.id);
          if (!soldItem) return candidate;
          return {
            ...candidate,
            stockOnHand: Math.max(0, candidate.stockOnHand - soldItem.quantity)
          };
        }),
        customers:
          input.customerId && balanceDue > 0
            ? state.customers.map((customer) =>
                customer.id === input.customerId ? { ...customer, balance: customer.balance + balanceDue } : customer
              )
            : state.customers,
        pendingSync: state.pendingSync + 1,
        syncMessage: "Sale saved locally. Waiting to sync..."
      }));
      const servedBy = get().user?.fullName?.trim() || get().user?.roleLabel?.trim() || get().user?.role || "Staff";
      const receipt = buildReceiptArtifacts(sale, sale.items, business.currency, servedBy, business.name);
      return { sale, receipt };
    }
  },
  syncNow: async () => {
    const business = get().business;
    if (!business) return;
    if (get().syncing) return;
    const queuedActions = await listQueuedActions(business.id);
    if (!queuedActions.length) {
      set({ syncMessage: "Nothing is waiting to sync", syncProgress: null });
      await get().refreshPendingSync();
      return;
    }

    const startedAt = new Date().toISOString();
    set({
      syncing: true,
      syncMessage: `Syncing 0 of ${queuedActions.length} queued actions...`,
      syncProgress: {
        total: queuedActions.length,
        completed: 0,
        currentLabel: null,
        currentKind: null,
        startedAt,
        lastError: null
      }
    });

    try {
      let completed = 0;
      let paused = false;
      for (const action of queuedActions) {
        const actionLabel = describeQueuedAction(action as { kind: string; payload: Record<string, unknown> });
        set((state) => ({
          syncProgress: state.syncProgress
            ? {
                ...state.syncProgress,
                currentLabel: actionLabel,
                currentKind: action.kind,
                lastError: null
              }
            : state.syncProgress,
          syncMessage: `Syncing ${completed + 1} of ${queuedActions.length}: ${actionLabel}`
        }));

        try {
          switch (action.kind) {
            case "createCategory":
              await createCategory(action.payload);
              break;
            case "createBrand":
              await createBrand(action.payload);
              break;
            case "createProduct":
              await createProduct(action.payload);
              break;
            case "adjustStock":
              await adjustProductStock(action.payload);
              break;
            case "createCustomer":
              await createCustomer(action.payload);
              break;
            case "updateCustomer":
              await apiUpdateCustomer(action.payload.customerId, action.payload);
              break;
            case "createSupplier":
              await createSupplier(action.payload);
              break;
            case "createExpense":
              await createExpense(action.payload);
              break;
            case "recordCustomerPayment":
              await recordCustomerPayment(action.payload.customerId, action.payload);
              break;
            case "createSale":
              await apiCreateSale(action.payload);
              break;
          }
          await removeAction(action.id);
          completed += 1;
          set((state) => ({
            syncProgress: state.syncProgress
              ? {
                  ...state.syncProgress,
                  completed,
                  currentLabel: null,
                  currentKind: null,
                  lastError: null
                }
              : state.syncProgress,
            syncMessage:
              completed === queuedActions.length
                ? `Synced ${completed} of ${queuedActions.length} queued actions`
                : `Synced ${completed} of ${queuedActions.length} queued actions`
          }));
        } catch (error) {
          await markActionFailed(action, error);
          paused = true;
          set({
            syncMessage: isOfflineError(error)
              ? "Offline queue paused until the connection returns"
              : error instanceof Error
                ? `Sync paused: ${error.message}`
                : "Sync paused",
            syncProgress: {
              total: queuedActions.length,
              completed,
              currentLabel: actionLabel,
              currentKind: action.kind,
              startedAt,
              lastError: error instanceof Error ? error.message : String(error)
            }
          });
          break;
        }
      }
      const remaining = await countQueuedActions(business.id);
      if (!paused && remaining === 0) {
        const [catalogResult, dashboardResult] = await Promise.allSettled([get().loadCatalog(), get().loadDashboard()]);
        const refreshFailure = catalogResult.status === "rejected" ? catalogResult.reason : dashboardResult.status === "rejected" ? dashboardResult.reason : null;
        set({
          syncMessage: refreshFailure
            ? refreshFailure instanceof Error
              ? refreshFailure.message
              : "Refresh failed"
            : "Cloud data refreshed"
        });
      } else if (!paused && remaining > 0) {
        set({ syncMessage: "Cloud data refreshed, but some queued items remain" });
      }
    } catch (error) {
      set({ syncMessage: error instanceof Error ? error.message : "Refresh failed" });
    } finally {
      set({ syncing: false, syncProgress: null });
      await get().refreshPendingSync();
    }
  },
  refreshPendingSync: async () => {
    const businessId = get().business?.id;
    const pendingSync = businessId ? await countQueuedActions(businessId) : 0;
    set({ pendingSync });
  }
}));

if (typeof setAuthFailureHandler === "function") {
  setAuthFailureHandler(async () => {
    const state = useAppStore.getState();
    if (!state.user && !state.business) {
      return;
    }
    await state.logout();
  });
}
