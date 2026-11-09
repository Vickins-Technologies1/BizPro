import { createHash } from "crypto";

export type PaymentLifecycleState = "posted" | "reconciliation_pending" | "reconciled" | "failed" | "reversed" | "refunded";

type PaymentRequestFingerprintInput = {
  operation: "sale_payment" | "invoice_payment" | "customer_payment" | "sale_initial_payment";
  businessId: string;
  targetId: string;
  customerId?: string | null;
  branchId?: string | null;
  amount: number;
  currency: string;
  method: string;
  reference?: string | null | undefined;
  paymentDate?: string | Date | null | undefined;
};

export function buildPaymentRequestFingerprint(input: PaymentRequestFingerprintInput) {
  const canonical = {
    operation: input.operation,
    businessId: input.businessId,
    targetId: input.targetId,
    customerId: input.customerId ?? null,
    branchId: input.branchId ?? null,
    amountMinor: Math.round(input.amount * 100),
    currency: input.currency.trim().toUpperCase(),
    method: input.method,
    reference: input.reference?.trim() || null,
    paymentDate: input.paymentDate ? new Date(input.paymentDate).toISOString() : null
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function buildOperationFingerprint(value: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function assertPaymentRequestMatches(existing: { requestFingerprint?: string | null }, fingerprint: string) {
  if (!existing.requestFingerprint || existing.requestFingerprint !== fingerprint) {
    const error = new Error("Idempotency key was already used for a different payment request");
    error.name = "PaymentIdempotencyConflict";
    throw error;
  }
}

const paymentTransitions: Record<PaymentLifecycleState, readonly PaymentLifecycleState[]> = {
  posted: ["reversed", "refunded"],
  reconciliation_pending: ["reconciled", "failed", "reversed"],
  reconciled: ["reversed", "refunded"],
  failed: [],
  reversed: [],
  refunded: []
};

export function assertPaymentStateTransition(current: PaymentLifecycleState, next: PaymentLifecycleState) {
  if (current === next) return;
  if (!paymentTransitions[current]?.includes(next)) throw new Error(`Invalid payment transition from ${current} to ${next}`);
}

/** Compatibility rule for legacy rows; old M-Pesa entries are excluded absent verified state. */
export function eligiblePaymentMatch() {
  return {
    $or: [
      { paymentState: { $in: ["posted", "reconciled", "reversed", "refunded"] } },
      { paymentState: { $exists: false }, method: { $ne: "mpesa" }, status: { $in: ["paid", "partial"] } }
    ]
  };
}

export function isDuplicateKeyError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === 11000);
}
