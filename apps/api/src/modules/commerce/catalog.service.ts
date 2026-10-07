import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Brand, BrandDocument, Business, BusinessDocument, Category, CategoryDocument, Product, ProductDocument, Supplier, SupplierDocument } from "../schemas";
import { VendorProduct, VendorProductDocument } from "../commerce.schemas";
import type { CommercePrincipal } from "../../common/commerce-auth.decorator";
import { assertBranchAccess, escapeRegex, pageInput, pageResult, safeProductId } from "./commerce.helpers";
import { isMongoObjectId } from "../products/product-identity";

export type ProductQuery = {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  brandId?: string;
  sku?: string;
  vendorId?: string;
  branchId?: string;
  availability?: "in_stock" | "out_of_stock";
  minPrice?: number;
  maxPrice?: number;
};

@Injectable()
export class CommerceCatalogService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Brand.name) private readonly brandModel: Model<BrandDocument>,
    @InjectModel(Supplier.name) private readonly supplierModel: Model<SupplierDocument>,
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectModel(VendorProduct.name) private readonly vendorProductModel: Model<VendorProductDocument>
  ) {}

  async products(principal: CommercePrincipal, query: ProductQuery) {
    const { page, limit } = pageInput(query.page, query.limit);
    if (query.branchId) assertBranchAccess(principal, query.branchId);
    const branchId = query.branchId ?? (principal.branchIds.length === 1 ? principal.branchIds[0] : undefined);
    const and: Record<string, unknown>[] = [{ businessId: principal.businessId, deletedAt: null, isActive: true }, { visibility: { $in: ["EXTERNAL", "MARKETPLACE"] } }];
    if (branchId) and.push({ $or: [{ branchId }, { branchId: null }] });
    else if (principal.branchIds.length) and.push({ $or: [{ branchId: { $in: principal.branchIds } }, { branchId: null }] });
    if (query.categoryId) and.push({ categoryId: query.categoryId });
    if (query.brandId) and.push({ brandId: query.brandId });
    if (query.sku) and.push({ sku: query.sku });
    if (query.minPrice !== undefined || query.maxPrice !== undefined) and.push({ sellingPrice: { ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}) } });
    if (query.search?.trim()) {
      const search = escapeRegex(query.search.trim());
      and.push({ $or: [{ name: { $regex: search, $options: "i" } }, { sku: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }] });
    }
    if (query.availability === "in_stock") and.push({ $expr: { $gt: [{ $subtract: [{ $ifNull: ["$stockOnHand", 0] }, { $ifNull: ["$reservedQuantity", 0] }] }, 0] } });
    if (query.availability === "out_of_stock") and.push({ $expr: { $lte: [{ $subtract: [{ $ifNull: ["$stockOnHand", 0] }, { $ifNull: ["$reservedQuantity", 0] }] }, 0] } });
    if (query.vendorId) {
      const links = await this.vendorProductModel.find({ businessId: principal.businessId, vendorId: query.vendorId, status: "active", deletedAt: null }).select("productId").lean();
      and.push({ $or: links.map((link) => ({ $or: [{ externalId: link.productId }, { _id: link.productId }] })) });
    }
    const filter = { $and: and } as never;
    const total = await this.productModel.countDocuments(filter);
    const rows = await this.productModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return pageResult(await Promise.all(rows.map((row) => this.publicProduct(principal.businessId, row, branchId))), page, limit, total);
  }

  async product(principal: CommercePrincipal, id: string, branchId?: string) {
    const effectiveBranchId = branchId ?? (principal.branchIds.length === 1 ? principal.branchIds[0] : undefined);
    if (effectiveBranchId) assertBranchAccess(principal, effectiveBranchId);
    const identifierMatch = isMongoObjectId(id) ? [{ _id: id }, { externalId: id }] : [{ externalId: id }];
    const branchMatch = effectiveBranchId ? { $or: [{ branchId: effectiveBranchId }, { branchId: null }] } : principal.branchIds.length ? { $or: [{ branchId: { $in: principal.branchIds } }, { branchId: null }] } : null;
    const row = await this.productModel.findOne({ businessId: principal.businessId, deletedAt: null, isActive: true, visibility: { $in: ["EXTERNAL", "MARKETPLACE"] }, $and: [{ $or: identifierMatch }, ...(branchMatch ? [branchMatch] : [])] } as never).lean();
    if (!row) throw new NotFoundException("Commerce product not found");
    return this.publicProduct(principal.businessId, row, effectiveBranchId);
  }

  async categories(principal: CommercePrincipal, page?: number, limit?: number) {
    const paging = pageInput(page, limit);
    const filter = { businessId: principal.businessId, deletedAt: null };
    const total = await this.categoryModel.countDocuments(filter);
    const rows = await this.categoryModel.find(filter).sort({ sortOrder: 1, name: 1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit).lean();
    return pageResult(rows.map((row) => ({ id: String(row._id), name: row.name, color: row.color ?? null })), paging.page, paging.limit, total);
  }

  async vendors(principal: CommercePrincipal, page?: number, limit?: number) {
    const paging = pageInput(page, limit);
    const filter = { businessId: principal.businessId, deletedAt: null, isActive: true };
    const total = await this.supplierModel.countDocuments(filter);
    const rows = await this.supplierModel.find(filter).sort({ name: 1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit).lean();
    return pageResult(rows.map((row) => ({ id: String(row._id), name: row.businessName ?? row.name, status: row.status ?? "ACTIVE" })), paging.page, paging.limit, total);
  }

  private async publicProduct(businessId: string, row: Product & { _id?: unknown }, branchId?: string) {
    const [business, vendorCount, category, brand] = await Promise.all([
      this.businessModel.findOne({ ...(isMongoObjectId(businessId) ? { $or: [{ externalId: businessId }, { _id: businessId }] } : { externalId: businessId }), deletedAt: null } as never).select("currency").lean(),
      this.vendorProductModel.countDocuments({ businessId, productId: safeProductId(row), status: "active", availability: { $in: ["available", "backorder"] }, deletedAt: null }),
      row.categoryId ? this.categoryModel.findOne({ _id: row.categoryId, businessId, deletedAt: null }).select("name").lean() : null,
      row.brandId ? this.brandModel.findOne({ _id: row.brandId, businessId, deletedAt: null }).select("name").lean() : null
    ]);
    const availableQuantity = Number(row.stockOnHand ?? 0);
    const reservedQuantity = Number(row.reservedQuantity ?? 0);
    return {
      id: safeProductId(row),
      sku: row.sku ?? null,
      name: row.name,
      description: row.description ?? null,
      images: row.images ?? [],
      categoryId: row.categoryId ?? null,
      category: category?.name ?? null,
      brandId: row.brandId ?? null,
      brand: brand?.name ?? null,
      productSource: row.productSource ?? "INTERNAL",
      price: Number(row.sellingPrice ?? 0),
      currency: business?.currency ?? "KES",
      branchId: branchId ?? row.branchId ?? null,
      availability: Math.max(0, availableQuantity - reservedQuantity),
      stockStatus: availableQuantity - reservedQuantity > 0 ? "in_stock" : "out_of_stock",
      vendorAvailability: vendorCount > 0
    };
  }
}
