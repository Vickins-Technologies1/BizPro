import { calculateOutstanding, roundMoney, type OutstandingReceivable } from "@vbo/shared";

export type CustomerBalanceSource = {
  sales?: Array<{ id?: string; _id?: string | { toString(): string }; externalId?: string | null; balanceDue?: number; currency?: string | null }>;
  invoices?: Array<{ id?: string; saleId?: string | null; balanceDue?: number; currency?: string | null }>;
  standalonePayments?: Array<{ amount?: number }>;
  currency?: string;
};

/** Customer outstanding is the gross balance of its active sale and invoice obligations. */
export function calculateCustomerOutstanding(source: CustomerBalanceSource) {
  const saleAliases = new Map<string, string>();
  for (const sale of source.sales ?? []) {
    const canonical = String(sale._id ?? sale.id ?? sale.externalId ?? "");
    if (canonical) {
      saleAliases.set(canonical, canonical);
      if (sale.id) saleAliases.set(String(sale.id), canonical);
      if (sale.externalId) saleAliases.set(String(sale.externalId), canonical);
    }
  }
  const receivables: OutstandingReceivable[] = [
    ...(source.sales ?? []).map((row) => {
      const id = String(row._id ?? row.id ?? row.externalId ?? "");
      return { id: String(row.externalId ?? id), source: "sale" as const, balanceDue: Number(row.balanceDue ?? 0), currency: row.currency ?? source.currency ?? null, linkedReceivableId: id };
    }),
    ...(source.invoices ?? []).map((row) => ({ id: String(row.id ?? ""), source: "invoice" as const, balanceDue: Number(row.balanceDue ?? 0), currency: row.currency ?? source.currency ?? null, linkedReceivableId: row.saleId ? saleAliases.get(String(row.saleId)) ?? row.saleId : null }))
  ];
  return calculateOutstanding(receivables, source.currency);
}

/** Unallocated posted payments are customer credit and never offset receivables. */
export function calculateCustomerCredit(payments: Array<{ amount?: number }>) {
  return roundMoney(Math.max(0, payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)));
}

export function reconcileCustomerBalance(storedBalance: number, calculatedBalance: number) {
  const difference = roundMoney(Number(storedBalance || 0) - Number(calculatedBalance || 0));
  return { storedBalance: roundMoney(storedBalance), calculatedBalance: roundMoney(calculatedBalance), difference, isMatch: difference === 0 };
}
