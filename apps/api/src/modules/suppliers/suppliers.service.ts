import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { endOfDay, format, parseISO, startOfDay, subMonths } from "date-fns";
import {
  PurchaseOrder,
  PurchaseOrderDocument,
  Supplier,
  SupplierCategory,
  SupplierCategoryDocument,
  SupplierContact,
  SupplierContactDocument,
  SupplierFile,
  SupplierFileDocument,
  SupplierPayment,
  SupplierPaymentDocument
} from "../schemas";
import type { Supplier as SharedSupplier, SupplierDocument as SharedSupplierDocument, SupplierPerformanceReport, SupplierStatement } from "@vbo/shared";
import { toSafeIsoString } from "../../common/date-normalizer";

@Injectable()
export class SuppliersService {
  constructor(
    @InjectModel(Supplier.name) private readonly supplierModel: Model<SharedSupplier>,
    @InjectModel(SupplierCategory.name) private readonly supplierCategoryModel: Model<SupplierCategoryDocument>,
    @InjectModel(SupplierContact.name) private readonly supplierContactModel: Model<SupplierContactDocument>,
    @InjectModel(SupplierFile.name) private readonly supplierDocumentModel: Model<SupplierFileDocument>,
    @InjectModel(SupplierPayment.name) private readonly supplierPaymentModel: Model<SupplierPaymentDocument>,
    @InjectModel(PurchaseOrder.name) private readonly purchaseOrderModel: Model<PurchaseOrderDocument>
  ) {}

