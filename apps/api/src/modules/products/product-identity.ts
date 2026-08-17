import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { buildBranchMatch } from "../../common/branch-scope";

export const INVALID_PRODUCT_ID_RESPONSE = {
  success: false,
  code: "INVALID_PRODUCT_ID",
  message: "The selected product could not be identified. Please refresh your products and try again."
} as const;

export const PRODUCT_NOT_FOUND_RESPONSE = {
  success: false,
  code: "PRODUCT_NOT_FOUND",
  message: "The selected product is no longer available. Refresh your products and try again."
} as const;

export function isMongoObjectId(value: string) {
  return Types.ObjectId.isValid(value);
}

export function buildProductLookupQuery(input: { businessId: string; identifier: string; branchId?: string | null }) {
  const query: Record<string, unknown> = {
    businessId: input.businessId,
    deletedAt: null,
    ...buildBranchMatch(input.branchId ?? null)
  };
  query.$or = isMongoObjectId(input.identifier) ? [{ _id: input.identifier }, { externalId: input.identifier }] : [{ externalId: input.identifier }];
  return query;
}

export function collectProductIdentifiers(product: { _id?: unknown; externalId?: string | null }, identifier: string) {
  return [...new Set([identifier, product.externalId ?? null, product._id ? String(product._id) : null].filter(Boolean) as string[])];
}

export function invalidProductIdException() {
  return new BadRequestException(INVALID_PRODUCT_ID_RESPONSE);
}

export function productNotFoundException() {
  return new NotFoundException(PRODUCT_NOT_FOUND_RESPONSE);
}
