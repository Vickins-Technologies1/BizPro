import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";

type RateBucket = {
  attempts: number;
  resetAt: number;
};

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateBucket>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const handlerName = context.getHandler().name as string;
    const now = Date.now();
    const rule = this.resolveRule(handlerName);
    if (!rule) {
      return true;
    }

    const key = `${handlerName}:${rule.key(request)}`;
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { attempts: 1, resetAt: now + rule.windowMs });
      this.cleanup(now);
      return true;
    }

    if (bucket.attempts >= rule.limit) {
      throw new HttpException("Too many authentication attempts. Please wait and try again.", HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.attempts += 1;
    this.cleanup(now);
    return true;
  }

  private resolveRule(handlerName: string) {
    switch (handlerName) {
      case "login":
        return {
          limit: 10,
          windowMs: 5 * 60 * 1000,
          key: (request: { ip?: string; body?: { identifier?: string; businessId?: string } }) =>
            [this.normalize(request.ip), this.normalize(request.body?.identifier), this.normalize(request.body?.businessId)].filter(Boolean).join(":") || "global"
        };
      case "register":
        return {
          limit: 3,
          windowMs: 15 * 60 * 1000,
          key: (request: { ip?: string; body?: { phone?: string; businessId?: string } }) =>
            [this.normalize(request.ip), this.normalize(request.body?.phone), this.normalize(request.body?.businessId)].filter(Boolean).join(":") || "global"
        };
      default:
        return null;
    }
  }

  private normalize(value?: string | null) {
    return value?.trim().toLowerCase() ?? "";
  }

  private cleanup(now: number) {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
