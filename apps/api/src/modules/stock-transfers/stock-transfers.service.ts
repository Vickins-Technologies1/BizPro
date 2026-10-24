import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import { resolveReadBranchId, type BranchScope } from "../../common/branch-scope";
import { runInTransaction } from "../../common/mongo-transaction";
import { Branch, BranchDocument, Product, ProductDocument, StockMovement, StockMovementDocument, StockTransfer, StockTransferDocument, StockTransferItem } from "../schemas";
import { isMongoObjectId, productNotFoundException } from "../products/product-identity";

function stockTransferIdentity(id: string) {
  return isMongoObjectId(id) ? { $or: [{ _id: id }, { externalId: id }] } : { externalId: id };
}

function transferFilter(businessId: string, id: string) {
  return { businessId, deletedAt: null, $and: [stockTransferIdentity(id)] };
}

function branchIdForActor(scope: BranchScope, branchId: string, action: string) {
  if (scope.role !== "owner" && scope.branchId?.trim() !== branchId) {
    throw new ForbiddenException(`Your assigned branch cannot ${action} this transfer`);
  }
}

function validateItems(items: StockTransferItem[]) {
  if (!items?.length) throw new BadRequestException("Add at least one product to the stock transfer");
  const productIds = items.map((item) => item.productId?.trim());
  if (productIds.some((id) => !id) || new Set(productIds).size !== productIds.length) {
    throw new BadRequestException("Each transfer must contain unique products with stable shared catalog IDs");
  }
  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitCost) || item.unitCost < 0) {
      throw new BadRequestException("Transfer quantities must be positive and unit costs cannot be negative");
    }
  }
}

@Injectable()
export class StockTransfersService {
  constructor(
    @InjectModel(StockTransfer.name) private readonly stockTransferModel: Model<StockTransferDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(StockMovement.name) private readonly movementModel: Model<StockMovementDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @InjectConnection() private readonly connection: Connection
  ) {}

  list(businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    return this.stockTransferModel.find({ businessId, deletedAt: null, ...(branchId ? { $or: [{ fromBranchId: branchId }, { toBranchId: branchId }] } : {}) }).sort({ createdAt: -1 }).lean();
  }

