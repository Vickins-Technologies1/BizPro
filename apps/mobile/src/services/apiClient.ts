import { env } from "@/config/env";
import { secureStore } from "@/storage/secure";
import type { Business, Category, Customer, Expense, Payment, Product, Sale, StockMovement, DailySummary } from "@shared";

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  auth?: boolean;
};

export type ApiSession = {
  user: { id: string; fullName: string; role: string; businessId: string };
  business: Business;
  accessToken?: string | null;
};

type AuthResponse = {
  accessToken: string;
  user: ApiSession["user"];
  business: Business;
  setup?: {
    businessId: string;
    branchId: string;
    ownerUserId: string;
    deviceId: string;
    subscriptionPlanCode: string;
  };
};

type RawEntity = Record<string, any> & { _id?: string; id?: string };

function withId<T extends RawEntity>(entity: T): T & { id: string } {
  const id = entity.id ?? String(entity._id ?? "");
  const { _id, ...rest } = entity;
  return { ...rest, id } as T & { id: string };
}

function withSaleItems<T extends RawEntity>(sale: T): T & { id: string } {
  const normalized = withId(sale);
  const items = Array.isArray(normalized.items)
    ? normalized.items.map((item: RawEntity) => withId({ ...item, saleId: item.saleId ?? normalized.id }))
    : normalized.items;
  return { ...normalized, items } as T & { id: string };
}

async function getSessionToken() {
  const raw = await secureStore.getSession();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { accessToken?: string | null };
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}

async function readErrorMessage(response: Response) {
  const fallback = `Request failed with status ${response.status}`;
  const raw = await response.text();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[]; error?: string };
    if (Array.isArray(parsed.message)) return parsed.message.join(", ");
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    // fall through
  }
  return raw;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.auth === false ? options.token ?? null : options.token ?? (await getSessionToken());
  const response = await fetch(`${env.apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export async function authMe() {
  return apiRequest<ApiSession>("/auth/me");
}

export async function registerBusiness(input: {
  businessId?: string;
  branchId?: string;
  ownerUserId?: string;
  ownerName: string;
  phone: string;
  password: string;
  businessName: string;
  businessType: string;
  planTier: string;
  currency: string;
  branchName: string;
  cashierPin?: string | null;
}) {
  return apiRequest<AuthResponse>("/auth/register", { method: "POST", body: input, auth: false });
}

export async function loginBusiness(input: { identifier: string; passwordOrPin: string; businessId?: string }) {
  return apiRequest<AuthResponse>("/auth/login", { method: "POST", body: input, auth: false });
}

export async function listCategories() {
  const categories = await apiRequest<RawEntity[]>("/categories");
  return categories.map((category) => withId(category)) as Category[];
}

export async function createCategory(input: { businessId: string; name: string; color?: string | null; sortOrder?: number }) {
  const category = await apiRequest<RawEntity>("/categories", { method: "POST", body: input });
  return withId(category) as Category;
}

export async function listProducts() {
  const products = await apiRequest<RawEntity[]>("/products");
  return products.map((product) => withId(product)) as Product[];
}

export async function createProduct(input: {
  businessId: string;
  categoryId?: string | null;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit: string;
  buyingPrice: number;
  sellingPrice: number;
  stockOnHand?: number;
  lowStockThreshold?: number;
  isActive?: boolean;
}) {
  const product = await apiRequest<RawEntity>("/products", { method: "POST", body: input });
  return withId(product) as Product;
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  const product = await apiRequest<RawEntity>(`/products/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return withId(product) as Product;
}

export async function archiveProduct(id: string) {
  const product = await apiRequest<RawEntity>(`/products/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return withId(product) as Product;
}

export async function adjustProductStock(input: { productId: string; quantityDelta: number; unitCost: number; note?: string | null; referenceType?: string }) {
  const product = await apiRequest<RawEntity>(`/products/${encodeURIComponent(input.productId)}/adjust-stock`, {
    method: "POST",
    body: {
      quantityDelta: input.quantityDelta,
      unitCost: input.unitCost,
      note: input.note ?? null,
      referenceType: input.referenceType ?? "adjustment"
    }
  });
  return withId(product) as Product;
}

export async function getProductHistory(productId: string) {
  const history = await apiRequest<{ stockMovements: RawEntity[]; salesHistory: Array<RawEntity & { receiptNumber: string; quantity: number; unitPrice: number; lineTotal: number; createdAt: string; paymentStatus: string }> }>(
    `/products/${encodeURIComponent(productId)}/history`
  );
  return {
    stockMovements: history.stockMovements.map((movement) => withId(movement)) as StockMovement[],
    salesHistory: history.salesHistory.map((sale) => withId(sale))
  };
}

export async function listCustomers() {
  const customers = await apiRequest<RawEntity[]>("/customers");
  return customers.map((customer) => withId(customer)) as Customer[];
}

export async function createCustomer(input: { businessId: string; name: string; phone?: string | null; email?: string | null; notes?: string | null; balance?: number }) {
  const customer = await apiRequest<RawEntity>("/customers", { method: "POST", body: input });
  return withId(customer) as Customer;
}

export async function listCustomerPayments(customerId: string) {
  const payments = await apiRequest<RawEntity[]>(`/customers/${encodeURIComponent(customerId)}/payments`);
  return payments.map((payment) => withId(payment)) as Payment[];
}

export async function recordCustomerPayment(customerId: string, input: { amount: number; method: Payment["method"]; reference?: string | null; note?: string | null }) {
  const payment = await apiRequest<RawEntity>(`/customers/${encodeURIComponent(customerId)}/payments`, { method: "POST", body: input });
  return withId(payment) as Payment;
}

export async function listExpenses() {
  const expenses = await apiRequest<RawEntity[]>("/expenses");
  return expenses.map((expense) => withId(expense)) as Expense[];
}

export async function createExpense(input: { businessId: string; categoryId?: string | null; amount: number; note: string; expenseDate: string; recordedById?: string | null }) {
  const expense = await apiRequest<RawEntity>("/expenses", { method: "POST", body: input });
  return withId(expense) as Expense;
}

export async function listSales() {
  const sales = await apiRequest<RawEntity[]>("/sales");
  return sales.map((sale) => withSaleItems(sale)) as Sale[];
}

export async function createSale(input: {
  businessId: string;
  branchId?: string | null;
  customerId?: string | null;
  paymentMethod: Sale["paymentMethod"];
  paymentStatus: Sale["paymentStatus"];
  amountPaid: number;
  discountTotal?: number;
  taxTotal?: number;
  notes?: string | null;
  receiptNumber: string;
  subtotal: number;
  balanceDue: number;
  items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; costPrice: number; lineDiscount: number; lineTotal: number }>;
}) {
  const sale = await apiRequest<RawEntity>("/sales", { method: "POST", body: input });
  return withSaleItems(sale) as Sale;
}

export async function getReportsSummary(from?: string, to?: string) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<DailySummary>(`/reports/summary${suffix}`);
}

export async function getTopProducts() {
  return apiRequest<Array<{ productId: string; productName: string; quantity: number; total: number }>>("/reports/top-products");
}

export async function getPaymentBreakdown() {
  return apiRequest<Array<{ _id: string; total: number; count: number }>>("/reports/payment-breakdown");
}
