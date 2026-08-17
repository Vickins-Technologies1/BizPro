import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { endOfDay, parseISO, startOfDay } from "date-fns";
import {
  BankAccount,
  BankAccountDocument,
  CreditNote,
  CreditNoteDocument,
  Expense,
  ExpenseDocument,
  Payment,
  PaymentDocument,
  PettyCashEntry,
  PettyCashEntryDocument,
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

type DateRange = Record<string, Date>;

@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(BankAccount.name) private readonly bankAccountModel: Model<BankAccountDocument>,
    @InjectModel(PettyCashEntry.name) private readonly pettyCashModel: Model<PettyCashEntryDocument>,
    @InjectModel(CreditNote.name) private readonly creditNoteModel: Model<CreditNoteDocument>
  ) {}

  async overview(businessId: string, from?: string, to?: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const saleRange = buildDateRange(from, to);
    const expenseRange = buildDateRange(from, to);
    const paymentRange = buildDateRange(from, to);
    const entryRange = buildDateRange(from, to);

    const [sales, expenseTotals, payments, creditNotes, bankAccounts, pettyCashEntries] = await Promise.all([
      this.saleModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId), ...(saleRange ? { createdAt: saleRange } : {}) }).lean(),
      this.expenseModel.aggregate([{ $match: { businessId, ...buildBranchMatch(branchId), ...(expenseRange ? { expenseDate: expenseRange } : {}) } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      this.paymentModel.aggregate([{ $match: { businessId, ...buildBranchMatch(branchId), ...(paymentRange ? { createdAt: paymentRange } : {}) } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      this.creditNoteModel.aggregate([{ $match: { businessId, deletedAt: null, ...buildBranchMatch(branchId), ...(entryRange ? { creditDate: entryRange } : {}) } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      this.bankAccountModel.find({ businessId, deletedAt: null }).lean(),
      this.pettyCashModel.find({ businessId, deletedAt: null, ...(entryRange ? { entryDate: entryRange } : {}) }).lean()
    ]);

    const incomeTotal = sales.reduce((sum, sale) => sum + Number(sale.grandTotal ?? 0), 0);
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
    const creditNoteTotal = creditNotes[0]?.total ?? 0;
    const bankBalanceTotal = bankAccounts.reduce((sum, account) => sum + Number(account.currentBalance ?? account.openingBalance ?? 0), 0);
    const pettyCashBalance = pettyCashEntries.reduce((sum, entry) => sum + (entry.direction === "in" ? Number(entry.amount ?? 0) : -Number(entry.amount ?? 0)), 0);
    const invoiceCount = sales.filter((sale) => Number(sale.balanceDue ?? 0) > 0).length;
    const invoiceTotal = sales.reduce((sum, sale) => sum + Math.max(0, Number(sale.balanceDue ?? 0)), 0);
    const taxTotal = sales.reduce((sum, sale) => sum + Number(sale.taxTotal ?? 0), 0);
    const profitLossTotal = incomeTotal - cogsTotal - expensesTotal;
    const cashFlowTotal = paymentTotal - expensesTotal + pettyCashBalance;

    return {
      incomeTotal,
      expensesTotal,
      profitLossTotal,
      cashFlowTotal,
      taxTotal,
      invoiceCount,
      invoiceTotal,
      creditNoteCount: creditNotes.length,
      creditNoteTotal,
      paymentTotal,
      bankBalanceTotal,
      pettyCashBalance
    } satisfies FinanceOverview;
  }

  invoices(businessId: string, from?: string, to?: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const range = buildDateRange(from, to);
    return this.saleModel
      .find({ businessId, deletedAt: null, balanceDue: { $gt: 0 }, ...buildBranchMatch(branchId), ...(range ? { createdAt: range } : {}) })
      .sort({ createdAt: -1 })
      .lean()
      .then((sales) =>
        sales.map((sale) => ({
          id: String(sale.externalId ?? sale._id),
          receiptNumber: sale.receiptNumber,
          customerId: sale.customerId ?? null,
          grandTotal: Number(sale.grandTotal ?? 0),
          balanceDue: Number(sale.balanceDue ?? 0),
          paymentStatus: sale.paymentStatus,
          createdAt: String((sale as { createdAt?: string | Date }).createdAt ?? new Date().toISOString())
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
      creditDate: input.creditDate,
      deletedAt: null
    });
    return this.normalizeCreditNote(created.toObject());
  }

  async updateCreditNote(businessId: string, id: string, patch: Partial<CreditNoteView>, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, patch.branchId ?? null);
    const note = await this.creditNoteModel.findOne({ _id: id, businessId, deletedAt: null, ...buildBranchMatch(branchId) });
    if (!note) throw new NotFoundException("Credit note not found");
    if (patch.reference !== undefined) note.reference = patch.reference;
    if (patch.relatedSaleId !== undefined) note.relatedSaleId = patch.relatedSaleId ?? null;
    if (patch.customerId !== undefined) note.customerId = patch.customerId ?? null;
    if (patch.amount !== undefined) note.amount = Number(patch.amount ?? 0);
    if (patch.reason !== undefined) note.reason = patch.reason;
    if (patch.note !== undefined) note.note = patch.note ?? null;
    if (patch.status !== undefined) note.status = patch.status;
    await note.save();
    return this.normalizeCreditNote(note.toObject());
  }

  async archiveCreditNote(businessId: string, id: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const note = await this.creditNoteModel.findOneAndUpdate({ _id: id, businessId, deletedAt: null, ...buildBranchMatch(branchId) }, { deletedAt: new Date(), status: "void" }, { new: true }).lean();
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
    const account = await this.bankAccountModel.findOne({ _id: id, businessId, deletedAt: null });
    if (!account) throw new NotFoundException("Bank account not found");
    if (patch.bankName !== undefined) account.bankName = patch.bankName;
    if (patch.accountName !== undefined) account.accountName = patch.accountName;
    if (patch.accountNumber !== undefined) account.accountNumber = patch.accountNumber ?? null;
    if (patch.currency !== undefined) account.currency = patch.currency;
    if (patch.openingBalance !== undefined) account.openingBalance = Number(patch.openingBalance ?? 0);
    if (patch.currentBalance !== undefined) account.currentBalance = Number(patch.currentBalance ?? 0);
    if (patch.isPrimary !== undefined) account.isPrimary = patch.isPrimary;
    if (patch.notes !== undefined) account.notes = patch.notes ?? null;
    await account.save();
    return this.normalizeBankAccount(account.toObject());
  }

  async archiveBankAccount(businessId: string, id: string) {
    const account = await this.bankAccountModel.findOneAndUpdate({ _id: id, businessId, deletedAt: null }, { deletedAt: new Date(), isPrimary: false }, { new: true }).lean();
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
      category: input.category ?? null,
      note: input.note ?? null,
      recordedById: input.recordedById ?? null,
      entryDate: input.entryDate,
      deletedAt: null
    });
    return this.normalizePettyCashEntry(created.toObject());
  }

  async archivePettyCashEntry(businessId: string, id: string) {
    const entry = await this.pettyCashModel.findOneAndUpdate({ _id: id, businessId, deletedAt: null }, { deletedAt: new Date() }, { new: true }).lean();
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
