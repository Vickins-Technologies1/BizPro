import { create } from "zustand";
import type { Business, Category, Customer, DailySummary, Expense, Payment, Product, Sale } from "@shared";
import { secureStore } from "@/storage/secure";
import { createId } from "@/utils/id";
import { dateKey } from "@/utils/date";
import { buildReceiptArtifacts, type ReceiptArtifacts } from "@/services/receiptService";
import { registerBusiness, loginBusiness, authMe, listCategories, listProducts, listCustomers, listSales, listExpenses, createCategory, createProduct, adjustProductStock, createCustomer, recordCustomerPayment, createExpense, createSale as apiCreateSale, getReportsSummary, getTopProducts } from "@/services/apiClient";
import { businessSetupSchema, loginSchema } from "@shared";
import { setThemeTokens, type ThemeMode } from "@/theme/tokens";
import type { AccessPermission } from "@shared";

export interface DashboardSummary extends DailySummary {
  topProducts: Array<{ productId: string; productName: string; quantity: number; total: number }>;
}

interface AppState {
  ready: boolean;
  loading: boolean;
  authLoading: boolean;
  themeMode: ThemeMode;
  business: Business | null;
  user: { id: string; fullName: string; role: string; businessId?: string; ownerId?: string | null; roleLabel?: string | null; permissions?: AccessPermission[] | null } | null;
  deviceId: string;
  pendingSync: number;
  syncMessage: string;
  dashboard: DashboardSummary | null;
  products: Product[];
  categories: Category[];
  customers: Customer[];
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
  addCategory: (input: Omit<Category, "id" | "createdAt" | "updatedAt" | "deletedAt">) => Promise<Category>;
  addProduct: (input: Omit<Product, "id" | "createdAt" | "updatedAt" | "deletedAt">) => Promise<Product>;
  adjustStock: (input: { productId: string; quantityDelta: number; unitCost: number; note?: string }) => Promise<Product>;
  addCustomer: (input: Omit<Customer, "id" | "createdAt" | "updatedAt" | "deletedAt" | "balance"> & { balance?: number }) => Promise<Customer>;
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
  user: { id: string; fullName: string; role: string; businessId?: string; ownerId?: string | null; roleLabel?: string | null; permissions?: AccessPermission[] | null };
  accessToken?: string | null;
};

function normalizeSetupValue(value: string) {
  return value.trim();
}

