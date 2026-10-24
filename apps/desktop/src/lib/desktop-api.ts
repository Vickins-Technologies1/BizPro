import type { BankAccount, Business, Branch, BusinessNotification, CreditNote, Customer, DailySummary, EnterpriseAnalytics, Expense, FinanceOverview, FinancePayment, Invoice, PettyCashEntry, Product, PurchaseOrder, Sale, StockTransfer, Supplier, SupplierCategory, SupplierContact, SupplierDocument, SupplierPayment, SupplierPerformanceReport, SupplierStatement } from "@vbo/shared";

export type Session = {
  accessToken: string;
  user: { id: string; fullName: string; role: string; businessId: string; branchId?: string | null; permissions?: string[] | null };
  business: Business;
  branches?: Branch[];
};

const TOKEN_KEY = "bizpro.desktop.token";
const SESSION_KEY = "bizpro.desktop.session";
const QUEUE_KEY = "bizpro.desktop.offline.queue";
const CACHE_PREFIX = "bizpro.desktop.cache.";
const MAX_CACHE_BYTES = 750_000;

export type OfflineEntry = { id: string; accountKey: string; path: string; body: unknown; createdAt: string };

type ApiEntity = Record<string, unknown>;

export class DesktopApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "DesktopApiError"; }
}

function normalizeEntity<T extends ApiEntity>(entity: T): T & { id: string } {
  const id = String(entity.externalId ?? entity.id ?? entity._id ?? "");
  return { ...entity, id } as T & { id: string };
}

function normalizeProduct<T extends ApiEntity>(product: T): T & { id: string; serverId: string | null } {
  const normalized = normalizeEntity(product);
  const serverId = product._id ? String(product._id) : (product.serverId ? String(product.serverId) : null);
  return { ...normalized, id: serverId ?? normalized.id, serverId };
}

function normalizeList<T extends ApiEntity>(items: T[]) { return items.map(normalizeEntity); }

function normalizeSummary<T extends ApiEntity>(summary: T) {
  return { ...summary, totalSales: summary.totalSales ?? summary.salesTotal, totalExpenses: summary.totalExpenses ?? summary.expensesTotal, netProfit: summary.netProfit ?? summary.estimatedProfit } as T;
}

function normalizeInvoice(invoice: ApiEntity): Invoice {
  return { ...invoice, id: String(invoice._id ?? invoice.id ?? invoice.externalId ?? ""), lineItems: Array.isArray(invoice.lineItems) ? invoice.lineItems : [] } as unknown as Invoice;
}

function normalizeBranch(branch: ApiEntity): Branch {
  return { ...branch, id: String(branch._id ?? branch.id ?? ""), status: branch.status === "inactive" ? "inactive" : "active", isDefault: Boolean(branch.isDefault) } as unknown as Branch;
}

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as Session : null;
  } catch { return null; }
}

export function writeSession(session: Session) {
  window.localStorage.setItem(TOKEN_KEY, session.accessToken);
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(SESSION_KEY);
}

function currentAccountKey() {
  const session = readSession();
  return session ? `${session.user.businessId}:${session.user.id}` : "";
}

function notifyQueueChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("dira-offline-queue-change"));
}

export function queuedCount() {
  if (typeof window === "undefined") return 0;
  const accountKey = currentAccountKey();
  if (!accountKey) return 0;
  return readQueue().filter((entry) => entry.accountKey === accountKey).length;
}

export function queueOffline(path: string, body: unknown) {
  const accountKey = currentAccountKey();
  if (!accountKey) throw new Error("Sign in before queueing work for offline sync.");
  const current = readQueue();
  current.push({ id: crypto.randomUUID(), accountKey, path, body, createdAt: new Date().toISOString() });
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(current));
  notifyQueueChanged();
}

export function isOfflineError(error: unknown) {
  return typeof navigator !== "undefined" && (!navigator.onLine || error instanceof TypeError);
}

function readQueue(): OfflineEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => item && typeof item.path === "string") as OfflineEntry[] : [];
  } catch { return []; }
}

function cacheKey(path: string) { return `${CACHE_PREFIX}${path}`; }

