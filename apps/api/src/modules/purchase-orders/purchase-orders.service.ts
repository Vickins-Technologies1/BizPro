import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { resolveBusinessTypeConfig } from "@vbo/shared";
import { Connection, Model } from "mongoose";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";
import { buildBusinessLookup } from "../../common/business-lookup";
import { runInTransaction } from "../../common/mongo-transaction";
import {
  Business,
  BusinessDocument,
  Product,
  ProductDocument,
  PurchaseOrder,
  PurchaseOrderDocument,
  PurchaseOrderItem,
  PurchaseOrderReceipt,
  StockMovement,
  StockMovementDocument
} from "../schemas";
import { buildProductLookupQuery, isMongoObjectId, productNotFoundException, invalidProductIdException } from "../products/product-identity";

function purchaseOrderIdentity(id: string) {
  return isMongoObjectId(id) ? { $or: [{ _id: id }, { externalId: id }] } : { externalId: id };
}

function hasReceipts(order: Pick<PurchaseOrder, "items" | "receipts">) {
  return (order.receipts?.length ?? 0) > 0 || (order.items ?? []).some((item) => Number(item.receivedQuantity ?? 0) > 0);
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectModel(PurchaseOrder.name) private readonly purchaseOrderModel: Model<PurchaseOrderDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(StockMovement.name) private readonly movementModel: Model<StockMovementDocument>,
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectConnection() private readonly connection: Connection
  ) {}

  list(businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    return this.purchaseOrderModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).sort({ createdAt: -1 }).lean();
  }

  async create(input: Partial<PurchaseOrder> & { businessId: string; orderNumber: string; orderDate: Date }, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
    if (input.externalId) {
      const existing = await this.purchaseOrderModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) return existing;
    }
    const items = (input.items ?? []).map((item) => ({ ...item, receivedQuantity: 0 }));
    return this.purchaseOrderModel.create({
      ...input,
      branchId,
      deletedAt: null,
      status: input.status ?? "draft",
      items,
      receipts: []
    });
  }

  async update(businessId: string, id: string, patch: Partial<PurchaseOrder>, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, patch.branchId ?? scope.requestedBranchId ?? null);
    const filter = { businessId, deletedAt: null, $and: [purchaseOrderIdentity(id), buildBranchMatch(branchId)] };
    const current = await this.purchaseOrderModel.findOne(filter).lean();
    if (!current) throw new NotFoundException("Purchase order not found");
    if (current.status === "received") throw new BadRequestException("A fully received purchase order cannot be edited");
    if (patch.status === "received" || patch.status === "partially_received") {
      throw new BadRequestException("Record received quantities with the purchase-order receive action");
    }
    const received = hasReceipts(current);
    if (received && patch.items !== undefined) {
      throw new BadRequestException("Purchase-order lines cannot be changed after stock has been received");
    }
    if (received && (patch.status === "draft" || patch.status === "ordered")) {
      throw new BadRequestException("A partially received purchase order cannot return to an earlier status");
    }
    if (received && patch.status === "cancelled") {
      throw new BadRequestException("Cancel the remaining quantity through an explicit supplier workflow; received stock must stay linked to its order");
    }

    const { businessId: _ignoredBusinessId, branchId: _ignoredBranchId, receipts: _ignoredReceipts, receivedAt: _ignoredReceivedAt, ...safePatch } = patch;
    if (safePatch.items !== undefined) {
      safePatch.items = safePatch.items.map((item) => ({ ...item, receivedQuantity: 0 })) as PurchaseOrderItem[];
    }
    const updated = await this.purchaseOrderModel.findOneAndUpdate(filter, safePatch, { new: true }).lean();
    if (!updated) throw new NotFoundException("Purchase order not found");
    return updated;
  }

  async receive(
    businessId: string,
    id: string,
    input: { receiptId: string; items: Array<{ productId: string; quantity: number }> },
    scope: BranchScope = {}
  ) {
    const branchId = resolveWriteBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    if (!branchId) throw new BadRequestException("Select a branch before receiving stock");
    const receiptId = input.receiptId.trim();
    if (receiptId.length < 8 || receiptId.length > 128) throw new BadRequestException("A valid receipt ID is required");
    if (!input.items?.length) throw new BadRequestException("Enter at least one received quantity");
    if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
      throw new BadRequestException("Include each product only once per receipt");
    }
    for (const item of input.items) {
      if (!item.productId?.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException("Received quantities must be greater than zero");
      }
    }

    return runInTransaction(this.connection, async (session) => {
      const orderFilter = { businessId, deletedAt: null, $and: [purchaseOrderIdentity(id), buildBranchMatch(branchId)] };
      const order = await this.purchaseOrderModel.findOne(orderFilter).session(session).lean();
      if (!order) throw new NotFoundException("Purchase order not found");
      if (order.receipts?.some((receipt) => receipt.receiptId === receiptId)) return order;
      if (order.status === "cancelled" || order.status === "received") {
        throw new BadRequestException("This purchase order cannot receive more stock");
      }
      if (order.status !== "ordered" && order.status !== "partially_received") {
        throw new BadRequestException("Mark the purchase order as ordered before receiving stock");
      }

      const business = await this.businessModel.findOne({ ...buildBusinessLookup(businessId), deletedAt: null }).session(session).lean();
      if (!business) throw new NotFoundException("Business not found");
      const businessConfig = resolveBusinessTypeConfig({
        businessType: (business as { businessType?: string }).businessType,
        industryKey: (business as { industryKey?: string }).industryKey
      });
      if (!businessConfig.capabilities.inventory) {
        throw new BadRequestException("This business configuration does not support inventory receiving");
      }

      const nextItems: PurchaseOrderItem[] = (order.items ?? []).map((item) => ({ ...item, receivedQuantity: Number(item.receivedQuantity ?? 0) }));
      const receiptItems: PurchaseOrderReceipt["items"] = [];
      const orderKey = String(order.externalId ?? order._id);

      for (const receivedLine of input.items) {
        const matchingLines = nextItems.filter((line) => line.productId === receivedLine.productId);
        if (!matchingLines.length) throw new BadRequestException("A received product is not part of this purchase order");
        const orderedQuantity = matchingLines.reduce((sum, line) => sum + Number(line.quantity), 0);
        const alreadyReceived = matchingLines.reduce((sum, line) => sum + Number(line.receivedQuantity ?? 0), 0);
        const outstanding = Math.max(0, orderedQuantity - alreadyReceived);
        if (receivedLine.quantity > outstanding + 1e-9) {
          throw new BadRequestException(`Received quantity for ${matchingLines[0]!.productName} exceeds the outstanding order quantity`);
        }

        let toAllocate = receivedLine.quantity;
        for (const line of matchingLines) {
          const remaining = Math.max(0, Number(line.quantity) - Number(line.receivedQuantity ?? 0));
          const allocated = Math.min(remaining, toAllocate);
          line.receivedQuantity = Number(line.receivedQuantity ?? 0) + allocated;
          toAllocate -= allocated;
          if (toAllocate <= 1e-9) break;
        }

        const product = await this.productModel.findOne(buildProductLookupQuery({ businessId, identifier: receivedLine.productId, branchId })).session(session);
        if (!product) throw isMongoObjectId(receivedLine.productId) ? productNotFoundException() : invalidProductIdException();
        product.stockOnHand = Number(product.stockOnHand ?? 0) + receivedLine.quantity;
        await product.save({ session });

        const referenceId = `${orderKey}:receipt:${receiptId}`;
        await this.movementModel.create([{
          businessId,
          branchId,
          productId: product.externalId ?? String(product._id),
          referenceType: "purchase",
          referenceId,
          quantityDelta: receivedLine.quantity,
          unitCost: Number(matchingLines[0]!.unitCost ?? 0),
          note: `Receipt ${receiptId} for purchase order ${order.orderNumber}`,
          externalId: `${referenceId}:${receivedLine.productId}`
        }], { session });

        receiptItems.push({ productId: receivedLine.productId, quantity: receivedLine.quantity });
      }

      if (nextItems.some((line) => Number(line.receivedQuantity ?? 0) > Number(line.quantity) + 1e-9)) {
        throw new BadRequestException("Received quantities cannot exceed ordered quantities");
      }
      const fullyReceived = nextItems.length > 0 && nextItems.every((line) => Number(line.receivedQuantity ?? 0) + 1e-9 >= Number(line.quantity));
      const receivedAt = new Date();
      const receipt: PurchaseOrderReceipt = { receiptId, receivedAt, items: receiptItems };
      const updated = await this.purchaseOrderModel.findOneAndUpdate(
        orderFilter,
        {
          $set: {
            branchId,
            items: nextItems,
            status: fullyReceived ? "received" : "partially_received",
            ...(fullyReceived ? { receivedAt } : {})
          },
          $push: { receipts: receipt }
        },
        { new: true, session }
      ).lean();
      if (!updated) throw new NotFoundException("Purchase order not found");
      return updated;
    });
  }

  async archive(businessId: string, id: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const filter = { businessId, deletedAt: null, $and: [purchaseOrderIdentity(id), buildBranchMatch(branchId)] };
    const current = await this.purchaseOrderModel.findOne(filter).lean();
    if (!current) throw new NotFoundException("Purchase order not found");
    if (current.status === "received" || hasReceipts(current)) {
      throw new BadRequestException("A purchase order with received stock cannot be archived");
    }
    const updated = await this.purchaseOrderModel.findOneAndUpdate(filter, { deletedAt: new Date(), status: "cancelled" }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Purchase order not found");
    return updated;
  }
}
