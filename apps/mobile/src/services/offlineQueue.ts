import { secureStore } from "@/storage/secure";
import { createEventId } from "@/utils/id";
import type { Brand, Category, Customer, CustomerAttachment, Expense, Payment, Product, Sale, Supplier } from "@shared";

export type OfflineQueueKind =
  | "createCategory"
  | "createBrand"
  | "createProduct"
  | "adjustStock"
  | "createCustomer"
  | "updateCustomer"
  | "createSupplier"
  | "createExpense"
  | "recordCustomerPayment"
  | "createSale";

export type OfflineQueueEntry =
  | {
      id: string;
      businessId: string;
      kind: "createCategory";
      payload: {
        businessId: string;
        externalId: string;
        name: string;
        color?: string | null;
        sortOrder?: number;
      };
      createdAt: string;
      attempts: number;
      lastError: string | null;
    }
  | {
      id: string;
      businessId: string;
      kind: "createBrand";
      payload: {
        businessId: string;
        externalId: string;
        name: string;
        description?: string | null;
      };
      createdAt: string;
      attempts: number;
      lastError: string | null;
    }
  | {
      id: string;
      businessId: string;
      kind: "createProduct";
      payload: {
        businessId: string;
        externalId: string;
        branchId?: string | null;
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
      };
      createdAt: string;
      attempts: number;
      lastError: string | null;
    }
  | {
      id: string;
      businessId: string;
      kind: "createSupplier";
      payload: {
        businessId: string;
        externalId: string;
        branchId?: string | null;
        categoryId?: string | null;
        code?: string | null;
        name: string;
        phone?: string | null;
        email?: string | null;
        contactName?: string | null;
        notes?: string | null;
        isActive?: boolean;
      };
      createdAt: string;
      attempts: number;
      lastError: string | null;
    }
  | {
      id: string;
      businessId: string;
      dedupeKey?: string | null;
      kind: "adjustStock";
      payload: {
        businessId: string;
        productId: string;
        branchId?: string | null;
        quantityDelta: number;
        unitCost: number;
        note?: string | null;
        referenceType?: string;
        referenceId: string;
      };
      createdAt: string;
      attempts: number;
      lastError: string | null;
    }
  | {
      id: string;
      businessId: string;
      kind: "createCustomer";
      payload: {
        businessId: string;
        externalId: string;
        branchId?: string | null;
        groupId?: string | null;
        name: string;
        phone?: string | null;
        email?: string | null;
        creditLimit?: number;
        loyaltyPoints?: number;
        notes?: string | null;
        balance?: number;
        attachments?: CustomerAttachment[];
      };
      createdAt: string;
      attempts: number;
      lastError: string | null;
    }
  | {
      id: string;
      businessId: string;
      kind: "updateCustomer";
      payload: {
        businessId: string;
        customerId: string;
        branchId?: string | null;
        groupId?: string | null;
        name?: string;
        phone?: string | null;
        email?: string | null;
        creditLimit?: number;
        loyaltyPoints?: number;
        notes?: string | null;
        attachments?: CustomerAttachment[];
      };
      createdAt: string;
      attempts: number;
      lastError: string | null;
    }
  | {
      id: string;
      businessId: string;
      kind: "createExpense";
      payload: {
        businessId: string;
        externalId: string;
        branchId?: string | null;
        categoryId?: string | null;
        amount: number;
        note: string;
        expenseDate: string;
        recordedById?: string | null;
      };
      createdAt: string;
      attempts: number;
      lastError: string | null;
    }
  | {
      id: string;
      businessId: string;
      kind: "recordCustomerPayment";
      payload: {
        businessId: string;
        customerId: string;
        externalId: string;
        branchId?: string | null;
        amount: number;
        method: Payment["method"];
        reference?: string | null;
        note?: string | null;
      };
      createdAt: string;
      attempts: number;
      lastError: string | null;
    }
  | {
      id: string;
      businessId: string;
      dedupeKey?: string | null;
      kind: "createSale";
      payload: {
        businessId: string;
        externalId: string;
        branchId?: string | null;
        customerId?: string | null;
        paymentMethod: Sale["paymentMethod"];
        paymentStatus: Sale["paymentStatus"];
        amountPaid: number;
        discountTotal: number;
        taxTotal: number;
        grandTotal: number;
        notes?: string | null;
        receiptNumber: string;
        subtotal: number;
        balanceDue: number;
        items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; costPrice: number; lineDiscount: number; lineTotal: number }>;
      };
      createdAt: string;
      attempts: number;
      lastError: string | null;
    };

