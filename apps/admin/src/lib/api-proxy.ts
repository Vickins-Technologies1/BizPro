import type { NextRequest } from "next/server";
import { hasPlatformAdminPermission, isPlatformAdminRole } from "@vbo/shared";
import { createPlatformAdminAssertion } from "./admin-assertion";
import { hashAdminPassword } from "./auth";
import { getProxyRoutePermission, isAllowedProxyPathParts } from "./proxy-policy";

const MAX_BODY_BYTES = 1_000_000;

export async function proxyToCloudRun(request: NextRequest, pathParts: string[]) {
  const method = request.method.toUpperCase();
  if (!isAllowedProxyPathParts(pathParts)) {
    return jsonError(404, "Admin API route not found");
  }

  const path = pathParts.join("/");
  const requiredPermission = getProxyRoutePermission(method, path);
  if (!requiredPermission) return jsonError(404, "Admin API route not found");

  if (!isReadOnlyMethod(method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return jsonError(403, "Cross-origin administrative requests are not allowed");
  }

  let authenticated: Awaited<ReturnType<typeof createPlatformAdminAssertion>>;
  try {
    authenticated = await createPlatformAdminAssertion(request.headers);
  } catch {
    return jsonError(503, "Admin authentication is not configured");
  }
  if (!authenticated) return jsonError(401, "Sign in with an authorized administrator account");
  if (!hasPlatformAdminPermission(authenticated.session.user.role, requiredPermission)) return jsonError(403, "Your platform administrator role cannot perform this action");

  let body: string | undefined;
  if (!isReadOnlyMethod(method)) {
    const contentType = request.headers.get("content-type") ?? "";
    if (method !== "DELETE" && !contentType.toLowerCase().includes("application/json")) return jsonError(415, "Administrative requests must use JSON");
    if (contentType && !contentType.toLowerCase().includes("application/json")) return jsonError(415, "Administrative requests must use JSON");
    body = contentType ? await request.text() : undefined;
    if (new TextEncoder().encode(body ?? "").byteLength > MAX_BODY_BYTES) return jsonError(413, "Administrative request is too large");
  }

  if (path === "platform-admin/errors/ingest" && (!process.env.PLATFORM_ERROR_INGEST_KEY || Buffer.byteLength(process.env.PLATFORM_ERROR_INGEST_KEY) < 32)) {
    return jsonError(503, "System error intake is not configured");
  }

  if (path === "platform-admin/admin-users" && method === "POST") {
    try {
      const input = JSON.parse(body ?? "") as { name?: unknown; email?: unknown; role?: unknown; password?: unknown };
      if (typeof input.password !== "string" || input.password.length < 12 || input.password.length > 128) return jsonError(400, "Temporary administrator passwords must be 12 to 128 characters");
      body = JSON.stringify({ name: input.name, email: input.email, role: input.role, passwordHash: await hashAdminPassword(input.password) });
    } catch {
      return jsonError(400, "Administrator request is invalid");
    }
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = buildUpstreamUrl(pathParts, request.url);
  } catch {
    return jsonError(503, "Admin API upstream is not configured");
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers: buildProxyHeaders(request, authenticated.token, path),
      ...(body === undefined ? {} : { body }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store"
    });
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    responseHeaders.set("cache-control", "no-store");
    const requestId = upstream.headers.get("x-request-id");
    if (requestId) responseHeaders.set("x-request-id", requestId);
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch {
    return jsonError(502, "Admin API is temporarily unavailable");
  }
}

export function buildUpstreamUrl(pathParts: string[], requestUrl: string) {
  const configured = process.env.ADMIN_API_BASE_URL;
  if (!configured) throw new Error("ADMIN_API_BASE_URL is required");
  const base = new URL(configured);
  if (base.username || base.password || base.search || base.hash || !["https:", "http:"].includes(base.protocol)) {
    throw new Error("ADMIN_API_BASE_URL is invalid");
  }
  if (process.env.NODE_ENV === "production" && base.protocol !== "https:") throw new Error("Admin API upstream must use HTTPS in production");
  const incoming = new URL(requestUrl);
  const path = pathParts.map((part) => encodeURIComponent(part)).join("/");
  const upstream = new URL(`${base.toString().replace(/\/+$/, "")}/${path}`);
  upstream.search = incoming.search;
  if (upstream.origin !== base.origin || !upstream.pathname.startsWith(`${base.pathname.replace(/\/+$/, "")}/`)) {
    throw new Error("Admin API path escaped its configured upstream");
  }
  return upstream;
}

function buildProxyHeaders(request: NextRequest, assertion: string, path: string) {
  const headers = new Headers({
    accept: request.headers.get("accept") ?? "application/json",
    "x-admin-assertion": assertion
  });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const requestId = request.headers.get("x-request-id");
  if (requestId && /^[A-Za-z0-9._:-]{1,128}$/.test(requestId)) headers.set("x-request-id", requestId);
  if (path === "platform-admin/errors/ingest") headers.set("x-error-ingest-key", process.env.PLATFORM_ERROR_INGEST_KEY ?? "");
  return headers;
}

function isReadOnlyMethod(method: string) {
  return method === "GET" || method === "HEAD";
}

function jsonError(status: number, message: string) {
  return Response.json({ statusCode: status, message }, { status, headers: { "cache-control": "no-store" } });
}
