import type { Business, Branch, Customer, DailySummary, Product, Sale } from "@vbo/shared";

export type Session = {
  accessToken: string;
  user: { id: string; fullName: string; role: string; businessId: string; branchId?: string | null; permissions?: string[] | null };
  business: Business;
  branches?: Branch[];
};

const TOKEN_KEY = "bizpro.desktop.token";
const SESSION_KEY = "bizpro.desktop.session";
const QUEUE_KEY = "bizpro.desktop.offline.queue";

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

export function queuedCount() {
  if (typeof window === "undefined") return 0;
  try { return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]").length as number; } catch { return 0; }
}

export function queueOffline(path: string, body: unknown) {
  const current = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as unknown[];
  current.push({ id: crypto.randomUUID(), path, body, createdAt: new Date().toISOString() });
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(current));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) }
  });
  if (!response.ok) throw new Error(await response.text());
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export async function login(identifier: string, passwordOrPin: string) {
  return request<Session>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, passwordOrPin }) });
}

export const api = {
  me: () => request<Session>("/auth/me"),
  dashboard: (branchId?: string | null) => request<DailySummary>(`/reports/summary${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`),
  products: (branchId?: string | null) => request<Product[]>(`/products${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`),
  customers: (branchId?: string | null) => request<Customer[]>(`/customers${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`),
  sales: (branchId?: string | null) => request<Sale[]>(`/sales${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`),
  expenses: (branchId?: string | null) => request<unknown[]>(`/expenses${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`),
  suppliers: () => request<unknown[]>("/suppliers"),
  employees: (branchId?: string | null) => request<unknown[]>(`/employees${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`),
  reports: (branchId?: string | null) => request<DailySummary>(`/reports/summary${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`),
  createSale: (body: unknown) => request<Sale>("/sales", { method: "POST", body: JSON.stringify(body) })
};
