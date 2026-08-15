import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Category, CategoryDocument } from "../schemas";

@Injectable()
export class CategoriesService {
  constructor(@InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>) {}

  list(businessId: string) {
    return this.categoryModel.find({ businessId, deletedAt: null }).sort({ sortOrder: 1 }).lean();
  }

  async create(input: Partial<Category> & { businessId: string; name: string }) {
    if (input.externalId) {
      const existing = await this.categoryModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    return this.categoryModel.create({ ...input, deletedAt: null });
  }
}
