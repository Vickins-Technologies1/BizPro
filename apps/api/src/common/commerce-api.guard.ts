import { CanActivate, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectModel } from "@nestjs/mongoose";
import { createHash, timingSafeEqual } from "node:crypto";
import { Model } from "mongoose";
import { CommerceApiCredential, CommerceApiCredentialDocument } from "../modules/commerce.schemas";
import type { CommercePrincipal } from "./commerce-auth.decorator";

@Injectable()
export class CommerceRateLimiter {
  private readonly buckets = new Map<string, { startedAt: number; count: number }>();

  check(key: string, limit: number) {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || now - existing.startedAt >= 60_000) {
      this.buckets.set(key, { startedAt: now, count: 1 });
      return;
    }
    if (existing.count >= limit) {
      throw new HttpException("Commerce API rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }
    existing.count += 1;
  }
}

@Injectable()
export class CommerceApiGuard implements CanActivate {
  constructor(
    @InjectModel(CommerceApiCredential.name) private readonly credentialModel: Model<CommerceApiCredentialDocument>,
    private readonly rateLimiter: CommerceRateLimiter
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined>; commerceAuth?: CommercePrincipal }>();
    const rawApiKey = readHeader(request.headers["x-api-key"]);
    if (!rawApiKey) throw new UnauthorizedException("Commerce API key is required");
    const [keyId, secret] = rawApiKey.split(".", 2);
    if (!keyId || !secret) throw new UnauthorizedException("Invalid Commerce API key");

    const credential = await this.credentialModel.findOne({ keyId, status: "ACTIVE" }).select("+secretHash").lean();
    if (!credential || (credential.expiresAt && credential.expiresAt.getTime() <= Date.now())) {
      throw new UnauthorizedException("Commerce API key is invalid or expired");
    }
    const expectedHash = createHash("sha256").update(secret).digest("hex");
    const expected = Buffer.from(expectedHash, "hex");
    const actual = Buffer.from(credential.secretHash, "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new UnauthorizedException("Commerce API key is invalid");

    const principal: CommercePrincipal = {
      credentialId: String(credential._id),
      businessId: credential.businessId,
      scopes: credential.scopes,
      branchIds: credential.branchIds ?? [],
      rateLimitPerMinute: credential.rateLimitPerMinute
    };
    this.rateLimiter.check(principal.credentialId, principal.rateLimitPerMinute);
    request.commerceAuth = principal;
    await this.credentialModel.updateOne({ _id: credential._id }, { $set: { lastUsedAt: new Date() } });
    return true;
  }
}

function readHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

@Injectable()
export class CommerceScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string[]>("commerce_scopes", [context.getHandler(), context.getClass()]) ?? [];
    if (!required.length) return true;
    const request = context.switchToHttp().getRequest<{ commerceAuth?: CommercePrincipal }>();
    const principal = request.commerceAuth;
    if (!principal || !required.every((scope) => principal.scopes.includes(scope))) {
      throw new ForbiddenException("Commerce API scope is not granted");
    }
    return true;
  }
}
