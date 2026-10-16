import { BadRequestException, Injectable, Optional } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { resolveCatalogCreationContext, type CatalogCreationContext, type CatalogEntityType } from "@vbo/shared";
import { Business, BusinessDocument, Product, ProductDocument, Sale, SaleDocument, StockMovement, StockMovementDocument } from "../schemas";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";
import {
  buildProductLookupQuery,
  collectProductIdentifiers,
  invalidProductIdException,
  isMongoObjectId,
  productNotFoundException
} from "./product-identity";
import { NotificationsService } from "../notifications/notifications.service";
import { findBusinessByIdentifier } from "../../common/business-lookup";

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(StockMovement.name) private readonly movementModel: Model<StockMovementDocument>,
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    private readonly notifications: NotificationsService,
    @Optional() @InjectModel(Business.name) private readonly businessModel?: Model<BusinessDocument>
  ) {}

  list(businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    return this.productModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).sort({ createdAt: -1 }).lean();
  }

  async listPage(
    businessId: string,
    input: { page: number; pageSize: number; search?: string; categoryId?: string; brandId?: string; supplierId?: string },
    scope: BranchScope = {}
  ) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const searchPattern = input.search ? escapeRegex(input.search) : null;
    const filter = {
      businessId,
      deletedAt: null,
      ...buildBranchMatch(branchId),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.brandId ? { brandId: input.brandId } : {}),
      ...(input.supplierId ? { supplierId: input.supplierId } : {}),
      ...(searchPattern
        ? {
            $or: [
              { name: { $regex: searchPattern, $options: "i" } },
              { sku: { $regex: searchPattern, $options: "i" } },
              { barcode: { $regex: searchPattern, $options: "i" } },
              { batchNumber: { $regex: searchPattern, $options: "i" } },
              { serialNumber: { $regex: searchPattern, $options: "i" } }
            ]
          }
        : {})
    };
    const total = await this.productModel.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    const page = Math.min(input.page, totalPages);
    const items = await this.productModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * input.pageSize)
      .limit(input.pageSize)
      .lean();
    return { items, page, pageSize: input.pageSize, total, totalPages };
  }

  async create(input: Partial<Product> & { businessId: string; name: string }, scope: BranchScope = {}) {
    const context = await this.resolveCreationContext(input.businessId, input.catalogEntityType ?? null);
    const payload = this.normalizeCreationPayload(input, context);
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
    if (payload.externalId) {
      const existing = await this.productModel.findOne({ businessId: payload.businessId, externalId: payload.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    return this.productModel.create({ ...payload, branchId, deletedAt: null });
  }

  async update(businessId: string, id: string, patch: Partial<Product>, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, patch.branchId ?? null);
    let safePatch = patch;
    if (this.businessModel) {
      const existing = await this.productModel.findOne(buildProductLookupQuery({ businessId, identifier: id, branchId })).lean();
      if (!existing) throw isMongoObjectId(id) ? productNotFoundException() : invalidProductIdException();
      const context = await this.resolveCreationContext(businessId, patch.catalogEntityType ?? existing.catalogEntityType ?? null);
      if (patch.industryKey && patch.industryKey !== context.industryKey) {
        throw new BadRequestException("The catalog record does not belong to this business industry.");
      }
      safePatch = {
        ...patch,
        catalogEntityType: context.config.entityType,
        industryKey: context.industryKey
      };
    }
    const { businessId: _ignoredBusinessId, branchId: _ignoredBranchId, industryKey: _ignoredIndustryKey, ...patchWithoutContext } = safePatch;
    safePatch = patchWithoutContext;
    const updated = await this.productModel.findOneAndUpdate(buildProductLookupQuery({ businessId, identifier: id, branchId }), safePatch, { new: true }).lean();
    if (!updated) throw isMongoObjectId(id) ? productNotFoundException() : invalidProductIdException();
    return updated;
  }

  private async resolveCreationContext(businessId: string, entityType: CatalogEntityType | null) {
    if (!this.businessModel) {
      throw new BadRequestException("Business industry context is unavailable. Refresh the workspace and try again.");
    }
    const business = await findBusinessByIdentifier(this.businessModel, businessId);
    if (!business) throw new BadRequestException("Business context could not be resolved.");
    const resolution = resolveCatalogCreationContext({
      industryKey: business.industryKey ?? null,
      businessType: business.businessType ?? null,
      ...(entityType ? { entityType } : {})
    });
    if (resolution.status !== "ready") throw new BadRequestException(resolution.message);
    return resolution.context;
  }

  private normalizeCreationPayload(input: Partial<Product> & { businessId: string; name: string }, context: CatalogCreationContext) {
    const requiredName = typeof input.name === "string" ? input.name.trim() : "";
    if (requiredName.length < 2) throw new BadRequestException("Enter a name for this catalog record.");
    const priceRequired = context.config.fields.some((field) => field.key === "sellingPrice" && field.required);
    if (priceRequired && (input.sellingPrice == null || !Number.isFinite(Number(input.sellingPrice)) || Number(input.sellingPrice) < 0)) {
      throw new BadRequestException(`${context.config.itemLabel} price is required.`);
    }
    const unitRequired = context.config.fields.some((field) => field.key === "unit" && field.required);
    if (unitRequired && !input.unit?.trim()) throw new BadRequestException("Enter a unit of measure.");
    if (input.industryKey && input.industryKey !== context.industryKey) {
      throw new BadRequestException("The catalog record does not belong to this business industry.");
    }
    return {
      ...input,
      name: requiredName,
      catalogEntityType: context.config.entityType,
      industryKey: context.industryKey,
      unit: input.unit?.trim() || context.config.defaultUnit,
      buyingPrice: Number(input.buyingPrice ?? 0),
      sellingPrice: Number(input.sellingPrice ?? 0),
      stockOnHand: context.config.supportsInventory ? Number(input.stockOnHand ?? 0) : 0,
      lowStockThreshold: context.config.supportsInventory ? Number(input.lowStockThreshold ?? 0) : 0
    };
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
