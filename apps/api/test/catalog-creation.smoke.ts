import assert from "node:assert/strict";
import { resolveCatalogCreationContext } from "@vbo/shared";

async function main() {
  const restaurant = resolveCatalogCreationContext({ businessType: "restaurant" });
  assert.equal(restaurant.status, "ready");
  if (restaurant.status === "ready") {
    assert.equal(restaurant.context.config.entityType, "menu_item");
    assert.equal(restaurant.context.config.formKey, "restaurant_menu_item");
    assert.equal(restaurant.context.config.supportsInventory, false);
  }

  const clinic = resolveCatalogCreationContext({ industryKey: "healthcare", businessType: "clinic", entityType: "service" });
  assert.equal(clinic.status, "ready");
  if (clinic.status === "ready") assert.equal(clinic.context.config.formKey, "clinical_service");

  const retailService = resolveCatalogCreationContext({ businessType: "retail_shop", entityType: "service" });
  assert.equal(retailService.status, "ready");
  if (retailService.status === "ready") assert.equal(retailService.context.config.formKey, "service");

  const automotive = resolveCatalogCreationContext({ businessType: "service_center", entityType: "service" });
  assert.equal(automotive.status, "ready");
  if (automotive.status === "ready") assert.equal(automotive.context.config.formKey, "automotive_service");

  assert.equal(resolveCatalogCreationContext({}).status, "missing");
  assert.equal(resolveCatalogCreationContext({ industryKey: "not-an-industry" }).status, "invalid");
  assert.equal(resolveCatalogCreationContext({ industryKey: "healthcare", businessType: "clinic", entityType: "product" }).status, "invalid");

  const moduleLoader = require("module") as typeof import("module");
  const originalLoad = moduleLoader._load;
  const mongooseModule = require("@nestjs/mongoose");
  moduleLoader._load = function patchedLoad(request: string, parent: NodeModule | null, isMain: boolean) {
    if (request === "@nestjs/mongoose") return { ...mongooseModule, Prop: () => () => undefined };
    return originalLoad.call(this, request, parent, isMain);
  };
  const { ProductsService } = require("../src/modules/products/products.service") as { ProductsService: new (...args: any[]) => any };
  const created: Record<string, unknown>[] = [];
  const service = new ProductsService(
    {
      findOne: () => ({ lean: async () => null }),
      create: async (input: Record<string, unknown>) => { created.push(input); return input; }
    },
    {},
    {},
    {},
    { findOne: () => ({ lean: async () => ({ businessType: "clinic", industryKey: "healthcare" }) }) }
  );

  await service.create({ businessId: "business-1", catalogEntityType: "service", name: "Consultation", sellingPrice: 1200 });
  assert.equal(created[0]?.catalogEntityType, "service");
  assert.equal(created[0]?.industryKey, "healthcare");
  assert.equal(created[0]?.unit, "service");
  assert.equal(created[0]?.stockOnHand, 0);
  await assert.rejects(() => service.create({ businessId: "business-1", catalogEntityType: "product", name: "Invalid retail product", sellingPrice: 10 }), /not supported|industry/i);

  console.log("Catalog creation smoke tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
