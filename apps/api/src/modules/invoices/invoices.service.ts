import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { endOfDay, parseISO, startOfDay } from "date-fns";
import { Connection, Model } from "mongoose";
import {
  AuditLog,
  AuditLogDocument,
  Business,
  BusinessDocument,
  CreditNote,
  CreditNoteDocument,
  Customer,
  CustomerDocument,
  DebitNote,
  DebitNoteDocument,
  Invoice,
  InvoiceDocument,
  Payment,
  PaymentDocument
} from "../schemas";
import { runInTransaction } from "../../common/mongo-transaction";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";
import { buildBusinessLookup } from "../../common/business-lookup";
import { toSafeIsoDateString, toSafeIsoString } from "../../common/date-normalizer";
import { NotificationsService } from "../notifications/notifications.service";
import { FiscalizationService, type FiscalizationOutcome } from "./fiscalization.service";
import type { DebitNote as DebitNoteView, Invoice as InvoiceView, InvoiceLineItem, InvoicePaymentRecord, InvoiceTaxSnapshot, InvoiceLifecycleStatus, FinanceInvoice } from "@vbo/shared";

type InvoiceListQuery = {
  search?: string;
  status?: string;
  customerId?: string;
  from?: string;
  to?: string;
  sortBy?: "invoiceNumber" | "issueDate" | "dueDate" | "grandTotal" | "balanceDue" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

type InvoiceLineInput = Omit<InvoiceLineItem, "id" | "lineSubtotal" | "lineDiscount" | "lineTax" | "lineTotal" | "tax"> & {
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  taxCategory?: InvoiceTaxSnapshot["taxCategory"];
  taxCode?: string | null;
  taxRate?: number;
  taxInclusive?: boolean;
};

type InvoiceCreateInput = {
  businessId: string;
  branchId?: string | null;
  externalId?: string | null;
  shareToken?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerBusinessName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerTaxPin?: string | null;
  invoiceNumber?: string | null;
  issueDate: Date;
  dueDate: Date;
  paymentTerms: string;
  currency: string;
  referenceNumber?: string | null;
  purchaseOrderNumber?: string | null;
  notes?: string | null;
  termsAndConditions?: string | null;
  status?: InvoiceLifecycleStatus;
  amountPaid?: number;
  lineItems: InvoiceLineInput[];
};

type InvoicePatchInput = Partial<Omit<InvoiceCreateInput, "businessId" | "issueDate" | "dueDate" | "lineItems">> & {
  issueDate?: Date;
  dueDate?: Date;
  lineItems?: InvoiceLineInput[];
};

type InvoicePaymentInput = {
  businessId: string;
  invoiceId: string;
  amount: number;
  method: string;
  paymentDate: Date;
  reference?: string | null;
  note?: string | null;
  externalId?: string | null;
  recordedById?: string | null;
};

type CreditNoteInput = {
  businessId: string;
  invoiceId: string;
  branchId?: string | null;
  externalId?: string | null;
  reference: string;
  customerId?: string | null;
  amount: number;
  reason: string;
  note?: string | null;
  creditDate: Date;
  status?: "draft" | "issued" | "void";
};

type DebitNoteInput = {
  businessId: string;
  invoiceId: string;
  branchId?: string | null;
  externalId?: string | null;
  reference: string;
  reason: string;
  amount: number;
  taxAdjustment: number;
  note?: string | null;
  issuedAt: Date;
  status?: "draft" | "issued" | "void";
};

const DEFAULT_SETTINGS = {
  prefix: "INV-",
  startingNumber: 1,
  nextNumber: 1,
  padding: 6,
  autoGenerate: true,
  resetBehavior: "never" as const,
  defaultPaymentTermsDays: 30,
  publicSharingEnabled: true,
  paymentMethods: ["cash", "mpesa", "bank", "card", "cheque", "other", "credit"]
};

const FINAL_STATUSES: InvoiceLifecycleStatus[] = ["paid", "cancelled", "void", "refunded", "archived"];

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(DebitNote.name) private readonly debitNoteModel: Model<DebitNoteDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectModel(CreditNote.name) private readonly creditNoteModel: Model<CreditNoteDocument>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly notifications: NotificationsService,
    private readonly fiscalization: FiscalizationService
  ) {}

  async list(businessId: string, query: InvoiceListQuery = {}, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const search = query.search?.trim();
    const filter: Record<string, unknown> = { businessId, deletedAt: null, ...buildBranchMatch(branchId) };
    if (query.customerId) {
      filter.customerId = query.customerId;
    }
    if (query.from || query.to) {
      filter.issueDate = buildDateRange(query.from, query.to);
    }
    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: escapeRegex(search), $options: "i" } },
        { referenceNumber: { $regex: escapeRegex(search), $options: "i" } },
        { customerName: { $regex: escapeRegex(search), $options: "i" } },
        { customerBusinessName: { $regex: escapeRegex(search), $options: "i" } }
      ];
    }
    if (query.status) {
      if (query.status === "overdue") {
        filter.$or = [
          ...(Array.isArray(filter.$or) ? filter.$or : []),
          { status: { $in: ["sent", "viewed", "partially_paid"] }, balanceDue: { $gt: 0 }, dueDate: { $lt: new Date() } }
        ];
      } else {
        filter.status = query.status;
      }
    }

    const sortBy = query.sortBy ?? "issueDate";
    const sortOrder = query.sortOrder ?? "desc";
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 } as Record<string, 1 | -1>;
    const [items, total] = await Promise.all([
      this.invoiceModel.find(filter).sort(sort).skip((page - 1) * pageSize).limit(pageSize).lean(),
      this.invoiceModel.countDocuments(filter)
    ]);
    return {
      items: items.map((item) => this.serializeInvoice(item)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
  }

  async dashboard(businessId: string, from?: string, to?: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const range = buildDateRange(from, to);
    const filter: Record<string, unknown> = { businessId, deletedAt: null, ...buildBranchMatch(branchId) };
    if (range) filter.issueDate = range;
    const [invoices, drafts, totalPaid, payments, overdue] = await Promise.all([
      this.invoiceModel.find(filter).lean(),
      this.invoiceModel.countDocuments({ ...filter, status: "draft" }),
      this.invoiceModel.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: "$amountPaid" } } }]),
      this.paymentModel.aggregate([{ $match: { businessId, ...buildBranchMatch(branchId), ...(range ? { createdAt: range } : {}) } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      this.invoiceModel.countDocuments({ ...filter, status: { $in: ["sent", "viewed", "partially_paid", "overdue"] }, balanceDue: { $gt: 0 }, dueDate: { $lt: new Date() } })
    ]);
    const totals = invoices.map((invoice) => this.serializeInvoice(invoice));
    return {
      totalInvoiced: totals.reduce((sum, invoice) => sum + invoice.grandTotal, 0),
      paid: totals.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      outstanding: totals.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      overdue: totals.filter((invoice) => invoice.status === "overdue").reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      drafts,
      thisMonth: invoices.filter((invoice) => sameMonth(new Date(invoice.issueDate), new Date())).length,
      thisYear: invoices.filter((invoice) => sameYear(new Date(invoice.issueDate), new Date())).length,
      paymentTotal: payments[0]?.total ?? 0,
      totalPaid: totalPaid[0]?.total ?? 0,
      overdueCount: overdue
    };
  }

  async get(businessId: string, id: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const invoice = await this.invoiceModel.findOne({ _id: id, businessId, deletedAt: null, ...buildBranchMatch(branchId) }).lean();
    if (!invoice) throw new NotFoundException("Invoice not found");
    return this.serializeInvoice(await this.enrichInvoice(invoice));
  }

  async getByToken(token: string) {
    const invoice = await this.invoiceModel.findOne({ shareToken: token, deletedAt: null }).lean();
    if (!invoice) throw new NotFoundException("Invoice not found");
    return this.serializeInvoice(await this.enrichInvoice(invoice));
  }

  async customerHistory(businessId: string, customerId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const [invoices, payments, creditNotes, debitNotes] = await Promise.all([
      this.invoiceModel.find({ businessId, customerId, deletedAt: null, ...buildBranchMatch(branchId) }).sort({ issueDate: -1 }).lean(),
      this.paymentModel.find({ businessId, customerId, invoiceId: { $ne: null }, ...buildBranchMatch(branchId) }).sort({ createdAt: -1 }).limit(20).lean(),
      this.creditNoteModel.find({ businessId, customerId, invoiceId: { $ne: null }, deletedAt: null, ...buildBranchMatch(branchId) }).sort({ creditDate: -1 }).lean(),
      this.debitNoteModel.find({ businessId, customerId, deletedAt: null, ...buildBranchMatch(branchId) }).sort({ issuedAt: -1 }).lean()
    ]);
    const rows = invoices.map((invoice) => this.serializeInvoice(invoice));
    return {
      totalInvoiced: rows.reduce((sum, invoice) => sum + invoice.grandTotal, 0),
      totalPaid: rows.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      outstandingBalance: rows.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      overdueAmount: rows.filter((invoice) => invoice.status === "overdue").reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      invoiceCount: rows.length,
      recentInvoices: rows.slice(0, 8),
      paymentHistory: payments.map((payment) => this.serializePayment(payment)),
      creditNotes: creditNotes.map((note) => this.serializeCreditNote(note)),
      debitNotes: debitNotes
        .filter((note) => note.invoiceId === customerId || note.businessId === businessId)
        .map((note) => this.serializeDebitNote(note))
    };
  }

  async create(input: InvoiceCreateInput, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
    return runInTransaction(this.connection, async (session) => {
      const business = await this.businessModel.findOne(buildBusinessLookup(input.businessId)).session(session);
      if (!business) throw new NotFoundException("Business not found");
      const resolvedSettings = this.resolveInvoiceSettings(business);
      const invoiceNumber = await this.resolveInvoiceNumber(business, input.invoiceNumber ?? null, resolvedSettings, session);
      const shareToken = resolvedSettings.publicSharingEnabled ? randomUUID().replaceAll("-", "") : null;
      const customer = input.customerId ? await this.customerModel.findOne({ _id: input.customerId, businessId: input.businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session) : null;
      if (input.customerId && !customer) throw new NotFoundException("Customer not found");
      const prepared = this.prepareInvoicePayload({
        ...input,
        invoiceNumber,
        shareToken,
        branchId,
        customerName: input.customerName ?? customer?.name ?? null,
        customerBusinessName: input.customerBusinessName ?? customer?.businessName ?? null,
        customerEmail: input.customerEmail ?? customer?.email ?? null,
        customerPhone: input.customerPhone ?? customer?.phone ?? null,
        customerAddress: input.customerAddress ?? customer?.address ?? null,
        customerTaxPin: input.customerTaxPin ?? customer?.taxPin ?? null
      });
      const invoice = (
        await this.invoiceModel.create(
          [
            {
              ...prepared.record,
              branchId,
              deletedAt: null,
              history: [
                this.createHistoryEntry("created", "Invoice created", null, { invoiceNumber, status: prepared.record.status })
              ]
            }
          ],
          { session }
        )
      )[0]!;
      await this.writeAudit(session, input.businessId, "invoice", invoice._id.toString(), "created", { invoiceNumber });
      return this.serializeInvoice(await this.enrichInvoice(invoice.toObject()));
    });
  }

  async update(businessId: string, id: string, patch: InvoicePatchInput, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, patch.branchId ?? null);
    return runInTransaction(this.connection, async (session) => {
      const invoice = await this.invoiceModel.findOne({ _id: id, businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session);
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (this.isFinalStatus(invoice.status)) throw new BadRequestException("Only draft or open invoices can be edited");
      if (patch.invoiceNumber !== undefined) invoice.invoiceNumber = patch.invoiceNumber ?? invoice.invoiceNumber;
      if (patch.customerId !== undefined) invoice.customerId = patch.customerId ?? null;
      if (patch.customerName !== undefined) invoice.customerName = patch.customerName ?? null;
      if (patch.customerBusinessName !== undefined) invoice.customerBusinessName = patch.customerBusinessName ?? null;
      if (patch.customerEmail !== undefined) invoice.customerEmail = patch.customerEmail ?? null;
      if (patch.customerPhone !== undefined) invoice.customerPhone = patch.customerPhone ?? null;
      if (patch.customerAddress !== undefined) invoice.customerAddress = patch.customerAddress ?? null;
      if (patch.customerTaxPin !== undefined) invoice.customerTaxPin = patch.customerTaxPin ?? null;
      if (patch.issueDate !== undefined) invoice.issueDate = patch.issueDate;
      if (patch.dueDate !== undefined) invoice.dueDate = patch.dueDate;
      if (patch.paymentTerms !== undefined) invoice.paymentTerms = patch.paymentTerms;
      if (patch.currency !== undefined) invoice.currency = patch.currency;
      if (patch.referenceNumber !== undefined) invoice.referenceNumber = patch.referenceNumber ?? null;
      if (patch.purchaseOrderNumber !== undefined) invoice.purchaseOrderNumber = patch.purchaseOrderNumber ?? null;
      if (patch.notes !== undefined) invoice.notes = patch.notes ?? null;
      if (patch.termsAndConditions !== undefined) invoice.termsAndConditions = patch.termsAndConditions ?? null;
      if (patch.status !== undefined) this.assertTransition(invoice.status, patch.status);
      if (patch.lineItems !== undefined) {
        const prepared = this.prepareInvoicePayload({
          businessId,
          branchId,
          invoiceNumber: invoice.invoiceNumber,
          customerId: invoice.customerId ?? null,
          customerName: invoice.customerName ?? null,
          customerBusinessName: invoice.customerBusinessName ?? null,
          customerEmail: invoice.customerEmail ?? null,
          customerPhone: invoice.customerPhone ?? null,
          customerAddress: invoice.customerAddress ?? null,
          customerTaxPin: invoice.customerTaxPin ?? null,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          paymentTerms: invoice.paymentTerms,
          currency: invoice.currency,
          referenceNumber: invoice.referenceNumber ?? null,
          purchaseOrderNumber: invoice.purchaseOrderNumber ?? null,
          notes: invoice.notes ?? null,
          termsAndConditions: invoice.termsAndConditions ?? null,
          status: invoice.status,
          amountPaid: invoice.amountPaid,
          lineItems: patch.lineItems
        });
        Object.assign(invoice, prepared.record);
      }
      invoice.history.push(this.createHistoryEntry("updated", "Invoice updated", null, { changedFields: Object.keys(patch) }));
      await invoice.save({ session });
      await this.writeAudit(session, businessId, "invoice", invoice._id.toString(), "updated", { invoiceNumber: invoice.invoiceNumber });
      return this.serializeInvoice(await this.enrichInvoice(invoice.toObject()));
    });
  }

  async duplicate(businessId: string, id: string, scope: BranchScope = {}) {
    const original = await this.get(businessId, id, scope);
    return this.create(
      {
        businessId,
        branchId: original.branchId ?? null,
        customerId: original.customerId ?? null,
        customerName: original.customerName ?? null,
        customerBusinessName: original.customerBusinessName ?? null,
        customerEmail: original.customerEmail ?? null,
        customerPhone: original.customerPhone ?? null,
        customerAddress: original.customerAddress ?? null,
        customerTaxPin: original.customerTaxPin ?? null,
        issueDate: new Date(),
        dueDate: new Date(original.dueDate),
        paymentTerms: original.paymentTerms,
        currency: original.currency,
        referenceNumber: original.referenceNumber ?? null,
        purchaseOrderNumber: original.purchaseOrderNumber ?? null,
        notes: original.notes ?? null,
        termsAndConditions: original.termsAndConditions ?? null,
        lineItems: original.lineItems.map((item) => ({
          productId: item.productId ?? null,
          productName: item.productName ?? null,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountType: item.discountType,
          discountValue: item.discountValue,
          taxCategory: item.tax.taxCategory,
          taxCode: item.tax.taxCode ?? null,
          taxRate: item.tax.taxRate,
          taxInclusive: item.tax.taxInclusive
        }))
      },
      scope
    );
  }

  async send(businessId: string, id: string, scope: BranchScope = {}) {
    return runInTransaction(this.connection, async (session) => {
      const invoice = await this.invoiceModel.findOne({ _id: id, businessId, deletedAt: null, ...buildBranchMatch(resolveReadBranchId(scope, scope.branchId ?? null)) }).session(session);
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (invoice.status !== "draft" && invoice.status !== "archived") {
        throw new BadRequestException("Only draft invoices can be sent");
      }
      invoice.status = invoice.amountPaid > 0 && invoice.balanceDue > 0 ? "partially_paid" : invoice.balanceDue > 0 ? "sent" : "paid";
      invoice.sentAt = new Date();
      invoice.history.push(this.createHistoryEntry("sent", "Invoice sent", null, {}));
      const fiscalization = await this.fiscalization.submitInvoice({
        invoiceId: String(invoice._id),
        businessId,
        invoiceNumber: invoice.invoiceNumber,
        payload: this.serializeInvoice(invoice.toObject())
      });
      this.applyFiscalization(invoice, fiscalization);
      const customer = invoice.customerId ? await this.customerModel.findOne({ _id: invoice.customerId, businessId, deletedAt: null, ...buildBranchMatch(resolveReadBranchId(scope, scope.branchId ?? null)) }).session(session) : null;
      if (customer && invoice.balanceDue > 0) {
        customer.balance = Math.max(0, Number(customer.balance ?? 0) + invoice.balanceDue);
        await customer.save({ session });
      }
      await invoice.save({ session });
      await this.writeAudit(session, businessId, "invoice", invoice._id.toString(), "sent", { invoiceNumber: invoice.invoiceNumber });
      await this.notifications.createNotification({
        businessId,
        audienceUserId: null,
        title: `Invoice ${invoice.invoiceNumber} sent`,
        body: `${invoice.customerName ?? "Customer"} received invoice ${invoice.invoiceNumber}.`,
        category: "billing",
        priority: "normal",
        routeName: "Invoices",
        routeParams: { invoiceId: String(invoice._id) },
        dedupeKey: `invoice-sent:${businessId}:${invoice._id}`
      });
      return this.serializeInvoice(await this.enrichInvoice(invoice.toObject()));
    });
  }

  async markViewed(businessId: string, id: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const invoice = await this.invoiceModel.findOne({ _id: id, businessId, deletedAt: null, ...buildBranchMatch(branchId) });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (!["sent", "viewed", "partially_paid", "overdue"].includes(invoice.status)) {
      throw new BadRequestException("Only sent invoices can be marked viewed");
    }
    invoice.status = invoice.balanceDue > 0 && invoice.status !== "partially_paid" ? "viewed" : invoice.status;
    invoice.viewedAt = invoice.viewedAt ?? new Date();
    invoice.history.push(this.createHistoryEntry("viewed", "Invoice viewed", null, {}));
    await invoice.save();
    return this.serializeInvoice(await this.enrichInvoice(invoice.toObject()));
  }

  async recordPayment(input: InvoicePaymentInput, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, null);
    return runInTransaction(this.connection, async (session) => {
      const invoice = await this.invoiceModel.findOne({ _id: input.invoiceId, businessId: input.businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session);
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (this.isFinalStatus(invoice.status)) throw new BadRequestException("Cannot record payments against a finalised invoice");
      const outstandingBefore = Number(invoice.balanceDue ?? 0);
      if (input.amount <= 0) throw new BadRequestException("Payment amount must be greater than zero");
      if (input.amount > outstandingBefore) throw new BadRequestException("Overpayment is not allowed for this invoice");
      const payment = (
        await this.paymentModel.create(
          [
            {
              businessId: input.businessId,
              branchId,
              customerId: invoice.customerId ?? null,
              saleId: null,
              invoiceId: invoice._id.toString(),
              debtPaymentId: null,
              externalId: input.externalId ?? null,
              method: input.method,
              status: input.amount >= outstandingBefore ? "paid" : "partial",
              amount: input.amount,
              reference: input.reference ?? null,
              note: input.note ?? null,
              provider: input.method === "mpesa" ? "tuma" : null,
              reconciledAt: input.method === "mpesa" ? input.paymentDate : null
            }
          ],
          { session }
        )
      )[0]!;
      invoice.amountPaid = Number(invoice.amountPaid ?? 0) + input.amount;
      invoice.balanceDue = Math.max(0, Number(invoice.grandTotal ?? 0) - invoice.amountPaid);
      invoice.status = invoice.balanceDue <= 0 ? "paid" : "partially_paid";
      invoice.paidAt = invoice.balanceDue <= 0 ? new Date() : invoice.paidAt ?? null;
      invoice.payments.push({
        id: input.externalId ?? payment._id.toString(),
        paymentId: payment._id.toString(),
        amount: input.amount,
        method: input.method,
        paymentDate: toSafeIsoString(input.paymentDate),
        reference: input.reference ?? null,
        note: input.note ?? null
      });
      invoice.history.push(this.createHistoryEntry("payment_recorded", "Payment recorded", input.recordedById ?? null, { amount: input.amount, method: input.method }));
      const customer = invoice.customerId ? await this.customerModel.findOne({ _id: invoice.customerId, businessId: input.businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session) : null;
      if (customer) {
        customer.balance = Math.max(0, Number(customer.balance ?? 0) - input.amount);
        await customer.save({ session });
      }
      await invoice.save({ session });
      await this.writeAudit(session, input.businessId, "invoice", invoice._id.toString(), "payment_recorded", { amount: input.amount, method: input.method });
      return {
        invoice: this.serializeInvoice(await this.enrichInvoice(invoice.toObject())),
        payment: this.serializePayment(payment.toObject())
      };
    });
  }

  async cancel(businessId: string, id: string, scope: BranchScope = {}) {
    return this.transitionInvoice(businessId, id, "cancelled", "cancelled", scope);
  }

  async void(businessId: string, id: string, scope: BranchScope = {}) {
    return this.transitionInvoice(businessId, id, "void", "voided", scope);
  }

  async archive(businessId: string, id: string, scope: BranchScope = {}) {
    return this.transitionInvoice(businessId, id, "archived", "archived", scope);
  }

  async restore(businessId: string, id: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const invoice = await this.invoiceModel.findOne({ _id: id, businessId, deletedAt: null, ...buildBranchMatch(branchId) });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.status !== "archived") throw new BadRequestException("Only archived invoices can be restored");
    invoice.status = invoice.balanceDue > 0 ? (invoice.amountPaid > 0 ? "partially_paid" : invoice.sentAt ? "sent" : "draft") : "paid";
    invoice.archivedAt = null;
    invoice.history.push(this.createHistoryEntry("restored", "Invoice restored", null, {}));
    await invoice.save();
    return this.serializeInvoice(await this.enrichInvoice(invoice.toObject()));
  }

  async deleteDraft(businessId: string, id: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const invoice = await this.invoiceModel.findOne({ _id: id, businessId, deletedAt: null, ...buildBranchMatch(branchId) });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.status !== "draft") throw new BadRequestException("Only draft invoices can be deleted");
    invoice.deletedAt = new Date();
    invoice.history.push(this.createHistoryEntry("deleted", "Draft invoice deleted", null, {}));
    await invoice.save();
    await this.writeAudit(null, businessId, "invoice", invoice._id.toString(), "deleted", { invoiceNumber: invoice.invoiceNumber });
    return this.serializeInvoice(await this.enrichInvoice(invoice.toObject()));
  }

  async createCreditNote(input: CreditNoteInput, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
    return runInTransaction(this.connection, async (session) => {
      const invoice = await this.invoiceModel.findOne({ _id: input.invoiceId, businessId: input.businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session);
      if (!invoice) throw new NotFoundException("Invoice not found");
      const created = await this.creditNoteModel.create(
        [
          {
            businessId: input.businessId,
            branchId,
            externalId: input.externalId ?? null,
            invoiceId: invoice._id.toString(),
            reference: input.reference,
            relatedSaleId: null,
            customerId: input.customerId ?? invoice.customerId ?? null,
            amount: input.amount,
            reason: input.reason,
            note: input.note ?? null,
            status: input.status ?? "draft",
            creditDate: input.creditDate,
            deletedAt: null
          }
        ],
        { session }
      );
      const note = created[0]!;
      invoice.balanceDue = Math.max(0, Number(invoice.balanceDue ?? 0) - input.amount);
      if (input.amount >= invoice.amountPaid && invoice.amountPaid > 0) {
        invoice.status = "refunded";
        invoice.refundedAt = new Date();
      } else if (invoice.balanceDue > 0) {
        invoice.status = invoice.amountPaid > 0 ? "partially_paid" : invoice.status;
      }
      invoice.history.push(this.createHistoryEntry("credit_note", "Credit note created", null, { amount: input.amount, reference: input.reference }));
      const customer = invoice.customerId ? await this.customerModel.findOne({ _id: invoice.customerId, businessId: input.businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session) : null;
      if (customer) {
        customer.balance = Math.max(0, Number(customer.balance ?? 0) - input.amount);
        await customer.save({ session });
      }
      await invoice.save({ session });
      await this.writeAudit(session, input.businessId, "invoice", invoice._id.toString(), "credit_note_created", { amount: input.amount, reference: input.reference });
      await this.fiscalization.creditNote({
        invoiceId: String(invoice._id),
        businessId: input.businessId,
        invoiceNumber: invoice.invoiceNumber,
        payload: { creditNoteId: String(note._id), amount: input.amount, reason: input.reason }
      });
      return { invoice: this.serializeInvoice(await this.enrichInvoice(invoice.toObject())), creditNote: this.serializeCreditNote(note.toObject()) };
    });
  }

  async createDebitNote(input: DebitNoteInput, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
    return runInTransaction(this.connection, async (session) => {
      const invoice = await this.invoiceModel.findOne({ _id: input.invoiceId, businessId: input.businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session);
      if (!invoice) throw new NotFoundException("Invoice not found");
      const created = await this.debitNoteModel.create(
        [
          {
            businessId: input.businessId,
            branchId,
            externalId: input.externalId ?? null,
            invoiceId: invoice._id.toString(),
            customerId: invoice.customerId ?? null,
            reference: input.reference,
            reason: input.reason,
            amount: input.amount,
            taxAdjustment: input.taxAdjustment,
            note: input.note ?? null,
            status: input.status ?? "draft",
            issuedAt: input.issuedAt,
            deletedAt: null
          }
        ],
        { session }
      );
      const note = created[0]!;
      invoice.balanceDue = Number(invoice.balanceDue ?? 0) + input.amount + input.taxAdjustment;
      invoice.status = invoice.balanceDue > 0 ? (invoice.amountPaid > 0 ? "partially_paid" : "sent") : invoice.status;
      invoice.history.push(this.createHistoryEntry("debit_note", "Debit note created", null, { amount: input.amount, reference: input.reference }));
      const customer = invoice.customerId ? await this.customerModel.findOne({ _id: invoice.customerId, businessId: input.businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session) : null;
      if (customer) {
        customer.balance = Number(customer.balance ?? 0) + input.amount + input.taxAdjustment;
        await customer.save({ session });
      }
      await invoice.save({ session });
      await this.writeAudit(session, input.businessId, "invoice", invoice._id.toString(), "debit_note_created", { amount: input.amount, reference: input.reference });
      await this.fiscalization.debitNote({
        invoiceId: String(invoice._id),
        businessId: input.businessId,
        invoiceNumber: invoice.invoiceNumber,
        payload: { debitNoteId: String(note._id), amount: input.amount, reason: input.reason }
      });
      return { invoice: this.serializeInvoice(await this.enrichInvoice(invoice.toObject())), debitNote: this.serializeDebitNote(note.toObject()) };
    });
  }

  async renderInvoiceHtml(businessId: string, id: string, scope: BranchScope = {}) {
    const invoice = await this.get(businessId, id, scope);
    const business = await this.businessModel.findOne(buildBusinessLookup(businessId)).lean();
    if (!business) throw new NotFoundException("Business not found");
    return { html: buildInvoiceHtml(invoice, business) };
  }

  private async transitionInvoice(businessId: string, id: string, nextStatus: InvoiceLifecycleStatus, action: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    return runInTransaction(this.connection, async (session) => {
      const invoice = await this.invoiceModel.findOne({ _id: id, businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session);
      if (!invoice) throw new NotFoundException("Invoice not found");
      this.assertTransition(invoice.status, nextStatus);
      invoice.status = nextStatus;
      if (nextStatus === "cancelled") invoice.cancelledAt = new Date();
      if (nextStatus === "void") invoice.voidedAt = new Date();
      if (nextStatus === "archived") invoice.archivedAt = new Date();
      invoice.history.push(this.createHistoryEntry(action, `Invoice ${action}`, null, {}));
      const fiscalization = nextStatus === "cancelled" ? await this.fiscalization.cancelInvoice({ invoiceId: String(invoice._id), businessId, invoiceNumber: invoice.invoiceNumber, payload: this.serializeInvoice(invoice.toObject()) }) : nextStatus === "void" ? await this.fiscalization.voidInvoice({ invoiceId: String(invoice._id), businessId, invoiceNumber: invoice.invoiceNumber, payload: this.serializeInvoice(invoice.toObject()) }) : { status: "not_configured" as const };
      this.applyFiscalization(invoice, fiscalization);
      const customer = invoice.customerId ? await this.customerModel.findOne({ _id: invoice.customerId, businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session) : null;
      if (customer && (nextStatus === "cancelled" || nextStatus === "void")) {
        customer.balance = Math.max(0, Number(customer.balance ?? 0) - Number(invoice.balanceDue ?? 0));
        await customer.save({ session });
      }
      await invoice.save({ session });
      await this.writeAudit(session, businessId, "invoice", invoice._id.toString(), action, { invoiceNumber: invoice.invoiceNumber });
      return this.serializeInvoice(await this.enrichInvoice(invoice.toObject()));
    });
  }

  private async enrichInvoice(invoice: Record<string, any>) {
    const [payments, creditNotes, debitNotes] = await Promise.all([
      this.paymentModel.find({ invoiceId: String(invoice._id), businessId: invoice.businessId }).sort({ createdAt: -1 }).lean(),
      this.creditNoteModel.find({ invoiceId: String(invoice._id), businessId: invoice.businessId, deletedAt: null }).sort({ creditDate: -1 }).lean(),
      this.debitNoteModel.find({ invoiceId: String(invoice._id), businessId: invoice.businessId, deletedAt: null }).sort({ issuedAt: -1 }).lean()
    ]);
    return {
      ...invoice,
      payments,
      creditNotes,
      debitNotes
    };
  }

  private resolveInvoiceSettings(business: Record<string, any>) {
    const settings = business.invoiceSettings ?? {};
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      paymentMethods: Array.isArray(settings.paymentMethods) && settings.paymentMethods.length ? settings.paymentMethods : DEFAULT_SETTINGS.paymentMethods
    };
  }

  private async resolveInvoiceNumber(
    business: BusinessDocument & { invoiceSettings?: Record<string, any> | null },
    requested: string | null,
    settings: ReturnType<InvoicesService["resolveInvoiceSettings"]>,
    session: any
  ) {
    if (requested?.trim()) return requested.trim();
    if (!settings.autoGenerate) {
      throw new BadRequestException("Invoice number is required when auto-generation is disabled");
    }
    const nextNumber = Number(settings.nextNumber ?? settings.startingNumber ?? 1);
    business.invoiceSettings = {
      ...settings,
      nextNumber: nextNumber + 1
    };
    await business.save({ session });
    return `${settings.prefix}${String(nextNumber).padStart(settings.padding, "0")}`;
  }

  private prepareInvoicePayload(input: InvoiceCreateInput & { branchId?: string | null; customerName?: string | null; customerBusinessName?: string | null; customerEmail?: string | null; customerPhone?: string | null; customerAddress?: string | null; customerTaxPin?: string | null }) {
    const lineItems = input.lineItems.map((line) => this.calculateLineItem(line));
    const subtotal = roundMoney(lineItems.reduce((sum, line) => sum + line.lineSubtotal, 0));
    const discountTotal = roundMoney(lineItems.reduce((sum, line) => sum + line.lineDiscount, 0));
    const taxableAmount = roundMoney(lineItems.reduce((sum, line) => sum + line.tax.taxableAmount, 0));
    const taxTotal = roundMoney(lineItems.reduce((sum, line) => sum + line.lineTax, 0));
    const grandTotal = roundMoney(lineItems.reduce((sum, line) => sum + line.lineTotal, 0));
    const amountPaid = roundMoney(Math.min(Number(input.amountPaid ?? 0), grandTotal));
    const balanceDue = roundMoney(Math.max(0, grandTotal - amountPaid));
    return {
      record: {
        externalId: input.externalId ?? null,
        businessId: input.businessId,
        branchId: input.branchId ?? null,
        customerId: input.customerId ?? null,
        customerName: input.customerName ?? null,
        customerBusinessName: input.customerBusinessName ?? null,
        customerEmail: input.customerEmail ?? null,
        customerPhone: input.customerPhone ?? null,
        customerAddress: input.customerAddress ?? null,
        customerTaxPin: input.customerTaxPin ?? null,
        invoiceNumber: input.invoiceNumber ?? "TEMP",
        referenceNumber: input.referenceNumber ?? null,
        purchaseOrderNumber: input.purchaseOrderNumber ?? null,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        paymentTerms: input.paymentTerms,
        currency: input.currency,
        status: input.status ?? (balanceDue > 0 ? "draft" : "paid"),
        subtotal,
        discountTotal,
        taxableAmount,
        taxTotal,
        grandTotal,
        amountPaid,
        balanceDue,
        notes: input.notes ?? null,
        termsAndConditions: input.termsAndConditions ?? null,
        shareToken: input.shareToken ?? null,
        fiscalizationStatus: "not_configured",
        fiscalizationProvider: null,
        fiscalizationReference: null,
        fiscalizationRequestId: null,
        fiscalizationDocumentNumber: null,
        fiscalizationDate: null,
        fiscalizationResponse: null,
        fiscalizationError: null,
        fiscalizationPayloadReference: null,
        lineItems: lineItems.map((line) => ({
          ...line,
          tax: { ...line.tax }
        })),
        payments: [],
        history: [],
        archivedAt: null,
        sentAt: null,
        viewedAt: null,
        paidAt: amountPaid >= grandTotal && grandTotal > 0 ? new Date() : null,
        cancelledAt: null,
        voidedAt: null,
        refundedAt: null,
        deletedAt: null
      }
    };
  }

  private calculateLineItem(input: InvoiceLineInput): InvoiceLineItem {
    const quantity = Number(input.quantity ?? 0);
    const unitPrice = Number(input.unitPrice ?? 0);
    const lineSubtotal = roundMoney(quantity * unitPrice);
    const discountValue = Number(input.discountValue ?? 0);
    const lineDiscount =
      (input.discountType ?? "fixed") === "percentage" ? roundMoney(lineSubtotal * (discountValue / 100)) : roundMoney(Math.min(discountValue, lineSubtotal));
    const taxableAmount = roundMoney(Math.max(0, lineSubtotal - lineDiscount));
    const taxRate = Number(input.taxRate ?? 0);
    const taxInclusive = Boolean(input.taxInclusive);
    const taxAmount = taxInclusive ? roundMoney(taxableAmount - taxableAmount / (1 + taxRate / 100 || 1)) : roundMoney(taxableAmount * (taxRate / 100));
    const lineTotal = taxInclusive ? taxableAmount : roundMoney(taxableAmount + taxAmount);
    return {
      id: randomUUID(),
      productId: input.productId ?? null,
      productName: input.productName ?? null,
      description: input.description,
      quantity,
      unit: input.unit,
      unitPrice,
      discountType: input.discountType ?? "fixed",
      discountValue,
      lineDiscount,
      lineSubtotal,
      lineTax: taxAmount,
      lineTotal,
      tax: {
        taxCategory: input.taxCategory ?? "vat",
        taxCode: input.taxCode ?? null,
        taxRate,
        taxInclusive,
        taxAmount,
        taxableAmount
      }
    };
  }

  private createHistoryEntry(action: string, note: string, actorId: string | null, payload: Record<string, unknown>) {
    return {
      id: randomUUID(),
      action,
      note,
      actorId,
      createdAt: new Date().toISOString(),
      payload
    };
  }

  private assertTransition(current: InvoiceLifecycleStatus, next: InvoiceLifecycleStatus) {
    if (current === next) return;
    const allowed: Record<InvoiceLifecycleStatus, InvoiceLifecycleStatus[]> = {
      draft: ["sent", "cancelled", "void", "archived"],
      sent: ["viewed", "partially_paid", "paid", "overdue", "cancelled", "void", "archived"],
      viewed: ["partially_paid", "paid", "overdue", "cancelled", "void", "archived"],
      partially_paid: ["partially_paid", "paid", "overdue", "refunded", "archived"],
      paid: ["refunded", "archived"],
      overdue: ["partially_paid", "paid", "cancelled", "void", "archived"],
      cancelled: [],
      void: [],
      refunded: ["archived"],
      archived: ["draft"]
    };
    if (!allowed[current]?.includes(next)) {
      throw new BadRequestException(`Invalid invoice transition from ${current} to ${next}`);
    }
  }

  private isFinalStatus(status: InvoiceLifecycleStatus) {
    return FINAL_STATUSES.includes(status);
  }

  private applyFiscalization(invoice: any, fiscalization: FiscalizationOutcome) {
    invoice.fiscalizationStatus = fiscalization.status;
    invoice.fiscalizationReference = fiscalization.reference ?? null;
    invoice.fiscalizationDocumentNumber = fiscalization.documentNumber ?? null;
    invoice.fiscalizationResponse = fiscalization.response ?? null;
    invoice.fiscalizationError = fiscalization.error ?? null;
    invoice.fiscalizationPayloadReference = fiscalization.payloadReference ?? null;
    invoice.fiscalizationDate = fiscalization.status === "submitted" ? new Date() : invoice.fiscalizationDate ?? null;
  }

  private async writeAudit(session: any, businessId: string, entityType: string, entityId: string, action: string, payload: Record<string, unknown>) {
    const options = session ? { session } : undefined;
    await this.auditLogModel.create([{ businessId, entityType, entityId, action, payload }], options as any);
  }

  private serializeInvoice(invoice: Record<string, any>): InvoiceView {
    const { _id, history, payments, ...rest } = invoice;
    const issueDate = toSafeIsoDateString(rest.issueDate ?? null);
    const dueDate = toSafeIsoDateString(rest.dueDate ?? null);
    const balanceDue = Number(rest.balanceDue ?? 0);
    const status = this.resolveStatus(rest.status, dueDate, balanceDue);
    return {
      id: String(rest.externalId ?? _id),
      businessId: String(rest.businessId),
      branchId: rest.branchId ?? null,
      customerId: rest.customerId ?? null,
      customerName: rest.customerName ?? null,
      customerBusinessName: rest.customerBusinessName ?? null,
      customerEmail: rest.customerEmail ?? null,
      customerPhone: rest.customerPhone ?? null,
      customerAddress: rest.customerAddress ?? null,
      customerTaxPin: rest.customerTaxPin ?? null,
      invoiceNumber: String(rest.invoiceNumber ?? ""),
      externalId: rest.externalId ?? null,
      referenceNumber: rest.referenceNumber ?? null,
      purchaseOrderNumber: rest.purchaseOrderNumber ?? null,
      issueDate,
      dueDate,
      paymentTerms: rest.paymentTerms ?? "30 days",
      currency: rest.currency ?? "KES",
      status,
      subtotal: Number(rest.subtotal ?? 0),
      discountTotal: Number(rest.discountTotal ?? 0),
      taxableAmount: Number(rest.taxableAmount ?? 0),
      taxTotal: Number(rest.taxTotal ?? 0),
      grandTotal: Number(rest.grandTotal ?? 0),
      amountPaid: Number(rest.amountPaid ?? 0),
      balanceDue,
      notes: rest.notes ?? null,
      termsAndConditions: rest.termsAndConditions ?? null,
      archivedAt: rest.archivedAt ? toSafeIsoString(rest.archivedAt) : null,
      sentAt: rest.sentAt ? toSafeIsoString(rest.sentAt) : null,
      viewedAt: rest.viewedAt ? toSafeIsoString(rest.viewedAt) : null,
      paidAt: rest.paidAt ? toSafeIsoString(rest.paidAt) : null,
      cancelledAt: rest.cancelledAt ? toSafeIsoString(rest.cancelledAt) : null,
      voidedAt: rest.voidedAt ? toSafeIsoString(rest.voidedAt) : null,
      refundedAt: rest.refundedAt ? toSafeIsoString(rest.refundedAt) : null,
      shareToken: rest.shareToken ?? null,
      fiscalizationStatus: rest.fiscalizationStatus ?? null,
      fiscalizationProvider: rest.fiscalizationProvider ?? null,
      fiscalizationReference: rest.fiscalizationReference ?? null,
      fiscalizationRequestId: rest.fiscalizationRequestId ?? null,
      fiscalizationDocumentNumber: rest.fiscalizationDocumentNumber ?? null,
      fiscalizationDate: rest.fiscalizationDate ? toSafeIsoString(rest.fiscalizationDate) : null,
      fiscalizationResponse: rest.fiscalizationResponse ?? null,
      fiscalizationError: rest.fiscalizationError ?? null,
      fiscalizationPayloadReference: rest.fiscalizationPayloadReference ?? null,
      lineItems: Array.isArray(rest.lineItems) ? rest.lineItems.map((line: any) => this.serializeLineItem(line)) : [],
      payments: Array.isArray(payments) ? payments.map((payment: any) => this.serializePayment(payment)) : Array.isArray(rest.payments) ? rest.payments.map((payment: any) => this.serializePayment(payment)) : [],
      history: Array.isArray(history)
        ? history.map((entry: any) => ({
            id: String(entry.id ?? randomUUID()),
            action: String(entry.action ?? "event"),
            note: entry.note ?? null,
            actorId: entry.actorId ?? null,
            createdAt: String(entry.createdAt ?? new Date().toISOString()),
            payload: entry.payload ?? null
          }))
        : [],
      creditNotes: Array.isArray(invoice.creditNotes) ? invoice.creditNotes.map((note: any) => this.serializeCreditNote(note)) : [],
      debitNotes: Array.isArray(invoice.debitNotes) ? invoice.debitNotes.map((note: any) => this.serializeDebitNote(note)) : []
    };
  }

  private serializeLineItem(line: Record<string, any>): InvoiceLineItem {
    return {
      id: String(line.id ?? randomUUID()),
      productId: line.productId ?? null,
      productName: line.productName ?? null,
      description: String(line.description ?? line.productName ?? "Item"),
      quantity: Number(line.quantity ?? 0),
      unit: String(line.unit ?? "pcs"),
      unitPrice: Number(line.unitPrice ?? 0),
      discountType: line.discountType ?? "fixed",
      discountValue: Number(line.discountValue ?? 0),
      lineDiscount: Number(line.lineDiscount ?? 0),
      lineSubtotal: Number(line.lineSubtotal ?? 0),
      lineTax: Number(line.lineTax ?? 0),
      lineTotal: Number(line.lineTotal ?? 0),
      tax: {
        taxCategory: line.tax?.taxCategory ?? "vat",
        taxCode: line.tax?.taxCode ?? null,
        taxRate: Number(line.tax?.taxRate ?? 0),
        taxInclusive: Boolean(line.tax?.taxInclusive),
        taxAmount: Number(line.tax?.taxAmount ?? 0),
        taxableAmount: Number(line.tax?.taxableAmount ?? 0)
      }
    };
  }

  private serializePayment(payment: Record<string, any>) {
    return {
      id: String(payment.externalId ?? payment._id ?? randomUUID()),
      businessId: String(payment.businessId ?? ""),
      branchId: payment.branchId ?? null,
      customerId: payment.customerId ?? null,
      saleId: payment.saleId ?? null,
      invoiceId: payment.invoiceId ?? null,
      debtPaymentId: payment.debtPaymentId ?? null,
      method: payment.method,
      status: payment.status,
      amount: Number(payment.amount ?? 0),
      reference: payment.reference ?? null,
      note: payment.note ?? null,
      provider: payment.provider ?? null,
      reconciledAt: payment.reconciledAt ? toSafeIsoString(payment.reconciledAt) : null,
      createdAt: payment.createdAt ? toSafeIsoString(payment.createdAt) : new Date().toISOString(),
      updatedAt: payment.updatedAt ? toSafeIsoString(payment.updatedAt) : new Date().toISOString()
    };
  }

  private serializeCreditNote(note: Record<string, any>) {
    const { _id, ...rest } = note;
    return {
      ...rest,
      id: String(rest.externalId ?? _id),
      invoiceId: rest.invoiceId ?? null,
      relatedSaleId: rest.relatedSaleId ?? null,
      customerId: rest.customerId ?? null,
      note: rest.note ?? null,
      deletedAt: rest.deletedAt ?? null,
      creditDate: toSafeIsoDateString(rest.creditDate ?? null)
    };
  }

  private serializeDebitNote(note: Record<string, any>): DebitNoteView {
    const { _id, ...rest } = note;
    return {
      id: String(rest.externalId ?? _id),
      businessId: String(rest.businessId ?? ""),
      createdAt: toSafeIsoString(rest.createdAt ?? new Date()),
      updatedAt: toSafeIsoString(rest.updatedAt ?? new Date()),
      deletedAt: rest.deletedAt ?? null,
      invoiceId: String(rest.invoiceId ?? ""),
      customerId: rest.customerId ?? null,
      reference: String(rest.reference ?? ""),
      reason: String(rest.reason ?? ""),
      amount: Number(rest.amount ?? 0),
      taxAdjustment: Number(rest.taxAdjustment ?? 0),
      note: rest.note ?? null,
      status: rest.status ?? "draft",
      issuedAt: toSafeIsoDateString(rest.issuedAt ?? null)
    };
  }

  private resolveStatus(status: any, dueDate: string, balanceDue: number): InvoiceLifecycleStatus {
    if (status === "sent" || status === "viewed" || status === "partially_paid" || status === "overdue") {
      if (balanceDue > 0 && new Date(dueDate).getTime() < Date.now()) return "overdue";
    }
    return (status ?? (balanceDue <= 0 ? "paid" : "draft")) as InvoiceLifecycleStatus;
  }

  private async enrichCustomerFromInvoice(customerId: string | null, businessId: string, branchId: string | null) {
    if (!customerId) return null;
    return this.customerModel.findOne({ _id: customerId, businessId, deletedAt: null, ...buildBranchMatch(branchId) }).lean();
  }
}

function buildDateRange(from?: string, to?: string) {
  if (!from && !to) return null;
  const range: Record<string, Date> = {};
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

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function sameYear(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear();
}

function buildInvoiceHtml(invoice: InvoiceView, business: Record<string, any>) {
  const rows = invoice.lineItems
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(line.description)}</td>
          <td style="text-align:center">${line.quantity}</td>
          <td style="text-align:right">${formatMoney(line.unitPrice, invoice.currency)}</td>
          <td style="text-align:right">${formatMoney(line.lineDiscount, invoice.currency)}</td>
          <td style="text-align:right">${formatMoney(line.lineTax, invoice.currency)}</td>
          <td style="text-align:right">${formatMoney(line.lineTotal, invoice.currency)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { margin: 0; padding: 24px; font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #f8fafc; }
        .sheet { max-width: 840px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; }
        .hero { padding: 28px; background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); color: #fff; display: flex; justify-content: space-between; gap: 20px; }
        .title { font-size: 34px; font-weight: 800; margin: 0; }
        .muted { color: #94a3b8; font-size: 12px; }
        .body { padding: 24px; display: grid; gap: 18px; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
        .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; background: #f8fafc; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        th { text-align: left; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
        .totals { display: grid; gap: 6px; justify-content: end; max-width: 280px; margin-left: auto; }
        .totals div { display: flex; justify-content: space-between; gap: 16px; }
        .footer { padding: 18px 24px 26px; color: #475569; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="hero">
          <div>
            <p class="muted">Commercial invoice</p>
            <h1 class="title">${escapeHtml(business.name ?? "Biz Pro")}</h1>
            <div>${escapeHtml(business.address ?? "")}</div>
            <div>${escapeHtml(business.phone ?? "")} ${business.email ? `• ${escapeHtml(business.email)}` : ""}</div>
            <div>${business.taxPin ? `Tax PIN: ${escapeHtml(business.taxPin)}` : ""}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px; opacity:0.8">Invoice #</div>
            <div style="font-size:28px; font-weight:800">${escapeHtml(invoice.invoiceNumber)}</div>
            <div>${escapeHtml(invoice.status.replaceAll("_", " ").toUpperCase())}</div>
          </div>
        </div>
        <div class="body">
          <div class="grid">
            <div class="card">
              <div class="muted">Bill to</div>
              <div style="font-size:18px; font-weight:700; margin-top:4px">${escapeHtml(invoice.customerName ?? "Customer")}</div>
              <div>${escapeHtml(invoice.customerBusinessName ?? "")}</div>
              <div>${escapeHtml(invoice.customerAddress ?? "")}</div>
              <div>${escapeHtml(invoice.customerEmail ?? "")}</div>
              <div>${escapeHtml(invoice.customerPhone ?? "")}</div>
              <div>${escapeHtml(invoice.customerTaxPin ?? "")}</div>
            </div>
            <div class="card">
              <div class="muted">Invoice details</div>
              <div style="margin-top:6px"><strong>Date:</strong> ${invoice.issueDate}</div>
              <div><strong>Due:</strong> ${invoice.dueDate}</div>
              <div><strong>Payment terms:</strong> ${escapeHtml(invoice.paymentTerms)}</div>
              <div><strong>Reference:</strong> ${escapeHtml(invoice.referenceNumber ?? "-")}</div>
              <div><strong>PO number:</strong> ${escapeHtml(invoice.purchaseOrderNumber ?? "-")}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align:center">Qty</th>
                <th style="text-align:right">Unit</th>
                <th style="text-align:right">Discount</th>
                <th style="text-align:right">Tax</th>
                <th style="text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="totals">
            <div><span>Subtotal</span><strong>${formatMoney(invoice.subtotal, invoice.currency)}</strong></div>
            <div><span>Discounts</span><strong>${formatMoney(invoice.discountTotal, invoice.currency)}</strong></div>
            <div><span>Tax</span><strong>${formatMoney(invoice.taxTotal, invoice.currency)}</strong></div>
            <div><span>Paid</span><strong>${formatMoney(invoice.amountPaid, invoice.currency)}</strong></div>
            <div><span>Balance</span><strong>${formatMoney(invoice.balanceDue, invoice.currency)}</strong></div>
            <div><span>Grand total</span><strong>${formatMoney(invoice.grandTotal, invoice.currency)}</strong></div>
          </div>
          ${invoice.notes ? `<div class="card"><div class="muted">Notes</div><div>${escapeHtml(invoice.notes)}</div></div>` : ""}
          ${invoice.termsAndConditions ? `<div class="card"><div class="muted">Terms & conditions</div><div>${escapeHtml(invoice.termsAndConditions)}</div></div>` : ""}
        </div>
        <div class="footer">
          ${business.vatRegistrationNumber ? `VAT registration: ${escapeHtml(business.vatRegistrationNumber)} • ` : ""}Generated by Biz Pro
        </div>
      </div>
    </body>
  </html>`;
}

function formatMoney(amount: number, currency: string) {
  return `${currency} ${Number(amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
