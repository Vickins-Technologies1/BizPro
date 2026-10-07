"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateOutstandingBalance = exports.calculateNetProfit = exports.calculateGrossProfit = exports.FINANCIAL_CALCULATION_VERSION = exports.MONEY_SCALE = void 0;
exports.isFiniteNumber = isFiniteNumber;
exports.roundMoney = roundMoney;
exports.assertMoney = assertMoney;
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
function calculateSale(lines, amountPaid) {
    if (!lines.length)
        throw new Error("A sale must contain at least one item");
    const calculatedLines = lines.map((line) => {
        if (!isFiniteNumber(line.quantity) || line.quantity <= 0)
            throw new Error("Sale quantities must be greater than zero");
        const quantity = line.quantity;
        const unitPrice = assertMoney(line.unitPrice, "unitPrice", { min: 0 });
        const unitCost = assertMoney(line.unitCost, "unitCost", { min: 0 });
        const lineSubtotal = roundMoney(unitPrice * quantity);
        const lineDiscount = assertMoney(line.discount ?? 0, "discount", { min: 0, max: lineSubtotal });
        const lineTax = assertMoney(line.tax ?? 0, "tax", { min: 0 });
        const lineTotal = roundMoney(lineSubtotal - lineDiscount + lineTax);
        return { ...line, quantity, unitPrice, unitCost, lineSubtotal, lineDiscount, lineTax, lineTotal };
    });
    const subtotal = roundMoney(calculatedLines.reduce((sum, line) => sum + line.lineSubtotal, 0));
    const discountTotal = roundMoney(calculatedLines.reduce((sum, line) => sum + line.lineDiscount, 0));
    const taxTotal = roundMoney(calculatedLines.reduce((sum, line) => sum + line.lineTax, 0));
    const grandTotal = roundMoney(calculatedLines.reduce((sum, line) => sum + line.lineTotal, 0));
    const paid = assertMoney(amountPaid, "amountPaid", { min: 0, max: grandTotal });
    return { lines: calculatedLines, subtotal, discountTotal, taxTotal, grandTotal, amountPaid: paid, balanceDue: roundMoney(grandTotal - paid) };
}
