export const MONEY_SCALE = 100;
export const FINANCIAL_CALCULATION_VERSION = 1;

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Financial value must be finite");
  return Math.round((value + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;
}

export function assertMoney(value: unknown, name: string, options: { min?: number; max?: number } = {}): number {
  if (!isFiniteNumber(value)) throw new Error(`${name} must be a finite number`);
  const rounded = roundMoney(value);
  if (options.min !== undefined && rounded < options.min) throw new Error(`${name} must be at least ${options.min}`);
  if (options.max !== undefined && rounded > options.max) throw new Error(`${name} must be at most ${options.max}`);
  return rounded;
}

/** Validate a new transaction amount against the repository's current 2-place currency convention. */
export function assertCurrencyAmount(value: unknown, name: string, options: { min?: number; max?: number } = {}): number {
  const amount = assertMoney(value, name, options);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(amount)) * 4;
  if (Math.abs((value as number) - amount) > tolerance) {
    throw new Error(`${name} must have no more than 2 decimal places`);
  }
  if (!Number.isSafeInteger(Math.round(amount * MONEY_SCALE))) {
    throw new Error(`${name} is outside the supported monetary range`);
  }
  return amount;
}

export function assertQuantity(value: unknown, name = "quantity"): number {
  if (!isFiniteNumber(value) || value <= 0) throw new Error(`${name} must be greater than zero`);
  if (!Number.isFinite(value * 1_000_000)) throw new Error(`${name} is outside the supported range`);
  return value;
}

export function assertUnitPrice(value: unknown, name = "unitPrice"): number {
  return assertCurrencyAmount(value, name, { min: 0 });
}

export function assertLineDiscount(value: unknown, lineSubtotal: number, name = "discount"): number {
  return assertCurrencyAmount(value, name, { min: 0, max: lineSubtotal });
}

export function assertInvoiceDiscount(value: unknown, lineSubtotal: number, type: "percentage" | "fixed"): number {
  return type === "percentage"
    ? assertMoney(value, "Invoice discount percentage", { min: 0, max: 100 })
    : assertCurrencyAmount(value, "Invoice discount", { min: 0, max: lineSubtotal });
}

export function assertTaxRate(value: unknown, name = "taxRate"): number {
  return assertMoney(value, name, { min: 0, max: 1000 });
}

export function assertInitialPayment(value: unknown, grandTotal: number, name = "amountPaid"): number {
  return assertCurrencyAmount(value, name, { min: 0, max: grandTotal });
}

export function assertSubsequentPayment(value: unknown, outstanding?: number, name = "Payment amount"): number {
  return assertCurrencyAmount(value, name, { min: 0.01, ...(outstanding === undefined ? {} : { max: outstanding }) });
}

export function assertPaymentMethod<T extends string>(value: unknown, allowed: readonly T[], name = "payment method"): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${name} is not supported`);
  return value as T;
}

export function calculatePercentage(value: number, percentage: number): number {
  return roundMoney(assertMoney(value, "value", { min: 0 }) * assertMoney(percentage, "percentage", { min: 0, max: 100 }) / 100);
}

export const calculateGrossProfit = (revenue: number, costOfGoodsSold: number) =>
  roundMoney(assertMoney(revenue, "revenue") - assertMoney(costOfGoodsSold, "costOfGoodsSold"));

export const calculateNetProfit = (grossProfit: number, expenses: number) =>
  roundMoney(assertMoney(grossProfit, "grossProfit") - assertMoney(expenses, "expenses"));

export const calculateOutstandingBalance = (total: number, amountPaid: number, credits = 0) =>
  roundMoney(Math.max(0, assertMoney(total, "total") - assertMoney(amountPaid, "amountPaid") - assertMoney(credits, "credits")));

export function calculateTax(taxableAmount: number, taxRate: number, taxInclusive = false) {
  const base = assertMoney(taxableAmount, "taxableAmount", { min: 0 });
  const rate = assertMoney(taxRate, "taxRate", { min: 0, max: 1000 });
  return taxInclusive ? roundMoney(base - base / (1 + rate / 100 || 1)) : roundMoney(base * rate / 100);
}

export type OutstandingReceivable = {
  id: string;
  source: "sale" | "invoice";
  balanceDue?: number;
  linkedReceivableId?: string | null;
  active?: boolean;
  currency?: string | null;
};

/**
 * Canonical outstanding definition: active unpaid receivables, deduplicated by
 * an explicit sale/invoice representation link. Linked invoices represent the
 * obligation; unlinked sales and invoices are independent receivable sources.
 */
export function calculateOutstanding(receivables: OutstandingReceivable[], currency?: string) {
  const active = receivables.filter((row) => row.active !== false && (!currency || !row.currency || row.currency === currency));
  const groups = new Map<string, OutstandingReceivable[]>();
  for (const row of active) {
    const key = row.linkedReceivableId ? `linked:${row.linkedReceivableId}` : `${row.source}:${row.id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  let total = 0;
  for (const rows of groups.values()) {
    const invoices = rows.filter((row) => row.source === "invoice");
    const selected = invoices.length ? invoices : rows;
    total += selected.reduce((sum, row) => sum + Math.max(0, Number(row.balanceDue ?? 0)), 0);
  }
  return roundMoney(total);
}

