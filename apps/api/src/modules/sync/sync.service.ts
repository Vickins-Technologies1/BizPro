import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  AuditLog,
  AuditLogDocument,
  Category,
  CategoryDocument,
  Customer,
  CustomerDocument,
  Expense,
  ExpenseDocument,
  Payment,
  PaymentDocument,
  Product,
  ProductDocument,
  Sale,
  SaleDocument,
  StockMovement,
  StockMovementDocument,
  SyncCheckpoint,
  SyncCheckpointDocument,
  SyncEvent,
  SyncEventDocument
} from "../schemas";
import { CreateSaleInput } from "../sales/sales.service";

@Injectable()
export class SyncService {
  constructor(
    @InjectModel(SyncEvent.name) private readonly syncEventModel: Model<SyncEventDocument>,
    @InjectModel(SyncCheckpoint.name) private readonly checkpointModel: Model<SyncCheckpointDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(StockMovement.name) private readonly stockMovementModel: Model<StockMovementDocument>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>
  ) {}

  async push(businessId: string, deviceId: string, events: Array<{ eventId: string; entityType: string; entityId: string; action: string; payload: Record<string, unknown>; createdAt: string }>) {
    const acknowledgements: Array<{ eventId: string }> = [];
    for (const event of events) {
      const existing = await this.syncEventModel.findOne({ eventId: event.eventId }).lean();
      if (existing) {
        acknowledgements.push({ eventId: event.eventId });
        continue;
      }
      const record = await this.syncEventModel.create({
        eventId: event.eventId,
        businessId,
        deviceId,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        payload: event.payload,
        status: "pending",
        retryCount: 0,
        lastError: null
      });
      try {
        await this.applyEvent(businessId, event);
        await this.syncEventModel.findByIdAndUpdate(record._id, { status: "applied" });
        acknowledgements.push({ eventId: event.eventId });
      } catch (error) {
        await this.syncEventModel.findByIdAndUpdate(record._id, {
          status: "failed",
          lastError: error instanceof Error ? error.message : "Sync apply failed",
          retryCount: 1
        });
        throw error;
      }
    }
    await this.checkpointModel.findOneAndUpdate(
      { businessId, deviceId },
      { businessId, deviceId, lastPushedAt: new Date(), updatedAt: new Date() },
      { upsert: true, new: true }
    );
    return { acknowledgements, cursor: new Date().toISOString() };
  }

