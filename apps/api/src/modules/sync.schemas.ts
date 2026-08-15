import type { Schema } from "mongoose";

type SchemaEntry = { name: string; schema: Schema };

export function buildSyncSchemas(input: {
  SyncEvent: SchemaEntry;
  SyncCheckpoint: SchemaEntry;
}) {
  return [input.SyncEvent, input.SyncCheckpoint] as const;
}
