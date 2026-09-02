import { env } from "@/config/env";
import { secureStore } from "@/storage/secure";
import { createBusinessOperationDraft, enqueueAction, isOfflineError } from "@/services/offlineQueue";
import type {
  AccessPermission,
  BankAccount,
  Brand,
  Branch,
  Business,
  Category,
  CreditNote,
  Customer,
  CustomerAnalytics,
  CustomerAttachment,
  CustomerGroup,
  DebitNote,
  Invoice,
  FinanceInvoice,
  FinanceOverview,
  FinancePayment,
  Expense,
  Payment,
  PettyCashEntry,
  Product,
  PurchaseOrder,
  Sale,
  StockMovement,
  StockTransfer,
  DailySummary,
  EnterpriseAnalytics,
  Supplier,
  SupplierCategory,
  SupplierContact,
  SupplierDocument,
  SupplierPayment,
  SupplierPerformanceReport,
  SupplierStatement,
  UserRole
  ,BusinessOperation,
  BusinessOperationKind,
  BusinessOperationStatus
} from "@shared";

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  auth?: boolean;
};

type AuthFailureHandler = (() => Promise<void> | void) | null;

let authFailureHandler: AuthFailureHandler = null;

export function setAuthFailureHandler(handler: AuthFailureHandler) {
  authFailureHandler = handler;
}

export type ApiSession = {
  user: { id: string; fullName: string; role: string; businessId: string; branchId?: string | null; ownerId?: string | null; roleLabel?: string | null; permissions?: AccessPermission[] | null };
  business: Business;
  branches?: Branch[];
  accessToken?: string | null;
};

export type NotificationRecord = {
  id: string;
  businessId: string;
  audienceUserId?: string | null;
  title: string;
  body: string;
  category: string;
  priority: "low" | "normal" | "high" | "critical";
  routeName?: string | null;
  routeParams?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  sentAt: string;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPage = {
  items: NotificationRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unreadCount: number;
};

type AuthResponse = {
  accessToken: string;
  user: ApiSession["user"];
  business: Business;
  branches?: Branch[];
  setup?: {
    businessId: string;
    branchId: string;
    ownerUserId: string;
    deviceId: string;
    subscriptionPlanCode: string;
  };
};

type RawEntity = Record<string, any> & { _id?: string; id?: string };

function withBranchQuery(path: string, branchId?: string | null) {
  if (!branchId) return path;
  const query = new URLSearchParams();
  query.set("branchId", branchId);
  return `${path}?${query.toString()}`;
}

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
  roles: Array<{ role: UserRole; label: string; description?: string; permissions: AccessPermission[] }>;
};

function normalizeIsoDate(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

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
  const id = entity.externalId ?? entity.id ?? String(entity._id ?? "");
  const { _id, ...rest } = entity;
  return { ...rest, id } as T & { id: string };
}

function normalizeProduct(product: RawEntity): Product {
  const normalized = withId(product);
  return {
    ...normalized,
    serverId: product._id ? String(product._id) : normalized.serverId ?? null,
    branchId: normalized.branchId ?? null,
    categoryId: normalized.categoryId ?? null,
    brandId: normalized.brandId ?? null,
    supplierId: normalized.supplierId ?? null,
    sku: normalized.sku ?? null,
    barcode: normalized.barcode ?? null,
    batchNumber: normalized.batchNumber ?? null,
    expiryDate: normalized.expiryDate ?? null,
    serialNumber: normalized.serialNumber ?? null,
    unit: normalized.unit ?? "pcs",
    buyingPrice: Number(normalized.buyingPrice ?? 0),
    sellingPrice: Number(normalized.sellingPrice ?? 0),
    stockOnHand: Number(normalized.stockOnHand ?? 0),
    lowStockThreshold: Number(normalized.lowStockThreshold ?? 5),
    isActive: normalized.isActive ?? true
  } as Product;
}

function withSaleItems<T extends RawEntity>(sale: T): T & { id: string } {
  const normalized = withId(sale);
  const items = Array.isArray(normalized.items)
    ? normalized.items.map((item: RawEntity) => withId({ ...item, saleId: item.saleId ?? normalized.id }))
    : [];
  return {
    ...normalized,
    createdAt: normalizeIsoDate(normalized.createdAt),
    updatedAt: normalizeIsoDate(normalized.updatedAt),
    items
  } as T & { id: string };
}

function normalizeCustomer(customer: RawEntity): Customer {
  const normalized = withId(customer);
  return {
    ...normalized,
    groupId: normalized.groupId ?? null,
    businessName: normalized.businessName ?? null,
    phone: normalized.phone ?? null,
    email: normalized.email ?? null,
    address: normalized.address ?? null,
    taxPin: normalized.taxPin ?? null,
    creditLimit: Number(normalized.creditLimit ?? 0),
    loyaltyPoints: Number(normalized.loyaltyPoints ?? 0),
    notes: normalized.notes ?? null,
    balance: Number(normalized.balance ?? 0),
    attachments: Array.isArray(normalized.attachments)
      ? normalized.attachments.map((attachment: RawEntity, index: number) => ({
          id: String(attachment.id ?? attachment.externalId ?? index),
          label: String(attachment.label ?? "Attachment"),
          url: String(attachment.url ?? ""),
          note: attachment.note ?? null,
          addedAt: String(attachment.addedAt ?? new Date().toISOString())
        }))
      : []
  } as Customer;
}

function normalizeCustomerGroup(group: RawEntity): CustomerGroup {
  const normalized = withId(group);
  return {
    ...normalized,
    description: normalized.description ?? null,
    color: normalized.color ?? null,
    isActive: normalized.isActive ?? true
  } as CustomerGroup;
}

