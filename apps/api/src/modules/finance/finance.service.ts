import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import { endOfDay, parseISO, startOfDay } from "date-fns";
import {
  BankAccount,
  BankAccountDocument,
  BankTransaction,
  BankTransactionDocument,
  CreditNote,
  CreditNoteDocument,
  Customer,
  CustomerDocument,
  Expense,
  ExpenseDocument,
  Invoice,
  InvoiceDocument,
  Payment,
  PaymentDocument,
  PettyCashEntry,
  PettyCashEntryDocument,
  AuditLog,
  AuditLogDocument,
  Sale,
  SaleDocument
} from "../schemas";
import { toSafeIsoDateString, toSafeIsoString } from "../../common/date-normalizer";
import type {
  BankAccount as BankAccountView,
  CreditNote as CreditNoteView,
  FinanceInvoice,
  FinanceOverview,
  FinancePayment,
  PettyCashEntry as PettyCashEntryView
} from "@vbo/shared";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";
import { calculateGrossProfit, calculateNetProfit, calculateOutstanding, roundMoney } from "@vbo/shared";
import { runInTransaction } from "../../common/mongo-transaction";
import { assertPaymentStateTransition, eligiblePaymentMatch, type PaymentLifecycleState } from "../../common/payment-integrity";
import { deriveInvoiceLifecycleStatus } from "../invoices/invoice-lifecycle";

type DateRange = Record<string, Date>;

