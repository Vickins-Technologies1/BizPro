import { NextRequest } from "next/server";
import { proxyToCloudRun } from "../../lib/api-proxy";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return proxyToCloudRun(request, []);
}

export function POST(request: NextRequest) {
  return proxyToCloudRun(request, []);
}

export function PUT(request: NextRequest) {
  return proxyToCloudRun(request, []);
}

export function PATCH(request: NextRequest) {
  return proxyToCloudRun(request, []);
}

export function DELETE(request: NextRequest) {
  return proxyToCloudRun(request, []);
}

export function OPTIONS(request: NextRequest) {
  return proxyToCloudRun(request, []);
}

export function HEAD(request: NextRequest) {
  return proxyToCloudRun(request, []);
}
