import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CommerceIdempotencyRecord, CommerceIdempotencyRecordDocument } from "../commerce.schemas";
import type { CommercePrincipal } from "../../common/commerce-auth.decorator";
import { hashRequest } from "./commerce.helpers";

@Injectable()
export class CommerceIdempotencyService {
  constructor(@InjectModel(CommerceIdempotencyRecord.name) private readonly recordModel: Model<CommerceIdempotencyRecordDocument>) {}

  async execute<T extends Record<string, unknown>>(principal: CommercePrincipal, operation: string, key: string | undefined, payload: unknown, action: () => Promise<T>): Promise<T> {
    if (!key?.trim()) return action();
    const requestHash = hashRequest(payload);
    const existing = await this.recordModel.findOne({ businessId: principal.businessId, credentialId: principal.credentialId, operation, key }).lean();
    if (existing) {
      if (existing.requestHash !== requestHash) throw new ConflictException("Idempotency-Key was already used with a different request");
      if (existing.status === "COMPLETED" && existing.responseBody) return existing.responseBody as T;
      throw new ConflictException("The original idempotent request is still being processed");
    }
    try {
      await this.recordModel.create({ businessId: principal.businessId, credentialId: principal.credentialId, operation, key, requestHash, status: "PENDING", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    } catch (error) {
      const raced = await this.recordModel.findOne({ businessId: principal.businessId, credentialId: principal.credentialId, operation, key }).lean();
      if (raced?.requestHash === requestHash && raced.status === "COMPLETED" && raced.responseBody) return raced.responseBody as T;
      throw error;
    }
    const result = await action();
    await this.recordModel.updateOne({ businessId: principal.businessId, credentialId: principal.credentialId, operation, key }, { $set: { status: "COMPLETED", responseStatus: 200, responseBody: result } });
    return result;
  }
}
