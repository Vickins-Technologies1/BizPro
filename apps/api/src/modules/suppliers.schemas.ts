import type { Schema } from "mongoose";

type SchemaEntry = { name: string; schema: Schema };

export function buildSuppliersSchemas(input: {
  SupplierCategory: SchemaEntry;
  SupplierContact: SchemaEntry;
  SupplierDocument: SchemaEntry;
  SupplierPayment: SchemaEntry;
}) {
  return [input.SupplierCategory, input.SupplierContact, input.SupplierDocument, input.SupplierPayment] as const;
}
