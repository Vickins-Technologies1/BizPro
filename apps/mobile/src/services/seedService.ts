import { CategoryRepository, ProductRepository } from "@/repositories/catalogRepository";
import { CustomerRepository } from "@/repositories/customerRepository";

export async function seedDemoData(businessId: string) {
  const categoryRepo = new CategoryRepository();
  const productRepo = new ProductRepository();
  const customerRepo = new CustomerRepository();

  const category = await categoryRepo.create({
    businessId,
    name: "Fast Moving",
    color: "#2563EB",
    sortOrder: 1
  });

  await productRepo.create({
    businessId,
    categoryId: category.id,
    name: "Sugar 1kg",
    sku: "SUG-1KG",
    barcode: null,
    unit: "pack",
    buyingPrice: 140,
    sellingPrice: 180,
    stockOnHand: 24,
    lowStockThreshold: 6,
    isActive: true
  });

  await customerRepo.create({
    businessId,
    name: "Walk-in Customer",
    phone: null,
    email: null,
    notes: "Default cash customer",
    balance: 0
  });
}
