import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";
import { adminAuth, connectAdminMongo } from "../../../lib/auth";

export const runtime = "nodejs";

const handlers = toNextJsHandler(adminAuth);

export async function GET(request: NextRequest) {
  await connectAdminMongo();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  await connectAdminMongo();
  return handlers.POST(request);
}
