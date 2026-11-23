import { createHmac } from "node:crypto";
import { getPlatformAdminPermissions, isPlatformAdminRole } from "@vbo/shared";
import { adminAuth } from "./auth";

export async function createPlatformAdminAssertion(headers: Headers) {
  const session = await adminAuth.api.getSession({ headers });
  if (!session || session.user.isActive === false || !isPlatformAdminRole(session.user.role)) return null;

  const secret = process.env.ADMIN_API_SIGNING_SECRET ?? "";
  if (Buffer.byteLength(secret) < 32) throw new Error("ADMIN_API_SIGNING_SECRET must contain at least 32 bytes");
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = encodeBase64Url(JSON.stringify({
    iss: "dira-admin-console",
    aud: "dira-admin-api",
    sub: session.user.id,
    email: session.user.email,
    role: session.user.role,
    permissions: getPlatformAdminPermissions(session.user.role),
    sid: session.session.id,
    iat: now,
    exp: now + 60
  }));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return { token: `${signingInput}.${signature}`, session };
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}
