import { create } from "zustand";
import type { Business, Customer, Product, Sale, Expense, DailySummary, Category, Payment } from "@shared";
import { initializeDatabase, oneSql, runSql, allSql } from "@/storage/sqlite";
import { secureStore } from "@/storage/secure";
import { createId, createEventId } from "@/utils/id";
import { nowIso, dateKey } from "@/utils/date";
import { seedDemoData } from "@/services/seedService";
import { CategoryRepository, ProductRepository } from "@/repositories/catalogRepository";
import { CustomerRepository } from "@/repositories/customerRepository";
import { ExpenseRepository, PaymentRepository, StockMovementRepository } from "@/repositories/financeRepository";
import { SyncService } from "@/services/syncService";
import { getDashboardSummary, getTopProducts } from "@/services/reportService";
import { businessSetupSchema, loginSchema } from "@shared";
import { buildReceiptText } from "@/services/receiptService";
import { env } from "@/config/env";
import { remoteLogin, remoteRegister } from "@/services/remoteAuth";

const categoryRepository = new CategoryRepository();
const productRepository = new ProductRepository();
const customerRepository = new CustomerRepository();
const expenseRepository = new ExpenseRepository();
const paymentRepository = new PaymentRepository();
const stockMovementRepository = new StockMovementRepository();
const syncService = new SyncService();

export interface DashboardSummary extends DailySummary {
  topProducts: Array<{ productId: string; productName: string; quantity: number; total: number }>;
}

interface AppState {
  ready: boolean;
  loading: boolean;
  authLoading: boolean;
  business: Business | null;
  user: { id: string; fullName: string; role: string; businessId?: string } | null;
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
  completeOnboarding: (input: unknown) => Promise<void>;
  login: (input: unknown) => Promise<void>;
  logout: () => Promise<void>;
  loadDashboard: () => Promise<void>;
  loadCatalog: () => Promise<void>;
  addCategory: (input: Omit<Category, "id" | "createdAt" | "updatedAt" | "deletedAt">) => Promise<void>;
  addProduct: (input: Omit<Product, "id" | "createdAt" | "updatedAt" | "deletedAt">) => Promise<void>;
  adjustStock: (input: { productId: string; quantityDelta: number; unitCost: number; note?: string }) => Promise<void>;
  addCustomer: (input: Omit<Customer, "id" | "createdAt" | "updatedAt" | "deletedAt" | "balance"> & { balance?: number }) => Promise<void>;
  addExpense: (input: Omit<Expense, "id" | "createdAt" | "updatedAt" | "deletedAt">) => Promise<void>;
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
  }) => Promise<{ sale: Sale; receipt: string }>;
  syncNow: () => Promise<void>;
  refreshPendingSync: () => Promise<void>;
}

type StoredSession = {
  user: { id: string; fullName: string; role: string; businessId?: string } | null;
  accessToken?: string | null;
};

async function ensureBusiness() {
  const row = await oneSql<Business>("SELECT * FROM businesses WHERE deletedAt IS NULL ORDER BY createdAt DESC LIMIT 1");
  return row ?? null;
}