type OfflineQueueStorage = {
  version: 1;
  entries: OfflineQueueEntry[];
};

const DEFAULT_QUEUE: OfflineQueueStorage = { version: 1, entries: [] };

function parseQueue(raw: string | null): OfflineQueueStorage {
  if (!raw) {
    return DEFAULT_QUEUE;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OfflineQueueStorage>;
    if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) {
      return DEFAULT_QUEUE;
    }
    return {
      version: 1,
      entries: parsed.entries.filter(Boolean) as OfflineQueueEntry[]
    };
  } catch {
    return DEFAULT_QUEUE;
  }
}

async function readQueue(): Promise<OfflineQueueStorage> {
  return parseQueue(await secureStore.getOfflineQueue());
}

async function writeQueue(queue: OfflineQueueStorage) {
  await secureStore.setOfflineQueue(JSON.stringify(queue));
}

export function isOfflineError(error: unknown) {
  if (!error) {
    return false;
  }
  if (error instanceof TypeError) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /network request failed|failed to fetch|network error|connection refused|timeout/i.test(message);
}

export async function listQueuedActions(businessId?: string) {
  const queue = await readQueue();
  return businessId ? queue.entries.filter((entry) => entry.businessId === businessId) : queue.entries;
}

export async function countQueuedActions(businessId?: string) {
  return (await listQueuedActions(businessId)).length;
}

export async function enqueueAction(
  action: Omit<OfflineQueueEntry, "createdAt" | "attempts" | "lastError"> & { createdAt?: string; dedupeKey?: string | null }
) {
  const queue = await readQueue();
  const entry = {
    ...action,
    createdAt: action.createdAt ?? new Date().toISOString(),
    attempts: 0,
    lastError: null
  } as OfflineQueueEntry & { dedupeKey?: string | null };
  const dedupeKey = entry.dedupeKey ?? null;
  if (dedupeKey) {
    const existingIndex = queue.entries.findIndex(
      (candidate) =>
        candidate.businessId === entry.businessId &&
        candidate.kind === entry.kind &&
        (candidate as { dedupeKey?: string | null }).dedupeKey === dedupeKey
    );
    if (existingIndex >= 0) {
      const existing = queue.entries[existingIndex]!;
      const merged: OfflineQueueEntry = {
        ...existing,
        ...entry,
        id: existing.id,
        createdAt: existing.createdAt,
        attempts: existing.attempts,
        lastError: existing.lastError
      } as OfflineQueueEntry;
      queue.entries[existingIndex] = merged;
      await writeQueue(queue);
      return merged;
    }
  }
  queue.entries.push(entry);
  await writeQueue(queue);
  return entry;
}

export async function replaceAction(entry: OfflineQueueEntry) {
  const queue = await readQueue();
  const index = queue.entries.findIndex((candidate) => candidate.id === entry.id);
  if (index === -1) {
    queue.entries.push(entry);
  } else {
    queue.entries[index] = entry;
  }
  await writeQueue(queue);
}

export async function removeAction(id: string) {
  const queue = await readQueue();
  const next = queue.entries.filter((entry) => entry.id !== id);
  if (next.length === queue.entries.length) {
    return;
  }
  await writeQueue({ version: 1, entries: next });
}

export async function clearBusinessActions(businessId: string) {
  const queue = await readQueue();
  const next = queue.entries.filter((entry) => entry.businessId !== businessId);
  await writeQueue({ version: 1, entries: next });
}

export async function markActionFailed(entry: OfflineQueueEntry, error: unknown) {
  const updated: OfflineQueueEntry = {
    ...entry,
    attempts: entry.attempts + 1,
    lastError: error instanceof Error ? error.message : String(error)
  };
  await replaceAction(updated);
  return updated;
}

export function createQueueId() {
  return createEventId();
}

export function createCategoryDraft(input: {
  businessId: string;
  externalId: string;
  name: string;
  color?: string | null;
  sortOrder?: number;
}): Category {
  return {
    id: input.externalId,
    externalId: input.externalId,
    businessId: input.businessId,
    name: input.name,
    color: input.color ?? null,
    sortOrder: input.sortOrder ?? 0,
    deletedAt: null
  } as unknown as Category;
}

