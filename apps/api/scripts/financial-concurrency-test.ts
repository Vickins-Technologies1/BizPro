import assert from "node:assert/strict";
import mongoose from "mongoose";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { SalesService } from "../src/modules/sales/sales.service";
import { AuditLog, AuditLogSchema, Business, BusinessSchema, CreditNote, CreditNoteSchema, Customer, CustomerSchema, DebitNote, DebitNoteSchema, Invoice, InvoiceSchema, Payment, PaymentSchema, Product, ProductSchema, Sale, SaleSchema, StockMovement, StockMovementSchema } from "../src/modules/schemas";
import { InvoicesService } from "../src/modules/invoices/invoices.service";

const expectedDatabase = "vbo_financial_test_phase6b";
const expectedHost = "127.0.0.1";
const expectedPort = "27018";

function assertIsolatedTestUri(uri: string) {
  const parsed = new URL(uri);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (parsed.protocol !== "mongodb:" || parsed.hostname !== expectedHost || parsed.port !== expectedPort || database !== expectedDatabase) {
    throw new Error(`Refusing financial integration tests: MONGODB_TEST_URI must target mongodb://${expectedHost}:${expectedPort}/${expectedDatabase} only`);
  }
}

async function expectRejected(operation: () => Promise<unknown>, expected: new (...args: any[]) => Error, label: string) {
  let caught: unknown;
  try { await operation(); } catch (error) { caught = error; }
  assert.ok(caught instanceof expected, `${label} should reject with ${expected.name}`);
}

