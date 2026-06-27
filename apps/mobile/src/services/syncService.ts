import NetInfo from "@react-native-community/netinfo";
import { nowIso } from "@/utils/date";
import { allSql, runSql } from "@/storage/sqlite";
import { SyncRepository, SyncCheckpointRepository } from "@/repositories/syncRepository";
import type { SyncEventPayload } from "@shared";

export type SyncStatus = "idle" | "syncing" | "online" | "offline" | "error";

export class SyncService {
  private readonly syncRepo = new SyncRepository();
  private readonly checkpointRepo = new SyncCheckpointRepository();

  async enqueue(event: SyncEventPayload) {
    await this.syncRepo.enqueue(event);
  }

  async pendingCount() {
    const rows = await allSql<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_events WHERE status IN ('pending', 'failed')"
    );
    return rows[0]?.count ?? 0;
  }

  async flush(businessId: string, deviceId: string, endpoint: string, token?: string | null) {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      return { status: "offline" as const, pushed: 0 };
    }
    const pending = await this.syncRepo.pending();
    if (!pending.length) {
      await this.checkpointRepo.upsert({ businessId, deviceId, lastPulledAt: nowIso(), lastPushedAt: nowIso(), serverCursor: null });
      return { status: "online" as const, pushed: 0 };
    }

    const response = await fetch(`${endpoint}/sync/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        businessId,
        deviceId,
        events: pending.map((event) => ({
          ...event,
          payload: JSON.parse(event.payload)
        }))
      })
    });
    if (!response.ok) {
      const text = await response.text();
      for (const event of pending) {
        await this.syncRepo.markFailed(event.eventId, text);
      }
      throw new Error(text);
    }
    const data = (await response.json()) as { acknowledgements?: { eventId: string }[]; cursor?: string | null };
    for (const ack of data.acknowledgements ?? []) {
      await this.syncRepo.markSent(ack.eventId);
    }
    await this.checkpointRepo.upsert({
      businessId,
      deviceId,
      lastPulledAt: nowIso(),
      lastPushedAt: nowIso(),
      serverCursor: data.cursor ?? null
    });
    return { status: "online" as const, pushed: data.acknowledgements?.length ?? 0 };
  }

  async pull(businessId: string, deviceId: string, endpoint: string, token?: string | null) {
    const response = await fetch(`${endpoint}/sync/pull?businessId=${encodeURIComponent(businessId)}&deviceId=${encodeURIComponent(deviceId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const payload = (await response.json()) as {
      cursor?: string | null;
      changes?: Array<{ entityType: string; action: string; entityId: string; payload: Record<string, unknown> }>;
    };
    for (const change of payload.changes ?? []) {
      if (change.entityType === "category" && change.action !== "delete") {
        const p = change.payload as Record<string, unknown>;
        await runSql(
          `INSERT INTO categories (id, businessId, name, color, sortOrder, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             color = excluded.color,
             sortOrder = excluded.sortOrder,
             updatedAt = excluded.updatedAt,
             deletedAt = excluded.deletedAt`,
          [
            String(p.id),
            String(p.businessId),
            String(p.name),
            (p.color as string | null) ?? null,
            Number(p.sortOrder ?? 0),
            String(p.createdAt ?? nowIso()),
            String(p.updatedAt ?? nowIso()),
            (p.deletedAt as string | null) ?? null
          ]
        );
      }
      if (change.entityType === "payment" && change.action !== "delete") {
        const p = change.payload as Record<string, unknown>;
        await runSql(
          `INSERT INTO payments (id, businessId, customerId, saleId, debtPaymentId, method, status, amount, reference, note, provider, reconciledAt, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             customerId = excluded.customerId,
             saleId = excluded.saleId,
             debtPaymentId = excluded.debtPaymentId,
             method = excluded.method,
             status = excluded.status,
             amount = excluded.amount,
             reference = excluded.reference,
             note = excluded.note,
             provider = excluded.provider,
             reconciledAt = excluded.reconciledAt,
             updatedAt = excluded.updatedAt`,
          [
            String(p.id),
            String(p.businessId),
            (p.customerId as string | null) ?? null,
            (p.saleId as string | null) ?? null,
            (p.debtPaymentId as string | null) ?? null,
            String(p.method ?? "cash"),
            String(p.status ?? "paid"),
            Number(p.amount ?? 0),
            (p.reference as string | null) ?? null,
            (p.note as string | null) ?? null,
            (p.provider as string | null) ?? null,
            (p.reconciledAt as string | null) ?? null,
            String(p.createdAt ?? nowIso()),
            String(p.updatedAt ?? nowIso())
          ]
        );
      }
      if (change.entityType === "customer" && change.action !== "delete") {
        const p = change.payload as Record<string, unknown>;
        await runSql(
          `INSERT INTO customers (id, businessId, name, phone, email, notes, balance, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             phone = excluded.phone,
             email = excluded.email,
             notes = excluded.notes,
             balance = excluded.balance,
             updatedAt = excluded.updatedAt,
             deletedAt = excluded.deletedAt`,
          [
            String(p.id),
            String(p.businessId),
            String(p.name),
            (p.phone as string | null) ?? null,
            (p.email as string | null) ?? null,
            (p.notes as string | null) ?? null,
            Number(p.balance ?? 0),
            String(p.createdAt ?? nowIso()),
            String(p.updatedAt ?? nowIso()),
            (p.deletedAt as string | null) ?? null
          ]
        );
      }
      if (change.entityType === "expense" && change.action !== "delete") {
        const p = change.payload as Record<string, unknown>;
        await runSql(
          `INSERT INTO expenses (id, businessId, categoryId, amount, note, expenseDate, recordedById, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             categoryId = excluded.categoryId,
             amount = excluded.amount,
             note = excluded.note,
             expenseDate = excluded.expenseDate,
             recordedById = excluded.recordedById,
             updatedAt = excluded.updatedAt,
             deletedAt = excluded.deletedAt`,
          [
            String(p.id),
            String(p.businessId),
            (p.categoryId as string | null) ?? null,
            Number(p.amount ?? 0),
            String(p.note ?? ""),
            String(p.expenseDate ?? nowIso()),
            (p.recordedById as string | null) ?? null,
            String(p.createdAt ?? nowIso()),
            String(p.updatedAt ?? nowIso()),
            (p.deletedAt as string | null) ?? null
          ]
        );
      }
      if (change.entityType === "stockMovement" && change.action !== "delete") {
        const p = change.payload as Record<string, unknown>;
        await runSql(
          `INSERT INTO stock_movements (id, businessId, productId, referenceType, referenceId, quantityDelta, unitCost, note, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             productId = excluded.productId,
             referenceType = excluded.referenceType,
             referenceId = excluded.referenceId,
             quantityDelta = excluded.quantityDelta,
             unitCost = excluded.unitCost,
             note = excluded.note,
             updatedAt = excluded.updatedAt`,
          [
            String(p.id),
            String(p.businessId),
            String(p.productId),
            String(p.referenceType ?? "restock"),
            String(p.referenceId ?? p.id),
            Number(p.quantityDelta ?? 0),
            Number(p.unitCost ?? 0),
            (p.note as string | null) ?? null,
            String(p.createdAt ?? nowIso()),
            String(p.updatedAt ?? nowIso())
          ]
        );
        await runSql(
          "UPDATE products SET stockOnHand = MAX(0, stockOnHand + ?) WHERE id = ?",
          [Number(p.quantityDelta ?? 0), String(p.productId)]
        );
      }
      if (change.entityType === "product" && change.action !== "delete") {
        const p = change.payload as Record<string, unknown>;
        await runSql(
          `INSERT INTO products (id, businessId, categoryId, name, sku, barcode, unit, buyingPrice, sellingPrice, stockOnHand, lowStockThreshold, isActive, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             categoryId = excluded.categoryId,
             name = excluded.name,
             sku = excluded.sku,
             barcode = excluded.barcode,
             unit = excluded.unit,
             buyingPrice = excluded.buyingPrice,
             sellingPrice = excluded.sellingPrice,
             stockOnHand = excluded.stockOnHand,
             lowStockThreshold = excluded.lowStockThreshold,
             isActive = excluded.isActive,
             updatedAt = excluded.updatedAt,
             deletedAt = excluded.deletedAt`,
          [
            String(p.id),
            String(p.businessId),
            (p.categoryId as string | null) ?? null,
            String(p.name),
            (p.sku as string | null) ?? null,
            (p.barcode as string | null) ?? null,
            String(p.unit),
            Number(p.buyingPrice ?? 0),
            Number(p.sellingPrice ?? 0),
            Number(p.stockOnHand ?? 0),
            Number(p.lowStockThreshold ?? 0),
            p.isActive ? 1 : 0,
            String(p.createdAt ?? nowIso()),
            String(p.updatedAt ?? nowIso()),
            (p.deletedAt as string | null) ?? null
          ]
        );
      }
    }
    await this.checkpointRepo.upsert({
      businessId,
      deviceId,
      lastPulledAt: nowIso(),
      lastPushedAt: nowIso(),
      serverCursor: payload.cursor ?? null
    });
    return payload;
  }
}
