import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Product, ProductDocument, StockMovement, StockMovementDocument } from "../schemas";

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(StockMovement.name) private readonly movementModel: Model<StockMovementDocument>
  ) {}

  list(businessId: string) {
    return this.productModel.find({ businessId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  create(input: Partial<Product> & { businessId: string; name: string; unit: string; buyingPrice: number; sellingPrice: number }) {
    return this.productModel.create({ ...input, deletedAt: null });
  }

  async update(id: string, patch: Partial<Product>) {
    const updated = await this.productModel.findByIdAndUpdate(id, patch, { new: true }).lean();
    if (!updated) throw new NotFoundException("Product not found");
    return updated;
  }

  async archive(id: string) {
    const updated = await this.productModel.findByIdAndUpdate(id, { deletedAt: new Date(), isActive: false }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Product not found");
    return updated;
  }

  async adjustStock(input: { businessId: string; productId: string; referenceType: StockMovement["referenceType"]; referenceId: string; quantityDelta: number; unitCost: number; note?: string }) {
    const product = await this.productModel.findById(input.productId);
    if (!product) throw new NotFoundException("Product not found");
    product.stockOnHand = Math.max(0, product.stockOnHand + input.quantityDelta);
    await product.save();
    await this.movementModel.create({ ...input });
    return product.toObject();
  }
}
