import { BaseRepository } from "./baseRepository";
import { createId } from "@/utils/id";
import { nowIso } from "@/utils/date";
import type { Category, Product } from "@shared";

export class CategoryRepository extends BaseRepository<Category> {
  constructor() {
    super("categories");
  }

  async create(input: Omit<Category, "id" | "createdAt" | "updatedAt"> & { businessId: string }) {
    const row: Category = {
      ...input,
      id: createId(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null
    };
    return this.insert(row);
  }
}

export class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super("products");
  }

  async create(input: Omit<Product, "id" | "createdAt" | "updatedAt"> & { businessId: string }) {
    const row: Product = {
      ...input,
      id: createId(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null
    };
    return this.insert(row);
  }

  async adjustStock(productId: string, delta: number) {
    const product = await this.findById(productId);
    if (!product) return null;
    return this.update(productId, {
      stockOnHand: Math.max(0, Number(product.stockOnHand || 0) + delta),
      updatedAt: nowIso()
    } as Partial<Product>);
  }
}