  async pull(businessId: string, deviceId: string, since?: string) {
    const after = since ? new Date(since) : new Date(0);
    const [categories, products, customers, expenses, sales, payments, stockMovements] = await Promise.all([
      this.categoryModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.productModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.customerModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.expenseModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.saleModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.paymentModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.stockMovementModel.find({ businessId, updatedAt: { $gt: after } }).lean()
    ]);
    const changes = [
      ...categories.map((payload) => ({ entityType: "category", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...products.map((payload) => ({ entityType: "product", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...customers.map((payload) => ({ entityType: "customer", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...expenses.map((payload) => ({ entityType: "expense", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...sales.map((payload) => ({ entityType: "sale", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...payments.map((payload) => ({ entityType: "payment", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...stockMovements.map((payload) => ({ entityType: "stockMovement", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } }))
    ];
    await this.checkpointModel.findOneAndUpdate(
      { businessId, deviceId },
      { businessId, deviceId, lastPulledAt: new Date(), updatedAt: new Date() },
      { upsert: true, new: true }
    );
    return { cursor: new Date().toISOString(), changes };
  }

  async health(businessId: string) {
    const [pendingEvents, checkpoints] = await Promise.all([
      this.syncEventModel.countDocuments({ businessId, status: { $in: ["pending", "failed"] } }),
      this.checkpointModel.find({ businessId }).sort({ updatedAt: -1 }).lean()
    ]);
    return { pendingEvents, checkpoints };
  }

  private async applyEvent(businessId: string, event: { entityType: string; action: string; entityId: string; payload: Record<string, unknown> }) {
    if (event.entityType === "product") {
      await this.productModel.findOneAndUpdate(
        { businessId, externalId: event.entityId },
        {
          externalId: event.entityId,
          businessId,
          categoryId: (event.payload.categoryId as string | null) ?? null,
          name: String(event.payload.name),
          sku: (event.payload.sku as string | null) ?? null,
          barcode: (event.payload.barcode as string | null) ?? null,
          unit: String(event.payload.unit ?? "pcs"),
          buyingPrice: Number(event.payload.buyingPrice ?? 0),
          sellingPrice: Number(event.payload.sellingPrice ?? 0),
          stockOnHand: Number(event.payload.stockOnHand ?? 0),
          lowStockThreshold: Number(event.payload.lowStockThreshold ?? 5),
          isActive: Boolean(event.payload.isActive ?? true),
          deletedAt: (event.payload.deletedAt as string | null) ? new Date(String(event.payload.deletedAt)) : null
        },
        { upsert: true, new: true }
      );
      await this.auditLogModel.create({ businessId, entityType: "product", entityId: event.entityId, action: event.action, payload: event.payload });
      return;
    }
    if (event.entityType === "category") {
      await this.categoryModel.findOneAndUpdate(
        { businessId, externalId: event.entityId },
        {
          externalId: event.entityId,
          businessId,
          name: String(event.payload.name ?? ""),
          color: (event.payload.color as string | null) ?? null,
          sortOrder: Number(event.payload.sortOrder ?? 0),
          deletedAt: null
        },
        { upsert: true, new: true }
      );
      return;
    }
    if (event.entityType === "customer") {
      await this.customerModel.findOneAndUpdate(
        { businessId, externalId: event.entityId },
        {
          externalId: event.entityId,
          businessId,
          name: String(event.payload.name),
          phone: (event.payload.phone as string | null) ?? null,
          email: (event.payload.email as string | null) ?? null,
          notes: (event.payload.notes as string | null) ?? null,
          balance: Number(event.payload.balance ?? 0),
          deletedAt: (event.payload.deletedAt as string | null) ? new Date(String(event.payload.deletedAt)) : null
        },
        { upsert: true, new: true }
      );
      return;
    }
    if (event.entityType === "expense") {
      await this.expenseModel.findOneAndUpdate(
        { businessId, externalId: event.entityId },
        {
          externalId: event.entityId,
          businessId,
          categoryId: (event.payload.categoryId as string | null) ?? null,
          amount: Number(event.payload.amount ?? 0),
          note: String(event.payload.note ?? ""),
          expenseDate: event.payload.expenseDate ? new Date(String(event.payload.expenseDate)) : new Date(),
          recordedById: (event.payload.recordedById as string | null) ?? null,
          deletedAt: null
        },
        { upsert: true, new: true }
      );
      return;
    }
    if (event.entityType === "sale") {
      const sale = event.payload.sale as Record<string, unknown> | undefined;
      const payment = event.payload.payment as Record<string, unknown> | undefined;
      if (sale) {
        await this.saleModel.findOneAndUpdate(
          { businessId, externalId: String(sale.id ?? event.entityId) },
          {
            externalId: String(sale.id ?? event.entityId),
            businessId,
            branchId: (sale.branchId as string | null) ?? null,
            customerId: (sale.customerId as string | null) ?? null,
            receiptNumber: String(sale.receiptNumber ?? ""),
            subtotal: Number(sale.subtotal ?? 0),
            discountTotal: Number(sale.discountTotal ?? 0),
            taxTotal: Number(sale.taxTotal ?? 0),
            grandTotal: Number(sale.grandTotal ?? 0),
            amountPaid: Number(sale.amountPaid ?? 0),
            balanceDue: Number(sale.balanceDue ?? 0),
            paymentStatus: String(sale.paymentStatus ?? "paid"),
            paymentMethod: String(sale.paymentMethod ?? "cash"),
            cashierId: (sale.cashierId as string | null) ?? null,
            notes: (sale.notes as string | null) ?? null,
            items: Array.isArray(sale.items) ? sale.items : [],
            deletedAt: null
          },
          { upsert: true, new: true }
        );
      }
      if (payment) {
        const paymentExternalId = String(payment.id ?? sale?.id ?? event.entityId);
        await this.paymentModel.findOneAndUpdate(
          { businessId, externalId: paymentExternalId },
          {
            externalId: paymentExternalId,
            businessId,
            customerId: (payment.customerId as string | null) ?? (sale?.customerId as string | null) ?? null,
            saleId: String(sale?.id ?? event.entityId),
            debtPaymentId: (payment.debtPaymentId as string | null) ?? null,
            method: String(payment.method ?? "cash"),
            status: String(payment.status ?? "paid"),
            amount: Number(payment.amount ?? 0),
            reference: (payment.reference as string | null) ?? null,
            note: (payment.note as string | null) ?? null,
            provider: (payment.provider as string | null) ?? null,
            reconciledAt: payment.reconciledAt ? new Date(String(payment.reconciledAt)) : null
          },
          { upsert: true, new: true }
        );
      }
    }
    if (event.entityType === "payment") {
      const payment = event.payload as Record<string, unknown>;
      const paymentExternalId = String(payment.id ?? event.entityId);
      await this.paymentModel.findOneAndUpdate(
        { businessId, externalId: paymentExternalId },
        {
          externalId: paymentExternalId,
          businessId,
          customerId: (payment.customerId as string | null) ?? null,
          saleId: (payment.saleId as string | null) ?? null,
          debtPaymentId: (payment.debtPaymentId as string | null) ?? null,
          method: String(payment.method ?? "cash"),
          status: String(payment.status ?? "paid"),
          amount: Number(payment.amount ?? 0),
          reference: (payment.reference as string | null) ?? null,
          note: (payment.note as string | null) ?? null,
          provider: (payment.provider as string | null) ?? null,
          reconciledAt: payment.reconciledAt ? new Date(String(payment.reconciledAt)) : null
        },
        { upsert: true, new: true }
      );
      return;
    }
    if (event.entityType === "stockMovement") {
      const movementId = String(event.entityId);
      await this.stockMovementModel.findOneAndUpdate(
        { businessId, externalId: movementId },
        {
          externalId: movementId,
          businessId,
          productId: String(event.payload.productId ?? ""),
          referenceType: String(event.payload.referenceType ?? "restock"),
          referenceId: String(event.payload.referenceId ?? movementId),
          quantityDelta: Number(event.payload.quantityDelta ?? 0),
          unitCost: Number(event.payload.unitCost ?? 0),
          note: (event.payload.note as string | null) ?? null
        },
        { upsert: true, new: true }
      );
      await this.productModel.findOneAndUpdate(
        { businessId, externalId: String(event.payload.productId ?? "") },
        { $inc: { stockOnHand: Number(event.payload.quantityDelta ?? 0) } }
      );
    }
  }
}
