import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { StockTransfer, StockTransferDocument } from "../schemas";
import { isMongoObjectId } from "../products/product-identity";

function stockTransferIdentity(id: string) {
  return isMongoObjectId(id) ? { $or: [{ _id: id }, { externalId: id }] } : { externalId: id };
}

@Injectable()
export class StockTransfersService {
  constructor(@InjectModel(StockTransfer.name) private readonly stockTransferModel: Model<StockTransferDocument>) {}

  list(businessId: string) {
    return this.stockTransferModel.find({ businessId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  async create(input: Partial<StockTransfer> & { businessId: string; transferNumber: string; transferDate: Date }) {
    if (input.externalId) {
      const existing = await this.stockTransferModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    return this.stockTransferModel.create({ ...input, deletedAt: null, status: input.status ?? "draft", items: input.items ?? [] });
  }

  async update(businessId: string, id: string, patch: Partial<StockTransfer>) {
    const { businessId: _ignoredBusinessId, ...safePatch } = patch;
    const updated = await this.stockTransferModel.findOneAndUpdate({ businessId, deletedAt: null, $and: [stockTransferIdentity(id)] }, safePatch, { new: true }).lean();
    if (!updated) throw new NotFoundException("Stock transfer not found");
    return updated;
  }

  async archive(businessId: string, id: string) {
    const updated = await this.stockTransferModel.findOneAndUpdate({ businessId, deletedAt: null, $and: [stockTransferIdentity(id)] }, { deletedAt: new Date(), status: "cancelled" }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Stock transfer not found");
    return updated;
  }
}
