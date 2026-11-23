import { Injectable } from "@nestjs/common";
import { BadRequestException, ConflictException, NotFoundException, Optional } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import { redactSensitiveText } from "../../common/secret-redaction";
import {
  AuditLog,
  AuditLogDocument,
  Brand,
  BrandDocument,
  Category,
  CategoryDocument,
  Customer,
  CustomerDocument,
  CustomerGroup,
  CustomerGroupDocument,
  Expense,
  ExpenseDocument,
  Payment,
  PaymentDocument,
  Product,
  ProductDocument,
  PurchaseOrder,
  PurchaseOrderDocument,
  Sale,
  SaleDocument,
  StockAdjustment,
  StockAdjustmentDocument,
  StockMovement,
  StockMovementDocument,
  StockTransfer,
  StockTransferDocument,
  Supplier,
  SupplierDocument,
  SyncCheckpoint,
  SyncCheckpointDocument,
  SyncEvent,
  SyncEventDocument
} from "../schemas";
import { BusinessOperation as BusinessOperationModel, BusinessOperationDocument } from "../business-operations.schemas";
import { SalesService } from "../sales/sales.service";
import { resolveCatalogCreationContext } from "@vbo/shared";
import { Business, BusinessDocument } from "../schemas";
import { findBusinessByIdentifier } from "../../common/business-lookup";
import { runInTransaction } from "../../common/mongo-transaction";

