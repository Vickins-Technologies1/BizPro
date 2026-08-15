import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Brand, BrandDocument } from "../schemas";

@Injectable()
export class BrandsService {
  constructor(@InjectModel(Brand.name) private readonly brandModel: Model<BrandDocument>) {}

  list(businessId: string) {
    return this.brandModel.find({ businessId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  async create(input: Partial<Brand> & { businessId: string; name: string }) {
    if (input.externalId) {
      const existing = await this.brandModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    return this.brandModel.create({ ...input, deletedAt: null, isActive: input.isActive ?? true });
  }

  async update(businessId: string, id: string, patch: Partial<Brand>) {
    const { businessId: _ignoredBusinessId, ...safePatch } = patch;
    const updated = await this.brandModel.findOneAndUpdate({ _id: id, businessId }, safePatch, { new: true }).lean();
    if (!updated) throw new NotFoundException("Brand not found");
    return updated;
  }

  async archive(businessId: string, id: string) {
    const updated = await this.brandModel.findOneAndUpdate({ _id: id, businessId }, { deletedAt: new Date(), isActive: false }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Brand not found");
    return updated;
  }
}