  list(businessId: string) {
    return this.supplierModel.find({ businessId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  async create(input: Partial<Supplier> & { businessId: string; name: string }) {
    if (input.externalId) {
      const existing = await this.supplierModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    return this.supplierModel.create({
      ...input,
      categoryId: input.categoryId ?? null,
      deletedAt: null,
      isActive: input.isActive ?? true
    });
  }

  async update(businessId: string, id: string, patch: Partial<Supplier>) {
    const { businessId: _ignoredBusinessId, ...safePatch } = patch;
    const updated = await this.supplierModel.findOneAndUpdate({ _id: id, businessId }, { ...safePatch, categoryId: safePatch.categoryId ?? null }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Supplier not found");
    return updated;
  }

  async archive(businessId: string, id: string) {
    const updated = await this.supplierModel.findOneAndUpdate({ _id: id, businessId }, { deletedAt: new Date(), isActive: false }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Supplier not found");
    return updated;
  }

  listCategories(businessId: string) {
    return this.supplierCategoryModel.find({ businessId, deletedAt: null }).sort({ sortOrder: 1, createdAt: -1 }).lean();
  }

  async createCategory(input: Partial<SupplierCategory> & { businessId: string; name: string }) {
    if (input.externalId) {
      const existing = await this.supplierCategoryModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    return this.supplierCategoryModel.create({
      ...input,
      description: input.description ?? null,
      color: input.color ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      deletedAt: null
    });
  }

  async updateCategory(businessId: string, id: string, patch: Partial<SupplierCategory>) {
    const { businessId: _ignoredBusinessId, ...safePatch } = patch;
    const updated = await this.supplierCategoryModel.findOneAndUpdate({ _id: id, businessId }, safePatch, { new: true }).lean();
    if (!updated) throw new NotFoundException("Supplier category not found");
    return updated;
  }

  async archiveCategory(businessId: string, id: string) {
    const updated = await this.supplierCategoryModel.findOneAndUpdate({ _id: id, businessId }, { deletedAt: new Date(), isActive: false }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Supplier category not found");
    return updated;
  }

  listContacts(businessId: string, supplierId: string) {
    return this.supplierContactModel.find({ businessId, supplierId, deletedAt: null }).sort({ isPrimary: -1, createdAt: -1 }).lean();
  }

  async createContact(input: Partial<SupplierContact> & { businessId: string; supplierId: string; name: string }) {
    if (input.externalId) {
      const existing = await this.supplierContactModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    return this.supplierContactModel.create({
      ...input,
      role: input.role ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
      isPrimary: input.isPrimary ?? false,
      deletedAt: null
    });
  }

  async updateContact(businessId: string, supplierId: string, id: string, patch: Partial<SupplierContact>) {
    const { businessId: _ignoredBusinessId, supplierId: _ignoredSupplierId, ...safePatch } = patch;
    const updated = await this.supplierContactModel.findOneAndUpdate({ _id: id, businessId, supplierId }, safePatch, { new: true }).lean();
    if (!updated) throw new NotFoundException("Supplier contact not found");
    return updated;
  }

  async archiveContact(businessId: string, supplierId: string, id: string) {
    const updated = await this.supplierContactModel.findOneAndUpdate({ _id: id, businessId, supplierId }, { deletedAt: new Date() }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Supplier contact not found");
    return updated;
  }

  listDocuments(businessId: string, supplierId: string) {
    return this.supplierDocumentModel.find({ businessId, supplierId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  async createDocument(
    input: Partial<SharedSupplierDocument> & { externalId?: string | null; businessId: string; supplierId: string; title: string; url: string }
  ) {
    if (input.externalId) {
      const existing = await this.supplierDocumentModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    return this.supplierDocumentModel.create({
      ...input,
      fileName: input.fileName ?? null,
      documentType: input.documentType ?? null,
      note: input.note ?? null,
      uploadedById: input.uploadedById ?? null,
      deletedAt: null
    });
  }

  async updateDocument(businessId: string, supplierId: string, id: string, patch: Partial<SharedSupplierDocument>) {
    const { businessId: _ignoredBusinessId, supplierId: _ignoredSupplierId, ...safePatch } = patch;
    const updated = await this.supplierDocumentModel.findOneAndUpdate({ _id: id, businessId, supplierId }, safePatch, { new: true }).lean();
    if (!updated) throw new NotFoundException("Supplier document not found");
    return updated;
  }

  async archiveDocument(businessId: string, supplierId: string, id: string) {
    const updated = await this.supplierDocumentModel.findOneAndUpdate({ _id: id, businessId, supplierId }, { deletedAt: new Date() }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Supplier document not found");
    return updated;
  }

  listPayments(businessId: string, supplierId: string, from?: string, to?: string) {
    const range = buildDateRange(from, to);
    return this.supplierPaymentModel.find({ businessId, supplierId, deletedAt: null, ...(range ? { paymentDate: range } : {}) }).sort({ paymentDate: -1 }).lean();
  }

  async createPayment(input: Partial<SupplierPayment> & { businessId: string; supplierId: string; amount: number; method: SupplierPayment["method"]; paymentDate: Date }) {
    if (input.externalId) {
      const existing = await this.supplierPaymentModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    return this.supplierPaymentModel.create({
      ...input,
      purchaseOrderId: input.purchaseOrderId ?? null,
      reference: input.reference ?? null,
      note: input.note ?? null,
      recordedById: input.recordedById ?? null,
      deletedAt: null
    });
  }

  async archivePayment(businessId: string, supplierId: string, id: string) {
    const updated = await this.supplierPaymentModel.findOneAndUpdate({ _id: id, businessId, supplierId }, { deletedAt: new Date() }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Supplier payment not found");
    return updated;
  }

  async statement(businessId: string, supplierId: string, from?: string, to?: string): Promise<SupplierStatement> {
    const supplier = await this.supplierModel.findOne({ businessId, _id: supplierId, deletedAt: null }).lean();
    if (!supplier) throw new NotFoundException("Supplier not found");
    const range = buildRange(from, to);
    const start = range?.from ?? startOfDay(subMonths(new Date(), 11));
    const end = range?.to ?? endOfDay(new Date());

    const [orders, payments, openingOrders, openingPayments] = await Promise.all([
      this.purchaseOrderModel.find({
        businessId,
        supplierId,
        deletedAt: null,
        ...(range ? { orderDate: range } : {})
      }).sort({ orderDate: 1 }).lean(),
      this.supplierPaymentModel.find({
        businessId,
        supplierId,
        deletedAt: null,
        ...(range ? { paymentDate: range } : {})
      }).sort({ paymentDate: 1 }).lean(),
      this.purchaseOrderModel.aggregate([
        {
          $match: {
            businessId,
            supplierId,
            deletedAt: null,
            orderDate: { $lt: start }
          }
        },
        { $match: { status: { $nin: ["draft", "cancelled"] } } },
        { $group: { _id: null, total: { $sum: "$total" } } }
      ]),
      this.supplierPaymentModel.aggregate([
        {
          $match: {
            businessId,
            supplierId,
            deletedAt: null,
            paymentDate: { $lt: start }
          }
        },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    const activeOrders = orders.filter((order) => !["draft", "cancelled"].includes(String(order.status)));
    const billedTotal = activeOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const openingBalance = Number(openingOrders[0]?.total ?? 0) - Number(openingPayments[0]?.total ?? 0);
    const entries = [
      ...activeOrders.map((order) => ({
        date: toSafeIsoString(order.orderDate),
        reference: order.orderNumber,
        description: `Purchase order ${String(order.status).replaceAll("_", " ")}`,
        debit: Number(order.total ?? 0),
        credit: 0,
        kind: "bill" as const
      })),
      ...payments.map((payment) => ({
        date: toSafeIsoString(payment.paymentDate),
        reference: payment.reference ?? payment.externalId ?? "Supplier payment",
        description: `Supplier payment via ${payment.method}`,
        debit: 0,
        credit: Number(payment.amount ?? 0),
        kind: "payment" as const
      }))
    ].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

    let balance = openingBalance;
    const statementEntries = entries.map((entry) => {
      balance = entry.kind === "bill" ? balance + entry.debit : balance - entry.credit;
      return { ...entry, balance };
    });

    return {
      supplierId,
      range: {
        from: start.toISOString(),
        to: end.toISOString(),
        label: buildRangeLabel(start, end)
      },
      openingBalance,
      billedTotal,
      paidTotal,
      outstandingBalance: Math.max(0, openingBalance + billedTotal - paidTotal),
      entries: statementEntries
    };
  }

  async performance(businessId: string, supplierId: string, from?: string, to?: string): Promise<SupplierPerformanceReport> {
    const supplier = await this.supplierModel.findOne({ businessId, _id: supplierId, deletedAt: null }).lean();
    if (!supplier) throw new NotFoundException("Supplier not found");
    const range = buildRange(from, to);
    const orders = await this.purchaseOrderModel.find({
      businessId,
      supplierId,
      deletedAt: null,
      ...(range ? { orderDate: range } : {})
    }).sort({ orderDate: -1 }).lean();
    const payments = await this.supplierPaymentModel.find({
      businessId,
      supplierId,
      deletedAt: null,
      ...(range ? { paymentDate: range } : {})
    }).sort({ paymentDate: -1 }).lean();

    const activeOrders = orders.filter((order) => !["draft", "cancelled"].includes(String(order.status)));
    const billedTotal = activeOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    return {
      supplierId,
      supplierName: String(supplier.name),
      ordersCount: activeOrders.length,
      billedTotal,
      paidTotal,
      outstandingBalance: Math.max(0, billedTotal - paidTotal),
      averageOrderValue: activeOrders.length ? billedTotal / activeOrders.length : 0,
      paymentCoveragePercent: billedTotal > 0 ? (paidTotal / billedTotal) * 100 : 0,
      lastPaymentAt: payments[0]?.paymentDate ? toSafeIsoString(payments[0].paymentDate) : null,
      lastOrderAt: activeOrders[0]?.orderDate ? toSafeIsoString(activeOrders[0].orderDate) : null
    };
  }
}

function buildDateRange(from?: string, to?: string) {
  if (!from && !to) return null;
  const start = from ? normalizeBound(from, "from") : startOfDay(subMonths(new Date(), 11));
  const end = to ? normalizeBound(to, "to") : endOfDay(new Date());
  return { $gte: start, $lte: end };
}

function buildRange(from?: string, to?: string) {
  if (!from && !to) return null;
  const start = from ? normalizeBound(from, "from") : startOfDay(subMonths(new Date(), 11));
  const end = to ? normalizeBound(to, "to") : endOfDay(new Date());
  return { from: start, to: end };
}

function normalizeBound(value: string, bound: "from" | "to") {
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

function buildRangeLabel(start: Date, end: Date) {
  return format(start, "MMM d, yyyy") === format(end, "MMM d, yyyy")
    ? format(start, "MMM d, yyyy")
    : `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
}