function createReceiptNumber() {
  return `R-${dateKey().replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
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

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  loading: false,
  authLoading: true,
  themeMode: "light",
  business: null,
  user: null,
  deviceId: "",
  pendingSync: 0,
  syncMessage: "Cloud only",
  dashboard: null,
  products: [],
  categories: [],
  customers: [],
  sales: [],
  expenses: [],
  error: null,
  bootstrap: async () => {
    set({ loading: true, error: null });
    try {
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
          set({
            themeMode,
            business: remote.business,
            user: remote.user,
            deviceId,
            ready: true,
            authLoading: false
          });
          await Promise.allSettled([get().loadDashboard(), get().loadCatalog(), get().refreshPendingSync()]);
          return;
        } catch (error) {
          console.warn("[auth] Stored session could not be restored", error);
          await secureStore.clearSession();
        }
      }

      set({
        themeMode,
        business: null,
        user: null,
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
    await secureStore.setSession(JSON.stringify(session));
    set({
      business,
      user: session.user,
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

      const remote = await registerBusiness({
        businessId: createId(),
        branchId: createId(),
        ownerUserId: createId(),
        ownerName,
        phone,
        password: parsed.password,
        businessName,
        businessType: parsed.businessType,
        planTier: parsed.planTier,
        currency,
        branchName,
        cashierPin: parsed.cashierPin ? normalizeSetupValue(parsed.cashierPin) : null
      });

      const session: StoredSession = {
        user: remote.user,
        accessToken: remote.accessToken
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
        session: { user: remote.user, accessToken: remote.accessToken }
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
      dashboard: null,
      products: [],
      categories: [],
      customers: [],
      sales: [],
      expenses: [],
      pendingSync: 0,
      syncMessage: "Cloud only"
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
    const [summary, topProducts] = await Promise.all([getReportsSummary(), getTopProducts()]);
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
    const [categories, products, customers, sales, expenses] = await Promise.all([
      listCategories(),
      listProducts(),
      listCustomers(),
      listSales(),
      listExpenses()
    ]);
    set({ categories, products, customers, sales, expenses });
  },
  addCategory: async (input) => {
    const category = await createCategory({
      businessId: get().business?.id ?? input.businessId,
      name: input.name,
      color: input.color ?? null,
      sortOrder: input.sortOrder
    });
    await Promise.allSettled([get().loadCatalog(), get().loadDashboard()]);
    return category;
  },
  addProduct: async (input) => {
    const product = await createProduct({
      businessId: get().business?.id ?? input.businessId,
      categoryId: input.categoryId ?? null,
      name: input.name,
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
      unit: input.unit,
      buyingPrice: input.buyingPrice,
      sellingPrice: input.sellingPrice,
      stockOnHand: input.stockOnHand,
      lowStockThreshold: input.lowStockThreshold,
      isActive: input.isActive
    });
    await Promise.allSettled([get().loadCatalog(), get().loadDashboard()]);
    return product;
  },
  adjustStock: async (input) => {
    const product = await adjustProductStock({
      productId: input.productId,
      quantityDelta: input.quantityDelta,
      unitCost: input.unitCost,
      note: input.note ?? "Stock adjustment",
      referenceType: "adjustment"
    });
    await Promise.allSettled([get().loadCatalog(), get().loadDashboard()]);
    return product;
  },
  addCustomer: async (input) => {
    const customer = await createCustomer({
      businessId: get().business?.id ?? input.businessId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
      balance: input.balance ?? 0
    });
    await Promise.allSettled([get().loadCatalog(), get().loadDashboard()]);
    return customer;
  },
  addExpense: async (input) => {
    const expense = await createExpense({
      businessId: get().business?.id ?? input.businessId,
      categoryId: input.categoryId ?? null,
      amount: input.amount,
      note: input.note,
      expenseDate: input.expenseDate,
      recordedById: input.recordedById ?? null
    });
    await Promise.allSettled([get().loadDashboard(), get().loadCatalog()]);
    return expense;
  },
  recordDebtPayment: async (input) => {
    const payment = await recordCustomerPayment(input.customerId, {
      amount: input.amount,
      method: input.method,
      reference: input.reference ?? null,
      note: input.note ?? null
    });
    await Promise.allSettled([get().loadDashboard(), get().loadCatalog()]);
    return payment;
  },
  createSale: async (input) => {
    const business = get().business;
    if (!business) throw new Error("No business loaded");
    const receiptNumber = createReceiptNumber();
    const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discountTotal = input.discountTotal ?? input.items.reduce((sum, item) => sum + item.discount, 0);
    const taxTotal = input.taxTotal ?? 0;
    const grandTotal = subtotal - discountTotal + taxTotal;
    const balanceDue = Math.max(0, grandTotal - input.amountPaid);
    const sale = await apiCreateSale({
      businessId: business.id,
      branchId: input.branchId ?? null,
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
          productId: item.productId,
          productName: product?.name ?? item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
          lineDiscount: item.discount,
          lineTotal: item.unitPrice * item.quantity - item.discount
        };
      })
    });
    await Promise.allSettled([get().loadCatalog(), get().loadDashboard()]);
    const servedBy = get().user?.fullName?.trim() || get().user?.roleLabel?.trim() || get().user?.role || "Staff";
    const receipt = buildReceiptArtifacts(sale, sale.items, business.currency, servedBy, business.name);
    return { sale, receipt };
  },
  syncNow: async () => {
    const business = get().business;
    if (!business) return;
    set({ syncMessage: "Refreshing from cloud..." });
    try {
      await Promise.allSettled([get().loadCatalog(), get().loadDashboard()]);
      set({ syncMessage: "Cloud data refreshed" });
    } catch (error) {
      set({ syncMessage: error instanceof Error ? error.message : "Refresh failed" });
    } finally {
      await get().refreshPendingSync();
    }
  },
  refreshPendingSync: async () => {
    set({ pendingSync: 0 });
  }
}));
