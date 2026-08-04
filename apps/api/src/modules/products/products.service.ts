import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Product, ProductDocument, Sale, SaleDocument, StockMovement, StockMovementDocument } from "../schemas";

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(StockMovement.name) private readonly movementModel: Model<StockMovementDocument>,
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>
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

  async history(businessId: string, productId: string) {
    const [stockMovements, salesHistory] = await Promise.all([
      this.movementModel.find({ businessId, productId }).sort({ createdAt: -1 }).limit(24).lean(),
      this.saleModel.aggregate([
        { $match: { businessId } },
        { $unwind: "$items" },
        { $match: { "items.productId": productId } },
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