@Injectable()
export class SyncService {
  constructor(
    @InjectModel(SyncEvent.name) private readonly syncEventModel: Model<SyncEventDocument>,
    @InjectModel(SyncCheckpoint.name) private readonly checkpointModel: Model<SyncCheckpointDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Brand.name) private readonly brandModel: Model<BrandDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(CustomerGroup.name) private readonly customerGroupModel: Model<CustomerGroupDocument>,
    @InjectModel(Supplier.name) private readonly supplierModel: Model<SupplierDocument>,
    @InjectModel(PurchaseOrder.name) private readonly purchaseOrderModel: Model<PurchaseOrderDocument>,
    @InjectModel(StockTransfer.name) private readonly stockTransferModel: Model<StockTransferDocument>,
    @InjectModel(StockAdjustment.name) private readonly stockAdjustmentModel: Model<StockAdjustmentDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(StockMovement.name) private readonly stockMovementModel: Model<StockMovementDocument>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectModel(BusinessOperationModel.name) private readonly businessOperationModel: Model<BusinessOperationDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly salesService: SalesService,
    @Optional() @InjectModel(Business.name) private readonly businessModel?: Model<BusinessDocument>
  ) {}

  async push(businessId: string, deviceId: string, events: Array<{ eventId: string; entityType: string; entityId: string; action: string; payload: Record<string, unknown>; createdAt: string; entityVersion?: number }>) {
    const acknowledgements: Array<{ eventId: string }> = [];
    for (const event of events) {
      const existing = await this.syncEventModel.findOne({ businessId, deviceId, eventId: event.eventId }).lean();
      if (existing) {
        if (existing.status === "applied") {
          acknowledgements.push({ eventId: event.eventId });
          continue;
        }
        if (existing.status === "retrying") throw new ConflictException("This synchronization event is already being retried");
        const claimed = await this.syncEventModel.findOneAndUpdate(
          { _id: existing._id, status: { $in: ["pending", "failed", "sent"] } },
          { $set: { status: "retrying", lastAttemptAt: new Date() }, $inc: { retryCount: 1 } },
          { new: true }
        ).lean();
        if (!claimed) throw new ConflictException("This synchronization event changed state before it could be retried");
        try {
          await this.applyEvent(businessId, event);
          await this.syncEventModel.findByIdAndUpdate(existing._id, { status: "applied", lastError: null });
          acknowledgements.push({ eventId: event.eventId });
          continue;
        } catch (error) {
          await this.syncEventModel.findByIdAndUpdate(existing._id, { status: "failed", lastAttemptAt: new Date(), lastError: sanitizeSyncError(error) });
          throw error;
        }
      }
      if (event.entityVersion !== undefined) {
        const newer = await this.syncEventModel.findOne({ businessId, entityType: event.entityType, entityId: event.entityId, entityVersion: { $gt: event.entityVersion } }).sort({ entityVersion: -1 }).lean();
        if (newer) {
          acknowledgements.push({ eventId: event.eventId });
          continue;
        }
      }
      const record = await this.syncEventModel.create({
        eventId: event.eventId,
        businessId,
        deviceId,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        entityVersion: event.entityVersion ?? null,
        serverReceivedAt: new Date(),
        payload: event.payload,
        status: "pending",
        retryCount: 0,
        lastError: null,
        lastAttemptAt: new Date()
      });
      try {
        await this.applyEvent(businessId, event);
        await this.syncEventModel.findByIdAndUpdate(record._id, { status: "applied" });
        acknowledgements.push({ eventId: event.eventId });
      } catch (error) {
        await this.syncEventModel.findByIdAndUpdate(record._id, {
          status: "failed",
          lastError: sanitizeSyncError(error),
          lastAttemptAt: new Date(),
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
    const [categories, brands, products, customers, customerGroups, suppliers, purchaseOrders, stockTransfers, stockAdjustments, expenses, sales, payments, stockMovements, businessOperations] = await Promise.all([
      this.categoryModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.brandModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.productModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.customerModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.customerGroupModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.supplierModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.purchaseOrderModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.stockTransferModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.stockAdjustmentModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.expenseModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.saleModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.paymentModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.stockMovementModel.find({ businessId, updatedAt: { $gt: after } }).lean(),
      this.businessOperationModel.find({ businessId, updatedAt: { $gt: after } }).lean()
    ]);
    const changes = [
      ...categories.map((payload) => ({ entityType: "category", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...brands.map((payload) => ({ entityType: "brand", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...products.map((payload) => ({ entityType: "product", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...customers.map((payload) => ({ entityType: "customer", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...customerGroups.map((payload) => ({ entityType: "customerGroup", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...suppliers.map((payload) => ({ entityType: "supplier", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...purchaseOrders.map((payload) => ({ entityType: "purchaseOrder", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...stockTransfers.map((payload) => ({ entityType: "stockTransfer", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...stockAdjustments.map((payload) => ({ entityType: "stockAdjustment", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...expenses.map((payload) => ({ entityType: "expense", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...sales.map((payload) => ({ entityType: "sale", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...payments.map((payload) => ({ entityType: "payment", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...stockMovements.map((payload) => ({ entityType: "stockMovement", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } })),
      ...businessOperations.map((payload) => ({ entityType: "businessOperation", action: "upsert", entityId: payload.externalId ?? payload._id.toString(), payload: { ...payload, id: payload.externalId ?? payload._id.toString() } }))
    ];
    await this.checkpointModel.findOneAndUpdate(
      { businessId, deviceId },
      { businessId, deviceId, lastPulledAt: new Date(), updatedAt: new Date() },
      { upsert: true, new: true }
    );
    return { cursor: new Date().toISOString(), changes };
  }

  async retryFailedEvent(id: string) {
    const event = await this.syncEventModel.findOne({ eventId: id }).lean();
    if (!event) throw new NotFoundException("Sync event not found");
    if (event.status === "applied") return { eventId: event.eventId, businessId: event.businessId, deviceId: event.deviceId, status: event.status, retryCount: event.retryCount };
    if (event.status !== "failed") throw new ConflictException("Only failed synchronization events can be retried");

    const claimed = await this.syncEventModel.findOneAndUpdate(
      { _id: event._id, status: "failed" },
      { $set: { status: "retrying", lastAttemptAt: new Date() }, $inc: { retryCount: 1 } },
      { new: true }
    ).lean();
    if (!claimed) throw new ConflictException("This synchronization event is already being retried");

    try {
      await this.applyEvent(claimed.businessId, claimed);
      const completed = await this.syncEventModel.findByIdAndUpdate(claimed._id, { status: "applied", lastError: null }, { new: true }).lean();
      return { eventId: claimed.eventId, businessId: claimed.businessId, deviceId: claimed.deviceId, status: "applied", retryCount: completed?.retryCount ?? claimed.retryCount };
    } catch (error) {
      const failed = await this.syncEventModel.findByIdAndUpdate(claimed._id, { status: "failed", lastError: sanitizeSyncError(error), lastAttemptAt: new Date() }, { new: true }).lean();
      return { eventId: claimed.eventId, businessId: claimed.businessId, deviceId: claimed.deviceId, status: "failed", retryCount: failed?.retryCount ?? claimed.retryCount, lastError: failed?.lastError ?? "Retry failed" };
    }
  }

  async health(businessId: string) {
    const [pendingEvents, checkpoints] = await Promise.all([
      this.syncEventModel.countDocuments({ businessId, status: { $in: ["pending", "failed"] } }),
      this.checkpointModel.find({ businessId }).sort({ updatedAt: -1 }).lean()
    ]);
    return { pendingEvents, checkpoints };
  }

  private async applyEvent(businessId: string, event: { entityType: string; action: string; entityId: string; payload: Record<string, unknown> }) {
    if (event.entityType === "businessOperation") {
      await this.businessOperationModel.findOneAndUpdate(
        { businessId, externalId: event.entityId },
        {
          externalId: event.entityId,
          businessId,
          branchId: (event.payload.branchId as string | null) ?? null,
          kind: String(event.payload.kind ?? "order"),
          status: String(event.payload.status ?? "open"),
          title: String(event.payload.title ?? "Operation"),
          customerId: (event.payload.customerId as string | null) ?? null,
          staffId: (event.payload.staffId as string | null) ?? null,
          scheduledAt: event.payload.scheduledAt ? new Date(String(event.payload.scheduledAt)) : null,
          durationMinutes: event.payload.durationMinutes == null ? null : Number(event.payload.durationMinutes),
          tableName: (event.payload.tableName as string | null) ?? null,
          vehiclePlate: (event.payload.vehiclePlate as string | null) ?? null,
          vehicleMake: (event.payload.vehicleMake as string | null) ?? null,
          vehicleModel: (event.payload.vehicleModel as string | null) ?? null,
          vehicleYear: event.payload.vehicleYear == null ? null : Number(event.payload.vehicleYear),
          vehicleMileage: event.payload.vehicleMileage == null ? null : Number(event.payload.vehicleMileage),
          notes: (event.payload.notes as string | null) ?? null,
          items: Array.isArray(event.payload.items) ? event.payload.items : [],
          total: Number(event.payload.total ?? 0),
          deletedAt: event.payload.deletedAt ? new Date(String(event.payload.deletedAt)) : null
        },
        { upsert: true, new: true }
      );
      return;
    }
    if (event.entityType === "product") {
      const productPayload = await this.normalizeProductSyncPayload(businessId, event.payload);
      await this.productModel.findOneAndUpdate(
        { businessId, externalId: event.entityId },
        {
          externalId: event.entityId,
          businessId,
          ...productPayload
        },
        { upsert: true, new: true }
      );
      await this.auditLogModel.create({ businessId, entityType: "product", entityId: event.entityId, action: event.action, payload: event.payload });
      return;
    }
    if (event.entityType === "brand") {
      await this.brandModel.findOneAndUpdate(
        { businessId, externalId: event.entityId },
        {
          externalId: event.entityId,
          businessId,
          name: String(event.payload.name ?? ""),
          description: (event.payload.description as string | null) ?? null,
          isActive: Boolean(event.payload.isActive ?? true),
          deletedAt: null
        },
        { upsert: true, new: true }
      );
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
    if (event.entityType === "supplier") {
      await this.supplierModel.findOneAndUpdate(
        { businessId, externalId: event.entityId },
        {
          externalId: event.entityId,
          businessId,
          code: (event.payload.code as string | null) ?? null,
          name: String(event.payload.name ?? ""),
          phone: (event.payload.phone as string | null) ?? null,
          email: (event.payload.email as string | null) ?? null,
          contactName: (event.payload.contactName as string | null) ?? null,
          notes: (event.payload.notes as string | null) ?? null,
          isActive: Boolean(event.payload.isActive ?? true),
          deletedAt: null
        },
        { upsert: true, new: true }
      );
      return;
    }
    if (event.entityType === "purchaseOrder") {
      await this.purchaseOrderModel.findOneAndUpdate(
        { businessId, externalId: event.entityId },
        {
          externalId: event.entityId,
          businessId,
          supplierId: (event.payload.supplierId as string | null) ?? null,
          orderNumber: String(event.payload.orderNumber ?? event.entityId),
          status: String(event.payload.status ?? "draft"),
          orderDate: event.payload.orderDate ? new Date(String(event.payload.orderDate)) : new Date(),
          expectedDate: event.payload.expectedDate ? new Date(String(event.payload.expectedDate)) : null,
          receivedAt: event.payload.receivedAt ? new Date(String(event.payload.receivedAt)) : null,
          subtotal: Number(event.payload.subtotal ?? 0),
          taxTotal: Number(event.payload.taxTotal ?? 0),
          total: Number(event.payload.total ?? 0),
          notes: (event.payload.notes as string | null) ?? null,
          items: Array.isArray(event.payload.items) ? event.payload.items : [],
          deletedAt: null
        },
        { upsert: true, new: true }
      );
      return;
    }
    if (event.entityType === "stockTransfer") {
      await this.stockTransferModel.findOneAndUpdate(
        { businessId, externalId: event.entityId },
        {
          externalId: event.entityId,
          businessId,
          fromBranchId: (event.payload.fromBranchId as string | null) ?? null,
          toBranchId: (event.payload.toBranchId as string | null) ?? null,
          transferNumber: String(event.payload.transferNumber ?? event.entityId),
          status: String(event.payload.status ?? "draft"),
          transferDate: event.payload.transferDate ? new Date(String(event.payload.transferDate)) : new Date(),
          receivedAt: event.payload.receivedAt ? new Date(String(event.payload.receivedAt)) : null,
          note: (event.payload.note as string | null) ?? null,
          items: Array.isArray(event.payload.items) ? event.payload.items : [],
          deletedAt: null
        },
        { upsert: true, new: true }
      );
      return;
    }
    if (event.entityType === "stockAdjustment") {
      await this.stockAdjustmentModel.findOneAndUpdate(
        { businessId, externalId: event.entityId },
        {
          externalId: event.entityId,
          businessId,
          productId: String(event.payload.productId ?? ""),
          adjustmentNumber: String(event.payload.adjustmentNumber ?? event.entityId),
          quantityDelta: Number(event.payload.quantityDelta ?? 0),
          unitCost: Number(event.payload.unitCost ?? 0),
          reason: String(event.payload.reason ?? "Adjustment"),
          referenceId: (event.payload.referenceId as string | null) ?? null,
          note: (event.payload.note as string | null) ?? null,
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
          deletedAt: event.payload.deletedAt ? new Date(String(event.payload.deletedAt)) : null
        },
        { upsert: true, new: true }
      );
      return;
    }
    if (event.entityType === "sale") {
      const sale = event.payload.sale as Record<string, unknown> | undefined;
      const payment = event.payload.payment as Record<string, unknown> | undefined;
      if (sale) {
        if (sale.deletedAt) {
          await this.saleModel.findOneAndUpdate(
            { businessId, externalId: String(sale.externalId ?? sale.id ?? event.entityId) },
            { deletedAt: new Date(String(sale.deletedAt)) },
            { new: true }
          );
          return;
        }
        const items = Array.isArray(sale.items) ? sale.items.map((item) => {
          const row = item as Record<string, unknown>;
          return { productId: String(row.productId ?? ""), quantity: Number(row.quantity ?? 0), discount: Number(row.discount ?? row.lineDiscount ?? 0), tax: Number(row.tax ?? row.lineTax ?? 0) };
        }) : [];
        await this.salesService.create({
          businessId,
          externalId: String(sale.externalId ?? sale.id ?? event.entityId),
          branchId: (sale.branchId as string | null) ?? null,
          customerId: (sale.customerId as string | null) ?? null,
          cashierId: (sale.cashierId as string | null) ?? null,
          receiptNumber: String(sale.receiptNumber ?? event.entityId),
          amountPaid: Number(payment?.amount ?? sale.amountPaid ?? 0),
          paymentStatus: String(sale.paymentStatus ?? "unpaid") as never,
          paymentMethod: String(payment?.method ?? sale.paymentMethod ?? "cash") as never,
          notes: (sale.notes as string | null) ?? null,
          items
        }, {});
      }
      return;
    }
    if (event.entityType === "payment") {
      throw new BadRequestException("Raw payment sync is disabled; replay the typed sale, invoice, or customer payment request with its original idempotency key");
    }
    if (event.entityType === "stockMovement") {
      const movementId = String(event.entityId);
      await runInTransaction(this.connection, async (session) => {
        const existingMovement = await this.stockMovementModel.findOne({ businessId, externalId: movementId }).session(session).lean();
        if (existingMovement) return;
        await this.stockMovementModel.create([{
          externalId: movementId,
          businessId,
          productId: String(event.payload.productId ?? ""),
          referenceType: String(event.payload.referenceType ?? "restock"),
          referenceId: String(event.payload.referenceId ?? movementId),
          quantityDelta: Number(event.payload.quantityDelta ?? 0),
          unitCost: Number(event.payload.unitCost ?? 0),
          note: (event.payload.note as string | null) ?? null
        }], { session });
        const result = await this.productModel.updateOne(
          { businessId, externalId: String(event.payload.productId ?? "") },
          { $inc: { stockOnHand: Number(event.payload.quantityDelta ?? 0) } },
          { session }
        );
        if (!result.matchedCount) throw new NotFoundException("The stock movement product no longer exists");
      });
    }
  }

  private async normalizeProductSyncPayload(businessId: string, payload: Record<string, unknown>) {
    if (!this.businessModel) throw new BadRequestException("Business industry context is unavailable for synchronization.");
    const business = await findBusinessByIdentifier(this.businessModel, businessId);
    if (!business) throw new BadRequestException("Business context could not be resolved for synchronization.");
    const resolution = resolveCatalogCreationContext({
      industryKey: business.industryKey ?? null,
      businessType: business.businessType ?? null,
      ...(typeof payload.catalogEntityType === "string" ? { entityType: payload.catalogEntityType } : {})
    });
    if (resolution.status !== "ready") throw new BadRequestException(resolution.message);
    if (payload.industryKey && payload.industryKey !== resolution.context.industryKey) {
      throw new BadRequestException("Queued catalog data belongs to a different industry context.");
    }
    const config = resolution.context.config;
    const name = String(payload.name ?? "").trim();
    if (name.length < 2) throw new BadRequestException("Queued catalog data is missing a valid name.");
    return {
      catalogEntityType: config.entityType,
      industryKey: resolution.context.industryKey,
      categoryId: (payload.categoryId as string | null) ?? null,
      brandId: (payload.brandId as string | null) ?? null,
      supplierId: (payload.supplierId as string | null) ?? null,
      name,
      description: (payload.description as string | null) ?? null,
      variants: Array.isArray(payload.variants) ? payload.variants : [],
      addOns: Array.isArray(payload.addOns) ? payload.addOns : [],
      recipeIngredients: Array.isArray(payload.recipeIngredients) ? payload.recipeIngredients : [],
      serviceDurationMinutes: payload.serviceDurationMinutes == null ? null : Number(payload.serviceDurationMinutes),
      assignedStaffId: (payload.assignedStaffId as string | null) ?? null,
      commissionRate: payload.commissionRate == null ? null : Number(payload.commissionRate),
      compatibility: (payload.compatibility as string | null) ?? null,
      pricingModel: (payload.pricingModel as "fixed" | "hourly" | "quantity" | "recurring" | "milestone" | "custom" | null) ?? null,
      hourlyPrice: payload.hourlyPrice == null ? null : Number(payload.hourlyPrice),
      quantityUnit: (payload.quantityUnit as string | null) ?? null,
      sku: (payload.sku as string | null) ?? null,
      barcode: (payload.barcode as string | null) ?? null,
      batchNumber: (payload.batchNumber as string | null) ?? null,
      expiryDate: payload.expiryDate ? new Date(String(payload.expiryDate)) : null,
      serialNumber: (payload.serialNumber as string | null) ?? null,
      unit: String(payload.unit ?? config.defaultUnit),
      buyingPrice: Number(payload.buyingPrice ?? 0),
      sellingPrice: Number(payload.sellingPrice ?? 0),
      stockOnHand: config.supportsInventory ? Number(payload.stockOnHand ?? 0) : 0,
      lowStockThreshold: config.supportsInventory ? Number(payload.lowStockThreshold ?? 0) : 0,
      isActive: Boolean(payload.isActive ?? true),
      deletedAt: (payload.deletedAt as string | null) ? new Date(String(payload.deletedAt)) : null
    };
  }
}

function sanitizeSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : "Sync apply failed";
  return redactSensitiveText(message, 1000);
}
