import { NextRequest } from "next/server";
import { proxyToRender } from "../../../lib/api-proxy";

export const runtime = "nodejs";

export function GET(request: NextRequest, context: { params: { path: string[] } }) {
  return proxyToRender(request, context.params.path);
}

export function POST(request: NextRequest, context: { params: { path: string[] } }) {
  return proxyToRender(request, context.params.path);
}

export function PUT(request: NextRequest, context: { params: { path: string[] } }) {
  return proxyToRender(request, context.params.path);
}

export function PATCH(request: NextRequest, context: { params: { path: string[] } }) {
  return proxyToRender(request, context.params.path);
}

export function DELETE(request: NextRequest, context: { params: { path: string[] } }) {
  return proxyToRender(request, context.params.path);
}

export function OPTIONS(request: NextRequest, context: { params: { path: string[] } }) {
  return proxyToRender(request, context.params.path);
}

export function HEAD(request: NextRequest, context: { params: { path: string[] } }) {
  return proxyToRender(request, context.params.path);
}
