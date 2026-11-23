import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { createHmac, timingSafeEqual } from "node:crypto";
import { hasPlatformAdminPermission, isPlatformAdminRole, type PlatformAdminPermission, type PlatformAdminRole } from "@vbo/shared";

export const PLATFORM_ADMIN_PERMISSIONS_KEY = "platform-admin-permissions";
export const PlatformAdminPermissions = (...permissions: PlatformAdminPermission[]) => SetMetadata(PLATFORM_ADMIN_PERMISSIONS_KEY, permissions);

export type PlatformAdminIdentity = {
  id: string;
  email: string;
  role: PlatformAdminRole;
  sessionId: string;
};

type AssertionClaims = {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  role: string;
  sid: string;
  iat: number;
  exp: number;
};

export function verifyPlatformAdminAssertion(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret || Buffer.byteLength(secret) < 32 || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
  const expectedSignature = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest();
  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }
  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature)) return null;

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as { alg?: string; typ?: string };
    const claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AssertionClaims;
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;
    if (claims.iss !== "dira-admin-console" || claims.aud !== "dira-admin-api") return null;
    if (!claims.sub || !claims.sid || !claims.email || !isPlatformAdminRole(claims.role)) return null;
    if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.iat > nowSeconds + 30 || claims.exp <= nowSeconds) return null;
    if (claims.exp - claims.iat > 90) return null;
    return { id: claims.sub, email: claims.email, role: claims.role, sessionId: claims.sid } satisfies PlatformAdminIdentity;
  } catch {
    return null;
  }
}

@Injectable()
export class PlatformAdminAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; platformAdmin?: PlatformAdminIdentity }>();
    const assertion = String(request.headers["x-admin-assertion"] ?? "");
    const secret = this.config.get<string>("ADMIN_API_SIGNING_SECRET") ?? "";
    const identity = verifyPlatformAdminAssertion(assertion, secret);
    if (!identity) throw new UnauthorizedException("A valid platform administrator session is required");
    request.platformAdmin = identity;
    return true;
  }
}

@Injectable()
export class PlatformAdminPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<PlatformAdminPermission[]>(PLATFORM_ADMIN_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (!required.length) return true;
    const request = context.switchToHttp().getRequest<{ platformAdmin?: PlatformAdminIdentity }>();
    return required.every((permission) => hasPlatformAdminPermission(request.platformAdmin?.role, permission));
  }
}

export const CurrentPlatformAdmin = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<{ platformAdmin?: PlatformAdminIdentity }>().platformAdmin ?? null;
});
