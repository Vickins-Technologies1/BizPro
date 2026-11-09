"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateOutstandingBalance = exports.calculateNetProfit = exports.calculateGrossProfit = exports.FINANCIAL_CALCULATION_VERSION = exports.MONEY_SCALE = void 0;
exports.isFiniteNumber = isFiniteNumber;
exports.roundMoney = roundMoney;
exports.assertMoney = assertMoney;
exports.assertCurrencyAmount = assertCurrencyAmount;
exports.assertQuantity = assertQuantity;
exports.assertUnitPrice = assertUnitPrice;
exports.assertLineDiscount = assertLineDiscount;
exports.assertInvoiceDiscount = assertInvoiceDiscount;
exports.assertTaxRate = assertTaxRate;
exports.assertInitialPayment = assertInitialPayment;
exports.assertSubsequentPayment = assertSubsequentPayment;
exports.assertPaymentMethod = assertPaymentMethod;
exports.calculatePercentage = calculatePercentage;
exports.calculateTax = calculateTax;
exports.calculateOutstanding = calculateOutstanding;
exports.calculateSale = calculateSale;
exports.MONEY_SCALE = 100;
exports.FINANCIAL_CALCULATION_VERSION = 1;
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function roundMoney(value) {
    if (!Number.isFinite(value))
        throw new Error("Financial value must be finite");
    return Math.round((value + Number.EPSILON) * exports.MONEY_SCALE) / exports.MONEY_SCALE;
}
function assertMoney(value, name, options = {}) {
    if (!isFiniteNumber(value))
        throw new Error(`${name} must be a finite number`);
    const rounded = roundMoney(value);
    if (options.min !== undefined && rounded < options.min)
        throw new Error(`${name} must be at least ${options.min}`);
    if (options.max !== undefined && rounded > options.max)
        throw new Error(`${name} must be at most ${options.max}`);
    return rounded;
}
/** Validate a new transaction amount against the repository's current 2-place currency convention. */
function assertCurrencyAmount(value, name, options = {}) {
    const amount = assertMoney(value, name, options);
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(amount)) * 4;
    if (Math.abs(value - amount) > tolerance) {
        throw new Error(`${name} must have no more than 2 decimal places`);
    }
    if (!Number.isSafeInteger(Math.round(amount * exports.MONEY_SCALE))) {
        throw new Error(`${name} is outside the supported monetary range`);
    }
    return amount;
}
function assertQuantity(value, name = "quantity") {
    if (!isFiniteNumber(value) || value <= 0)
        throw new Error(`${name} must be greater than zero`);
    if (!Number.isFinite(value * 1_000_000))
        throw new Error(`${name} is outside the supported range`);
    return value;
}
function assertUnitPrice(value, name = "unitPrice") {
    return assertCurrencyAmount(value, name, { min: 0 });
}
function assertLineDiscount(value, lineSubtotal, name = "discount") {
    return assertCurrencyAmount(value, name, { min: 0, max: lineSubtotal });
}
function assertInvoiceDiscount(value, lineSubtotal, type) {
    return type === "percentage"
        ? assertMoney(value, "Invoice discount percentage", { min: 0, max: 100 })
        : assertCurrencyAmount(value, "Invoice discount", { min: 0, max: lineSubtotal });
}
function assertTaxRate(value, name = "taxRate") {
    return assertMoney(value, name, { min: 0, max: 1000 });
}
function assertInitialPayment(value, grandTotal, name = "amountPaid") {
    return assertCurrencyAmount(value, name, { min: 0, max: grandTotal });
}
function assertSubsequentPayment(value, outstanding, name = "Payment amount") {
    return assertCurrencyAmount(value, name, { min: 0.01, ...(outstanding === undefined ? {} : { max: outstanding }) });
}
function assertPaymentMethod(value, allowed, name = "payment method") {
    if (typeof value !== "string" || !allowed.includes(value))
        throw new Error(`${name} is not supported`);
    return value;
}
function calculatePercentage(value, percentage) {
    return roundMoney(assertMoney(value, "value", { min: 0 }) * assertMoney(percentage, "percentage", { min: 0, max: 100 }) / 100);
}
const calculateGrossProfit = (revenue, costOfGoodsSold) => roundMoney(assertMoney(revenue, "revenue") - assertMoney(costOfGoodsSold, "costOfGoodsSold"));
exports.calculateGrossProfit = calculateGrossProfit;
const calculateNetProfit = (grossProfit, expenses) => roundMoney(assertMoney(grossProfit, "grossProfit") - assertMoney(expenses, "expenses"));
exports.calculateNetProfit = calculateNetProfit;
const calculateOutstandingBalance = (total, amountPaid, credits = 0) => roundMoney(Math.max(0, assertMoney(total, "total") - assertMoney(amountPaid, "amountPaid") - assertMoney(credits, "credits")));
exports.calculateOutstandingBalance = calculateOutstandingBalance;
function calculateTax(taxableAmount, taxRate, taxInclusive = false) {
    const base = assertMoney(taxableAmount, "taxableAmount", { min: 0 });
    const rate = assertMoney(taxRate, "taxRate", { min: 0, max: 1000 });
    return taxInclusive ? roundMoney(base - base / (1 + rate / 100 || 1)) : roundMoney(base * rate / 100);
}
/**
 * Canonical outstanding definition: active unpaid receivables, deduplicated by
 * an explicit sale/invoice representation link. Linked invoices represent the
 * obligation; unlinked sales and invoices are independent receivable sources.
 */
function calculateOutstanding(receivables, currency) {
    const active = receivables.filter((row) => row.active !== false && (!currency || !row.currency || row.currency === currency));
    const groups = new Map();
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
function calculateSale(lines, amountPaid, options = {}) {
    if (!lines.length)
        throw new Error("A sale must contain at least one item");
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
    const orderDiscountMinor = Math.round(orderDiscount * exports.MONEY_SCALE);
    const discountableMinor = Math.round(discountableSubtotal * exports.MONEY_SCALE);
    let allocatedOrderDiscountMinor = 0;
    const allocated = baseLines.map((line, index) => {
        const lineBase = roundMoney(line.lineSubtotal - line.lineDiscount);
        const lineBaseMinor = Math.round(lineBase * exports.MONEY_SCALE);
        const allocation = index === baseLines.length - 1
            ? orderDiscountMinor - allocatedOrderDiscountMinor
            : discountableMinor > 0
                ? Math.floor(orderDiscountMinor * lineBaseMinor / discountableMinor)
                : 0;
        allocatedOrderDiscountMinor += allocation;
        return { ...line, orderDiscountAllocation: allocation / exports.MONEY_SCALE };
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
