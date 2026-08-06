import type { NextRequest } from "next/server";

const UPSTREAM_API_BASE = "https://bizpro-k625.onrender.com/api";

export function buildUpstreamUrl(pathParts: string[], requestUrl: string) {
  const path = pathParts.length ? pathParts.join("/") : "";
  const upstream = new URL(path ? `${UPSTREAM_API_BASE}/${path}` : UPSTREAM_API_BASE);
  const incoming = new URL(requestUrl);
  upstream.search = incoming.search;
  return upstream;
}

export function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers();

  request.headers.forEach((value: string, key: string) => {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "content-length" || lower === "connection") {
      return;
    }
    if (lower.startsWith("x-forwarded-") || lower.startsWith("x-vercel-")) {
      return;
    }
    headers.set(key, value);
  });

  headers.set("x-support-key", process.env.SUPPORT_API_KEY ?? "");
  return headers;
}

export async function proxyToRender(request: NextRequest, pathParts: string[]) {
  const upstreamUrl = buildUpstreamUrl(pathParts, request.url);
  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers: buildProxyHeaders(request)
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.text();
  }

  const upstream = await fetch(upstreamUrl, init);
  const body = method === "HEAD" ? null : await upstream.arrayBuffer();
  const headers = new Headers(upstream.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("transfer-encoding");
  headers.delete("connection");

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}
