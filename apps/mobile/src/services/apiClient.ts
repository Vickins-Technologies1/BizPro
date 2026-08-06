import { env } from "@/config/env";
import { secureStore } from "@/storage/secure";
import type { AccessPermission, Business, Category, Customer, Expense, Payment, Product, Sale, StockMovement, DailySummary, UserRole } from "@shared";

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  auth?: boolean;
};

export type ApiSession = {
  user: { id: string; fullName: string; role: string; businessId: string; ownerId?: string | null; roleLabel?: string | null; permissions?: AccessPermission[] | null };
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

export type EmployeeRecord = {
  id: string;
  businessId: string;
  ownerId?: string | null;
  branchId?: string | null;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  roleLabel?: string | null;
  permissions?: AccessPermission[] | null;
  isActive: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type EmployeeCatalog = {
  permissions: AccessPermission[];
  roles: Array<{ role: UserRole; label: string; permissions: AccessPermission[] }>;
};

export type AuditLogRecord = {
  id: string;
  businessId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

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

export async function deleteProduct(id: string) {
  return archiveProduct(id);
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

export async function getTopProducts(from?: string, to?: string) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<Array<{ productId: string; productName: string; quantity: number; total: number }>>(`/reports/top-products${suffix}`);
}

export async function getPaymentBreakdown(from?: string, to?: string) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<Array<{ _id: string; total: number; count: number }>>(`/reports/payment-breakdown${suffix}`);
}

export async function listEmployees() {
  const employees = await apiRequest<RawEntity[]>("/employees");
  return employees.map((employee) => withId(employee)) as EmployeeRecord[];
}

export async function getEmployeeCatalog() {
  return apiRequest<EmployeeCatalog>("/employees/catalog");
}

export async function listEmployeeAuditLogs() {
  const logs = await apiRequest<RawEntity[]>("/employees/audit");
  return logs.map((log) => withId(log)) as AuditLogRecord[];
}

export async function createEmployee(input: {
  branchId?: string | null;
  fullName: string;
  phone?: string | null;
  password: string;
  pin?: string | null;
  role: UserRole;
  roleLabel?: string | null;
  permissions?: AccessPermission[] | null;
  isActive?: boolean;
}) {
  const employee = await apiRequest<RawEntity>("/employees", { method: "POST", body: input });
  return withId(employee) as EmployeeRecord;
}

export async function updateEmployee(id: string, input: {
  branchId?: string | null;
  fullName?: string;
  phone?: string | null;
  role?: UserRole;
  roleLabel?: string | null;
  permissions?: AccessPermission[] | null;
  isActive?: boolean;
}) {
  const employee = await apiRequest<RawEntity>(`/employees/${encodeURIComponent(id)}`, { method: "PATCH", body: input });
  return withId(employee) as EmployeeRecord;
}

export async function suspendEmployee(id: string, reason?: string | null) {
  const employee = await apiRequest<RawEntity>(`/employees/${encodeURIComponent(id)}/suspend`, {
    method: "POST",
    body: { reason: reason ?? "" }
  });
  return withId(employee) as EmployeeRecord;
}

export async function restoreEmployee(id: string) {
  const employee = await apiRequest<RawEntity>(`/employees/${encodeURIComponent(id)}/restore`, {
    method: "POST"
  });
  return withId(employee) as EmployeeRecord;
}

export async function resetEmployeeCredentials(
  id: string,
  input: { password?: string | null; pin?: string | null }
) {
  const result = await apiRequest<{ employee: RawEntity; temporaryPassword: string | null }>(`/employees/${encodeURIComponent(id)}/reset-credentials`, {
    method: "POST",
    body: input
  });
  return {
    employee: withId(result.employee) as EmployeeRecord,
    temporaryPassword: result.temporaryPassword
  };
}

export async function deleteEmployee(id: string) {
  const employee = await apiRequest<RawEntity>(`/employees/${encodeURIComponent(id)}`, { method: "DELETE" });
  return withId(employee) as EmployeeRecord;
}
