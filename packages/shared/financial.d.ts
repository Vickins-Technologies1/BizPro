export declare const MONEY_SCALE = 100;
export declare const FINANCIAL_CALCULATION_VERSION = 1;
export declare function isFiniteNumber(value: unknown): value is number;
export declare function roundMoney(value: number): number;
export declare function assertMoney(value: unknown, name: string, options?: {
    min?: number;
    max?: number;
}): number;
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
export declare function calculateSale(lines: SaleCalculationLineInput[], amountPaid: number): {
    lines: {
        quantity: number;
        unitPrice: number;
        unitCost: number;
        lineSubtotal: number;
        lineDiscount: number;
        lineTax: number;
        lineTotal: number;
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
