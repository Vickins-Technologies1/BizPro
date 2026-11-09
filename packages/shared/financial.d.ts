export declare const MONEY_SCALE = 100;
export declare const FINANCIAL_CALCULATION_VERSION = 1;
export declare function isFiniteNumber(value: unknown): value is number;
export declare function roundMoney(value: number): number;
export declare function assertMoney(value: unknown, name: string, options?: {
    min?: number;
    max?: number;
}): number;
/** Validate a new transaction amount against the repository's current 2-place currency convention. */
export declare function assertCurrencyAmount(value: unknown, name: string, options?: {
    min?: number;
    max?: number;
}): number;
export declare function assertQuantity(value: unknown, name?: string): number;
export declare function assertUnitPrice(value: unknown, name?: string): number;
export declare function assertLineDiscount(value: unknown, lineSubtotal: number, name?: string): number;
export declare function assertInvoiceDiscount(value: unknown, lineSubtotal: number, type: "percentage" | "fixed"): number;
export declare function assertTaxRate(value: unknown, name?: string): number;
export declare function assertInitialPayment(value: unknown, grandTotal: number, name?: string): number;
export declare function assertSubsequentPayment(value: unknown, outstanding?: number, name?: string): number;
export declare function assertPaymentMethod<T extends string>(value: unknown, allowed: readonly T[], name?: string): T;
export declare function calculatePercentage(value: number, percentage: number): number;
export declare const calculateGrossProfit: (revenue: number, costOfGoodsSold: number) => number;
export declare const calculateNetProfit: (grossProfit: number, expenses: number) => number;
export declare const calculateOutstandingBalance: (total: number, amountPaid: number, credits?: number) => number;
export declare function calculateTax(taxableAmount: number, taxRate: number, taxInclusive?: boolean): number;
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
export declare function calculateOutstanding(receivables: OutstandingReceivable[], currency?: string): number;
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
export declare function calculateSale(lines: SaleCalculationLineInput[], amountPaid: number, options?: SaleCalculationOptions): {
    lines: {
        lineTax: number;
        lineTotal: number;
        orderDiscountAllocation: number;
        quantity: number;
        unitPrice: number;
        unitCost: number;
        lineSubtotal: number;
        lineDiscount: number;
        discount?: number;
        tax?: number;
    }[];
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
};