export type SaleCalculationLineInput = {
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discount?: number;
  tax?: number;
};

export type SaleCalculationLine = SaleCalculationLineInput & {
  lineSubtotal: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
};

export type SaleCalculationOptions = {
  orderDiscount?: number;
  taxRate?: number;
  taxInclusive?: boolean;
};

export function calculateSale(lines: SaleCalculationLineInput[], amountPaid: number, options: SaleCalculationOptions = {}) {
  if (!lines.length) throw new Error("A sale must contain at least one item");
  const baseLines = lines.map((line) => {
    const quantity = assertQuantity(line.quantity, "Sale quantity");
    const unitPrice = assertUnitPrice(line.unitPrice);
    const unitCost = assertCurrencyAmount(line.unitCost, "unitCost", { min: 0 });
    const lineSubtotal = roundMoney(unitPrice * quantity);
    const lineDiscount = assertLineDiscount(line.discount ?? 0, lineSubtotal);
    return { ...line, quantity, unitPrice, unitCost, lineSubtotal, lineDiscount };
  });

  const subtotal = roundMoney(baseLines.reduce((sum, line) => sum + line.lineSubtotal, 0));
  const lineDiscountTotal = roundMoney(baseLines.reduce((sum, line) => sum + line.lineDiscount, 0));
  const discountableSubtotal = roundMoney(subtotal - lineDiscountTotal);
  const orderDiscount = assertCurrencyAmount(options.orderDiscount ?? 0, "orderDiscount", { min: 0, max: discountableSubtotal });
  const orderDiscountMinor = Math.round(orderDiscount * MONEY_SCALE);
  const discountableMinor = Math.round(discountableSubtotal * MONEY_SCALE);
  let allocatedOrderDiscountMinor = 0;
  const allocated = baseLines.map((line, index) => {
    const lineBase = roundMoney(line.lineSubtotal - line.lineDiscount);
    const lineBaseMinor = Math.round(lineBase * MONEY_SCALE);
    const allocation = index === baseLines.length - 1
      ? orderDiscountMinor - allocatedOrderDiscountMinor
      : discountableMinor > 0
        ? Math.floor(orderDiscountMinor * lineBaseMinor / discountableMinor)
        : 0;
    allocatedOrderDiscountMinor += allocation;
    return { ...line, orderDiscountAllocation: allocation / MONEY_SCALE };
  });

  const taxRate = assertTaxRate(options.taxRate ?? 0);
  const taxInclusive = options.taxInclusive ?? false;
  const calculatedLines = allocated.map((line) => {
    const taxableBase = roundMoney(line.lineSubtotal - line.lineDiscount - line.orderDiscountAllocation);
    const lineTax = line.tax === undefined
      ? calculateTax(taxableBase, taxRate, taxInclusive)
      : assertCurrencyAmount(line.tax, "tax", { min: 0 });
    const lineTotal = roundMoney(taxableBase + (taxInclusive ? 0 : lineTax));
    return { ...line, lineTax, lineTotal };
  });
  const discountTotal = roundMoney(lineDiscountTotal + orderDiscount);
  const taxTotal = roundMoney(calculatedLines.reduce((sum, line) => sum + line.lineTax, 0));
  const grandTotal = roundMoney(calculatedLines.reduce((sum, line) => sum + line.lineTotal, 0));
  const paid = assertInitialPayment(amountPaid, grandTotal);
  return { lines: calculatedLines, subtotal, discountTotal, taxTotal, grandTotal, amountPaid: paid, balanceDue: roundMoney(grandTotal - paid) };
}