async function ensureSession(): Promise<StoredSession | null> {
  const session = await secureStore.getSession();
  return session ? JSON.parse(session) : null;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  loading: false,
  authLoading: true,
  business: null,
  user: null,
  deviceId: "",
  pendingSync: 0,
  syncMessage: "Idle",
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
      await initializeDatabase();
      const existingBusiness = await ensureBusiness();
      const session = await ensureSession();
      let deviceId = await secureStore.getDeviceId();
      if (!deviceId) {
        deviceId = createId();
        await secureStore.setDeviceId(deviceId);
      }
      if (existingBusiness) {
        set({
          business: existingBusiness,
          user: session?.user ?? null,
          deviceId,
          ready: true,
          authLoading: false
        });
        await get().loadDashboard();
        await get().loadCatalog();
        await get().refreshPendingSync();
      } else {
        set({ business: null, user: null, deviceId, ready: true, authLoading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to initialize app", authLoading: false });
    } finally {
      set({ loading: false });
    }
  },
  completeOnboarding: async (input) => {
    const parsed = businessSetupSchema.parse(input);
    set({ loading: true, error: null });
    try {
      const branchId = createId();
      const ownerUserId = createId();
      const business: Business = {
        id: createId(),
        name: parsed.businessName,
        slug: parsed.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        businessType: parsed.businessType,
        currency: parsed.currency,
        planTier: parsed.planTier,
        billingStatus: "trial",
        graceEndsAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        deletedAt: null
      };
      await initializeDatabase();
      await runSql("INSERT INTO businesses (id, name, slug, businessType, currency, planTier, billingStatus, graceEndsAt, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        business.id,
        business.name,
        business.slug,
        business.businessType,
        business.currency,
        business.planTier,
        business.billingStatus,
        null,
        business.createdAt,
        business.updatedAt,
        null
      ]);
      await runSql("INSERT INTO branches (id, businessId, name, code, isDefault, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
        branchId,
        business.id,
        parsed.branchName,
        "MAIN",
        1,
        nowIso(),
        nowIso(),
        null
      ]);
      await runSql("INSERT INTO users (id, businessId, fullName, phone, passwordHash, pinHash, role, isActive, createdAt, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        ownerUserId,
        business.id,
        parsed.ownerName,
        parsed.phone,
        await import("bcryptjs").then(({ default: bcrypt }) => bcrypt.hash(parsed.password, 10)),
        parsed.cashierPin ? await import("bcryptjs").then(({ default: bcrypt }) => bcrypt.hash(parsed.cashierPin!, 10)) : null,
        "owner",
        1,
        nowIso(),
        nowIso(),
        null
      ]);
      await runSql("INSERT INTO app_settings (id, businessId, deviceId, currency, lastSyncAt, themeMode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
        createId(),
        business.id,
        get().deviceId,
        business.currency,
        null,
        "dark",
        nowIso(),
        nowIso()
      ]);
      await seedDemoData(business.id);
      const stored = await ensureBusiness();
      let session: StoredSession = { user: { id: ownerUserId, fullName: parsed.ownerName, role: "owner", businessId: business.id } };
      try {
        const remote = await remoteRegister({
          businessId: business.id,
          branchId,
          ownerUserId,
          ownerName: parsed.ownerName,
          phone: parsed.phone,
          password: parsed.password,
          businessName: parsed.businessName,
          businessType: parsed.businessType,
          planTier: parsed.planTier,
          currency: parsed.currency,
          branchName: parsed.branchName,
          cashierPin: parsed.cashierPin || null
        });
        session = {
          user: {
            id: remote.user.id,
            fullName: remote.user.fullName,
            role: remote.user.role,
            businessId: remote.user.businessId
          },
          accessToken: remote.accessToken
        };
      } catch {
        session = { user: { id: ownerUserId, fullName: parsed.ownerName, role: "owner", businessId: business.id } };
      }
      set({ business: stored, user: session.user });
      await secureStore.setSession(JSON.stringify(session));
      await get().loadDashboard();
      await get().loadCatalog();
      await get().refreshPendingSync();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to complete onboarding" });
    } finally {
      set({ loading: false });
    }
  },
  login: async (input) => {
    const parsed = loginSchema.parse(input);
    const business = await ensureBusiness();
    if (!business) throw new Error("No business setup found");
    set({ authLoading: true, error: null });
    try {
      const user = await oneSql<{ id: string; fullName: string; role: string; passwordHash?: string; pinHash?: string }>(
        "SELECT id, fullName, role, passwordHash, pinHash FROM users WHERE businessId = ? AND (phone = ? OR fullName = ?) AND deletedAt IS NULL LIMIT 1",
        [business.id, parsed.identifier, parsed.identifier]
      );
      if (!user) throw new Error("Invalid credentials");
      const bcrypt = await import("bcryptjs").then((m) => m.default);
      const matchesPassword = user.passwordHash ? await bcrypt.compare(parsed.passwordOrPin, user.passwordHash) : false;
      const matchesPin = user.pinHash ? await bcrypt.compare(parsed.passwordOrPin, user.pinHash) : false;
      if (!matchesPassword && !matchesPin) throw new Error("Invalid credentials");
      let session: StoredSession = { user: { id: user.id, fullName: user.fullName, role: user.role, businessId: business.id } };
      try {
        const remote = await remoteLogin({ identifier: parsed.identifier, passwordOrPin: parsed.passwordOrPin });
        session = {
          user: {
            id: remote.user.id,
            fullName: remote.user.fullName,
            role: remote.user.role,
            businessId: remote.user.businessId
          },
          accessToken: remote.accessToken
        };
      } catch {
        session = { user: { id: user.id, fullName: user.fullName, role: user.role, businessId: business.id } };
      }
      await secureStore.setSession(JSON.stringify(session));
      set({ user: session.user, business });
    } finally {
      set({ authLoading: false });
    }
  },
  logout: async () => {
    await secureStore.clearSession();
    set({ user: null });
  },
  loadDashboard: async () => {
    const business = get().business ?? (await ensureBusiness());
    if (!business) return;
    const summary = await getDashboardSummary(business.id);
    const topProducts = await getTopProducts(business.id);
    set({
      dashboard: {
        salesTotal: summary.salesToday,
        expensesTotal: summary.expensesToday,
        cogsTotal: summary.cogsTotal,
        estimatedProfit: summary.estimatedProfit,
        debtTotal: summary.debtTotal,
        lowStockCount: summary.lowStockCount,
        date: dateKey(),
        topProducts: topProducts as Array<{ productId: string; productName: string; quantity: number; total: number }>
      }
    });
  },
  loadCatalog: async () => {
    const business = get().business ?? (await ensureBusiness());
    if (!business) return;
    const [categories, products, customers, sales, expenses] = await Promise.all([
      categoryRepository.findAll("businessId = ? AND deletedAt IS NULL", [business.id]),
      productRepository.findAll("businessId = ? AND deletedAt IS NULL", [business.id]),
      customerRepository.findAll("businessId = ? AND deletedAt IS NULL", [business.id]),
      allSql<Sale>("SELECT * FROM sales WHERE businessId = ? AND deletedAt IS NULL ORDER BY createdAt DESC", [business.id]),
      expenseRepository.findAll("businessId = ? AND deletedAt IS NULL", [business.id])
    ]);
    set({ categories, products, customers, sales, expenses });
  },
  addCategory: async (input) => {
    const business = get().business;
    if (!business) return;
    const category = await categoryRepository.create({ ...input, businessId: business.id });
    await syncService.enqueue({
      eventId: createEventId(),
      businessId: business.id,
      deviceId: get().deviceId,
      entityType: "category",
      entityId: category.id,
      action: "create",
      payload: category,
      createdAt: nowIso()
    });
    const categories = await categoryRepository.findAll("businessId = ? AND deletedAt IS NULL", [business.id]);
    set({ categories });
    await get().refreshPendingSync();
  },
  addProduct: async (input) => {
    const business = get().business;
    if (!business) return;
    const product = await productRepository.create({ ...input, businessId: business.id });
    await syncService.enqueue({
      eventId: createEventId(),
      businessId: business.id,
      deviceId: get().deviceId,
      entityType: "product",
      entityId: product.id,
      action: "create",
      payload: product,
      createdAt: nowIso()
    });
    await get().loadCatalog();
    await get().refreshPendingSync();
  },
  adjustStock: async (input) => {
    const business = get().business;
    if (!business) return;
    const movement = await stockMovementRepository.create({
      businessId: business.id,
      productId: input.productId,
      referenceType: "restock",
      referenceId: createId(),
      quantityDelta: input.quantityDelta,
      unitCost: input.unitCost,
      note: input.note ?? "Stock adjustment"
    });
    await productRepository.adjustStock(input.productId, input.quantityDelta);
    await syncService.enqueue({
      eventId: createEventId(),
      businessId: business.id,
      deviceId: get().deviceId,
      entityType: "stockMovement",
      entityId: movement.id,
      action: "create",
      payload: movement,
      createdAt: nowIso()
    });
    await get().loadCatalog();
    await get().refreshPendingSync();
  },
  addCustomer: async (input) => {
    const business = get().business;
    if (!business) return;
    const customer = await customerRepository.create({ ...input, businessId: business.id });
    await syncService.enqueue({
      eventId: createEventId(),
      businessId: business.id,
      deviceId: get().deviceId,
      entityType: "customer",
      entityId: customer.id,
      action: "create",
      payload: customer,
      createdAt: nowIso()
    });
    await get().loadCatalog();
    await get().refreshPendingSync();
  },
  addExpense: async (input) => {
    const business = get().business;
    if (!business) return;
    const recorded = await expenseRepository.create({ ...input, businessId: business.id });
    await syncService.enqueue({
      eventId: createEventId(),
      businessId: business.id,
      deviceId: get().deviceId,
      entityType: "expense",
      entityId: recorded.id,
      action: "create",
      payload: recorded,
      createdAt: nowIso()
    });
    await get().loadDashboard();
    await get().loadCatalog();
    await get().refreshPendingSync();
  },
  recordDebtPayment: async (input) => {
    const business = get().business;
    if (!business) throw new Error("No business loaded");
    const payment: Payment = {
      id: createId(),
      businessId: business.id,
      customerId: input.customerId,
      saleId: null,
      debtPaymentId: createId(),
      method: input.method,
      status: "paid",
      amount: input.amount,
      reference: input.reference ?? null,
      note: input.note ?? null,
      provider: input.method === "mpesa" ? "tuma" : null,
      reconciledAt: input.method === "mpesa" ? nowIso() : null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    await paymentRepository.insert(payment);
    await customerRepository.applyBalanceDelta(input.customerId, -Math.abs(input.amount));
    await syncService.enqueue({
      eventId: createEventId(),
      businessId: business.id,
      deviceId: get().deviceId,
      entityType: "payment",
      entityId: payment.id,
      action: "create",
      payload: payment,
      createdAt: nowIso()
    });
    await get().loadCatalog();
    await get().refreshPendingSync();
    return payment;
  },
  createSale: async (input) => {
    const business = get().business;
    if (!business) throw new Error("No business loaded");
    const receiptNumber = `R-${dateKey().replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discountTotal = input.discountTotal ?? input.items.reduce((sum, item) => sum + item.discount, 0);
    const taxTotal = input.taxTotal ?? 0;
    const grandTotal = subtotal - discountTotal + taxTotal;
    const balanceDue = Math.max(0, grandTotal - input.amountPaid);
    const saleId = createId();
    const sale: Sale = {
      id: saleId,
      businessId: business.id,
      branchId: input.branchId ?? null,
      customerId: input.customerId ?? null,
      receiptNumber,
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
      amountPaid: input.amountPaid,
      balanceDue,
      paymentStatus: input.paymentStatus,
      paymentMethod: input.paymentMethod,
      cashierId: get().user?.id ?? null,
      notes: input.notes ?? null,
      items: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null
    };
    await runSql(
      `INSERT INTO sales (id, businessId, branchId, customerId, receiptNumber, subtotal, discountTotal, taxTotal, grandTotal, amountPaid, balanceDue, paymentStatus, paymentMethod, cashierId, notes, createdAt, updatedAt, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sale.id,
        sale.businessId,
        sale.branchId,
        sale.customerId,
        sale.receiptNumber,
        sale.subtotal,
        sale.discountTotal,
        sale.taxTotal,
        sale.grandTotal,
        sale.amountPaid,
        sale.balanceDue,
        sale.paymentStatus,
        sale.paymentMethod,
        sale.cashierId,
        sale.notes,
        nowIso(),
        nowIso(),
        null
      ]
    );
    const saleItems: Array<{
      id: string;
      saleId: string;
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      costPrice: number;
      lineDiscount: number;
      lineTotal: number;
    }> = [];
    for (const item of input.items) {
      const product = await productRepository.findById(item.productId);
      saleItems.push({
        id: createId(),
        saleId: sale.id,
        productId: item.productId,
        productName: product?.name ?? item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        lineDiscount: item.discount,
        lineTotal: item.unitPrice * item.quantity - item.discount
      });
    }
    for (const item of saleItems) {
      await runSql(
        "INSERT INTO sale_items (id, saleId, productId, productName, quantity, unitPrice, costPrice, lineDiscount, lineTotal, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.saleId, item.productId, item.productName, item.quantity, item.unitPrice, item.costPrice, item.lineDiscount, item.lineTotal, nowIso(), nowIso()]
      );
    }
    const saleWithItems: Sale = { ...sale, items: saleItems };
    for (const item of input.items) {
      const product = await productRepository.findById(item.productId);
      if (!product) continue;
      await stockMovementRepository.create({
        businessId: business.id,
        productId: item.productId,
        referenceType: "sale",
        referenceId: sale.id,
        quantityDelta: -Math.abs(item.quantity),
        unitCost: item.costPrice,
        note: `Sale ${sale.receiptNumber}`
      });
      await productRepository.adjustStock(item.productId, -Math.abs(item.quantity));
    }
    if (input.customerId && balanceDue > 0) {
      await customerRepository.applyBalanceDelta(input.customerId, balanceDue);
    }
    const payment = await paymentRepository.insert({
      id: createId(),
      businessId: business.id,
      customerId: input.customerId ?? null,
      saleId: sale.id,
      debtPaymentId: null,
      method: input.paymentMethod,
      status: input.paymentStatus,
      amount: input.amountPaid,
      reference: null,
      note: input.notes ?? null,
      provider: input.paymentMethod === "mpesa" ? "tuma" : null,
      reconciledAt: input.paymentMethod === "mpesa" && input.paymentStatus === "paid" ? nowIso() : null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
    await syncService.enqueue({
      eventId: createEventId(),
      businessId: business.id,
      deviceId: get().deviceId,
      entityType: "sale",
      entityId: sale.id,
      action: "create",
      payload: { sale: saleWithItems, payment },
      createdAt: nowIso()
    });
    await get().loadCatalog();
    await get().loadDashboard();
    await get().refreshPendingSync();
    const receipt = buildReceiptText(saleWithItems, saleItems as any, business.currency);
    return { sale: saleWithItems, receipt };
  },
  syncNow: async () => {
    const business = get().business;
    if (!business) return;
    set({ syncMessage: "Syncing..." });
    try {
      const deviceId = get().deviceId;
      const endpoint = env.apiUrl;
      const session = await ensureSession();
      const token = session?.accessToken ?? null;
      await syncService.flush(business.id, deviceId, endpoint, token);
      await syncService.pull(business.id, deviceId, endpoint, token);
      await get().loadCatalog();
      await get().loadDashboard();
      await get().refreshPendingSync();
      set({ syncMessage: "Synced" });
    } catch (error) {
      set({ syncMessage: error instanceof Error ? error.message : "Sync failed" });
    }
  },
  refreshPendingSync: async () => {
    const pending = await syncService.pendingCount();
    set({ pendingSync: pending });
  }
}));
