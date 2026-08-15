import type { Schema } from "mongoose";

type SchemaEntry = { name: string; schema: Schema };

export function buildBusinessSchemas(input: {
  Business: SchemaEntry;
  Branch: SchemaEntry;
  User: SchemaEntry;
  Device: SchemaEntry;
}) {
  return [input.Business, input.Branch, input.User, input.Device] as const;
}
