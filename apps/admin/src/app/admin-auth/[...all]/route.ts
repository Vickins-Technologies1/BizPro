import { toNextJsHandler } from "better-auth/next-js";
import { adminAuth } from "../../../lib/auth";

export const runtime = "nodejs";

const handlers = toNextJsHandler(adminAuth);

export const GET = handlers.GET;
export const POST = handlers.POST;
