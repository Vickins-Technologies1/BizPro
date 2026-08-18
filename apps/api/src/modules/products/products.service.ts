import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Product, ProductDocument, Sale, SaleDocument, StockMovement, StockMovementDocument } from "../schemas";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";
import {
  buildProductLookupQuery,
  collectProductIdentifiers,
  invalidProductIdException,
  isMongoObjectId,
  productNotFoundException
} from "./product-identity";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(StockMovement.name) private readonly movementModel: Model<StockMovementDocument>,
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    private readonly notifications: NotificationsService
  ) {}

  list(businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    return this.productModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).sort({ createdAt: -1 }).lean();
  }

  async create(input: Partial<Product> & { businessId: string; name: string; unit: string; buyingPrice: number; sellingPrice: number }, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
    if (input.externalId) {
      const existing = await this.productModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    return this.productModel.create({ ...input, branchId, deletedAt: null });
  }

  async update(businessId: string, id: string, patch: Partial<Product>, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, patch.branchId ?? null);
    const { businessId: _ignoredBusinessId, branchId: _ignoredBranchId, ...safePatch } = patch;
    const updated = await this.productModel.findOneAndUpdate(buildProductLookupQuery({ businessId, identifier: id, branchId }), safePatch, { new: true }).lean();
    if (!updated) throw isMongoObjectId(id) ? productNotFoundException() : invalidProductIdException();
    return updated;
  }

  async archive(businessId: string, id: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const updated = await this.productModel.findOneAndUpdate(
      buildProductLookupQuery({ businessId, identifier: id, branchId }),
      { deletedAt: new Date(), isActive: false },
      { new: true }
    ).lean();
    if (!updated) throw isMongoObjectId(id) ? productNotFoundException() : invalidProductIdException();
    return updated;
  }

  async adjustStock(input: { businessId: string; productId: string; referenceType: StockMovement["referenceType"]; referenceId: string; quantityDelta: number; unitCost: number; note?: string; branchId?: string | null }, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, input.branchId ?? null);
    const product = await this.productModel.findOne(buildProductLookupQuery({ businessId: input.businessId, identifier: input.productId, branchId }));
    if (!product) throw isMongoObjectId(input.productId) ? productNotFoundException() : invalidProductIdException();
    const productKeys = collectProductIdentifiers(product, input.productId);
    const existingMovement = await this.movementModel.findOne({
      businessId: input.businessId,
      productId: { $in: productKeys },
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      ...buildBranchMatch(branchId)
    }).lean();
    if (existingMovement) {
      return product.toObject();
    }
    product.stockOnHand = Math.max(0, product.stockOnHand + input.quantityDelta);
    await product.save();
    await this.movementModel.create({
      ...input,
      branchId,
      productId: product.externalId ?? String(product._id),
      externalId: input.referenceId
    });
    const updated = product.toObject();
    if (updated.stockOnHand <= updated.lowStockThreshold) {
      void this.notifications
        .createLowStockNotification({
          businessId: input.businessId,
          productId: String(product._id),
          productName: updated.name,
          stockOnHand: updated.stockOnHand,
          threshold: updated.lowStockThreshold,
          routeParams: { productId: String(product._id) }
        })
        .catch(() => undefined);
    }
    return updated;
  }

  async history(businessId: string, productId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const product = await this.productModel.findOne(buildProductLookupQuery({ businessId, identifier: productId, branchId })).lean();
    if (!product) throw isMongoObjectId(productId) ? productNotFoundException() : invalidProductIdException();
    const productKeys = collectProductIdentifiers(product, productId);
    const [stockMovements, salesHistory] = await Promise.all([
      this.movementModel.find({ businessId, productId: { $in: productKeys }, ...buildBranchMatch(branchId) }).sort({ createdAt: -1 }).limit(24).lean(),
      this.saleModel.aggregate([
        { $match: { businessId, ...(branchId ? { $or: [{ branchId }, { branchId: null }] } : {}) } },
        { $unwind: "$items" },
        { $match: { "items.productId": { $in: productKeys } } },
        { $sort: { createdAt: -1 } },
        {
          $project: {
            id: "$_id",
            receiptNumber: 1,
            quantity: "$items.quantity",
            unitPrice: "$items.unitPrice",
            lineTotal: "$items.lineTotal",
            createdAt: 1,
            paymentStatus: 1
          }
        },
        { $limit: 24 }
      ])
    ]);

    return { stockMovements, salesHistory };
  }
}
