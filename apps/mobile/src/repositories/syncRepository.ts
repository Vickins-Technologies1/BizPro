import type { SyncEventPayload, SyncCheckpoint } from "@vbo/shared";
import { BaseRepository } from "./baseRepository";
import { createId } from "@/utils/id";
import { nowIso } from "@/utils/date";
import { allSql, runSql, oneSql } from "@/storage/sqlite";

export interface SyncEventRow {
  id: string;
  eventId: string;
  businessId: string;
  deviceId: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: string;
  status: "pending" | "sent" | "failed";
  retryCount: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export class SyncRepository extends BaseRepository<SyncEventRow> {
  constructor() {
    super("sync_events");
  }

  async enqueue(event: SyncEventPayload) {
    return this.insert({
      id: createId(),
      eventId: event.eventId,
      businessId: event.businessId,
      deviceId: event.deviceId,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      payload: JSON.stringify(event.payload),
      status: "pending",
      retryCount: 0,
      lastError: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  }

  async pending() {
    return allSql<SyncEventRow>("SELECT * FROM sync_events WHERE status IN ('pending', 'failed') ORDER BY createdAt ASC");
  }

  async markSent(eventId: string) {
    await runSql("UPDATE sync_events SET status = 'sent', updatedAt = ? WHERE eventId = ?", [nowIso(), eventId]);
  }

  async markFailed(eventId: string, error: string) {
    await runSql(
      "UPDATE sync_events SET status = 'failed', retryCount = retryCount + 1, lastError = ?, updatedAt = ? WHERE eventId = ?",
      [error, nowIso(), eventId]
    );
  }
}

export class SyncCheckpointRepository {
  async get(businessId: string, deviceId: string) {
    return oneSql<SyncCheckpoint>(
      "SELECT businessId, deviceId, lastPulledAt, lastPushedAt, serverCursor FROM sync_checkpoints WHERE businessId = ? AND deviceId = ? LIMIT 1",
      [businessId, deviceId]
    );
  }

  async upsert(input: SyncCheckpoint) {
    const exists = await this.get(input.businessId, input.deviceId);
    if (exists) {
      await runSql(
        "UPDATE sync_checkpoints SET lastPulledAt = ?, lastPushedAt = ?, serverCursor = ?, updatedAt = ? WHERE businessId = ? AND deviceId = ?",
        [input.lastPulledAt ?? null, input.lastPushedAt ?? null, input.serverCursor ?? null, nowIso(), input.businessId, input.deviceId]
      );
      return;
    }
    await runSql(
      "INSERT INTO sync_checkpoints (id, businessId, deviceId, lastPulledAt, lastPushedAt, serverCursor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [createId(), input.businessId, input.deviceId, input.lastPulledAt ?? null, input.lastPushedAt ?? null, input.serverCursor ?? null, nowIso(), nowIso()]
    );
  }
}