@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(BankAccount.name) private readonly bankAccountModel: Model<BankAccountDocument>,
    @InjectModel(PettyCashEntry.name) private readonly pettyCashModel: Model<PettyCashEntryDocument>,
    @InjectModel(CreditNote.name) private readonly creditNoteModel: Model<CreditNoteDocument>,
    @InjectModel(BankTransaction.name) private readonly bankTransactionModel: Model<BankTransactionDocument>,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>
  ) {}

  async overview(businessId: string, from?: string, to?: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const saleRange = buildDateRange(from, to);
    const expenseRange = buildDateRange(from, to);
    const paymentRange = buildDateRange(from, to);
    const entryRange = buildDateRange(from, to);
    const invoiceRange = buildDateRange(from, to);

    const [sales, receivableSales, expenseTotals, payments, pendingPayments, failedPayments, standalonePayments, creditNotes, bankAccounts, pettyCashEntries, invoices, receivableInvoices] = await Promise.all([
      this.saleModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId), ...(saleRange ? { createdAt: saleRange } : {}) }).lean(),
      this.saleModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).select({ _id: 1, externalId: 1, balanceDue: 1, currency: 1 }).lean(),
      this.expenseModel.aggregate([{ $match: { businessId, deletedAt: null, ...buildBranchMatch(branchId), ...(expenseRange ? { expenseDate: expenseRange } : {}) } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      this.paymentModel.aggregate([{ $match: { businessId, deletedAt: null, method: { $ne: "credit" }, ...(paymentRange ? { createdAt: paymentRange } : {}), $and: [eligiblePaymentMatch(), buildBranchMatch(branchId)] } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      this.paymentModel.aggregate([{ $match: { businessId, deletedAt: null, ...(paymentRange ? { createdAt: paymentRange } : {}), $and: [{ $or: [{ paymentState: "reconciliation_pending" }, { paymentState: { $exists: false }, status: "pending_confirmation" }] }, buildBranchMatch(branchId)] } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      this.paymentModel.aggregate([{ $match: { businessId, deletedAt: null, ...(paymentRange ? { createdAt: paymentRange } : {}), $and: [{ $or: [{ paymentState: "failed" }, { paymentState: { $exists: false }, status: "failed" }] }, buildBranchMatch(branchId)] } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      this.paymentModel.aggregate([{ $match: { businessId, method: { $ne: "credit" }, saleId: null, invoiceId: null, customerId: { $ne: null }, deletedAt: null, $and: [eligiblePaymentMatch(), buildBranchMatch(branchId)] } }, { $group: { _id: "$customerId", total: { $sum: "$amount" } } }]),
      this.creditNoteModel.find({ businessId, deletedAt: null, status: { $in: ["issued", "void"] }, ...buildBranchMatch(branchId) }).select({ amount: 1, status: 1, creditDate: 1, issuedAt: 1, voidedAt: 1 }).lean(),
      this.bankAccountModel.find({ businessId, deletedAt: null }).lean(),
      this.pettyCashModel.find({ businessId, deletedAt: null, ...(entryRange ? { entryDate: entryRange } : {}) }).lean(),
      this.invoiceModel.find({ businessId, deletedAt: null, status: { $nin: ["draft", "void", "cancelled", "archived"] }, ...buildBranchMatch(branchId), ...(invoiceRange ? { issueDate: invoiceRange } : {}) }).lean(),
      this.invoiceModel.find({ businessId, deletedAt: null, status: { $nin: ["draft", "void", "cancelled", "archived"] }, ...buildBranchMatch(branchId) }).select({ _id: 1, externalId: 1, saleId: 1, balanceDue: 1, currency: 1 }).lean()
    ]);

    const incomeTotal = roundMoney(sales.reduce((sum, sale) => sum + Number(sale.grandTotal ?? 0) - Number(sale.taxTotal ?? 0), 0));
    const cogsTotal = sales.reduce(
      (sum, sale) =>
        sum +
        (Array.isArray(sale.items)
          ? sale.items.reduce((lineSum: number, item: { costPrice: number; quantity: number }) => lineSum + Number(item.costPrice ?? 0) * Number(item.quantity ?? 0), 0)
          : 0),
      0
    );
    const expensesTotal = expenseTotals[0]?.total ?? 0;
    const paymentTotal = payments[0]?.total ?? 0;
    const eventFallsInRange = (value: Date | string | null | undefined) => {
      if (!value) return false;
      if (!entryRange) return true;
      const date = new Date(value).getTime();
      if (!Number.isFinite(date)) return false;
      return (!entryRange.$gte || date >= entryRange.$gte.getTime()) && (!entryRange.$lte || date <= entryRange.$lte.getTime());
    };
    const creditNoteTotal = roundMoney(creditNotes.reduce((sum, note) => {
      const issuedAt = note.issuedAt ?? (note.status === "issued" ? note.creditDate : null);
      let total = sum;
      if (eventFallsInRange(issuedAt)) total += Number(note.amount ?? 0);
      if (eventFallsInRange(note.voidedAt)) total -= Number(note.amount ?? 0);
      return total;
    }, 0));
    const creditNoteCount = creditNotes.filter((note) => eventFallsInRange(note.issuedAt ?? (note.status === "issued" ? note.creditDate : null)) || eventFallsInRange(note.voidedAt)).length;
    const bankBalanceTotal = bankAccounts.reduce((sum, account) => sum + Number(account.currentBalance ?? account.openingBalance ?? 0), 0);
    const pettyCashBalance = pettyCashEntries.reduce((sum, entry) => sum + (entry.direction === "in" ? Number(entry.amount ?? 0) : -Number(entry.amount ?? 0)), 0);
    const invoiceCount = invoices.length;
    const customerCreditTotal = roundMoney(standalonePayments.reduce((sum, row) => sum + Math.max(0, Number(row.total ?? 0)), 0));
    const saleAliases = new Map<string, string>();
    for (const sale of receivableSales) {
      saleAliases.set(String(sale._id), String(sale._id));
      if (sale.externalId) saleAliases.set(String(sale.externalId), String(sale._id));
    }
    const outstandingReceivables = [
      ...receivableSales.map((sale) => ({ id: String(sale.externalId ?? sale._id), source: "sale" as const, balanceDue: sale.balanceDue, currency: sale.currency, linkedReceivableId: String(sale._id) })),
      ...receivableInvoices.map((invoice) => ({ id: String(invoice.externalId ?? invoice._id), source: "invoice" as const, balanceDue: invoice.balanceDue, currency: invoice.currency, linkedReceivableId: invoice.saleId ? saleAliases.get(String(invoice.saleId)) ?? invoice.saleId : null }))
    ];
    const invoiceTotal = calculateOutstanding(outstandingReceivables);
    const saleTaxTotal = sales.reduce((sum, sale) => sum + Number(sale.taxTotal ?? 0), 0);
    const standaloneInvoiceTaxTotal = invoices
      .filter((invoice) => !invoice.saleId)
      .reduce((sum, invoice) => sum + Number((invoice as { taxTotal?: number }).taxTotal ?? 0), 0);
    const taxTotal = roundMoney(saleTaxTotal + standaloneInvoiceTaxTotal);
    const profitLossTotal = calculateNetProfit(calculateGrossProfit(incomeTotal, cogsTotal), expensesTotal);
    const cashFlowTotal = roundMoney(paymentTotal - expensesTotal + pettyCashBalance);

    return {
      incomeTotal,
      expensesTotal,
      profitLossTotal,
      cashFlowTotal,
      taxTotal,
      invoiceCount,
      invoiceTotal,
      customerCreditTotal,
      pendingPaymentTotal: roundMoney(Number(pendingPayments[0]?.total ?? 0)),
      failedPaymentTotal: roundMoney(Number(failedPayments[0]?.total ?? 0)),
      creditNoteCount,
      creditNoteTotal,
      paymentTotal,
      bankBalanceTotal,
      pettyCashBalance
    } satisfies FinanceOverview;
  }

  invoices(businessId: string, from?: string, to?: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const range = buildDateRange(from, to);
    return this.invoiceModel
      .find({ businessId, deletedAt: null, status: { $in: ["sent", "viewed", "partially_paid", "overdue"] }, balanceDue: { $gt: 0 }, ...buildBranchMatch(branchId), ...(range ? { issueDate: range } : {}) })
      .sort({ createdAt: -1 })
      .lean()
      .then((invoices) =>
        invoices.map((invoice) => ({
          id: String(invoice.externalId ?? invoice._id),
          receiptNumber: invoice.invoiceNumber,
          invoiceNumber: invoice.invoiceNumber,
          customerId: invoice.customerId ?? null,
          customerName: invoice.customerName ?? null,
          grandTotal: Number(invoice.grandTotal ?? 0),
          amountPaid: Number(invoice.amountPaid ?? 0),
          balanceDue: Number(invoice.balanceDue ?? 0),
          paymentStatus: invoice.balanceDue <= 0 ? "paid" : invoice.amountPaid > 0 ? "partial" : "unpaid",
          status: invoice.status,
          issueDate: String((invoice as { issueDate?: string | Date }).issueDate ?? new Date().toISOString()),
          dueDate: String((invoice as { dueDate?: string | Date }).dueDate ?? new Date().toISOString()),
          createdAt: String((invoice as { createdAt?: string | Date }).createdAt ?? new Date().toISOString())
        }) satisfies FinanceInvoice)
      );
  }

  payments(businessId: string, from?: string, to?: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const range = buildDateRange(from, to);
    return this.paymentModel
      .find({ businessId, ...buildBranchMatch(branchId), ...(range ? { createdAt: range } : {}) })
      .sort({ createdAt: -1 })
      .lean()
      .then((payments) => payments.map((payment) => this.normalizePayment(payment)));
  }

  async reconcilePendingPayment(businessId: string, paymentId: string, input: { providerReference: string; verifiedAmount: number; verifiedCurrency: string; reason: string; actorId: string }, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    if (!input.providerReference.trim() || !input.reason.trim()) throw new BadRequestException("Provider reference and verification reason are required");
    return runInTransaction(this.connection, async (session) => {
      const ids: Array<Record<string, string>> = [{ externalId: paymentId }];
      if (/^[a-f\d]{24}$/i.test(paymentId)) ids.unshift({ _id: paymentId });
      const payment = await this.paymentModel.findOne({ businessId, $and: [{ $or: ids }, buildBranchMatch(branchId)] }).session(session);
      if (!payment) throw new NotFoundException("Payment not found");
      if (payment.method !== "mpesa" || payment.paymentState !== "reconciliation_pending") throw new ConflictException("Only pending M-Pesa payments can be manually reconciled");
      if (payment.saleId && payment.invoiceId) throw new ConflictException("Payment has multiple receivable allocations; reconcile it manually before posting");
      if (Math.round(Number(payment.amount) * 100) !== Math.round(input.verifiedAmount * 100)) throw new ConflictException("Verified amount does not match the pending payment");
      if (String(payment.currency).toUpperCase() !== input.verifiedCurrency.trim().toUpperCase()) throw new ConflictException("Verified currency does not match the pending payment");
      const duplicateReference = await this.paymentModel.findOne({ businessId, method: "mpesa", reference: input.providerReference.trim(), paymentState: "reconciled", _id: { $ne: payment._id } }).session(session).lean();
      if (duplicateReference) throw new ConflictException("Provider transaction reference is already reconciled to another payment");
      const amount = Number(payment.amount);
      if (payment.saleId) {
        const sale = await this.saleModel.findOne({ businessId, $and: [{ $or: [{ _id: payment.saleId }, { externalId: payment.saleId }] }, buildBranchMatch(branchId)] }).session(session);
        if (!sale) throw new ConflictException("Associated sale is missing; payment remains pending");
        if (amount > Number(sale.balanceDue ?? 0)) throw new ConflictException("Verified payment exceeds the sale balance; payment remains pending");
        sale.amountPaid = roundMoney(Number(sale.amountPaid ?? 0) + amount);
        sale.balanceDue = roundMoney(Math.max(0, Number(sale.grandTotal ?? 0) - sale.amountPaid));
        sale.paymentStatus = sale.balanceDue <= 0 ? "paid" : "partial";
        await sale.save({ session });
      }
      if (payment.invoiceId) {
        const invoice = await this.invoiceModel.findOne({ businessId, $and: [{ $or: [{ _id: payment.invoiceId }, { externalId: payment.invoiceId }] }, buildBranchMatch(branchId)] }).session(session);
        if (!invoice) throw new ConflictException("Associated invoice is missing; payment remains pending");
        if (["draft", "cancelled", "void", "archived", "refunded"].includes(invoice.status)) throw new ConflictException("Associated invoice is not open; payment remains pending");
        if (amount > Number(invoice.balanceDue ?? 0)) throw new ConflictException("Verified payment exceeds the invoice balance; payment remains pending");
        invoice.amountPaid = roundMoney(Number(invoice.amountPaid ?? 0) + amount);
        invoice.balanceDue = roundMoney(Math.max(0, Number(invoice.balanceDue ?? 0) - amount));
        invoice.status = deriveInvoiceLifecycleStatus({ status: invoice.status, amountPaid: invoice.amountPaid, balanceDue: invoice.balanceDue, dueDate: invoice.dueDate, sentAt: invoice.sentAt, viewedAt: invoice.viewedAt });
        invoice.paidAt = invoice.balanceDue <= 0 ? new Date() : invoice.paidAt ?? null;
        invoice.payments.push({ id: payment.externalId ?? payment._id.toString(), paymentId: payment._id.toString(), amount, method: payment.method, paymentDate: new Date().toISOString(), reference: input.providerReference.trim(), note: payment.note ?? null });
        invoice.history.push({ action: "payment_reconciled", message: input.reason.trim(), actorId: input.actorId, payload: { paymentId: payment._id.toString(), amount, providerReference: input.providerReference.trim() } } as never);
        await invoice.save({ session });
      }
      if (payment.customerId) {
        const customerIds: Array<Record<string, string>> = [{ externalId: payment.customerId }];
        if (/^[a-f\d]{24}$/i.test(payment.customerId)) customerIds.unshift({ _id: payment.customerId });
        const customer = await this.customerModel.findOne({ businessId, deletedAt: null, $and: [{ $or: customerIds }, buildBranchMatch(branchId)] }).session(session);
        if (!customer) throw new ConflictException("Associated customer is missing; payment remains pending");
        if (payment.saleId || payment.invoiceId) {
          customer.balance = roundMoney(Math.max(0, Number(customer.balance ?? 0) - amount));
          await customer.save({ session });
        }
      }
      payment.reference = input.providerReference.trim();
      payment.status = "reconciled";
      payment.paymentState = "reconciled";
      payment.recordedById = payment.recordedById ?? input.actorId;
      payment.reconciledAt = new Date();
      payment.note = [payment.note, `Manual provider verification: ${input.reason.trim()}`].filter(Boolean).join(" · ");
      await payment.save({ session });
      await this.auditLogModel.create([{ businessId, entityType: "payment", entityId: payment._id.toString(), action: "reconciled", actorId: input.actorId, payload: { amount, currency: payment.currency, providerReference: input.providerReference.trim(), reason: input.reason.trim(), verificationMode: "manual_provider_portal" } }], { session });
      return payment.toObject();
    });
  }

  async reversePayment(businessId: string, paymentId: string, reason: string, kind: "reversal" | "refund", actorId: string, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    if (!reason.trim()) throw new BadRequestException("A reason is required");
    return runInTransaction(this.connection, async (session) => {
      const ids: Array<Record<string, string>> = [{ externalId: paymentId }];
      if (/^[a-f\d]{24}$/i.test(paymentId)) ids.unshift({ _id: paymentId });
      const original = await this.paymentModel.findOne({ businessId, $and: [{ $or: ids }, buildBranchMatch(branchId)] }).session(session);
      if (!original) throw new NotFoundException("Payment not found");
      const originalId = original._id.toString();
      if (original.saleId && original.invoiceId) throw new ConflictException("Payment has multiple receivable allocations; repair its allocation before reversing");
      const externalId = `${kind}:${originalId}`;
      const prior = await this.paymentModel.findOne({ businessId, externalId }).session(session).lean();
      if (prior) return prior;
      const state = (original.paymentState ?? (original.method === "mpesa" ? "reconciliation_pending" : "posted")) as PaymentLifecycleState;
      const next = kind === "refund" ? "refunded" : "reversed";
      try { assertPaymentStateTransition(state, next); } catch (error) { throw new ConflictException(error instanceof Error ? error.message : "Payment cannot be changed from its current state"); }
      const amount = Number(original.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new ConflictException("Invalid payment amount");
      const wasPosted = state === "posted" || state === "reconciled";
      let adjustCustomerBalance = false;
      if (wasPosted && original.saleId) {
        const sale = await this.saleModel.findOne({ businessId, $and: [{ $or: [{ _id: original.saleId }, { externalId: original.saleId }] }, buildBranchMatch(branchId)] }).session(session);
        if (!sale) throw new ConflictException("Associated sale was not found; payment remains unchanged");
        const saleIds = [String(sale._id), ...(sale.externalId ? [String(sale.externalId)] : [])];
        const activeInvoice = await this.invoiceModel.findOne({
          businessId,
          status: { $in: ["sent", "viewed", "partially_paid", "paid", "overdue"] },
          saleId: { $in: saleIds },
          ...buildBranchMatch(branchId)
        }).session(session).lean();
        if (activeInvoice) throw new ConflictException("Reverse payments against the active linked invoice, not its source sale");
        sale.amountPaid = roundMoney(Math.max(0, Number(sale.amountPaid ?? 0) - amount));
        sale.balanceDue = roundMoney(Math.max(0, Number(sale.grandTotal ?? 0) - sale.amountPaid));
        sale.paymentStatus = sale.balanceDue <= 0 ? "paid" : sale.amountPaid > 0 ? "partial" : "credit";
        await sale.save({ session });
        adjustCustomerBalance = true;
      }
      if (wasPosted && original.invoiceId) {
        const invoice = await this.invoiceModel.findOne({ businessId, $and: [{ $or: [{ _id: original.invoiceId }, { externalId: original.invoiceId }] }, buildBranchMatch(branchId)] }).session(session);
        if (!invoice) throw new ConflictException("Associated invoice was not found; payment remains unchanged");
        if (["cancelled", "void", "archived", "refunded"].includes(invoice.status)) throw new ConflictException("Payments on a final invoice must be handled through its approved reversal workflow");
        invoice.amountPaid = roundMoney(Math.max(0, Number(invoice.amountPaid ?? 0) - amount));
        invoice.balanceDue = roundMoney(Number(invoice.balanceDue ?? 0) + amount);
        invoice.status = deriveInvoiceLifecycleStatus({ status: invoice.status, amountPaid: invoice.amountPaid, balanceDue: invoice.balanceDue, dueDate: invoice.dueDate, sentAt: invoice.sentAt, viewedAt: invoice.viewedAt });
        invoice.history.push({ action: kind === "refund" ? "payment_refunded" : "payment_reversed", message: reason.trim(), actorId, payload: { paymentId: originalId, amount } } as never);
        await invoice.save({ session });
        adjustCustomerBalance = invoice.status !== "draft";
      }
      if (adjustCustomerBalance && original.customerId) {
        const customerIds: Array<Record<string, string>> = [{ externalId: original.customerId }];
        if (/^[a-f\d]{24}$/i.test(original.customerId)) customerIds.unshift({ _id: original.customerId });
        const customer = await this.customerModel.findOne({ businessId, deletedAt: null, $and: [{ $or: customerIds }, buildBranchMatch(branchId)] }).session(session);
        if (customer) { customer.balance = roundMoney(Number(customer.balance ?? 0) + amount); await customer.save({ session }); }
      }
      original.paymentState = next;
      await original.save({ session });
      const reversal = (await this.paymentModel.create([{
        businessId, branchId, customerId: original.customerId ?? null, saleId: original.saleId ?? null, invoiceId: original.invoiceId ?? null,
        debtPaymentId: original.debtPaymentId ?? null, externalId, method: original.method, status: next, paymentState: next,
        amount: -amount, currency: original.currency, recordedById: actorId, reversalOfPaymentId: originalId,
        requestFingerprint: `${kind}:${originalId}:${amount}`, reference: original.reference ?? null, note: reason.trim(), provider: original.provider ?? null, reconciledAt: null
      }], { session }))[0]!;
      await this.auditLogModel.create([{ businessId, entityType: "payment", entityId: originalId, action: kind === "refund" ? "refunded" : "reversed", actorId, payload: { reversalId: reversal._id.toString(), amount, reason: reason.trim() } }], { session });
      return reversal.toObject();
    });
  }

  creditNotes(businessId: string, from?: string, to?: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const range = buildDateRange(from, to);
    return this.creditNoteModel
      .find({ businessId, deletedAt: null, ...buildBranchMatch(branchId), ...(range ? { creditDate: range } : {}) })
      .sort({ creditDate: -1, createdAt: -1 })
      .lean()
      .then((notes) => notes.map((note) => this.normalizeCreditNote(note)));
  }

  async createCreditNote(input: {
    businessId: string;
    externalId?: string | null;
    branchId?: string | null;
    reference: string;
    relatedSaleId?: string | null;
    customerId?: string | null;
    amount: number;
    reason: string;
    note?: string | null;
    status?: "draft" | "issued" | "void";
    creditDate: Date;
  }, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new BadRequestException("Credit note amount must be greater than zero");
    if (input.externalId) {
      const existing = await this.creditNoteModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return this.normalizeCreditNote(existing);
      }
    }
    const created = await this.creditNoteModel.create({
      businessId: input.businessId,
      branchId,
      externalId: input.externalId ?? null,
      reference: input.reference,
      relatedSaleId: input.relatedSaleId ?? null,
      customerId: input.customerId ?? null,
      amount: input.amount,
      reason: input.reason,
      note: input.note ?? null,
      status: input.status ?? "draft",
      issuedAt: input.status === "issued" ? new Date() : null,
      voidedAt: input.status === "void" ? new Date() : null,
      creditDate: input.creditDate,
      deletedAt: null
    });
    return this.normalizeCreditNote(created.toObject());
  }

  async updateCreditNote(businessId: string, id: string, patch: Partial<CreditNoteView>, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, patch.branchId ?? null);
    const note = await this.creditNoteModel.findOne({ ...idLookupFilter(id), businessId, deletedAt: null, ...buildBranchMatch(branchId) });
    if (!note) throw new NotFoundException("Credit note not found");
    if (note.invoiceId) throw new BadRequestException("Invoice credit notes must be changed through the invoice lifecycle actions");
    if (note.status !== "draft") throw new BadRequestException("Only draft credit notes can be edited");
    if (patch.reference !== undefined) note.reference = patch.reference;
    if (patch.relatedSaleId !== undefined) note.relatedSaleId = patch.relatedSaleId ?? null;
    if (patch.customerId !== undefined) note.customerId = patch.customerId ?? null;
    if (patch.amount !== undefined) note.amount = Number(patch.amount ?? 0);
    if (patch.reason !== undefined) note.reason = patch.reason;
    if (patch.note !== undefined) note.note = patch.note ?? null;
    if (patch.status !== undefined && patch.status !== "draft") throw new BadRequestException("Credit notes must be issued through an accounting lifecycle action");
    await note.save();
    return this.normalizeCreditNote(note.toObject());
  }

  async archiveCreditNote(businessId: string, id: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const existing = await this.creditNoteModel.findOne({ ...idLookupFilter(id), businessId, deletedAt: null, ...buildBranchMatch(branchId) });
    if (existing?.invoiceId) throw new BadRequestException("Invoice credit notes must be voided through the invoice lifecycle actions");
    const now = new Date();
    if (existing && existing.status === "issued" && !existing.issuedAt) existing.issuedAt = existing.creditDate ?? now;
    if (existing) { existing.status = "void"; existing.voidedAt = now; await existing.save(); }
    const note = existing?.toObject?.() ?? existing;
    if (!note) throw new NotFoundException("Credit note not found");
    return this.normalizeCreditNote(note);
  }

  bankAccounts(businessId: string) {
    return this.bankAccountModel
      .find({ businessId, deletedAt: null })
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean()
      .then((accounts) => accounts.map((account) => this.normalizeBankAccount(account)));
  }

  async createBankAccount(input: {
    businessId: string;
    externalId?: string | null;
    bankName: string;
    accountName: string;
    accountNumber?: string | null;
    currency: string;
    openingBalance: number;
    currentBalance?: number;
    isPrimary?: boolean;
    notes?: string | null;
  }) {
    if (input.externalId) {
      const existing = await this.bankAccountModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return this.normalizeBankAccount(existing);
      }
    }
    const created = await this.bankAccountModel.create({
      businessId: input.businessId,
      externalId: input.externalId ?? null,
      bankName: input.bankName,
      accountName: input.accountName,
      accountNumber: input.accountNumber ?? null,
      currency: input.currency,
      openingBalance: input.openingBalance,
      currentBalance: input.currentBalance ?? input.openingBalance,
      isPrimary: input.isPrimary ?? false,
      notes: input.notes ?? null,
      deletedAt: null
    });
    return this.normalizeBankAccount(created.toObject());
  }

  async updateBankAccount(businessId: string, id: string, patch: Partial<BankAccountView>) {
    const account = await this.bankAccountModel.findOne({ ...idLookupFilter(id), businessId, deletedAt: null });
    if (!account) throw new NotFoundException("Bank account not found");
    if (patch.bankName !== undefined) account.bankName = patch.bankName;
    if (patch.accountName !== undefined) account.accountName = patch.accountName;
    if (patch.accountNumber !== undefined) account.accountNumber = patch.accountNumber ?? null;
    if (patch.currency !== undefined) account.currency = patch.currency;
    if (patch.openingBalance !== undefined) account.openingBalance = Number(patch.openingBalance ?? 0);
    if (patch.isPrimary !== undefined) account.isPrimary = patch.isPrimary;
    if (patch.notes !== undefined) account.notes = patch.notes ?? null;
    await account.save();
    return this.normalizeBankAccount(account.toObject());
  }

  async bankTransactions(businessId: string, bankAccountId: string) {
    const account = await this.bankAccountModel.findOne({ ...idLookupFilter(bankAccountId), businessId, deletedAt: null }).lean();
    if (!account) throw new NotFoundException("Bank account not found");
    return this.bankTransactionModel.find({ businessId, bankAccountId }).sort({ createdAt: 1 }).lean();
  }

  async createBankTransaction(input: {
    businessId: string;
    bankAccountId: string;
    externalId?: string | null;
    amount: number;
    direction: "in" | "out";
    type: string;
    source: string;
    reference?: string | null;
    description?: string | null;
    createdById?: string | null;
  }) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new NotFoundException("Bank transaction amount must be greater than zero");
    return runInTransaction(this.connection, async (session) => {
      const existing = input.externalId ? await this.bankTransactionModel.findOne({ businessId: input.businessId, externalId: input.externalId }).session(session).lean() : null;
      if (existing) return existing;
      const account = await this.bankAccountModel.findOne({ ...idLookupFilter(input.bankAccountId), businessId: input.businessId, deletedAt: null }).session(session);
      if (!account) throw new NotFoundException("Bank account not found");
      const created = (await this.bankTransactionModel.create([{ ...input, currency: account.currency, reference: input.reference ?? null, description: input.description ?? null, createdById: input.createdById ?? null }], { session }))[0]!;
      account.currentBalance = roundMoney(Number(account.currentBalance ?? account.openingBalance ?? 0) + (input.direction === "in" ? input.amount : -input.amount));
      await account.save({ session });
      await this.auditLogModel.create([{ businessId: input.businessId, entityType: "bank_transaction", entityId: String(created._id), action: "created", actorId: input.createdById ?? null, payload: { bankAccountId: input.bankAccountId, amount: input.amount, direction: input.direction, externalId: input.externalId ?? null } }], { session });
      return created.toObject();
    });
  }

  async archiveBankAccount(businessId: string, id: string) {
    const account = await this.bankAccountModel.findOneAndUpdate({ ...idLookupFilter(id), businessId, deletedAt: null }, { deletedAt: new Date(), isPrimary: false }, { new: true }).lean();
    if (!account) throw new NotFoundException("Bank account not found");
    return this.normalizeBankAccount(account);
  }

  pettyCash(businessId: string, from?: string, to?: string) {
    const range = buildDateRange(from, to);
    return this.pettyCashModel
      .find({ businessId, deletedAt: null, ...(range ? { entryDate: range } : {}) })
      .sort({ entryDate: -1, createdAt: -1 })
      .lean()
      .then((entries) => entries.map((entry) => this.normalizePettyCashEntry(entry)));
  }

  async createPettyCashEntry(input: {
    businessId: string;
    externalId?: string | null;
    label: string;
    amount: number;
    direction: "in" | "out";
    entryType?: "cash_in" | "cash_out" | "expense" | "adjustment";
    category?: string | null;
    note?: string | null;
    recordedById?: string | null;
    entryDate: Date;
  }) {
    if (input.externalId) {
      const existing = await this.pettyCashModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return this.normalizePettyCashEntry(existing);
      }
    }
    const created = await this.pettyCashModel.create({
      businessId: input.businessId,
      externalId: input.externalId ?? null,
      label: input.label,
      amount: input.amount,
      direction: input.direction,
      entryType: input.entryType ?? (input.direction === "in" ? "cash_in" : "cash_out"),
      category: input.category ?? null,
      note: input.note ?? null,
      recordedById: input.recordedById ?? null,
      entryDate: input.entryDate,
      deletedAt: null
    });
    return this.normalizePettyCashEntry(created.toObject());
  }

  async archivePettyCashEntry(businessId: string, id: string) {
    const entry = await this.pettyCashModel.findOneAndUpdate({ ...idLookupFilter(id), businessId, deletedAt: null }, { deletedAt: new Date() }, { new: true }).lean();
    if (!entry) throw new NotFoundException("Petty cash entry not found");
    return this.normalizePettyCashEntry(entry);
  }

  private normalizeBankAccount(account: Record<string, any>) {
    const { _id, ...rest } = account;
    return {
      ...rest,
      id: String(rest.externalId ?? _id),
      accountNumber: rest.accountNumber ?? null,
      notes: rest.notes ?? null,
      deletedAt: rest.deletedAt ?? null
    } as BankAccountView;
  }

  private normalizePettyCashEntry(entry: Record<string, any>) {
    const { _id, ...rest } = entry;
    return {
      ...rest,
      id: String(rest.externalId ?? _id),
      category: rest.category ?? null,
      note: rest.note ?? null,
      recordedById: rest.recordedById ?? null,
      deletedAt: rest.deletedAt ?? null,
      entryDate: toSafeIsoDateString(rest.entryDate ?? null)
    } as PettyCashEntryView;
  }

  private normalizeCreditNote(note: Record<string, any>) {
    const { _id, ...rest } = note;
    return {
      ...rest,
      id: String(rest.externalId ?? _id),
      relatedSaleId: rest.relatedSaleId ?? null,
      customerId: rest.customerId ?? null,
      note: rest.note ?? null,
      deletedAt: rest.deletedAt ?? null,
      issuedAt: rest.issuedAt ? toSafeIsoString(rest.issuedAt) : null,
      voidedAt: rest.voidedAt ? toSafeIsoString(rest.voidedAt) : null,
      creditDate: toSafeIsoDateString(rest.creditDate ?? null)
    } as CreditNoteView;
  }

  private normalizePayment(payment: Record<string, any>) {
    const { _id, ...rest } = payment;
    return {
      ...rest,
      id: String(rest.externalId ?? _id),
      customerId: rest.customerId ?? null,
      saleId: rest.saleId ?? null,
      invoiceId: rest.invoiceId ?? null,
      debtPaymentId: rest.debtPaymentId ?? null,
      reference: rest.reference ?? null,
      note: rest.note ?? null,
      provider: rest.provider ?? null,
      reconciledAt: rest.reconciledAt ? toSafeIsoString(rest.reconciledAt) : null
    } as FinancePayment;
  }
}

function buildDateRange(from?: string, to?: string) {
  if (!from && !to) return null;
  const range: DateRange = {};
  if (from) range.$gte = normalizeRangeBound(from, "from");
  if (to) range.$lte = normalizeRangeBound(to, "to");
  return range;
}

function idLookupFilter(id: string) {
  return /^[a-f\d]{24}$/i.test(id) ? { $or: [{ _id: id }, { externalId: id }] } : { externalId: id };
}

function normalizeRangeBound(value: string, bound: "from" | "to") {
  const parsed = parseISO(value);
  const date = Number.isNaN(parsed.getTime()) ? new Date(value) : parsed;
  if (Number.isNaN(date.getTime())) {
    return new Date(0);
  }
  if (value.includes("T")) {
    return date;
  }
  return bound === "from" ? startOfDay(date) : endOfDay(date);
}
