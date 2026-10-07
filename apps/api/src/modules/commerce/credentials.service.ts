import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { createHash, randomBytes } from "node:crypto";
import { Model } from "mongoose";
import { CommerceApiCredential, CommerceApiCredentialDocument } from "../commerce.schemas";
import { COMMERCE_SCOPES, createSecret } from "./commerce.helpers";

@Injectable()
export class CommerceCredentialsService {
  constructor(@InjectModel(CommerceApiCredential.name) private readonly credentialModel: Model<CommerceApiCredentialDocument>) {}

  async create(input: { businessId: string; name: string; scopes: string[]; branchIds?: string[]; expiresAt?: Date | null; rateLimitPerMinute?: number }) {
    const scopes = [...new Set(input.scopes)];
    if (scopes.some((scope) => !(COMMERCE_SCOPES as readonly string[]).includes(scope))) {
      throw new ConflictException("One or more Commerce scopes are not supported");
    }
    const keyId = randomBytes(12).toString("hex");
    const secret = createSecret();
    const credential = await this.credentialModel.create({
      businessId: input.businessId,
      name: input.name.trim(),
      keyId,
      keyPrefix: `dira_${keyId.slice(0, 8)}`,
      secretHash: createHash("sha256").update(secret).digest("hex"),
      scopes,
      branchIds: input.branchIds ?? [],
      status: "ACTIVE",
      expiresAt: input.expiresAt ?? null,
      rateLimitPerMinute: input.rateLimitPerMinute ?? 60,
      secretVersion: 1
    });
    return { ...this.publicView(credential.toObject()), apiKey: `${keyId}.${secret}` };
  }

  list(businessId: string) {
    return this.credentialModel.find({ businessId }).sort({ createdAt: -1 }).lean().then((rows) => rows.map((row) => this.publicView(row)));
  }

  async revoke(businessId: string, keyId: string) {
    const updated = await this.credentialModel.findOneAndUpdate({ businessId, keyId, status: "ACTIVE" }, { $set: { status: "REVOKED" } }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Commerce API credential not found");
    return this.publicView(updated);
  }

  async rotate(businessId: string, keyId: string) {
    const secret = createSecret();
    const updated = await this.credentialModel.findOneAndUpdate(
      { businessId, keyId, status: "ACTIVE" },
      { $set: { secretHash: createHash("sha256").update(secret).digest("hex") }, $inc: { secretVersion: 1 } },
      { new: true }
    ).lean();
    if (!updated) throw new NotFoundException("Commerce API credential not found");
    return { ...this.publicView(updated), apiKey: `${keyId}.${secret}` };
  }

  private publicView(row: Partial<CommerceApiCredential> & { _id?: unknown }) {
    return {
      id: String(row._id),
      keyId: row.keyId,
      keyPrefix: row.keyPrefix,
      name: row.name,
      businessId: row.businessId,
      scopes: row.scopes,
      branchIds: row.branchIds ?? [],
      status: row.status,
      expiresAt: row.expiresAt ?? null,
      lastUsedAt: row.lastUsedAt ?? null,
      rateLimitPerMinute: row.rateLimitPerMinute,
      secretVersion: row.secretVersion
    };
  }
}
