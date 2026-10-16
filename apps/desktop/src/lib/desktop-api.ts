import type { Business, Branch, Customer, DailySummary, EnterpriseAnalytics, Product, Sale } from "@vbo/shared";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
    if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
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

let saleRequestInFlight = false;

export const api = {
  me: () => request<Session>("/auth/me"),
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
  expenses: async (branchId?: string | null) => normalizeList(await request<ApiEntity[]>(`/expenses${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`)),
  suppliers: async () => normalizeList(await request<ApiEntity[]>("/suppliers")),
  employees: async (branchId?: string | null) => normalizeList(await request<ApiEntity[]>(`/employees${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`)),
  reports: (branchId?: string | null, from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.set("branchId", branchId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return request<ApiEntity>(`/reports/summary${query.size ? `?${query.toString()}` : ""}`).then(normalizeSummary) as Promise<DailySummary>;
  },
  financeOverview: (branchId?: string | null) => request<Record<string, unknown>>(`/finance/overview${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`),
  paymentBreakdown: (branchId?: string | null, from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.set("branchId", branchId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return request<Array<{ _id?: string; total?: number; count?: number }>>(`/reports/payment-breakdown${query.size ? `?${query.toString()}` : ""}`);
  },
  enterpriseAnalytics: (branchId?: string | null) => request<EnterpriseAnalytics>(`/analytics/enterprise${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`),
  operations: (branchId?: string | null) => request<unknown[]>(`/business-operations${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`),
  notifications: () => request<unknown[]>("/notifications"),
  createSale: async (body: unknown) => {
    if (saleRequestInFlight) throw new Error("A sale is already being submitted.");
    saleRequestInFlight = true;
    try { return await request<Sale>("/sales", { method: "POST", body: JSON.stringify(body) }); }
    finally { saleRequestInFlight = false; }
  },
  createProduct: (body: unknown) => request<Product>("/products", { method: "POST", body: JSON.stringify(body) }),
  createCustomer: (body: unknown) => request<Customer>("/customers", { method: "POST", body: JSON.stringify(body) }),
  updateCustomer: (id: string, body: unknown) => request<Customer>(`/customers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  createSupplier: (body: unknown) => request<ApiEntity>("/suppliers", { method: "POST", body: JSON.stringify(body) }).then(normalizeEntity),
  createExpense: (body: unknown) => request<ApiEntity>("/expenses", { method: "POST", body: JSON.stringify(body) }).then(normalizeEntity),
  markNotificationRead: (id: string) => request<void>(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => request<void>("/notifications/read-all", { method: "PATCH" })
};
