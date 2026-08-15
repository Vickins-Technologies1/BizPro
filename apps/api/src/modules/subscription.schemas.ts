import type { Schema } from "mongoose";

type SchemaEntry = { name: string; schema: Schema };

export function buildSubscriptionSchemas(input: {
  SubscriptionPlan: SchemaEntry;
  Subscription: SchemaEntry;
}) {
  return [input.SubscriptionPlan, input.Subscription] as const;
}
