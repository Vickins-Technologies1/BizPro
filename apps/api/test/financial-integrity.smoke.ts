import assert from "node:assert/strict";
import { assertCurrencyAmount, assertInitialPayment, assertInvoiceDiscount, assertLineDiscount, assertPaymentMethod, assertSubsequentPayment, assertTaxRate, assertUnitPrice, calculateGrossProfit, calculateNetProfit, calculateSale, calculateTax, PAYMENT_METHODS, roundMoney } from "@vbo/shared";
import { calculateBankBalance, calculatePettyCashBalance, reconcileCachedBalance } from "../src/modules/finance/reconciliation";
import { calculateCustomerCredit, calculateCustomerOutstanding, reconcileCustomerBalance } from "../src/modules/customers/customer-balance";
import { calculateOutstanding } from "@vbo/shared";
import { assertPaymentRequestMatches, assertPaymentStateTransition, buildPaymentRequestFingerprint, eligiblePaymentMatch } from "../src/common/payment-integrity";
import { WebhooksService } from "../src/modules/webhooks/webhooks.service";
import { deriveInvoiceLifecycleStatus, isActiveInvoiceReceivable } from "../src/modules/invoices/invoice-lifecycle";
import { InvoicesService } from "../src/modules/invoices/invoices.service";

async function main() {
  const sale = calculateSale([{ quantity: 1, unitPrice: 800, unitCost: 500 }], 800);
  assert.equal(sale.subtotal, 800);
  assert.equal(sale.grandTotal, 800);
  assert.equal(sale.balanceDue, 0);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);

  const discounted = calculateSale([{ quantity: 2, unitPrice: 100, unitCost: 40, discount: 10, tax: 5 }], 100);
  assert.equal(discounted.subtotal, 200);
  assert.equal(discounted.discountTotal, 10);
  assert.equal(discounted.taxTotal, 5);
  assert.equal(discounted.grandTotal, 195);
  assert.equal(discounted.balanceDue, 95);

  assert.throws(() => calculateSale([{ quantity: 0, unitPrice: 100, unitCost: 50 }], 0), /greater than zero/);
  assert.throws(() => calculateSale([{ quantity: -1, unitPrice: 100, unitCost: 50 }], 0), /greater than zero/);
  assert.throws(() => calculateSale([{ quantity: 1, unitPrice: 100, unitCost: 50 }], 101), /at most/);
  assert.throws(() => calculateSale([{ quantity: 1, unitPrice: 100, unitCost: 50, discount: 101 }], 0), /at most/);
  assert.throws(() => calculateSale([{ quantity: 1, unitPrice: -1, unitCost: 0 }], 0), /at least/);
  assert.throws(() => calculateSale([{ quantity: 1, unitPrice: 10.001, unitCost: 0 }], 0), /decimal places/);
  assert.equal(calculateSale([{ quantity: 1, unitPrice: 100, unitCost: 20, discount: 100 }], 0).grandTotal, 0);

  const orderDiscounted = calculateSale([
    { quantity: 1, unitPrice: 100, unitCost: 20 },
    { quantity: 1, unitPrice: 100, unitCost: 20 }
  ], 50, { orderDiscount: 3.01, taxRate: 16 });
  assert.equal(orderDiscounted.discountTotal, 3.01);
  assert.equal(orderDiscounted.taxTotal, 31.52);
  assert.equal(orderDiscounted.grandTotal, 228.51);
  assert.equal(orderDiscounted.amountPaid, 50);
  assert.equal(orderDiscounted.balanceDue, 178.51);
  assert.equal(orderDiscounted.lines.reduce((sum, line) => sum + line.orderDiscountAllocation, 0), 3.01);

  const taxInclusive = calculateSale([{ quantity: 1, unitPrice: 116, unitCost: 20 }], 116, { taxRate: 16, taxInclusive: true });
  assert.equal(taxInclusive.taxTotal, 16);
  assert.equal(taxInclusive.grandTotal, 116);
  assert.throws(() => calculateSale([{ quantity: 1, unitPrice: 10, unitCost: 0 }], 0, { orderDiscount: 10.01 }), /at most/);
  assert.throws(() => assertCurrencyAmount(1.001, "amount", { min: 0 }), /decimal places/);
  assert.equal(assertPaymentMethod("cash", PAYMENT_METHODS), "cash");
  assert.throws(() => assertPaymentMethod("wireless", PAYMENT_METHODS), /not supported/);
  assert.equal(assertUnitPrice(0), 0);
  assert.equal(assertLineDiscount(100, 100), 100);
  assert.equal(assertInvoiceDiscount(100, 100, "percentage"), 100);
  assert.equal(assertInitialPayment(0, 100), 0);
  assert.throws(() => assertInitialPayment(100.01, 100), /at most/);
  assert.equal(assertSubsequentPayment(100, 100), 100);
  assert.equal(assertTaxRate(1000), 1000);

  assert.equal(calculateGrossProfit(800, 500), 300);
  assert.equal(calculateNetProfit(300, 75), 225);
  assert.equal(calculateTax(100, 16), 16);
  assert.equal(calculateTax(100, 16, true), 13.79);
  assert.equal(calculateBankBalance(1000, [{ amount: 250, direction: "in" }, { amount: 100, direction: "out" }]), 1150);
  assert.equal(calculatePettyCashBalance(500, [{ amount: 50, direction: "in" }, { amount: 20, direction: "out" }]), 530);
  assert.equal(reconcileCachedBalance(1150, 1150).isMatch, true);
  assert.equal(calculateCustomerOutstanding({ sales: [{ balanceDue: 100 }], invoices: [{ balanceDue: 50 }], standalonePayments: [{ amount: 25 }] }), 150);
  const customerAReceivable = calculateCustomerOutstanding({ sales: [{ id: "sale-a", balanceDue: 0 }], standalonePayments: [{ amount: 150 }] });
  const customerBReceivable = calculateCustomerOutstanding({ sales: [{ id: "sale-b", balanceDue: 200 }] });
  assert.equal(customerAReceivable, 0, "customer A's unallocated overpayment remains credit");
  assert.equal(customerBReceivable, 200, "customer A's credit never reduces customer B's debt");
  assert.equal(calculateCustomerCredit([{ amount: 150 }]), 150);
  assert.equal(calculateCustomerCredit([{ amount: 100 }, { amount: -100 }]), 0, "a reversed unallocated payment leaves no credit");
  assert.equal(reconcileCustomerBalance(125, 125).isMatch, true);
  assert.equal(calculateOutstanding([{ id: "sale-1", source: "sale", balanceDue: 1000, linkedReceivableId: "sale-1" }, { id: "invoice-1", source: "invoice", balanceDue: 1000, linkedReceivableId: "sale-1" }]), 1000);
  assert.equal(calculateOutstanding([{ id: "sale-2", source: "sale", balanceDue: 1000, linkedReceivableId: "sale-2" }]), 1000);
  assert.equal(calculateCustomerOutstanding({ sales: [{ id: "sale-3", balanceDue: 600 }], invoices: [{ id: "invoice-3", saleId: "sale-3", balanceDue: 600 }] }), 600);
  assert.equal(calculateCustomerOutstanding({ sales: [{ _id: "sale-db-1", externalId: "sale-ext-1", balanceDue: 100 }], invoices: [{ id: "invoice-legacy", saleId: "sale-db-1", balanceDue: 60 }] }), 60);
  assert.equal(calculateCustomerOutstanding({ sales: [{ _id: "sale-db-1", externalId: "sale-ext-1", balanceDue: 100 }], invoices: [{ id: "invoice-current", saleId: "sale-ext-1", balanceDue: 60 }] }), 60);
  assert.equal(calculateCustomerOutstanding({ invoices: [{ id: "invoice-4", balanceDue: 800 }] }), 800);
  assert.equal(calculateCustomerOutstanding({ sales: [{ id: "sale-5", balanceDue: 1000 }], standalonePayments: [{ amount: 400 }] }), 1000, "unallocated payment remains credit until assigned to a sale or invoice");
  assert.equal(calculateOutstanding([{ id: "sale-deleted", source: "sale", balanceDue: 1000, active: false }]), 0);
  assert.equal(calculateOutstanding([
    { id: "sale-draft", source: "sale", balanceDue: 400, linkedReceivableId: "sale-draft" },
    { id: "invoice-draft", source: "invoice", balanceDue: 0, linkedReceivableId: "sale-draft", active: false }
  ]), 400);
  assert.equal(deriveInvoiceLifecycleStatus({ status: "draft", amountPaid: 100, balanceDue: 0, dueDate: "2026-01-01" }), "draft");
  assert.equal(deriveInvoiceLifecycleStatus({ status: "sent", amountPaid: 25, balanceDue: 75, dueDate: "2026-12-01", sentAt: "2026-10-01" }, new Date("2026-10-31")), "partially_paid");
  assert.equal(deriveInvoiceLifecycleStatus({ status: "partially_paid", amountPaid: 25, balanceDue: 75, dueDate: "2026-10-01", sentAt: "2026-09-01" }, new Date("2026-10-31")), "overdue");
  assert.equal(deriveInvoiceLifecycleStatus({ status: "sent", amountPaid: 100, balanceDue: 0, dueDate: "2026-01-01", sentAt: "2025-12-01" }, new Date("2026-10-31")), "paid");
  assert.equal(isActiveInvoiceReceivable("draft"), false);
  assert.equal(isActiveInvoiceReceivable("sent"), true);

  const invoiceDoc: any = {
    _id: "invoice-db-1", externalId: "invoice-1", businessId: "biz-1", branchId: null,
    customerId: "customer-1", invoiceNumber: "INV-1", issueDate: new Date("2026-10-01"), dueDate: new Date("2026-11-01"),
    currency: "KES", status: "sent", grandTotal: 100, amountPaid: 40, balanceDue: 60,
    sentAt: new Date("2026-10-01"), viewedAt: null, lineItems: [], payments: [], history: [],
    save: async () => undefined,
    toObject() { return { ...this }; }
  };
  const customerDoc: any = { balance: 60, save: async () => undefined };
  let createdCredit: any = null;
  const query = (value: any) => ({ session() { return Promise.resolve(value); }, sort() { return this; }, lean() { return Promise.resolve([]); } });
  const invoiceModel: any = { findOne: () => query(invoiceDoc) };
  const creditNoteModel: any = {
    create: async ([note]: any[]) => { createdCredit = { ...note, _id: "credit-db-1", save: async () => undefined, toObject() { return { ...this }; } }; return [createdCredit]; },
    findOne: () => query(createdCredit),
    find: () => query([])
  };
  const debitNoteModel: any = { find: () => query([]) };
  const paymentModel: any = { find: () => query([]) };
  const customerModel: any = { findOne: () => query(customerDoc) };
  const service = new InvoicesService(
    invoiceModel, debitNoteModel, paymentModel, customerModel, {} as any, creditNoteModel,
    { create: async () => undefined } as any, {} as any,
    { startSession: async () => ({ withTransaction: async (work: () => Promise<void>) => work(), endSession: async () => undefined }) } as any,
    {} as any, { creditNote: async () => ({ status: "not_configured" }) } as any
  );
  const draftedCredit = await service.createCreditNote({ businessId: "biz-1", invoiceId: "invoice-1", reference: "CN-1", amount: 20, reason: "returned item", creditDate: new Date("2026-10-31") });
  assert.equal(invoiceDoc.balanceDue, 60, "draft credit notes do not change invoice receivables");
  assert.equal(customerDoc.balance, 60, "draft credit notes do not change customer balances");
  assert.equal(draftedCredit.creditNote.status, "draft");
  await service.issueCreditNote("biz-1", "invoice-1", "credit-db-1");
  assert.equal(invoiceDoc.balanceDue, 40);
  assert.equal(customerDoc.balance, 40);
  await assert.rejects(() => service.issueCreditNote("biz-1", "invoice-1", "credit-db-1"), /Only draft credit notes/);
  await service.voidCreditNote("biz-1", "invoice-1", "credit-db-1");
  assert.equal(invoiceDoc.balanceDue, 60, "voiding an issued credit note compensates the invoice exactly once");
  assert.equal(customerDoc.balance, 60, "voiding an issued credit note restores the customer balance exactly once");

  const branchSaleId = "64b3e9f0d8e4c5a123456789";
  let linkedSaleFilter: any;
  const branchBusiness: any = { currency: "KES", invoiceSettings: { autoGenerate: true, nextNumber: 1 }, save: async () => undefined };
  const branchService = new InvoicesService(
    { findOne: () => { throw new Error("Invoice duplicate check should not run before sale validation"); } } as any,
    {} as any, {} as any, {} as any,
    { findOne: () => ({ session: async () => branchBusiness }) } as any,
    {} as any, {} as any,
    { findOne: (filter: any) => { linkedSaleFilter = filter; return { session: async () => null }; } } as any,
    { startSession: async () => ({ withTransaction: async (work: () => Promise<void>) => work(), endSession: async () => undefined }) } as any,
    {} as any, {} as any
  );
  await assert.rejects(() => branchService.create({
    businessId: "biz-1", branchId: "branch-2", saleId: branchSaleId,
    issueDate: new Date("2026-10-01"), dueDate: new Date("2026-11-01"), paymentTerms: "30 days", currency: "KES",
    lineItems: [{ description: "item", quantity: 1, unit: "pcs", unitPrice: 10 }]
  }, { role: "owner", branchId: null }), /Linked sale not found/);
  assert.equal(linkedSaleFilter.businessId, "biz-1");
  assert.deepEqual(linkedSaleFilter.$and, [
    { $or: [{ _id: branchSaleId }, { externalId: branchSaleId }] },
    { $or: [{ branchId: "branch-2" }, { branchId: null }] }
  ], "sale identity and branch scope must both constrain invoice linking");
  assert.equal(calculateCustomerOutstanding({ invoices: [{ id: "invoice-paid", balanceDue: 0 }], standalonePayments: [] }), 0);

  const paymentFingerprint = buildPaymentRequestFingerprint({ operation: "invoice_payment", businessId: "biz-1", targetId: "invoice-1", customerId: "customer-1", amount: 10, currency: "kes", method: "cash", reference: "r1" });
  assert.doesNotThrow(() => assertPaymentRequestMatches({ requestFingerprint: paymentFingerprint }, paymentFingerprint));
  assert.throws(() => assertPaymentRequestMatches({ requestFingerprint: paymentFingerprint }, `${paymentFingerprint}changed`), /different payment request/);
  assert.throws(() => assertPaymentRequestMatches({}, paymentFingerprint), /different payment request/);
  assert.doesNotThrow(() => assertPaymentStateTransition("reconciliation_pending", "reconciled"));
  assert.throws(() => assertPaymentStateTransition("failed", "reconciled"), /Invalid payment transition/);
  assert.deepEqual(eligiblePaymentMatch().$or[0], { paymentState: { $in: ["posted", "reconciled", "reversed", "refunded"] } });

  const reconciliationLogs: Array<Record<string, unknown>> = [];
  const webhook = new WebhooksService(
    { create: async () => ({ _id: "webhook-log" }), findByIdAndUpdate: async () => undefined } as any,
    { create: async (entry: Record<string, unknown>) => { reconciliationLogs.push(entry); } } as any,
    { findOneAndUpdate: async () => { throw new Error("Unverified callbacks must not mutate payments"); } } as any
  );
  assert.deepEqual(await webhook.receiveTuma({ reference: "untrusted-ref", amount: 10, result: "success" }), { ok: true, status: "pending_verification" });
  assert.deepEqual(await webhook.receiveTuma({ reference: "untrusted-ref", amount: 10, result: "success" }), { ok: true, status: "pending_verification" });
  assert.equal(reconciliationLogs.length, 2, "callbacks are candidates until authenticated and verified");

  console.log("Financial integrity smoke tests passed");
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
