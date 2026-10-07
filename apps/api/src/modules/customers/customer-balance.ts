import { calculateOutstanding, roundMoney, type OutstandingReceivable } from "@vbo/shared";

export type CustomerBalanceSource = {
  sales?: Array<{ id?: string; balanceDue?: number; currency?: string | null }>;
  invoices?: Array<{ id?: string; saleId?: string | null; balanceDue?: number; currency?: string | null }>;
  standalonePayments?: Array<{ amount?: number }>;
  currency?: string;
};

/** Customer outstanding is the canonical hybrid receivable total minus payments not already included in a receivable balance. */
export function calculateCustomerOutstanding(source: CustomerBalanceSource) {
  const receivables: OutstandingReceivable[] = [
    ...(source.sales ?? []).map((row) => ({ id: String(row.id ?? ""), source: "sale" as const, balanceDue: Number(row.balanceDue ?? 0), currency: row.currency ?? source.currency ?? null, linkedReceivableId: String(row.id ?? "") })),
    ...(source.invoices ?? []).map((row) => ({ id: String(row.id ?? ""), source: "invoice" as const, balanceDue: Number(row.balanceDue ?? 0), currency: row.currency ?? source.currency ?? null, linkedReceivableId: row.saleId ?? null }))
  ];
  return roundMoney(Math.max(0, calculateOutstanding(receivables, source.currency) - (source.standalonePayments ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0)));
}

export function reconcileCustomerBalance(storedBalance: number, calculatedBalance: number) {
  const difference = roundMoney(Number(storedBalance || 0) - Number(calculatedBalance || 0));
  return { storedBalance: roundMoney(storedBalance), calculatedBalance: roundMoney(calculatedBalance), difference, isMatch: difference === 0 };
}
