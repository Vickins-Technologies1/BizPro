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

  create(input: Partial<Category> & { businessId: string; name: string }) {
    return this.categoryModel.create({ ...input, deletedAt: null });
  }
}