function normalizeCustomerAnalytics(analytics: RawEntity): CustomerAnalytics {
  return {
    totalCustomers: Number(analytics.totalCustomers ?? 0),
    totalOutstanding: Number(analytics.totalOutstanding ?? 0),
    totalCreditLimit: Number(analytics.totalCreditLimit ?? 0),
    totalLoyaltyPoints: Number(analytics.totalLoyaltyPoints ?? 0),
    owingCustomers: Number(analytics.owingCustomers ?? 0),
    grouped: Array.isArray(analytics.grouped)
      ? analytics.grouped.map((group: RawEntity) => ({
          groupId: group.groupId ?? null,
          groupName: String(group.groupName ?? "Ungrouped"),
          customerCount: Number(group.customerCount ?? 0),
          outstanding: Number(group.outstanding ?? 0),
          loyaltyPoints: Number(group.loyaltyPoints ?? 0)
        }))
      : [],
    topBalances: Array.isArray(analytics.topBalances)
      ? analytics.topBalances.map((customer: RawEntity) => ({
          customerId: String(customer.customerId ?? customer.id ?? ""),
          name: String(customer.name ?? ""),
          balance: Number(customer.balance ?? 0),
          creditLimit: Number(customer.creditLimit ?? 0),
          loyaltyPoints: Number(customer.loyaltyPoints ?? 0)
        }))
      : []
  };
}

function normalizeInvoiceLineItem(line: RawEntity) {
  return {
    id: String(line.id ?? line.externalId ?? ""),
    productId: line.productId ?? null,
    productName: line.productName ?? null,
    description: String(line.description ?? line.productName ?? "Item"),
    quantity: Number(line.quantity ?? 0),
    unit: String(line.unit ?? "pcs"),
    unitPrice: Number(line.unitPrice ?? 0),
    discountType: line.discountType ?? "fixed",
    discountValue: Number(line.discountValue ?? 0),
    lineDiscount: Number(line.lineDiscount ?? 0),
    lineSubtotal: Number(line.lineSubtotal ?? 0),
    lineTax: Number(line.lineTax ?? 0),
    lineTotal: Number(line.lineTotal ?? 0),
    tax: {
      taxCategory: line.tax?.taxCategory ?? "vat",
      taxCode: line.tax?.taxCode ?? null,
      taxRate: Number(line.tax?.taxRate ?? 0),
      taxInclusive: Boolean(line.tax?.taxInclusive),
      taxAmount: Number(line.tax?.taxAmount ?? 0),
      taxableAmount: Number(line.tax?.taxableAmount ?? 0)
    }
  };
}

function normalizeDebitNote(note: RawEntity): DebitNote {
  const normalized = withId(note);
  return {
    ...normalized,
    customerId: normalized.customerId ?? null,
    invoiceId: String(normalized.invoiceId ?? ""),
    reference: String(normalized.reference ?? ""),
    reason: String(normalized.reason ?? ""),
    amount: Number(normalized.amount ?? 0),
    taxAdjustment: Number(normalized.taxAdjustment ?? 0),
    note: normalized.note ?? null,
    status: normalized.status ?? "draft",
    issuedAt: normalizeIsoDate(normalized.issuedAt)
  } as DebitNote;
}