async function main() {
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error("MONGODB_TEST_URI is required; refusing to run database tests against an unspecified target");
  assertIsolatedTestUri(uri);
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
  try {
    const hello = await connection.db!.admin().command({ hello: 1 });
    if (hello.setName !== "diraFinancialTest" || !hello.isWritablePrimary) throw new Error("Expected the isolated writable diraFinancialTest replica set");
    await connection.dropDatabase();
    const BusinessModel = connection.model(Business.name, BusinessSchema);
    const CustomerModel = connection.model(Customer.name, CustomerSchema);
    const PaymentModel = connection.model(Payment.name, PaymentSchema);
    const SaleModel = connection.model(Sale.name, SaleSchema);
    const ProductModel = connection.model(Product.name, ProductSchema);
    const MovementModel = connection.model(StockMovement.name, StockMovementSchema);
    const InvoiceModel = connection.model(Invoice.name, InvoiceSchema);
    const DebitNoteModel = connection.model(DebitNote.name, DebitNoteSchema);
    const CreditNoteModel = connection.model(CreditNote.name, CreditNoteSchema);
    const AuditLogModel = connection.model(AuditLog.name, AuditLogSchema);
    await Promise.all([PaymentModel.init(), SaleModel.init(), InvoiceModel.init()]);
    const business = await BusinessModel.create({ name: "Phase 6B isolated test business", slug: "phase6b-finance-test", businessType: "retail_shop", planTier: "command", currency: "KES", deletedAt: null });
    const [customerA, customerB] = await CustomerModel.create([
      { businessId: business._id.toString(), externalId: "customer-a", name: "Customer A", balance: 100, deletedAt: null },
      { businessId: business._id.toString(), externalId: "customer-b", name: "Customer B", balance: 45, deletedAt: null }
    ]);
    const sale = await SaleModel.create({
      businessId: business._id.toString(), externalId: "sale-a", receiptNumber: "TEST-A-001", customerId: customerA.externalId,
      subtotal: 100, discountTotal: 0, taxTotal: 0, grandTotal: 100, amountPaid: 0, balanceDue: 100,
      paymentStatus: "credit", paymentMethod: "credit", currency: "KES", items: [], deletedAt: null
    });
    const service = new SalesService(SaleModel as never, PaymentModel as never, MovementModel as never, ProductModel as never, CustomerModel as never, connection as never, BusinessModel as never);
    const invoiceService = new InvoicesService(InvoiceModel as never, DebitNoteModel as never, PaymentModel as never, CustomerModel as never, BusinessModel as never, CreditNoteModel as never, AuditLogModel as never, SaleModel as never, connection as never, undefined as never, undefined as never);
    const common = { businessId: business._id.toString(), saleId: sale._id.toString(), method: "cash" as const };
    await expectRejected(() => service.recordPayment({ ...common, externalId: "bad-negative", amount: -1 }), BadRequestException, "negative payment");
    await expectRejected(() => service.recordPayment({ ...common, externalId: "bad-overpay", amount: 101 }), BadRequestException, "overpayment");
    await service.recordPayment({ ...common, externalId: "pay-first", amount: 60 });
    const partial = await SaleModel.findById(sale._id).lean();
    assert.equal(partial?.amountPaid, 60);
    assert.equal(partial?.balanceDue, 40);
    assert.equal((await CustomerModel.findById(customerA._id).lean())?.balance, 40);
    const duplicateRetries = await Promise.all([
      service.recordPayment({ ...common, externalId: "pay-retry", amount: 10 }),
      service.recordPayment({ ...common, externalId: "pay-retry", amount: 10 })
    ]);
    assert.equal(duplicateRetries[0].payment._id.toString(), duplicateRetries[1].payment._id.toString());
    assert.equal(await PaymentModel.countDocuments({ businessId: business._id.toString(), externalId: "pay-retry" }), 1);
    await expectRejected(() => service.recordPayment({ ...common, externalId: "pay-retry", amount: 11 }), ConflictException, "conflicting idempotency retry");
    const competing = await Promise.allSettled([
      service.recordPayment({ ...common, externalId: "pay-concurrent-a", amount: 20 }),
      service.recordPayment({ ...common, externalId: "pay-concurrent-b", amount: 20 })
    ]);
    const finalSale = await SaleModel.findById(sale._id).lean();
    assert.ok(finalSale);
    assert.ok(finalSale.balanceDue >= 0);
    assert.equal(finalSale.amountPaid + finalSale.balanceDue, finalSale.grandTotal);
    assert.equal(await PaymentModel.countDocuments({ businessId: business._id.toString(), saleId: sale._id.toString(), paymentState: "posted" }), 2 + competing.filter((item) => item.status === "fulfilled").length);
    assert.equal((await CustomerModel.findById(customerB._id).lean())?.balance, 45, "Customer A payment must not change Customer B balance");

    const invoice = await InvoiceModel.create({
      businessId: business._id.toString(), externalId: "invoice-a", saleId: "synthetic-sale-for-invoice-a", invoiceNumber: "TEST-INV-001", customerId: customerA.externalId,
      issueDate: new Date(), dueDate: new Date(Date.now() + 86400000), paymentTerms: "Due on receipt", currency: "KES",
      status: "sent", subtotal: 50, discountTotal: 0, taxableAmount: 50, taxTotal: 0, grandTotal: 50, amountPaid: 0,
      balanceDue: 50, lineItems: [], payments: [], history: [], sentAt: new Date(), deletedAt: null
    });
    const invoiceCommon = { businessId: business._id.toString(), invoiceId: invoice._id.toString(), paymentDate: new Date() };
    await expectRejected(() => invoiceService.recordPayment({ ...invoiceCommon, externalId: "invoice-overpay", amount: 51, method: "cash" }), BadRequestException, "invoice overpayment");
    await invoiceService.recordPayment({ ...invoiceCommon, externalId: "invoice-partial", amount: 20, method: "cash" });
    const partialInvoice = await InvoiceModel.findById(invoice._id).lean();
    assert.equal(partialInvoice?.amountPaid, 20);
    assert.equal(partialInvoice?.balanceDue, 30);
    assert.equal(partialInvoice?.status, "partially_paid");
    const invoiceRetry = await invoiceService.recordPayment({ ...invoiceCommon, externalId: "invoice-partial", amount: 20, method: "cash" });
    assert.equal(invoiceRetry.payment.id, "invoice-partial");
    assert.equal(await PaymentModel.countDocuments({ businessId: business._id.toString(), externalId: "invoice-partial" }), 1);
    await expectRejected(() => invoiceService.recordPayment({ ...invoiceCommon, externalId: "invoice-partial", amount: 21, method: "cash" }), ConflictException, "conflicting invoice idempotency retry");
    await invoiceService.recordPayment({ ...invoiceCommon, externalId: "invoice-settle", amount: 30, method: "cash" });
    const settledInvoice = await InvoiceModel.findById(invoice._id).lean();
    assert.equal(settledInvoice?.amountPaid, 50);
    assert.equal(settledInvoice?.balanceDue, 0);
    assert.equal(settledInvoice?.status, "paid");

    const concurrentInvoice = await InvoiceModel.create({
      businessId: business._id.toString(), externalId: "invoice-concurrent", saleId: "synthetic-sale-for-invoice-concurrent", invoiceNumber: "TEST-INV-003", customerId: customerA.externalId,
      issueDate: new Date(), dueDate: new Date(Date.now() + 86400000), paymentTerms: "Due on receipt", currency: "KES",
      status: "sent", subtotal: 30, discountTotal: 0, taxableAmount: 30, taxTotal: 0, grandTotal: 30, amountPaid: 0,
      balanceDue: 30, lineItems: [], payments: [], history: [], sentAt: new Date(), deletedAt: null
    });
    const concurrentInvoiceResults = await Promise.allSettled([
      invoiceService.recordPayment({ businessId: business._id.toString(), invoiceId: concurrentInvoice._id.toString(), externalId: "invoice-concurrent-a", amount: 20, method: "cash", paymentDate: new Date() }),
      invoiceService.recordPayment({ businessId: business._id.toString(), invoiceId: concurrentInvoice._id.toString(), externalId: "invoice-concurrent-b", amount: 20, method: "cash", paymentDate: new Date() })
    ]);
    const finalConcurrentInvoice = await InvoiceModel.findById(concurrentInvoice._id).lean();
    assert.ok(finalConcurrentInvoice);
    assert.equal(concurrentInvoiceResults.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(finalConcurrentInvoice.amountPaid, 20);
    assert.equal(finalConcurrentInvoice.balanceDue, 10);
    assert.equal(finalConcurrentInvoice.status, "partially_paid");

    const mpesaInvoice = await InvoiceModel.create({
      businessId: business._id.toString(), externalId: "invoice-mpesa", saleId: "synthetic-sale-for-invoice-mpesa", invoiceNumber: "TEST-INV-002", customerId: customerA.externalId,
      issueDate: new Date(), dueDate: new Date(Date.now() + 86400000), paymentTerms: "Due on receipt", currency: "KES",
      status: "sent", subtotal: 25, discountTotal: 0, taxableAmount: 25, taxTotal: 0, grandTotal: 25, amountPaid: 0,
      balanceDue: 25, lineItems: [], payments: [], history: [], sentAt: new Date(), deletedAt: null
    });
    await invoiceService.recordPayment({ businessId: business._id.toString(), invoiceId: mpesaInvoice._id.toString(), externalId: "invoice-mpesa-pending", amount: 25, method: "mpesa", paymentDate: new Date(), reference: "test-provider-reference" });
    const pendingMpesaInvoice = await InvoiceModel.findById(mpesaInvoice._id).lean();
    const pendingMpesaPayment = await PaymentModel.findOne({ externalId: "invoice-mpesa-pending" }).lean();
    assert.equal(pendingMpesaInvoice?.amountPaid, 0, "pending M-Pesa must not post to the invoice balance");
    assert.equal(pendingMpesaInvoice?.balanceDue, 25);
    assert.equal(pendingMpesaPayment?.paymentState, "reconciliation_pending");
    assert.equal(pendingMpesaPayment?.status, "pending_confirmation");
    console.log(JSON.stringify({
      status: "PASS", database: expectedDatabase, replicaSet: hello.setName,
      scenarios: ["real SalesService partial payment", "negative and overpayment rejection", "same-key concurrent idempotent retry", "conflicting idempotency key rejected", "two concurrent sale payments preserve balance", "customer debt isolation", "real InvoicesService partial and final settlement", "invoice overpayment rejection", "invoice idempotent retry and conflict", "two concurrent invoice payments preserve balance", "unconfirmed M-Pesa stays pending"],
      concurrentDifferentKeyResults: competing.map((item) => item.status),
      finalSale: { amountPaid: finalSale.amountPaid, balanceDue: finalSale.balanceDue, paymentStatus: finalSale.paymentStatus }
    }, null, 2));
  } finally {
    await connection.dropDatabase();
    await connection.close();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Financial database integration test failed"); process.exitCode = 1; });
