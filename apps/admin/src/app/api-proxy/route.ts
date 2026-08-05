import { NextRequest } from "next/server";
import { proxyToRender } from "../../lib/api-proxy";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return proxyToRender(request, []);
}

export function POST(request: NextRequest) {
  return proxyToRender(request, []);
}

export function PUT(request: NextRequest) {
  return proxyToRender(request, []);
}

export function PATCH(request: NextRequest) {
  return proxyToRender(request, []);
}

export function DELETE(request: NextRequest) {
  return proxyToRender(request, []);
}

export function OPTIONS(request: NextRequest) {
  return proxyToRender(request, []);
}

export function HEAD(request: NextRequest) {
  return proxyToRender(request, []);
}
