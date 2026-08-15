import type { Schema } from "mongoose";

type SchemaEntry = { name: string; schema: Schema };

export function buildCatalogSchemas(input: {
  Category: SchemaEntry;
  Brand: SchemaEntry;
  Product: SchemaEntry;
  CustomerGroup: SchemaEntry;
  Customer: SchemaEntry;
  Supplier: SchemaEntry;
  PurchaseOrder: SchemaEntry;
  StockTransfer: SchemaEntry;
  StockAdjustment: SchemaEntry;
}) {
  return [
    input.Category,
    input.Brand,
    input.Product,
    input.CustomerGroup,
    input.Customer,
    input.Supplier,
    input.PurchaseOrder,
    input.StockTransfer,
    input.StockAdjustment
  ] as const;
}