function normalizeInvoice(invoice: RawEntity): Invoice {
  const normalized = withId(invoice);
  return {
    ...normalized,
    branchId: normalized.branchId ?? null,
    customerId: normalized.customerId ?? null,
    customerName: normalized.customerName ?? null,
    customerBusinessName: normalized.customerBusinessName ?? null,
    customerEmail: normalized.customerEmail ?? null,
    customerPhone: normalized.customerPhone ?? null,
    customerAddress: normalized.customerAddress ?? null,
    customerTaxPin: normalized.customerTaxPin ?? null,
    referenceNumber: normalized.referenceNumber ?? null,
    purchaseOrderNumber: normalized.purchaseOrderNumber ?? null,
    issueDate: normalizeIsoDate(normalized.issueDate),
    dueDate: normalizeIsoDate(normalized.dueDate),
    paymentTerms: normalized.paymentTerms ?? "30 days",
    currency: normalized.currency ?? "KES",
    status: normalized.status ?? "draft",
    subtotal: Number(normalized.subtotal ?? 0),
    discountTotal: Number(normalized.discountTotal ?? 0),
    taxableAmount: Number(normalized.taxableAmount ?? 0),
    taxTotal: Number(normalized.taxTotal ?? 0),
    grandTotal: Number(normalized.grandTotal ?? 0),
    amountPaid: Number(normalized.amountPaid ?? 0),
    balanceDue: Number(normalized.balanceDue ?? 0),
    notes: normalized.notes ?? null,
    termsAndConditions: normalized.termsAndConditions ?? null,
    archivedAt: normalized.archivedAt ? normalizeIsoDate(normalized.archivedAt) : null,
    sentAt: normalized.sentAt ? normalizeIsoDate(normalized.sentAt) : null,
    viewedAt: normalized.viewedAt ? normalizeIsoDate(normalized.viewedAt) : null,
    paidAt: normalized.paidAt ? normalizeIsoDate(normalized.paidAt) : null,
    cancelledAt: normalized.cancelledAt ? normalizeIsoDate(normalized.cancelledAt) : null,
    voidedAt: normalized.voidedAt ? normalizeIsoDate(normalized.voidedAt) : null,
    refundedAt: normalized.refundedAt ? normalizeIsoDate(normalized.refundedAt) : null,
    shareToken: normalized.shareToken ?? null,
    fiscalizationStatus: normalized.fiscalizationStatus ?? null,
    fiscalizationProvider: normalized.fiscalizationProvider ?? null,
    fiscalizationReference: normalized.fiscalizationReference ?? null,
    fiscalizationRequestId: normalized.fiscalizationRequestId ?? null,
    fiscalizationDocumentNumber: normalized.fiscalizationDocumentNumber ?? null,
    fiscalizationDate: normalized.fiscalizationDate ? normalizeIsoDate(normalized.fiscalizationDate) : null,
    fiscalizationResponse: normalized.fiscalizationResponse ?? null,
    fiscalizationError: normalized.fiscalizationError ?? null,
    fiscalizationPayloadReference: normalized.fiscalizationPayloadReference ?? null,
    lineItems: Array.isArray(normalized.lineItems) ? normalized.lineItems.map((line: RawEntity) => normalizeInvoiceLineItem(line)) : [],
    payments: Array.isArray(normalized.payments)
      ? normalized.payments.map((payment: RawEntity) => ({
          id: String(payment.id ?? payment.paymentId ?? payment.externalId ?? ""),
          paymentId: payment.paymentId ?? null,
          amount: Number(payment.amount ?? 0),
          method: payment.method ?? "cash",
          paymentDate: normalizeIsoDate(payment.paymentDate ?? null),
          reference: payment.reference ?? null,
          note: payment.note ?? null
        }))
      : [],
    history: Array.isArray(normalized.history)
      ? normalized.history.map((entry: RawEntity) => ({
          id: String(entry.id ?? ""),
          action: String(entry.action ?? "event"),
          note: entry.note ?? null,
          actorId: entry.actorId ?? null,
          createdAt: String(entry.createdAt ?? new Date().toISOString()),
          payload: entry.payload ?? null
        }))
      : [],
    creditNotes: Array.isArray(normalized.creditNotes) ? (normalized.creditNotes.map((note: RawEntity) => withId(note)) as CreditNote[]) : [],
    debitNotes: Array.isArray(normalized.debitNotes) ? normalized.debitNotes.map((note: RawEntity) => normalizeDebitNote(note)) : []
  } as Invoice;
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
    if (options.auth !== false && response.status === 401) {
      await secureStore.clearSession();
      await authFailureHandler?.();
    }
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
  industryKey?: string;
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

export async function createCategory(input: { businessId: string; externalId?: string | null; name: string; color?: string | null; sortOrder?: number }) {
  const category = await apiRequest<RawEntity>("/categories", { method: "POST", body: input });
  return withId(category) as Category;
}

export async function listBrands() {
  const brands = await apiRequest<RawEntity[]>("/brands");
  return brands.map((brand) => withId(brand)) as Brand[];
}

export async function createBrand(input: { businessId: string; externalId?: string | null; name: string; description?: string | null }) {
  const brand = await apiRequest<RawEntity>("/brands", { method: "POST", body: input });
  return withId(brand) as Brand;
}

export async function updateBrand(id: string, patch: Partial<Brand>) {
  const brand = await apiRequest<RawEntity>(`/brands/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return withId(brand) as Brand;
}

export async function archiveBrand(id: string) {
  const brand = await apiRequest<RawEntity>(`/brands/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return withId(brand) as Brand;
}

export async function listProducts(branchId?: string | null) {
  const products = await apiRequest<RawEntity[]>(withBranchQuery("/products", branchId));
  return products.map((product) => normalizeProduct(product));
}

export type ProductPage = {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function listProductsPage(input: {
  branchId?: string | null;
  page: number;
  pageSize?: number;
  search?: string;
  categoryId?: string | null;
  brandId?: string | null;
  supplierId?: string | null;
}) {
  const query = new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize ?? 6) });
  if (input.branchId) query.set("branchId", input.branchId);
  if (input.search?.trim()) query.set("search", input.search.trim());
  if (input.categoryId) query.set("categoryId", input.categoryId);
  if (input.brandId) query.set("brandId", input.brandId);
  if (input.supplierId) query.set("supplierId", input.supplierId);
  const response = await apiRequest<{ items: RawEntity[]; page: number; pageSize: number; total: number; totalPages: number }>(`/products/page?${query.toString()}`);
  return { ...response, items: response.items.map((product) => normalizeProduct(product)) } satisfies ProductPage;
}

export async function createProduct(input: {
  businessId: string;
  branchId?: string | null;
  externalId?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  supplierId?: string | null;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  serialNumber?: string | null;
  unit: string;
  buyingPrice: number;
  sellingPrice: number;
  stockOnHand?: number;
  lowStockThreshold?: number;
  isActive?: boolean;
}) {
  const product = await apiRequest<RawEntity>("/products", { method: "POST", body: input });
  return normalizeProduct(product);
}

