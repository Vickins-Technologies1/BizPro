import type { Schema } from "mongoose";

type SchemaEntry = { name: string; schema: Schema };

export function buildOpsSchemas(input: {
  WebhookLog: SchemaEntry;
  PaymentReconciliationLog: SchemaEntry;
  AuditLog: SchemaEntry;
  BusinessNotification: SchemaEntry;
}) {
  return [input.WebhookLog, input.PaymentReconciliationLog, input.AuditLog, input.BusinessNotification] as const;
}