export function createBrandDraft(input: {
  businessId: string;
  externalId: string;
  name: string;
  description?: string | null;
}): Brand {
  return {
    id: input.externalId,
    externalId: input.externalId,
    businessId: input.businessId,
    name: input.name,
    description: input.description ?? null,
    isActive: true,
    deletedAt: null
  } as unknown as Brand;
}

export function createProductDraft(input: {
  businessId: string;
  externalId: string;
  branchId?: string | null;
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
}): Product {
  return {
    id: input.externalId,
    externalId: input.externalId,
    serverId: null,
    businessId: input.businessId,
    branchId: input.branchId ?? null,
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
    stockOnHand: input.stockOnHand ?? 0,
    lowStockThreshold: input.lowStockThreshold ?? 5,
    isActive: input.isActive ?? true,
    deletedAt: null
  } as unknown as Product;
}

export function createSupplierDraft(input: {
  businessId: string;
  externalId: string;
  branchId?: string | null;
  categoryId?: string | null;
  code?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  contactName?: string | null;
  notes?: string | null;
  isActive?: boolean;
}): Supplier {
  return {
    id: input.externalId,
    externalId: input.externalId,
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    categoryId: input.categoryId ?? null,
    code: input.code ?? null,
    name: input.name,
    phone: input.phone ?? null,
    email: input.email ?? null,
    contactName: input.contactName ?? null,
    notes: input.notes ?? null,
    isActive: input.isActive ?? true,
    deletedAt: null
  } as unknown as Supplier;
}

export function createCustomerDraft(input: {
  businessId: string;
  externalId: string;
  branchId?: string | null;
  groupId?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  creditLimit?: number;
  loyaltyPoints?: number;
  notes?: string | null;
  balance?: number;
  attachments?: CustomerAttachment[];
}): Customer {
  return {
    id: input.externalId,
    externalId: input.externalId,
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
    attachments: Array.isArray(input.attachments)
      ? input.attachments.map((attachment) => ({
          id: attachment.id,
          label: attachment.label,
          url: attachment.url,
          note: attachment.note ?? null,
          addedAt: attachment.addedAt
        }))
      : [],
    deletedAt: null
  } as unknown as Customer;
}

export function createExpenseDraft(input: {
  businessId: string;
  externalId: string;
  branchId?: string | null;
  categoryId?: string | null;
  amount: number;
  note: string;
  expenseDate: string;
  recordedById?: string | null;
}): Expense {
  return {
    id: input.externalId,
    externalId: input.externalId,
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    categoryId: input.categoryId ?? null,
    amount: input.amount,
    note: input.note,
    expenseDate: input.expenseDate,
    recordedById: input.recordedById ?? null,
    deletedAt: null
  } as unknown as Expense;
}

export function createPaymentDraft(input: {
  businessId: string;
  customerId: string;
  externalId: string;
  branchId?: string | null;
  amount: number;
  method: Payment["method"];
  reference?: string | null;
  note?: string | null;
}): Payment {
  return {
    id: input.externalId,
    externalId: input.externalId,
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    customerId: input.customerId,
    saleId: null,
    debtPaymentId: null,
    method: input.method,
    status: "paid",
    amount: input.amount,
    reference: input.reference ?? null,
    note: input.note ?? null,
    provider: input.method === "mpesa" ? "tuma" : null,
    reconciledAt: input.method === "mpesa" ? new Date().toISOString() : null
  } as unknown as Payment;
}

export function createQueuedSaleDraft(input: {
  businessId: string;
  externalId: string;
  branchId?: string | null;
  customerId?: string | null;
  paymentMethod: Sale["paymentMethod"];
  paymentStatus: Sale["paymentStatus"];
  amountPaid: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  notes?: string | null;
  receiptNumber: string;
  subtotal: number;
  balanceDue: number;
  items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; costPrice: number; lineDiscount: number; lineTotal: number }>;
}): Sale {
  return {
    id: input.externalId,
    externalId: input.externalId,
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    customerId: input.customerId ?? null,
    cashierId: null,
    receiptNumber: input.receiptNumber,
    subtotal: input.subtotal,
    discountTotal: input.discountTotal,
    taxTotal: input.taxTotal,
    grandTotal: input.grandTotal,
    amountPaid: input.amountPaid,
    balanceDue: input.balanceDue,
    paymentStatus: input.paymentStatus,
    paymentMethod: input.paymentMethod,
    notes: input.notes ?? null,
    items: input.items,
    deletedAt: null
  } as unknown as Sale;
}
