import { createId } from "@/utils/id";
import { secureStore } from "@/storage/secure";
import type { PaymentMethod } from "@shared";

export type PosMode = "sale" | "return";
export type PosDiscountMode = "flat" | "percent";
export type PosTaxMode = "flat" | "percent";

export type PosCartLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
};

export type PosPaymentLine = {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  note?: string;
};

export type PosDraft = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  mode: PosMode;
  cart: PosCartLine[];
  paymentMethod: PaymentMethod;
  payments: PosPaymentLine[];
  discountMode: PosDiscountMode;
  discountValue: number;
  taxMode: PosTaxMode;
  taxValue: number;
  notes?: string;
  lookupCode?: string;
  productSearch?: string;
  customerId?: string | null;
  relatedSaleId?: string | null;
};

type PosDraftStorage = {
  version: 1;
  drafts: PosDraft[];
};

const DEFAULT_STORAGE: PosDraftStorage = { version: 1, drafts: [] };

const DEFAULT_PAYMENT_METHOD: PaymentMethod = "cash";
const PAYMENT_METHODS = new Set<PaymentMethod>(["cash", "mpesa", "bank", "credit"]);

function toIsoDate(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function normalizeCartLine(line: unknown): PosCartLine | null {
  if (!line || typeof line !== "object") return null;
  const candidate = line as Partial<PosCartLine> & { productId?: unknown; name?: unknown };
  if (typeof candidate.productId !== "string" || !candidate.productId.trim()) return null;
  if (typeof candidate.name !== "string" || !candidate.name.trim()) return null;
  return {
    productId: candidate.productId,
    name: candidate.name,
    quantity: Math.max(0, Math.floor(Number(candidate.quantity ?? 0))),
    unitPrice: Number(candidate.unitPrice ?? 0) || 0,
    costPrice: Number(candidate.costPrice ?? 0) || 0,
    discount: Number(candidate.discount ?? 0) || 0
  };
}

function normalizePaymentLine(line: unknown, fallbackMethod: PaymentMethod): PosPaymentLine | null {
  if (!line || typeof line !== "object") return null;
  const candidate = line as Partial<PosPaymentLine> & { id?: unknown; method?: unknown };
  const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : createId();
  const method = typeof candidate.method === "string" && PAYMENT_METHODS.has(candidate.method as PaymentMethod) ? (candidate.method as PaymentMethod) : fallbackMethod;
  return {
    id,
    method,
    amount: Number(candidate.amount ?? 0) || 0,
    reference: typeof candidate.reference === "string" ? candidate.reference : "",
    note: typeof candidate.note === "string" ? candidate.note : ""
  };
}

function normalizeDraft(raw: unknown): PosDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const draft = raw as Partial<PosDraft> & { id?: unknown; mode?: unknown; paymentMethod?: unknown };
  const id = typeof draft.id === "string" && draft.id.trim() ? draft.id : createId();
  const paymentMethod = typeof draft.paymentMethod === "string" && PAYMENT_METHODS.has(draft.paymentMethod as PaymentMethod) ? (draft.paymentMethod as PaymentMethod) : DEFAULT_PAYMENT_METHOD;
  const cart = Array.isArray(draft.cart) ? draft.cart.map(normalizeCartLine).filter((line): line is PosCartLine => Boolean(line)) : [];
  const payments = Array.isArray(draft.payments)
    ? draft.payments.map((line) => normalizePaymentLine(line, paymentMethod)).filter((line): line is PosPaymentLine => Boolean(line))
    : [];
  const normalized: PosDraft = {
    id,
    createdAt: toIsoDate(draft.createdAt),
    updatedAt: toIsoDate(draft.updatedAt ?? draft.createdAt),
    title: typeof draft.title === "string" && draft.title.trim() ? draft.title : "Saved draft",
    mode: draft.mode === "return" ? "return" : "sale",
    cart,
    paymentMethod,
    payments: payments.length ? payments : [{ id: createId(), method: paymentMethod, amount: 0, reference: "", note: "" }],
    discountMode: draft.discountMode === "percent" ? "percent" : "flat",
    discountValue: Number(draft.discountValue ?? 0) || 0,
    taxMode: draft.taxMode === "percent" ? "percent" : "flat",
    taxValue: Number(draft.taxValue ?? 0) || 0,
    customerId: typeof draft.customerId === "string" ? draft.customerId : null,
    relatedSaleId: typeof draft.relatedSaleId === "string" ? draft.relatedSaleId : null
  };
  if (typeof draft.notes === "string") {
    normalized.notes = draft.notes;
  }
  if (typeof draft.lookupCode === "string") {
    normalized.lookupCode = draft.lookupCode;
  }
  if (typeof draft.productSearch === "string") {
    normalized.productSearch = draft.productSearch;
  }
  return normalized;
}

function parseDrafts(raw: string | null): PosDraftStorage {
  if (!raw) return DEFAULT_STORAGE;
  try {
    const parsed = JSON.parse(raw) as Partial<PosDraftStorage>;
    if (parsed?.version !== 1 || !Array.isArray(parsed.drafts)) return DEFAULT_STORAGE;
    return {
      version: 1,
      drafts: parsed.drafts.map(normalizeDraft).filter((draft): draft is PosDraft => Boolean(draft))
    };
  } catch {
    return DEFAULT_STORAGE;
  }
}

async function readDraftStorage() {
  return parseDrafts(await secureStore.getPosDrafts());
}

async function writeDraftStorage(storage: PosDraftStorage) {
  await secureStore.setPosDrafts(JSON.stringify(storage));
}

export async function listPosDrafts() {
  const storage = await readDraftStorage();
  return storage.drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function savePosDraft(draft: Omit<PosDraft, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  const storage = await readDraftStorage();
  const now = new Date().toISOString();
  const next: PosDraft = {
    ...draft,
    id: draft.id ?? createId(),
    createdAt: draft.id ? storage.drafts.find((item) => item.id === draft.id)?.createdAt ?? now : now,
    updatedAt: now
  };
  const index = storage.drafts.findIndex((item) => item.id === next.id);
  if (index === -1) {
    storage.drafts.push(next);
  } else {
    storage.drafts[index] = next;
  }
  await writeDraftStorage(storage);
  return next;
}

export async function removePosDraft(id: string) {
  const storage = await readDraftStorage();
  storage.drafts = storage.drafts.filter((draft) => draft.id !== id);
  await writeDraftStorage(storage);
}

export async function clearPosDrafts() {
  await secureStore.clearPosDrafts();
}