function scopedCacheKey(path: string) {
  const accountKey = currentAccountKey();
  return accountKey ? `${CACHE_PREFIX}${encodeURIComponent(accountKey)}.${path}` : cacheKey(path);
}

function readCached<T>(path: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(scopedCacheKey(path));
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
}

function writeCached(path: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= MAX_CACHE_BYTES) window.localStorage.setItem(scopedCacheKey(path), serialized);
  } catch { /* Cache is an optimization, never a request failure. */ }
}

function clearCachedReads() {
  if (typeof window === "undefined") return;
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(CACHE_PREFIX)) window.localStorage.removeItem(key);
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  const isRead = !init?.method || init.method.toUpperCase() === "GET";
  if (isRead && typeof navigator !== "undefined" && !navigator.onLine) {
    const cached = readCached<T>(path);
    if (cached !== null) return cached;
    throw new Error("You are offline and this data is not cached yet.");
  }
  try {
    const response = await fetch(`/api${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) }
    });
    if (!response.ok) {
      const responseText = await response.text();
      let message = responseText || `Request failed (${response.status})`;
      try {
        const payload = JSON.parse(responseText) as { message?: string | string[]; error?: string };
        message = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message ?? payload.error ?? message;
      } catch { /* Some API and proxy errors are plain text. */ }
      throw new DesktopApiError(message, response.status);
    }
    const value = response.status === 204 ? undefined as T : await response.json() as T;
    if (isRead) writeCached(path, value);
    if (!isRead) clearCachedReads();
    return value;
  } catch (error) {
    if (isRead) {
      const cached = readCached<T>(path);
      if (cached !== null) return cached;
    }
    throw error;
  }
}

export async function flushOfflineQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, remaining: queuedCount() };
  const accountKey = currentAccountKey();
  if (!accountKey) return { synced: 0, remaining: 0 };
  const allEntries = readQueue();
  const pending = allEntries.filter((entry) => entry.accountKey === accountKey);
  if (!pending.length) return { synced: 0, remaining: 0 };
  let synced = 0;
  for (const entry of pending) {
    try { await request(entry.path, { method: "POST", body: JSON.stringify(entry.body) }); synced += 1; }
    catch { break; }
  }
  const unprocessed = pending.slice(synced);
  const processedIds = new Set(pending.slice(0, synced).map((entry) => entry.id));
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(allEntries.filter((entry) => !processedIds.has(entry.id))));
  notifyQueueChanged();
  return { synced, remaining: unprocessed.length };
}

export async function login(identifier: string, passwordOrPin: string) {
  return request<Session>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, passwordOrPin }) });
}

export async function registerBusiness(input: {
  ownerName: string; phone: string; phoneLocal: string; password: string; businessName: string;
  industryKey: string; businessType: string; planTier: string; currency: string; branchName: string; cashierPin?: string | null;
}) {
  return request<Session>("/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export async function requestPasswordReset(identifier: string) {
  return request<{ accepted: boolean; message: string; expiresInMinutes: number; debugCode?: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ identifier: identifier.trim() }) });
}

export async function resetPassword(input: { identifier: string; code: string; password: string }) {
  return request<{ success: boolean; message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify(input) });
}

let saleRequestInFlight = false;

export const api = {
  me: () => request<Omit<Session, "accessToken">>("/auth/me"),
  dashboard: (branchId?: string | null) => request<ApiEntity>(`/reports/summary${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`).then(normalizeSummary) as Promise<DailySummary>,
  products: async (branchId?: string | null) => (await request<ApiEntity[]>(`/products${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`)).map(normalizeProduct) as unknown as Product[],
  productsPage: (params: { branchId?: string | null; page?: number; pageSize?: number; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.branchId) query.set("branchId", params.branchId);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    if (params.search) query.set("search", params.search);
    return request<{ items: ApiEntity[]; total: number; page: number; pageSize: number }>(`/products/page?${query.toString()}`).then((result) => ({ ...result, items: result.items.map(normalizeProduct) as unknown as Product[] }));
  },
  customers: async (branchId?: string | null) => normalizeList(await request<ApiEntity[]>(`/customers${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`)) as unknown as Customer[],
  sales: async (branchId?: string | null) => normalizeList(await request<ApiEntity[]>(`/sales${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`)) as unknown as Sale[],
  purchaseOrders: async (branchId?: string | null) => normalizeList(await request<ApiEntity[]>(`/purchase-orders${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`)) as unknown as PurchaseOrder[],
  stockTransfers: async (branchId?: string | null) => normalizeList(await request<ApiEntity[]>(`/stock-transfers${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`)) as unknown as StockTransfer[],
  expenses: async (branchId?: string | null) => normalizeList(await request<ApiEntity[]>(`/expenses${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`)) as unknown as Expense[],
  suppliers: async () => normalizeList(await request<ApiEntity[]>("/suppliers")),
  supplierCategories: async () => normalizeList(await request<ApiEntity[]>("/suppliers/categories")) as unknown as SupplierCategory[],
  createSupplierCategory: async (body: unknown) => normalizeEntity(await request<ApiEntity>("/suppliers/categories", { method: "POST", body: JSON.stringify(body) })) as unknown as SupplierCategory,
  updateSupplierCategory: async (id: string, body: unknown) => normalizeEntity(await request<ApiEntity>(`/suppliers/categories/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) })) as unknown as SupplierCategory,
  archiveSupplierCategory: async (id: string) => normalizeEntity(await request<ApiEntity>(`/suppliers/categories/${encodeURIComponent(id)}/archive`, { method: "POST" })) as unknown as SupplierCategory,
  supplierContacts: async (supplierId: string) => normalizeList(await request<ApiEntity[]>(`/suppliers/${encodeURIComponent(supplierId)}/contacts`)) as unknown as SupplierContact[],
  createSupplierContact: async (supplierId: string, body: unknown) => normalizeEntity(await request<ApiEntity>(`/suppliers/${encodeURIComponent(supplierId)}/contacts`, { method: "POST", body: JSON.stringify(body) })) as unknown as SupplierContact,
  updateSupplierContact: async (supplierId: string, id: string, body: unknown) => normalizeEntity(await request<ApiEntity>(`/suppliers/${encodeURIComponent(supplierId)}/contacts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) })) as unknown as SupplierContact,
  archiveSupplierContact: async (supplierId: string, id: string) => normalizeEntity(await request<ApiEntity>(`/suppliers/${encodeURIComponent(supplierId)}/contacts/${encodeURIComponent(id)}/archive`, { method: "POST" })) as unknown as SupplierContact,
  supplierDocuments: async (supplierId: string) => normalizeList(await request<ApiEntity[]>(`/suppliers/${encodeURIComponent(supplierId)}/documents`)) as unknown as SupplierDocument[],
  createSupplierDocument: async (supplierId: string, body: unknown) => normalizeEntity(await request<ApiEntity>(`/suppliers/${encodeURIComponent(supplierId)}/documents`, { method: "POST", body: JSON.stringify(body) })) as unknown as SupplierDocument,
  updateSupplierDocument: async (supplierId: string, id: string, body: unknown) => normalizeEntity(await request<ApiEntity>(`/suppliers/${encodeURIComponent(supplierId)}/documents/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) })) as unknown as SupplierDocument,
  archiveSupplierDocument: async (supplierId: string, id: string) => normalizeEntity(await request<ApiEntity>(`/suppliers/${encodeURIComponent(supplierId)}/documents/${encodeURIComponent(id)}/archive`, { method: "POST" })) as unknown as SupplierDocument,
  supplierPayments: async (supplierId: string, from?: string, to?: string) => { const query = new URLSearchParams(); if (from) query.set("from", from); if (to) query.set("to", to); return normalizeList(await request<ApiEntity[]>(`/suppliers/${encodeURIComponent(supplierId)}/payments${query.size ? `?${query}` : ""}`)) as unknown as SupplierPayment[]; },
  createSupplierPayment: async (supplierId: string, body: unknown) => normalizeEntity(await request<ApiEntity>(`/suppliers/${encodeURIComponent(supplierId)}/payments`, { method: "POST", body: JSON.stringify(body) })) as unknown as SupplierPayment,
  archiveSupplierPayment: async (supplierId: string, id: string) => normalizeEntity(await request<ApiEntity>(`/suppliers/${encodeURIComponent(supplierId)}/payments/${encodeURIComponent(id)}/archive`, { method: "POST" })) as unknown as SupplierPayment,
  supplierStatement: async (supplierId: string, from?: string, to?: string) => { const query = new URLSearchParams(); if (from) query.set("from", from); if (to) query.set("to", to); return request<SupplierStatement>(`/suppliers/${encodeURIComponent(supplierId)}/statement${query.size ? `?${query}` : ""}`); },
  supplierPerformance: async (supplierId: string, from?: string, to?: string) => { const query = new URLSearchParams(); if (from) query.set("from", from); if (to) query.set("to", to); return request<SupplierPerformanceReport>(`/suppliers/${encodeURIComponent(supplierId)}/performance${query.size ? `?${query}` : ""}`); },
  employees: async (branchId?: string | null) => normalizeList(await request<ApiEntity[]>(`/employees${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`)),
  branches: async () => (await request<ApiEntity[]>("/branches")).map(normalizeBranch),
  createBranch: async (body: unknown) => normalizeBranch(await request<ApiEntity>("/branches", { method: "POST", body: JSON.stringify(body) })),
  updateBranch: async (id: string, body: unknown) => normalizeBranch(await request<ApiEntity>(`/branches/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) })),
  activateBranch: async (id: string) => normalizeBranch(await request<ApiEntity>(`/branches/${encodeURIComponent(id)}/activate`, { method: "POST" })),
  deactivateBranch: async (id: string) => normalizeBranch(await request<ApiEntity>(`/branches/${encodeURIComponent(id)}/deactivate`, { method: "POST" })),
  reports: (branchId?: string | null, from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.set("branchId", branchId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return request<ApiEntity>(`/reports/summary${query.size ? `?${query.toString()}` : ""}`).then(normalizeSummary) as Promise<DailySummary>;
  },
  topProducts: async (branchId?: string | null, from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.set("branchId", branchId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return request<Array<{ _id?: string; productName?: string; quantity?: number; total?: number }>>(`/reports/top-products${query.size ? `?${query.toString()}` : ""}`);
  },
  financeOverview: (branchId?: string | null, from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.set("branchId", branchId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return request<FinanceOverview>(`/finance/overview${query.size ? `?${query.toString()}` : ""}`);
  },
  financePayments: async (branchId?: string | null, from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.set("branchId", branchId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return normalizeList(await request<ApiEntity[]>(`/finance/payments${query.size ? `?${query.toString()}` : ""}`)) as unknown as FinancePayment[];
  },
  financeCreditNotes: async (branchId?: string | null, from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.set("branchId", branchId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return normalizeList(await request<ApiEntity[]>(`/finance/credit-notes${query.size ? `?${query.toString()}` : ""}`)) as unknown as CreditNote[];
  },
  createFinanceCreditNote: (body: unknown) => request<ApiEntity>("/finance/credit-notes", { method: "POST", body: JSON.stringify(body) }).then(normalizeEntity) as Promise<CreditNote>,
  archiveFinanceCreditNote: (id: string) => request<ApiEntity>(`/finance/credit-notes/${encodeURIComponent(id)}/archive`, { method: "POST" }).then(normalizeEntity) as Promise<CreditNote>,
  bankAccounts: async () => normalizeList(await request<ApiEntity[]>("/finance/bank-accounts")) as unknown as BankAccount[],
  createBankAccount: (body: unknown) => request<ApiEntity>("/finance/bank-accounts", { method: "POST", body: JSON.stringify(body) }).then(normalizeEntity) as Promise<BankAccount>,
  archiveBankAccount: (id: string) => request<ApiEntity>(`/finance/bank-accounts/${encodeURIComponent(id)}/archive`, { method: "POST" }).then(normalizeEntity) as Promise<BankAccount>,
  pettyCashEntries: async (branchId?: string | null, from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.set("branchId", branchId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return normalizeList(await request<ApiEntity[]>(`/finance/petty-cash${query.size ? `?${query.toString()}` : ""}`)) as unknown as PettyCashEntry[];
  },
  createPettyCashEntry: (body: unknown) => request<ApiEntity>("/finance/petty-cash", { method: "POST", body: JSON.stringify(body) }).then(normalizeEntity) as Promise<PettyCashEntry>,
  archivePettyCashEntry: (id: string) => request<ApiEntity>(`/finance/petty-cash/${encodeURIComponent(id)}/archive`, { method: "POST" }).then(normalizeEntity) as Promise<PettyCashEntry>,
  invoices: async (branchId?: string | null, page = 1, search = "") => {
    const query = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (branchId) query.set("branchId", branchId);
    if (search.trim()) query.set("search", search.trim());
    const response = await request<{ items: ApiEntity[]; total: number; totalPages: number }>(`/invoices?${query.toString()}`);
    return { ...response, items: response.items.map(normalizeInvoice) };
  },
  createInvoice: async (body: unknown) => normalizeInvoice(await request<ApiEntity>("/invoices", { method: "POST", body: JSON.stringify(body) })),
  recordInvoicePayment: async (id: string, body: unknown, branchId?: string | null) => {
    const response = await request<{ invoice: ApiEntity; payment: ApiEntity }>(`/invoices/${encodeURIComponent(id)}/payments${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`, { method: "POST", body: JSON.stringify(body) });
    return { invoice: normalizeInvoice(response.invoice), payment: normalizeEntity(response.payment) };
  },
  sendInvoice: (id: string) => request<ApiEntity>(`/invoices/${encodeURIComponent(id)}/send`, { method: "POST" }).then(normalizeInvoice),
  cancelInvoice: (id: string) => request<ApiEntity>(`/invoices/${encodeURIComponent(id)}/cancel`, { method: "POST" }).then(normalizeInvoice),
  archiveInvoice: (id: string) => request<ApiEntity>(`/invoices/${encodeURIComponent(id)}/archive`, { method: "POST" }).then(normalizeInvoice),
  paymentBreakdown: (branchId?: string | null, from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.set("branchId", branchId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return request<Array<{ _id?: string; total?: number; count?: number }>>(`/reports/payment-breakdown${query.size ? `?${query.toString()}` : ""}`);
  },
  enterpriseAnalytics: (branchId?: string | null, from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.set("branchId", branchId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return request<EnterpriseAnalytics>(`/analytics/enterprise${query.size ? `?${query.toString()}` : ""}`);
  },
  operations: (params: { branchId?: string | null; kind?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.branchId) query.set("branchId", params.branchId);
    if (params.kind) query.set("kind", params.kind);
    if (params.status) query.set("status", params.status);
    return request<ApiEntity[]>(`/business-operations${query.size ? `?${query.toString()}` : ""}`).then(normalizeList);
  },
  createOperation: async (body: unknown) => normalizeEntity(await request<ApiEntity>("/business-operations", { method: "POST", body: JSON.stringify(body) })),
  updateOperation: async (id: string, body: unknown) => normalizeEntity(await request<ApiEntity>(`/business-operations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) })),
  archiveOperation: async (id: string) => normalizeEntity(await request<ApiEntity>(`/business-operations/${encodeURIComponent(id)}/archive`, { method: "POST" })),
  notifications: () => request<unknown[]>("/notifications"),
  notificationsPage: async (params: { page?: number; pageSize?: number; search?: string } = {}) => {
    const query = new URLSearchParams({ page: String(params.page ?? 1), pageSize: String(params.pageSize ?? 12) });
    if (params.search?.trim()) query.set("search", params.search.trim());
    const result = await request<{ items: ApiEntity[]; page: number; pageSize: number; total: number; totalPages: number; unreadCount: number }>("/notifications/page?" + query.toString());
    return { ...result, items: normalizeList(result.items) as unknown as BusinessNotification[] };
  },
  createSale: async (body: unknown) => {
    if (saleRequestInFlight) throw new Error("A sale is already being submitted.");
    saleRequestInFlight = true;
    try { return await request<Sale>("/sales", { method: "POST", body: JSON.stringify(body) }); }
    finally { saleRequestInFlight = false; }
  },
  createPurchaseOrder: async (body: unknown) => normalizeEntity(await request<ApiEntity>("/purchase-orders", { method: "POST", body: JSON.stringify(body) })) as unknown as PurchaseOrder,
  updatePurchaseOrder: async (id: string, body: unknown) => normalizeEntity(await request<ApiEntity>(`/purchase-orders/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) })) as unknown as PurchaseOrder,
  receivePurchaseOrder: async (id: string, body: unknown, branchId?: string | null) => normalizeEntity(await request<ApiEntity>(`/purchase-orders/${encodeURIComponent(id)}/receive${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`, { method: "POST", body: JSON.stringify(body) })) as unknown as PurchaseOrder,
  archivePurchaseOrder: async (id: string, branchId?: string | null) => request<ApiEntity>(`/purchase-orders/${encodeURIComponent(id)}/archive${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`, { method: "POST" }).then(normalizeEntity) as unknown as PurchaseOrder,
  createStockTransfer: async (body: unknown) => normalizeEntity(await request<ApiEntity>("/stock-transfers", { method: "POST", body: JSON.stringify(body) })) as unknown as StockTransfer,
  createProduct: (body: unknown) => request<Product>("/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: async (id: string, branchId: string | null | undefined, body: unknown) => normalizeProduct(await request<ApiEntity>(`/products/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ ...(body as Record<string, unknown>), ...(branchId ? { branchId } : {}) }) })) as unknown as Product,
  archiveProduct: (id: string, branchId?: string | null) => request<ApiEntity>(`/products/${encodeURIComponent(id)}/archive${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`, { method: "POST" }),
  adjustProductStock: async (id: string, branchId: string | null | undefined, body: { quantityDelta: number; unitCost: number; note?: string }) => normalizeProduct(await request<ApiEntity>(`/products/${encodeURIComponent(id)}/adjust-stock${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`, { method: "POST", body: JSON.stringify(body) })) as unknown as Product,
  productHistory: (id: string, branchId?: string | null) => request<{ stockMovements: ApiEntity[]; salesHistory: ApiEntity[] }>(`/products/${encodeURIComponent(id)}/history${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`),
  createCustomer: (body: unknown) => request<Customer>("/customers", { method: "POST", body: JSON.stringify(body) }),
  updateCustomer: (id: string, body: unknown) => request<Customer>(`/customers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  customerPayments: (id: string, branchId?: string | null) => request<ApiEntity[]>(`/customers/${encodeURIComponent(id)}/payments${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`).then(normalizeList),
  recordCustomerPayment: (id: string, body: unknown) => request<ApiEntity>(`/customers/${encodeURIComponent(id)}/payments`, { method: "POST", body: JSON.stringify(body) }).then(normalizeEntity),
  createSupplier: (body: unknown) => request<ApiEntity>("/suppliers", { method: "POST", body: JSON.stringify(body) }).then(normalizeEntity),
  updateSupplier: (id: string, body: unknown) => request<ApiEntity>(`/suppliers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }).then(normalizeEntity),
  archiveSupplier: (id: string) => request<ApiEntity>(`/suppliers/${encodeURIComponent(id)}/archive`, { method: "POST" }).then(normalizeEntity),
  createExpense: (body: unknown) => request<ApiEntity>("/expenses", { method: "POST", body: JSON.stringify(body) }).then(normalizeEntity),
  createEmployee: (body: unknown) => request<ApiEntity>("/employees", { method: "POST", body: JSON.stringify(body) }).then(normalizeEntity),
  updateEmployee: (id: string, body: unknown) => request<ApiEntity>(`/employees/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }).then(normalizeEntity),
  suspendEmployee: (id: string, reason?: string) => request<ApiEntity>(`/employees/${encodeURIComponent(id)}/suspend`, { method: "POST", body: JSON.stringify({ reason: reason ?? "Suspended by workspace owner" }) }).then(normalizeEntity),
  restoreEmployee: (id: string) => request<ApiEntity>(`/employees/${encodeURIComponent(id)}/restore`, { method: "POST" }).then(normalizeEntity),
  markNotificationRead: (id: string) => request<void>(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => request<void>("/notifications/read-all", { method: "PATCH" })
};
