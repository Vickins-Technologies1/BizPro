import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Product, ProductDocument, Supplier, SupplierDocument } from "../schemas";
import { VendorProduct, VendorProductDocument } from "../commerce.schemas";
import { safeProductId } from "./commerce.helpers";
import { buildProductLookupQuery, isMongoObjectId } from "../products/product-identity";
import { CommerceWebhooksService } from "./webhooks.service";

@Injectable()
export class CommerceVendorsService {
  constructor(
    @InjectModel(Supplier.name) private readonly supplierModel: Model<SupplierDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(VendorProduct.name) private readonly vendorProductModel: Model<VendorProductDocument>,
    private readonly webhooks: CommerceWebhooksService
  ) {}

  list(businessId: string) {
    return this.supplierModel.find({ businessId, deletedAt: null }).sort({ name: 1 }).lean();
  }

  async create(input: Partial<Supplier> & { businessId: string; name: string }) {
    const vendor = await this.supplierModel.create({
      ...input,
      status: input.status ?? (input.isActive === false ? "INACTIVE" : "ACTIVE"),
      isActive: input.isActive ?? true,
      deletedAt: null
    });
    void this.webhooks.publish({ businessId: input.businessId, eventType: "vendor.updated", data: { vendorId: String(vendor._id), action: "created" } }).catch(() => undefined);
    return vendor;
  }

  async update(businessId: string, id: string, patch: Partial<Supplier>) {
    const { businessId: _businessId, deletedAt: _deletedAt, ...safePatch } = patch;
    const updated = await this.supplierModel.findOneAndUpdate({ businessId, _id: id, deletedAt: null }, safePatch, { new: true }).lean();
    if (!updated) throw new NotFoundException("Vendor not found");
    void this.webhooks.publish({ businessId, eventType: "vendor.updated", data: { vendorId: String(updated._id), action: "updated" } }).catch(() => undefined);
    return updated;
  }

  async disable(businessId: string, id: string) {
    const updated = await this.supplierModel.findOneAndUpdate({ businessId, _id: id, deletedAt: null }, { $set: { isActive: false, status: "INACTIVE" } }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Vendor not found");
    void this.webhooks.publish({ businessId, eventType: "vendor.updated", data: { vendorId: String(updated._id), action: "disabled" } }).catch(() => undefined);
    return updated;
  }

  async attachProduct(input: Partial<VendorProduct> & { businessId: string; vendorId: string; productId: string; vendorCost: number }) {
    if (!isMongoObjectId(input.vendorId)) throw new NotFoundException("Vendor not found");
    const [vendor, product] = await Promise.all([
      this.supplierModel.findOne({ _id: input.vendorId, businessId: input.businessId, deletedAt: null }).lean(),
      this.productModel.findOne(buildProductLookupQuery({ businessId: input.businessId, identifier: input.productId, branchId: input.branchId ?? null })).lean()
    ]);
    if (!vendor) throw new NotFoundException("Vendor not found");
    if (!product) throw new NotFoundException("Product not found");
    const relationship = await this.vendorProductModel.findOneAndUpdate(
      { businessId: input.businessId, vendorId: input.vendorId, productId: safeProductId(product), branchId: input.branchId ?? null },
      {
        $set: {
          ...input,
          productId: safeProductId(product),
          branchId: input.branchId ?? null,
          currency: input.currency ?? "KES",
          minimumOrderQuantity: input.minimumOrderQuantity ?? 1,
          leadTimeDays: input.leadTimeDays ?? 0,
          availability: input.availability ?? "available",
          status: input.status ?? "active",
          metadata: input.metadata ?? {},
          deletedAt: null
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    void this.webhooks.publish({ businessId: input.businessId, eventType: "product.updated", data: { productId: relationship?.productId ?? input.productId, vendorId: input.vendorId, action: "vendor_attached" } }).catch(() => undefined);
    return relationship;
  }

  listProductLinks(businessId: string, vendorId?: string, productId?: string) {
    return this.vendorProductModel.find({ businessId, deletedAt: null, ...(vendorId ? { vendorId } : {}), ...(productId ? { productId } : {}) }).sort({ createdAt: -1 }).lean();
  }

  async detachProduct(businessId: string, id: string) {
    const updated = await this.vendorProductModel.findOneAndUpdate({ _id: id, businessId, deletedAt: null }, { $set: { deletedAt: new Date(), status: "inactive" } }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Vendor product relationship not found");
    void this.webhooks.publish({ businessId, eventType: "product.updated", data: { vendorProductId: String(updated._id), action: "vendor_detached" } }).catch(() => undefined);
    return updated;
  }
}
