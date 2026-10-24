import type { StockTransfer } from "@vbo/shared";
import { request } from "./desktop-api";

type ApiEntity = Record<string, unknown>;

function normalizeTransfer(transfer: ApiEntity): StockTransfer {
  return { ...transfer, id: String(transfer.externalId ?? transfer.id ?? transfer._id ?? "") } as unknown as StockTransfer;
}

export const desktopStockTransfersApi = {
  list: async (branchId?: string | null) => normalizeList(await request<ApiEntity[]>(`/stock-transfers${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`)),
  create: async (body: unknown) => normalizeTransfer(await request<ApiEntity>("/stock-transfers", { method: "POST", body: JSON.stringify(body) })),
  update: async (id: string, body: unknown) => normalizeTransfer(await request<ApiEntity>(`/stock-transfers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) })),
  dispatch: async (id: string) => normalizeTransfer(await request<ApiEntity>(`/stock-transfers/${encodeURIComponent(id)}/dispatch`, { method: "POST" })),
  receive: async (id: string) => normalizeTransfer(await request<ApiEntity>(`/stock-transfers/${encodeURIComponent(id)}/receive`, { method: "POST" })),
  archive: async (id: string) => normalizeTransfer(await request<ApiEntity>(`/stock-transfers/${encodeURIComponent(id)}/archive`, { method: "POST" }))
};

function normalizeList(items: ApiEntity[]): StockTransfer[] {
  return items.map(normalizeTransfer);
}