  async create(input: Partial<StockTransfer> & { businessId: string; transferNumber: string; transferDate: Date }, scope: BranchScope = {}) {
    const fromBranchId = input.fromBranchId?.trim();
    const toBranchId = input.toBranchId?.trim();
    if (!fromBranchId || !toBranchId || fromBranchId === toBranchId) {
      throw new BadRequestException("Choose distinct source and destination branches");
    }
    branchIdForActor(scope, fromBranchId, "create");
    validateItems(input.items ?? []);
    if (input.status && input.status !== "draft") {
      throw new BadRequestException("New stock transfers must start as drafts; dispatch them after saving");
    }
    const branches = await this.branchModel.find({ businessId: input.businessId, _id: { $in: [fromBranchId, toBranchId] }, status: "active", deletedAt: null }).select({ _id: 1 }).lean();
    if (branches.length !== 2) throw new BadRequestException("Both transfer branches must be active branches in this business");
    if (input.externalId) {
      const existing = await this.stockTransferModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) return existing;
    }
    return this.stockTransferModel.create({ ...input, fromBranchId, toBranchId, deletedAt: null, status: "draft", dispatchedAt: null, receivedAt: null, items: input.items ?? [] });
  }

  async update(businessId: string, id: string, patch: Partial<StockTransfer>, scope: BranchScope = {}) {
    const current = await this.stockTransferModel.findOne(transferFilter(businessId, id)).lean();
    if (!current) throw new NotFoundException("Stock transfer not found");
    branchIdForActor(scope, current.fromBranchId ?? "", "edit");
    if (current.status !== "draft") throw new BadRequestException("Only draft transfers can be edited");
    if (patch.status !== undefined && patch.status !== "draft" && patch.status !== "cancelled") {
      throw new BadRequestException("Use the dispatch and receive actions to move transfer stock");
    }
    if (patch.status === "cancelled" && current.status !== "draft") throw new BadRequestException("A dispatched transfer cannot be cancelled");
    const fromBranchId = patch.fromBranchId === undefined ? current.fromBranchId : patch.fromBranchId?.trim();
    const toBranchId = patch.toBranchId === undefined ? current.toBranchId : patch.toBranchId?.trim();
    if (!fromBranchId || !toBranchId || fromBranchId === toBranchId) throw new BadRequestException("Choose distinct source and destination branches");
    branchIdForActor(scope, fromBranchId, "edit");
    if (patch.items !== undefined) validateItems(patch.items);
    const { businessId: _ignoredBusinessId, dispatchedAt: _ignoredDispatchedAt, receivedAt: _ignoredReceivedAt, ...safePatch } = patch;
    const updated = await this.stockTransferModel.findOneAndUpdate(
      { ...transferFilter(businessId, id), status: "draft" },
      { ...safePatch, fromBranchId, toBranchId },
      { new: true }
    ).lean();
    if (!updated) throw new BadRequestException("The transfer changed while you were editing it; refresh and try again");
    return updated;
  }

  async dispatch(businessId: string, id: string, scope: BranchScope = {}) {
    return runInTransaction(this.connection, async (session) => {
      const filter = transferFilter(businessId, id);
      const transfer = await this.stockTransferModel.findOne(filter).session(session).lean();
      if (!transfer) throw new NotFoundException("Stock transfer not found");
      if (transfer.status === "in_transit" && transfer.dispatchedAt) return transfer;
      if (transfer.status !== "draft") throw new BadRequestException("Only a draft transfer can be dispatched");
      const fromBranchId = transfer.fromBranchId?.trim();
      const toBranchId = transfer.toBranchId?.trim();
      if (!fromBranchId || !toBranchId || fromBranchId === toBranchId) throw new BadRequestException("This transfer has invalid branch details");
      branchIdForActor(scope, fromBranchId, "dispatch");
      validateItems(transfer.items ?? []);

      const branches = await this.branchModel.find({ businessId, _id: { $in: [fromBranchId, toBranchId] }, status: "active", deletedAt: null }).session(session).select({ _id: 1 }).lean();
      if (branches.length !== 2) throw new BadRequestException("Both transfer branches must still be active");

      for (const item of transfer.items) {
        const product = await this.productModel.findOne({ businessId, externalId: item.productId, branchId: fromBranchId, deletedAt: null, isActive: true }).session(session);
        if (!product) throw productNotFoundException();
        const available = Number(product.stockOnHand ?? 0) - Number(product.reservedQuantity ?? 0);
        if (available + 1e-9 < item.quantity) throw new BadRequestException(`Insufficient available stock for ${product.name}`);
        product.stockOnHand = Number(product.stockOnHand ?? 0) - item.quantity;
        await product.save({ session });
        const referenceId = String(transfer.externalId ?? transfer._id);
        await this.movementModel.create([{
          businessId,
          branchId: fromBranchId,
          productId: product.externalId ?? String(product._id),
          referenceType: "transfer",
          referenceId,
          quantityDelta: -item.quantity,
          unitCost: item.unitCost,
          batchNumber: item.batchNumber ?? null,
          serialNumbers: item.serialNumbers ?? [],
          note: `Dispatched to branch ${toBranchId} on transfer ${transfer.transferNumber}`,
          externalId: `${referenceId}:${fromBranchId}:${item.productId}:out`
        }], { session });
      }

      const dispatchedAt = new Date();
      const updated = await this.stockTransferModel.findOneAndUpdate(
        { ...filter, status: "draft" },
        { $set: { status: "in_transit", dispatchedAt } },
        { new: true, session }
      ).lean();
      if (!updated) throw new BadRequestException("Transfer status changed during dispatch; refresh and try again");
      return updated;
    });
  }

  async receive(businessId: string, id: string, scope: BranchScope = {}) {
    return runInTransaction(this.connection, async (session) => {
      const filter = transferFilter(businessId, id);
      const transfer = await this.stockTransferModel.findOne(filter).session(session).lean();
      if (!transfer) throw new NotFoundException("Stock transfer not found");
      if (transfer.status === "received" && transfer.receivedAt) return transfer;
      if (transfer.status !== "in_transit" || !transfer.dispatchedAt) {
        throw new BadRequestException("Only a transfer dispatched through the inventory workflow can be received; legacy transfers need reconciliation");
      }
      validateItems(transfer.items ?? []);
      const fromBranchId = transfer.fromBranchId?.trim();
      const toBranchId = transfer.toBranchId?.trim();
      if (!fromBranchId || !toBranchId || fromBranchId === toBranchId) throw new BadRequestException("This transfer has invalid branch details");
      branchIdForActor(scope, toBranchId, "receive");

      for (const item of transfer.items ?? []) {
        const product = await this.productModel.findOne({ businessId, externalId: item.productId, branchId: toBranchId, deletedAt: null, isActive: true }).session(session);
        if (!product) throw new BadRequestException(`Destination branch is missing catalog product ${item.productId}`);
        product.stockOnHand = Number(product.stockOnHand ?? 0) + item.quantity;
        await product.save({ session });
        const referenceId = String(transfer.externalId ?? transfer._id);
        await this.movementModel.create([{
          businessId,
          branchId: toBranchId,
          productId: product.externalId ?? String(product._id),
          referenceType: "transfer",
          referenceId,
          quantityDelta: item.quantity,
          unitCost: item.unitCost,
          batchNumber: item.batchNumber ?? null,
          serialNumbers: item.serialNumbers ?? [],
          note: `Received from branch ${fromBranchId} on transfer ${transfer.transferNumber}`,
          externalId: `${referenceId}:${toBranchId}:${item.productId}:in`
        }], { session });
      }

      const receivedAt = new Date();
      const updated = await this.stockTransferModel.findOneAndUpdate(
        { ...filter, status: "in_transit", dispatchedAt: transfer.dispatchedAt },
        { $set: { status: "received", receivedAt } },
        { new: true, session }
      ).lean();
      if (!updated) throw new BadRequestException("Transfer status changed during receipt; refresh and try again");
      return updated;
    });
  }

  async archive(businessId: string, id: string, scope: BranchScope = {}) {
    const current = await this.stockTransferModel.findOne(transferFilter(businessId, id)).lean();
    if (!current) throw new NotFoundException("Stock transfer not found");
    branchIdForActor(scope, current.fromBranchId ?? "", "archive");
    if (current.status !== "draft" && current.status !== "cancelled") throw new BadRequestException("Dispatched or received transfers cannot be archived");
    const updated = await this.stockTransferModel.findOneAndUpdate({ ...transferFilter(businessId, id), status: current.status }, { deletedAt: new Date(), status: "cancelled" }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Stock transfer not found");
    return updated;
  }
}
