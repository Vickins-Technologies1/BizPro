import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import { randomBytes } from "node:crypto";
import { AuditLog, AuditLogDocument, Customer, CustomerDocument, Product, ProductDocument } from "../schemas";
import { CommerceOrder, CommerceOrderDocument, InventoryReservation, InventoryReservationDocument, VendorProduct, VendorProductDocument } from "../commerce.schemas";
import type { CommercePrincipal } from "../../common/commerce-auth.decorator";
import { buildProductLookupQuery } from "../products/product-identity";
import { isMongoObjectId } from "../products/product-identity";
import { runInTransaction } from "../../common/mongo-transaction";
import { assertBranchAccess, safeProductId } from "./commerce.helpers";
import { CommerceIdempotencyService } from "./idempotency.service";
import { CommerceWebhooksService } from "./webhooks.service";

export type CommerceOrderItemInput = { productId: string; quantity: number; vendorId?: string; discount?: number; tax?: number };
export type CreateCommerceOrderInput = { branchId: string; externalReference?: string; customerId?: string; currency?: string; source?: "INTERNAL" | "EXTERNAL_API" | "MARKETPLACE"; items: CommerceOrderItemInput[]; metadata?: Record<string, unknown> };

@Injectable()
export class CommerceOrdersService {
  constructor(
    @InjectModel(CommerceOrder.name) private readonly orderModel: Model<CommerceOrderDocument>,
    @InjectModel(InventoryReservation.name) private readonly reservationModel: Model<InventoryReservationDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(VendorProduct.name) private readonly vendorProductModel: Model<VendorProductDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly idempotency: CommerceIdempotencyService,
    private readonly webhooks: CommerceWebhooksService
  ) {}

  async create(principal: CommercePrincipal, input: CreateCommerceOrderInput, idempotencyKey?: string) {
    assertBranchAccess(principal, input.branchId);
    if (!input.items.length) throw new ConflictException("An order must contain at least one item");
    const result = await this.idempotency.execute(principal, "orders.create", idempotencyKey, input, () => this.createAtomic(principal, input, idempotencyKey));
    void this.webhooks.publish({ businessId: principal.businessId, eventType: "order.created", data: { orderId: result.id, orderNumber: result.orderNumber, total: result.total, currency: result.currency } }).catch(() => undefined);
    return result;
  }

  async get(principal: CommercePrincipal, id: string) {
    const orderIdentifiers = isMongoObjectId(id) ? [{ _id: id }, { orderNumber: id }, { externalReference: id }] : [{ orderNumber: id }, { externalReference: id }];
    const order = await this.orderModel.findOne({ businessId: principal.businessId, deletedAt: null, $or: orderIdentifiers } as never).lean();
    if (!order) throw new NotFoundException("Commerce order not found");
    if (principal.branchIds.length && order.branchId && !principal.branchIds.includes(order.branchId)) throw new NotFoundException("Commerce order not found");
    return this.publicOrder(order);
  }

