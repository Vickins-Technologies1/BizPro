import { CanActivate, ExecutionContext, HttpException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";

@Injectable()
export class PlatformErrorIngestGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const expected = this.config.get<string>("PLATFORM_ERROR_INGEST_KEY") ?? "";
    if (Buffer.byteLength(expected) < 32) throw new ServiceUnavailableException("System error intake is not configured");
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const supplied = String(request.headers["x-error-ingest-key"] ?? "");
    const expectedBytes = Buffer.from(expected);
    const suppliedBytes = Buffer.from(supplied);
    if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
      throw new UnauthorizedException("A valid system error intake credential is required");
    }
    return true;
  }
}

type RateBucket = { start: number; count: number };
const mobileErrorBuckets = new Map<string, RateBucket>();

@Injectable()
export class MobileErrorRateGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: { sub?: string } }>();
    const actorId = request.user?.sub;
    if (!actorId) throw new UnauthorizedException("A signed-in business user is required");
    const now = Date.now();
    let bucket = mobileErrorBuckets.get(actorId);
    if (!bucket || now - bucket.start >= 60_000) {
      bucket = { start: now, count: 0 };
      mobileErrorBuckets.set(actorId, bucket);
    }
    bucket.count += 1;
    if (bucket.count > 30) throw new HttpException("Too many diagnostic reports", 429);
    if (mobileErrorBuckets.size > 10_000) {
      for (const [id, value] of mobileErrorBuckets) if (now - value.start >= 60_000) mobileErrorBuckets.delete(id);
    }
    return true;
  }
}