export async function updateProduct(id: string, patch: Partial<Product> & { branchId?: string | null }) {
  const product = await apiRequest<RawEntity>(`/products/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return normalizeProduct(product);
}

export async function archiveProduct(id: string, branchId?: string | null) {
  const product = await apiRequest<RawEntity>(withBranchQuery(`/products/${encodeURIComponent(id)}/archive`, branchId), { method: "POST" });
  return normalizeProduct(product);
}

export async function deleteProduct(id: string, branchId?: string | null) {
  return archiveProduct(id, branchId);
}

export async function adjustProductStock(input: { productId: string; quantityDelta: number; unitCost: number; note?: string | null; referenceType?: string; referenceId?: string; branchId?: string | null }) {
  const product = await apiRequest<RawEntity>(withBranchQuery(`/products/${encodeURIComponent(input.productId)}/adjust-stock`, input.branchId), {
    method: "POST",
    body: {
      quantityDelta: input.quantityDelta,
      unitCost: input.unitCost,
      note: input.note ?? null,
      referenceType: input.referenceType ?? "adjustment",
      referenceId: input.referenceId ?? undefined
    }
  });
  return normalizeProduct(product);
}

export async function getProductHistory(productId: string, branchId?: string | null) {
  const history = await apiRequest<{ stockMovements: RawEntity[]; salesHistory: Array<RawEntity & { receiptNumber: string; quantity: number; unitPrice: number; lineTotal: number; createdAt: string; paymentStatus: string }> }>(
    withBranchQuery(`/products/${encodeURIComponent(productId)}/history`, branchId)
  );
  return {
    stockMovements: history.stockMovements.map((movement) => withId(movement)) as StockMovement[],
    salesHistory: history.salesHistory.map((sale) => withId(sale))
  };
}

export async function listCustomers(branchId?: string | null) {
  const customers = await apiRequest<RawEntity[]>(withBranchQuery("/customers", branchId));
  return customers.map((customer) => normalizeCustomer(customer));
}

export async function listCustomerGroups(branchId?: string | null) {
  const groups = await apiRequest<RawEntity[]>(withBranchQuery("/customers/groups", branchId));
  return groups.map((group) => normalizeCustomerGroup(group));
}

export async function createCustomerGroup(input: { businessId: string; externalId?: string | null; name: string; description?: string | null; color?: string | null; isActive?: boolean }) {
  const group = await apiRequest<RawEntity>("/customers/groups", { method: "POST", body: input });
  return normalizeCustomerGroup(group);
}

export async function updateCustomerGroup(id: string, patch: Partial<CustomerGroup>) {
  const group = await apiRequest<RawEntity>(`/customers/groups/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return normalizeCustomerGroup(group);
}

export async function archiveCustomerGroup(id: string) {
  const group = await apiRequest<RawEntity>(`/customers/groups/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return normalizeCustomerGroup(group);
}

export async function listSuppliers() {
  const suppliers = await apiRequest<RawEntity[]>("/suppliers");
  return suppliers.map((supplier) => withId(supplier)) as Supplier[];
}

export async function createSupplier(input: { businessId: string; externalId?: string | null; categoryId?: string | null; code?: string | null; name: string; phone?: string | null; email?: string | null; contactName?: string | null; notes?: string | null; isActive?: boolean }) {
  const supplier = await apiRequest<RawEntity>("/suppliers", { method: "POST", body: input });
  return withId(supplier) as Supplier;
}

export async function updateSupplier(id: string, patch: Partial<Supplier>) {
  const supplier = await apiRequest<RawEntity>(`/suppliers/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return withId(supplier) as Supplier;
}

export async function archiveSupplier(id: string) {
  const supplier = await apiRequest<RawEntity>(`/suppliers/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return withId(supplier) as Supplier;
}

export async function listSupplierCategories() {
  const categories = await apiRequest<RawEntity[]>("/suppliers/categories");
  return categories.map((category) => withId(category)) as SupplierCategory[];
}

export async function createSupplierCategory(input: {
  businessId: string;
  externalId?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const category = await apiRequest<RawEntity>("/suppliers/categories", { method: "POST", body: input });
  return withId(category) as SupplierCategory;
}

export async function updateSupplierCategory(id: string, patch: Partial<SupplierCategory>) {
  const category = await apiRequest<RawEntity>(`/suppliers/categories/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return withId(category) as SupplierCategory;
}

export async function archiveSupplierCategory(id: string) {
  const category = await apiRequest<RawEntity>(`/suppliers/categories/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return withId(category) as SupplierCategory;
}

export async function listSupplierContacts(supplierId: string) {
  const contacts = await apiRequest<RawEntity[]>(`/suppliers/${encodeURIComponent(supplierId)}/contacts`);
  return contacts.map((contact) => withId(contact)) as SupplierContact[];
}

export async function createSupplierContact(
  supplierId: string,
  input: { name: string; role?: string | null; phone?: string | null; email?: string | null; isPrimary?: boolean; notes?: string | null }
) {
  const contact = await apiRequest<RawEntity>(`/suppliers/${encodeURIComponent(supplierId)}/contacts`, { method: "POST", body: input });
  return withId(contact) as SupplierContact;
}

export async function updateSupplierContact(supplierId: string, id: string, patch: Partial<SupplierContact>) {
  const contact = await apiRequest<RawEntity>(`/suppliers/${encodeURIComponent(supplierId)}/contacts/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return withId(contact) as SupplierContact;
}

export async function archiveSupplierContact(supplierId: string, id: string) {
  const contact = await apiRequest<RawEntity>(`/suppliers/${encodeURIComponent(supplierId)}/contacts/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return withId(contact) as SupplierContact;
}

export async function listSupplierDocuments(supplierId: string) {
  const documents = await apiRequest<RawEntity[]>(`/suppliers/${encodeURIComponent(supplierId)}/documents`);
  return documents.map((document) => withId(document)) as SupplierDocument[];
}

export async function createSupplierDocument(
  supplierId: string,
  input: { title: string; url: string; fileName?: string | null; documentType?: string | null; note?: string | null; uploadedById?: string | null }
) {
  const document = await apiRequest<RawEntity>(`/suppliers/${encodeURIComponent(supplierId)}/documents`, { method: "POST", body: input });
  return withId(document) as SupplierDocument;
}

export async function updateSupplierDocument(supplierId: string, id: string, patch: Partial<SupplierDocument>) {
  const document = await apiRequest<RawEntity>(`/suppliers/${encodeURIComponent(supplierId)}/documents/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return withId(document) as SupplierDocument;
}

export async function archiveSupplierDocument(supplierId: string, id: string) {
  const document = await apiRequest<RawEntity>(`/suppliers/${encodeURIComponent(supplierId)}/documents/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return withId(document) as SupplierDocument;
}

export async function listSupplierPayments(supplierId: string, from?: string, to?: string) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const payments = await apiRequest<RawEntity[]>(`/suppliers/${encodeURIComponent(supplierId)}/payments${suffix}`);
  return payments.map((payment) => withId(payment)) as SupplierPayment[];
}

export async function createSupplierPayment(
  supplierId: string,
  input: {
    externalId?: string | null;
    purchaseOrderId?: string | null;
    amount: number;
    method: SupplierPayment["method"];
    reference?: string | null;
    note?: string | null;
    paymentDate: string;
    recordedById?: string | null;
  }
) {
  const payment = await apiRequest<RawEntity>(`/suppliers/${encodeURIComponent(supplierId)}/payments`, { method: "POST", body: input });
  return withId(payment) as SupplierPayment;
}

export async function archiveSupplierPayment(supplierId: string, id: string) {
  const payment = await apiRequest<RawEntity>(`/suppliers/${encodeURIComponent(supplierId)}/payments/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return withId(payment) as SupplierPayment;
}

export async function getSupplierStatement(supplierId: string, from?: string, to?: string) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<SupplierStatement>(`/suppliers/${encodeURIComponent(supplierId)}/statement${suffix}`);
}

export async function getSupplierPerformance(supplierId: string, from?: string, to?: string) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<SupplierPerformanceReport>(`/suppliers/${encodeURIComponent(supplierId)}/performance${suffix}`);
}

export async function createCustomer(input: {
  businessId: string;
  branchId?: string | null;
  externalId?: string | null;
  groupId?: string | null;
  name: string;
  businessName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxPin?: string | null;
  creditLimit?: number;
  loyaltyPoints?: number;
  notes?: string | null;
  balance?: number;
  attachments?: CustomerAttachment[];
}) {
  const customer = await apiRequest<RawEntity>("/customers", { method: "POST", body: input });
  return normalizeCustomer(customer);
}

export async function updateCustomer(id: string, patch: Partial<Customer> & { branchId?: string | null }) {
  const customer = await apiRequest<RawEntity>(`/customers/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return normalizeCustomer(customer);
}

export async function listCustomerPayments(customerId: string, branchId?: string | null) {
  const payments = await apiRequest<RawEntity[]>(withBranchQuery(`/customers/${encodeURIComponent(customerId)}/payments`, branchId));
  return payments.map((payment) => withId(payment)) as Payment[];
}

export async function recordCustomerPayment(customerId: string, input: { businessId?: string; branchId?: string | null; externalId?: string | null; amount: number; method: Payment["method"]; reference?: string | null; note?: string | null }) {
  const payment = await apiRequest<RawEntity>(`/customers/${encodeURIComponent(customerId)}/payments`, { method: "POST", body: input });
  return withId(payment) as Payment;
}

export async function getCustomerAnalytics(branchId?: string | null) {
  const analytics = await apiRequest<RawEntity>(withBranchQuery("/customers/analytics", branchId));
  return normalizeCustomerAnalytics(analytics);
}

export async function listExpenses(branchId?: string | null) {
  const expenses = await apiRequest<RawEntity[]>(withBranchQuery("/expenses", branchId));
  return expenses.map((expense) => withId(expense)) as Expense[];
}

export async function createExpense(input: { businessId: string; branchId?: string | null; externalId?: string | null; categoryId?: string | null; amount: number; note: string; expenseDate: string; recordedById?: string | null }) {
  const expense = await apiRequest<RawEntity>("/expenses", { method: "POST", body: input });
  return withId(expense) as Expense;
}

export async function getFinanceOverview(from?: string, to?: string, branchId?: string | null) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (branchId) query.set("branchId", branchId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<FinanceOverview>(`/finance/overview${suffix}`);
}

export async function listFinanceInvoices(from?: string, to?: string, branchId?: string | null) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (branchId) query.set("branchId", branchId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<FinanceInvoice[]>(`/finance/invoices${suffix}`);
}

export async function listFinancePayments(from?: string, to?: string, branchId?: string | null) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (branchId) query.set("branchId", branchId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<FinancePayment[]>(`/finance/payments${suffix}`);
}

export async function listFinanceCreditNotes(from?: string, to?: string, branchId?: string | null) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (branchId) query.set("branchId", branchId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<CreditNote[]>(`/finance/credit-notes${suffix}`);
}

export async function createFinanceCreditNote(input: {
  businessId: string;
  branchId?: string | null;
  externalId?: string | null;
  reference: string;
  relatedSaleId?: string | null;
  customerId?: string | null;
  amount: number;
  reason: string;
  note?: string | null;
  status?: CreditNote["status"];
  creditDate: string;
}) {
  const note = await apiRequest<RawEntity>("/finance/credit-notes", { method: "POST", body: input });
  return withId({ ...note, creditDate: normalizeIsoDate(note.creditDate) }) as CreditNote;
}

export async function getInvoiceDashboard(from?: string, to?: string, branchId?: string | null) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (branchId) query.set("branchId", branchId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{
    totalInvoiced: number;
    paid: number;
    outstanding: number;
    overdue: number;
    drafts: number;
    thisMonth: number;
    thisYear: number;
    paymentTotal: number;
    totalPaid: number;
    overdueCount: number;
  }>(`/invoices/dashboard${suffix}`);
}

export async function listInvoices(input: {
  branchId?: string | null;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  customerId?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  if (input.branchId) query.set("branchId", input.branchId);
  if (input.page) query.set("page", String(input.page));
  if (input.pageSize) query.set("pageSize", String(input.pageSize));
  if (input.search?.trim()) query.set("search", input.search.trim());
  if (input.status) query.set("status", input.status);
  if (input.customerId) query.set("customerId", input.customerId);
  if (input.from) query.set("from", input.from);
  if (input.to) query.set("to", input.to);
  if (input.sortBy) query.set("sortBy", input.sortBy);
  if (input.sortOrder) query.set("sortOrder", input.sortOrder);
  const response = await apiRequest<{ items: RawEntity[]; page: number; pageSize: number; total: number; totalPages: number }>(`/invoices?${query.toString()}`);
  return { ...response, items: response.items.map((item) => normalizeInvoice(item)) };
}

export async function getInvoice(id: string, branchId?: string | null) {
  const invoice = await apiRequest<RawEntity>(withBranchQuery(`/invoices/${encodeURIComponent(id)}`, branchId));
  return normalizeInvoice(invoice);
}

export async function getInvoicePdfHtml(id: string, branchId?: string | null) {
  return apiRequest<{ html: string }>(withBranchQuery(`/invoices/${encodeURIComponent(id)}/pdf-html`, branchId));
}

export async function createInvoice(input: Omit<Invoice, "id" | "createdAt" | "updatedAt" | "deletedAt" | "history" | "payments" | "lineItems" | "creditNotes" | "debitNotes"> & {
  branchId?: string | null;
  externalId?: string | null;
  issueDate: string;
  dueDate: string;
  lineItems: Array<{
    productId?: string | null;
    productName?: string | null;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discountType?: "percentage" | "fixed";
    discountValue?: number;
    taxCategory?: "vat" | "zero_rated" | "exempt" | "non_taxable" | "custom";
    taxCode?: string | null;
    taxRate?: number;
    taxInclusive?: boolean;
  }>;
}) {
  const invoice = await apiRequest<RawEntity>("/invoices", { method: "POST", body: input });
  return normalizeInvoice(invoice);
}

export async function updateInvoice(id: string, patch: Partial<Invoice> & { branchId?: string | null; issueDate?: string; dueDate?: string; lineItems?: Array<any> }) {
  const invoice = await apiRequest<RawEntity>(`/invoices/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return normalizeInvoice(invoice);
}

export async function duplicateInvoice(id: string, branchId?: string | null) {
  const invoice = await apiRequest<RawEntity>(withBranchQuery(`/invoices/${encodeURIComponent(id)}/duplicate`, branchId), { method: "POST" });
  return normalizeInvoice(invoice);
}

export async function sendInvoice(id: string, branchId?: string | null) {
  const invoice = await apiRequest<RawEntity>(withBranchQuery(`/invoices/${encodeURIComponent(id)}/send`, branchId), { method: "POST" });
  return normalizeInvoice(invoice);
}

export async function markInvoiceViewed(id: string, branchId?: string | null) {
  const invoice = await apiRequest<RawEntity>(withBranchQuery(`/invoices/${encodeURIComponent(id)}/view`, branchId), { method: "POST" });
  return normalizeInvoice(invoice);
}

export async function recordInvoicePayment(
  id: string,
  input: { amount: number; method: string; paymentDate: string; reference?: string | null; note?: string | null; externalId?: string | null },
  branchId?: string | null
) {
  const response = await apiRequest<{ invoice: RawEntity; payment: RawEntity }>(withBranchQuery(`/invoices/${encodeURIComponent(id)}/payments`, branchId), { method: "POST", body: input });
  return { invoice: normalizeInvoice(response.invoice), payment: withId(response.payment) as Payment };
}

export async function cancelInvoice(id: string, branchId?: string | null) {
  const invoice = await apiRequest<RawEntity>(withBranchQuery(`/invoices/${encodeURIComponent(id)}/cancel`, branchId), { method: "POST" });
  return normalizeInvoice(invoice);
}

export async function voidInvoice(id: string, branchId?: string | null) {
  const invoice = await apiRequest<RawEntity>(withBranchQuery(`/invoices/${encodeURIComponent(id)}/void`, branchId), { method: "POST" });
  return normalizeInvoice(invoice);
}

export async function archiveInvoice(id: string, branchId?: string | null) {
  const invoice = await apiRequest<RawEntity>(withBranchQuery(`/invoices/${encodeURIComponent(id)}/archive`, branchId), { method: "POST" });
  return normalizeInvoice(invoice);
}

export async function restoreInvoice(id: string, branchId?: string | null) {
  const invoice = await apiRequest<RawEntity>(withBranchQuery(`/invoices/${encodeURIComponent(id)}/restore`, branchId), { method: "POST" });
  return normalizeInvoice(invoice);
}

export async function deleteDraftInvoice(id: string, branchId?: string | null) {
  const invoice = await apiRequest<RawEntity>(withBranchQuery(`/invoices/${encodeURIComponent(id)}`, branchId), { method: "DELETE" });
  return normalizeInvoice(invoice);
}

export async function createInvoiceCreditNote(
  id: string,
  input: {
    businessId: string;
    branchId?: string | null;
    externalId?: string | null;
    reference: string;
    customerId?: string | null;
    amount: number;
    reason: string;
    note?: string | null;
    creditDate: string;
    status?: CreditNote["status"];
  },
  branchId?: string | null
) {
  const note = await apiRequest<RawEntity>(withBranchQuery(`/invoices/${encodeURIComponent(id)}/credit-notes`, branchId), { method: "POST", body: input });
  return withId({ ...note, creditDate: normalizeIsoDate(note.creditDate) }) as CreditNote;
}

export async function createInvoiceDebitNote(
  id: string,
  input: {
    businessId: string;
    branchId?: string | null;
    externalId?: string | null;
    reference: string;
    reason: string;
    amount: number;
    taxAdjustment: number;
    note?: string | null;
    issuedAt: string;
    status?: "draft" | "issued" | "void";
  },
  branchId?: string | null
) {
  const note = await apiRequest<RawEntity>(withBranchQuery(`/invoices/${encodeURIComponent(id)}/debit-notes`, branchId), { method: "POST", body: input });
  return normalizeDebitNote(note);
}

export async function getInvoiceCustomerHistory(customerId: string, branchId?: string | null) {
  const history = await apiRequest<{
    totalInvoiced: number;
    totalPaid: number;
    outstandingBalance: number;
    overdueAmount: number;
    invoiceCount: number;
    recentInvoices: RawEntity[];
    paymentHistory: RawEntity[];
    creditNotes: RawEntity[];
    debitNotes: RawEntity[];
  }>(withBranchQuery(`/invoices/customer/${encodeURIComponent(customerId)}`, branchId));
  return {
    ...history,
    recentInvoices: history.recentInvoices.map((invoice) => normalizeInvoice(invoice)),
    paymentHistory: history.paymentHistory.map((payment) => withId(payment) as Payment),
    creditNotes: history.creditNotes.map((note) => withId(note) as CreditNote),
    debitNotes: history.debitNotes.map((note) => normalizeDebitNote(note))
  };
}

export async function getInvoicePublic(token: string) {
  const invoice = await apiRequest<RawEntity>(`/invoices/public/${encodeURIComponent(token)}`, { auth: false });
  return normalizeInvoice(invoice);
}

export async function updateFinanceCreditNote(id: string, patch: Partial<CreditNote>, branchId?: string | null) {
  const note = await apiRequest<RawEntity>(`/finance/credit-notes/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return withId({ ...note, creditDate: normalizeIsoDate(note.creditDate) }) as CreditNote;
}

export async function archiveFinanceCreditNote(id: string) {
  const note = await apiRequest<RawEntity>(`/finance/credit-notes/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return withId({ ...note, creditDate: normalizeIsoDate(note.creditDate) }) as CreditNote;
}

export async function listBankAccounts(branchId?: string | null) {
  const accounts = await apiRequest<RawEntity[]>(withBranchQuery("/finance/bank-accounts", branchId));
  return accounts.map((account) => withId(account)) as BankAccount[];
}

export async function createBankAccount(input: {
  businessId: string;
  externalId?: string | null;
  bankName: string;
  accountName: string;
  accountNumber?: string | null;
  currency: string;
  openingBalance: number;
  currentBalance?: number;
  isPrimary?: boolean;
  notes?: string | null;
}) {
  const account = await apiRequest<RawEntity>("/finance/bank-accounts", { method: "POST", body: input });
  return withId(account) as BankAccount;
}

export async function updateBankAccount(id: string, patch: Partial<BankAccount>) {
  const account = await apiRequest<RawEntity>(`/finance/bank-accounts/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return withId(account) as BankAccount;
}

export async function archiveBankAccount(id: string) {
  const account = await apiRequest<RawEntity>(`/finance/bank-accounts/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return withId(account) as BankAccount;
}

export async function listPettyCashEntries(from?: string, to?: string, branchId?: string | null) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (branchId) query.set("branchId", branchId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<PettyCashEntry[]>(`/finance/petty-cash${suffix}`);
}

export async function createPettyCashEntry(input: {
  businessId: string;
  externalId?: string | null;
  label: string;
  amount: number;
  direction: PettyCashEntry["direction"];
  category?: string | null;
  note?: string | null;
  recordedById?: string | null;
  entryDate: string;
}) {
  const entry = await apiRequest<RawEntity>("/finance/petty-cash", { method: "POST", body: input });
  return withId({ ...entry, entryDate: normalizeIsoDate(entry.entryDate) }) as PettyCashEntry;
}

export async function archivePettyCashEntry(id: string) {
  const entry = await apiRequest<RawEntity>(`/finance/petty-cash/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return withId({ ...entry, entryDate: normalizeIsoDate(entry.entryDate) }) as PettyCashEntry;
}

export async function listSales(branchId?: string | null) {
  const sales = await apiRequest<RawEntity[]>(withBranchQuery("/sales", branchId));
  return sales.map((sale) => withSaleItems(sale)) as Sale[];
}

export async function listBusinessOperations(input: { kind?: BusinessOperationKind; status?: BusinessOperationStatus } = {}) {
  const query = new URLSearchParams();
  if (input.kind) query.set("kind", input.kind);
  if (input.status) query.set("status", input.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const rows = await apiRequest<RawEntity[]>(`/business-operations${suffix}`);
  return rows.map(normalizeBusinessOperation);
}

export async function createBusinessOperation(input: Omit<BusinessOperation, "id" | "createdAt" | "updatedAt" | "deletedAt"> & { externalId?: string | null }) {
  const row = await apiRequest<RawEntity>("/business-operations", { method: "POST", body: input });
  return normalizeBusinessOperation(row);
}

export async function createBusinessOperationSafe(input: Omit<BusinessOperation, "id" | "createdAt" | "updatedAt" | "deletedAt"> & { externalId: string }) {
  try {
    return await createBusinessOperation(input);
  } catch (error) {
    if (!isOfflineError(error)) throw error;
    await enqueueAction({ id: `operation:${input.externalId}`, businessId: input.businessId, kind: "createBusinessOperation", payload: input, dedupeKey: `operation:${input.businessId}:${input.externalId}` });
    return createBusinessOperationDraft(input);
  }
}

export async function updateBusinessOperation(id: string, patch: Partial<BusinessOperation>) {
  const row = await apiRequest<RawEntity>(`/business-operations/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return normalizeBusinessOperation(row);
}

export async function updateBusinessOperationSafe(businessId: string, id: string, patch: Partial<BusinessOperation>) {
  try {
    return await updateBusinessOperation(id, patch);
  } catch (error) {
    if (!isOfflineError(error)) throw error;
    await enqueueAction({ id: "operation-update:" + id + ":" + Date.now(), businessId, kind: "updateBusinessOperation", payload: { businessId, operationId: id, patch } });
    return { id, businessId, ...patch } as BusinessOperation;
  }
}

export async function archiveBusinessOperation(id: string) {
  const row = await apiRequest<RawEntity>(`/business-operations/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return normalizeBusinessOperation(row);
}

function normalizeBusinessOperation(raw: RawEntity): BusinessOperation {
  return {
    id: String(raw.id ?? raw._id),
    externalId: raw.externalId ?? null,
    businessId: String(raw.businessId),
    branchId: raw.branchId ?? null,
    kind: raw.kind,
    status: raw.status,
    title: String(raw.title ?? "Operation"),
    customerId: raw.customerId ?? null,
    staffId: raw.staffId ?? null,
    scheduledAt: raw.scheduledAt ? normalizeIsoDate(raw.scheduledAt) : null,
    durationMinutes: raw.durationMinutes == null ? null : Number(raw.durationMinutes),
    tableName: raw.tableName ?? null,
    vehiclePlate: raw.vehiclePlate ?? null,
    notes: raw.notes ?? null,
    items: Array.isArray(raw.items) ? raw.items : [],
    total: Number(raw.total ?? 0),
    deletedAt: raw.deletedAt ? normalizeIsoDate(raw.deletedAt) : null,
    createdAt: normalizeIsoDate(raw.createdAt),
    updatedAt: normalizeIsoDate(raw.updatedAt)
  };
}

export async function createSale(input: {
  businessId: string;
  externalId?: string | null;
  branchId?: string | null;
  customerId?: string | null;
  paymentMethod: Sale["paymentMethod"];
  paymentStatus: Sale["paymentStatus"];
  amountPaid: number;
  discountTotal?: number;
  taxTotal?: number;
  grandTotal: number;
  notes?: string | null;
  receiptNumber: string;
  subtotal: number;
  balanceDue: number;
  items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; costPrice: number; lineDiscount: number; lineTotal: number }>;
}) {
  const sale = await apiRequest<RawEntity>("/sales", { method: "POST", body: input });
  return withSaleItems(sale) as Sale;
}

export async function listPurchaseOrders(branchId?: string | null) {
  const orders = await apiRequest<RawEntity[]>(withBranchQuery("/purchase-orders", branchId));
  return orders.map((order) => withId(order)) as PurchaseOrder[];
}

export async function createPurchaseOrder(input: {
  businessId: string;
  branchId?: string | null;
  externalId?: string | null;
  supplierId?: string | null;
  orderNumber: string;
  status?: PurchaseOrder["status"];
  orderDate: string;
  expectedDate?: string | null;
  receivedAt?: string | null;
  subtotal?: number;
  taxTotal?: number;
  total?: number;
  notes?: string | null;
  items: PurchaseOrder["items"];
}) {
  const order = await apiRequest<RawEntity>("/purchase-orders", { method: "POST", body: input });
  return withId(order) as PurchaseOrder;
}

export async function updatePurchaseOrder(id: string, patch: Partial<PurchaseOrder> & { branchId?: string | null }) {
  const order = await apiRequest<RawEntity>(`/purchase-orders/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return withId(order) as PurchaseOrder;
}

export async function archivePurchaseOrder(id: string, branchId?: string | null) {
  const order = await apiRequest<RawEntity>(withBranchQuery(`/purchase-orders/${encodeURIComponent(id)}/archive`, branchId), { method: "POST" });
  return withId(order) as PurchaseOrder;
}

export async function listStockTransfers() {
  const transfers = await apiRequest<RawEntity[]>("/stock-transfers");
  return transfers.map((transfer) => withId(transfer)) as StockTransfer[];
}

export async function createStockTransfer(input: {
  businessId: string;
  externalId?: string | null;
  fromBranchId?: string | null;
  toBranchId?: string | null;
  transferNumber: string;
  status?: StockTransfer["status"];
  transferDate: string;
  receivedAt?: string | null;
  note?: string | null;
  items: StockTransfer["items"];
}) {
  const transfer = await apiRequest<RawEntity>("/stock-transfers", { method: "POST", body: input });
  return withId(transfer) as StockTransfer;
}

export async function updateStockTransfer(id: string, patch: Partial<StockTransfer>) {
  const transfer = await apiRequest<RawEntity>(`/stock-transfers/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  return withId(transfer) as StockTransfer;
}

export async function archiveStockTransfer(id: string) {
  const transfer = await apiRequest<RawEntity>(`/stock-transfers/${encodeURIComponent(id)}/archive`, { method: "POST" });
  return withId(transfer) as StockTransfer;
}

export async function getReportsSummary(from?: string, to?: string, branchId?: string | null) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (branchId) query.set("branchId", branchId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<DailySummary>(`/reports/summary${suffix}`);
}

export async function getTopProducts(from?: string, to?: string, branchId?: string | null) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (branchId) query.set("branchId", branchId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<Array<{ productId: string; productName: string; quantity: number; total: number }>>(`/reports/top-products${suffix}`);
}

export async function getPaymentBreakdown(from?: string, to?: string, branchId?: string | null) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (branchId) query.set("branchId", branchId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<Array<{ _id: string; total: number; count: number }>>(`/reports/payment-breakdown${suffix}`);
}

export async function getEnterpriseAnalytics(from?: string, to?: string, branchId?: string | null) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (branchId) query.set("branchId", branchId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<EnterpriseAnalytics>(`/analytics/enterprise${suffix}`);
}

export async function listEmployees(branchId?: string | null) {
  const employees = await apiRequest<RawEntity[]>(withBranchQuery("/employees", branchId));
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

export async function registerDevicePushToken(input: {
  businessId: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  platform: "android" | "ios" | "web";
  pushToken: string;
}) {
  return apiRequest<RawEntity>("/notifications/devices", { method: "POST", body: input });
}

export async function listNotifications() {
  const notifications = await apiRequest<RawEntity[]>("/notifications");
  return notifications.map((notification) => withId(notification)) as NotificationRecord[];
}

export async function listNotificationsPage(input: { page: number; pageSize?: number; search?: string }) {
  const query = new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize ?? 20) });
  if (input.search?.trim()) query.set("search", input.search.trim());
  const response = await apiRequest<{ items: RawEntity[]; page: number; pageSize: number; total: number; totalPages: number; unreadCount: number }>(`/notifications/page?${query.toString()}`);
  return {
    ...response,
    items: response.items.map((notification) => withId(notification)) as NotificationRecord[]
  } satisfies NotificationPage;
}

export async function markAllNotificationsRead() {
  return apiRequest<{ updatedCount: number }>("/notifications/read-all", { method: "PATCH" });
}

export async function markNotificationRead(id: string) {
  const notification = await apiRequest<RawEntity>(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
  return withId(notification) as NotificationRecord;
}