  private async createAtomic(principal: CommercePrincipal, input: CreateCommerceOrderInput, idempotencyKey?: string) {
    return runInTransaction(this.connection, async (session) => {
      const orderNumber = `CO-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
      const resolvedItems: Array<Record<string, unknown>> = [];
      const fulfillmentItems = new Map<string, string[]>();
      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;

      let customerSnapshot: Record<string, unknown> | null = null;
      if (input.customerId) {
        if (!isMongoObjectId(input.customerId)) throw new NotFoundException("Customer not found");
        const customer = await this.customerModel.findOne({ _id: input.customerId, businessId: principal.businessId, deletedAt: null }).session(session).lean();
        if (!customer) throw new NotFoundException("Customer not found");
        customerSnapshot = { id: String(customer._id), name: customer.name, businessName: customer.businessName ?? null, email: customer.email ?? null, phone: customer.phone ?? null };
      }

      for (const item of input.items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new ConflictException("Order quantities must be positive");
        const product = await this.productModel.findOne({ ...buildProductLookupQuery({ businessId: principal.businessId, identifier: item.productId, branchId: input.branchId }), isActive: true, visibility: { $in: ["EXTERNAL", "MARKETPLACE"] } } as never).session(session).lean();
        if (!product) throw new NotFoundException("Order product not found");
        const canonicalProductId = safeProductId(product);
        let vendorCostSnapshot: number | null = null;
        if (item.vendorId) {
          const link = await this.vendorProductModel.findOne({ businessId: principal.businessId, vendorId: item.vendorId, productId: canonicalProductId, status: "active", deletedAt: null }).session(session).lean();
          if (!link) throw new NotFoundException("Vendor product relationship not found");
          vendorCostSnapshot = Number(link.vendorCost ?? 0);
        }
        const lineSubtotal = Number(product.sellingPrice ?? 0) * item.quantity;
        const discount = Math.max(0, Number(item.discount ?? 0));
        const tax = Math.max(0, Number(item.tax ?? 0));
        const lineTotal = Math.max(0, lineSubtotal - discount + tax);
        subtotal += lineSubtotal;
        discountTotal += discount;
        taxTotal += tax;
        resolvedItems.push({ productId: canonicalProductId, productNameSnapshot: product.name, skuSnapshot: product.sku ?? null, quantity: item.quantity, unitPrice: Number(product.sellingPrice ?? 0), vendorCostSnapshot, discount, tax, subtotal: lineTotal, vendorId: item.vendorId ?? null });
        if (item.vendorId) fulfillmentItems.set(item.vendorId, [...(fulfillmentItems.get(item.vendorId) ?? []), canonicalProductId]);
      }

      const order = (await this.orderModel.create([{
        businessId: principal.businessId,
        orderNumber,
        source: input.source ?? "EXTERNAL_API",
        externalReference: input.externalReference ?? null,
        customerId: input.customerId ?? null,
        customerSnapshot,
        branchId: input.branchId,
        items: resolvedItems,
        subtotal,
        discountTotal,
        taxTotal,
        total: Math.max(0, subtotal - discountTotal + taxTotal),
        currency: input.currency ?? "KES",
        paymentStatus: "PENDING",
        fulfillmentStatus: "UNFULFILLED",
        orderStatus: "PENDING",
        fulfillments: [...fulfillmentItems.entries()].map(([vendorId, itemProductIds]) => ({ vendorId, itemProductIds, status: "PENDING", externalReference: null })),
        credentialId: principal.credentialId,
        idempotencyKey: idempotencyKey ?? null,
        metadata: input.metadata ?? {},
        deletedAt: null
      }], { session }))[0]!;

      for (const item of resolvedItems) {
        const updated = await this.productModel.findOneAndUpdate(
          { ...buildProductLookupQuery({ businessId: principal.businessId, identifier: String(item.productId), branchId: input.branchId }), $expr: { $gte: [{ $subtract: [{ $ifNull: ["$stockOnHand", 0] }, { $ifNull: ["$reservedQuantity", 0] }] }, item.quantity] } } as never,
          { $inc: { reservedQuantity: Number(item.quantity) } },
          { new: true, session }
        ).lean();
        if (!updated) throw new ConflictException(`Insufficient sellable inventory for product ${String(item.productId)}`);
        await this.reservationModel.create([{
          businessId: principal.businessId,
          productId: String(item.productId),
          branchId: input.branchId,
          quantity: Number(item.quantity),
          referenceType: "commerce_order",
          referenceId: order._id.toString(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          status: "RESERVED",
          credentialId: principal.credentialId,
          idempotencyKey: idempotencyKey ?? null
        }], { session });
      }
      await this.auditModel.create([{ businessId: principal.businessId, actorId: principal.credentialId, entityType: "commerce_order", entityId: order._id.toString(), action: "order.created", payload: { orderNumber, total: order.total, itemCount: resolvedItems.length } }], { session });
      return this.publicOrder(order.toObject());
    });
  }

  private publicOrder(order: Partial<CommerceOrder> & { _id?: unknown; createdAt?: Date; updatedAt?: Date }) {
    return {
      id: String(order._id),
      orderNumber: order.orderNumber,
      source: order.source,
      externalReference: order.externalReference ?? null,
      customer: order.customerSnapshot ?? null,
      branchId: order.branchId ?? null,
      items: (order.items ?? []).map((item) => ({ productId: item.productId, productName: item.productNameSnapshot, sku: item.skuSnapshot ?? null, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount, tax: item.tax, subtotal: item.subtotal, vendorId: item.vendorId ?? null })),
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      taxTotal: order.taxTotal,
      total: order.total,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      orderStatus: order.orderStatus,
      fulfillments: order.fulfillments ?? [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }
}
