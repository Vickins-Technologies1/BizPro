import { headers } from "next/headers";
import { adminAuth } from "./auth";

export async function getPlatformAdminSession() {
  return adminAuth.api.getSession({ headers: headers() });
}
