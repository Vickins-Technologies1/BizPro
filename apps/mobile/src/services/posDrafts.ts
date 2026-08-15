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

function parseDrafts(raw: string | null): PosDraftStorage {
  if (!raw) return DEFAULT_STORAGE;
  try {
    const parsed = JSON.parse(raw) as Partial<PosDraftStorage>;
    if (parsed?.version !== 1 || !Array.isArray(parsed.drafts)) return DEFAULT_STORAGE;
    return {
      version: 1,
      drafts: parsed.drafts.filter(Boolean) as PosDraft[]
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
