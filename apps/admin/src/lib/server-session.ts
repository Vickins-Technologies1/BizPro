import { headers } from "next/headers";
import { adminAuth, connectAdminMongo } from "./auth";

export async function getPlatformAdminSession() {
  await connectAdminMongo();
  return adminAuth.api.getSession({ headers: headers() });
}
