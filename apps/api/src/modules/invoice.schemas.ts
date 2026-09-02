import type { Schema } from "mongoose";

type SchemaEntry = { name: string; schema: Schema };

export function buildInvoiceSchemas(input: {
  Invoice: SchemaEntry;
  DebitNote: SchemaEntry;
}) {
  return [input.Invoice, input.DebitNote] as const;
}
