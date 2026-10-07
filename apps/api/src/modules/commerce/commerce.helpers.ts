import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { CommercePrincipal } from "../../common/commerce-auth.decorator";

export const COMMERCE_SCOPES = ["products:read", "inventory:read", "vendors:read", "orders:read", "orders:write", "inventory:reserve"] as const;

export function hashRequest(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function createSecret() {
  return randomBytes(32).toString("base64url");
}

export function assertBranchAccess(principal: CommercePrincipal, branchId: string) {
  if (!branchId.trim()) throw new BadRequestException("branchId is required for Commerce inventory operations");
  if (principal.branchIds.length && !principal.branchIds.includes(branchId)) {
    throw new ForbiddenException("The API credential is not allowed to access this branch");
  }
}

export function pageInput(page?: number, limit?: number) {
  const safePage = Number.isInteger(page) && Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Number.isInteger(limit) && Number(limit) > 0 ? Math.min(Number(limit), 100) : 50;
  return { page: safePage, limit: safeLimit };
}

export function pageResult<T>(items: T[], page: number, limit: number, total: number) {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function safeProductId(product: { _id?: unknown; externalId?: string | null }) {
  return product.externalId ?? String(product._id);
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
