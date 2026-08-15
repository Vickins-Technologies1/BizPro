import { env } from "@/config/env";
import type { AccessPermission } from "@shared";

type RemoteAuthResponse = {
  accessToken: string;
  user: { id: string; businessId: string; role: string; fullName: string; ownerId?: string | null; roleLabel?: string | null; permissions?: AccessPermission[] | null };
  business: { id: string; name: string; slug: string; industryKey: string; businessType: string; currency: string; planTier: string; billingStatus: string };
};

async function requestJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response) {
  const fallback = `Request failed with status ${response.status}`;
  const raw = await response.text();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[]; error?: string };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(", ");
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message;
    }
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error;
    }
  } catch {
    // Fall through to the raw body below.
  }
  return raw;
}

export async function remoteRegister(input: {
  businessId: string;
  branchId: string;
  ownerUserId: string;
  ownerName: string;
  phone: string;
  password: string;
  businessName: string;
  industryKey?: string;
  businessType: string;
  planTier: string;
  currency: string;
  branchName: string;
  cashierPin?: string | null;
}) {
  return requestJson<RemoteAuthResponse>("/auth/register", input);
}

export async function remoteLogin(input: { identifier: string; passwordOrPin: string; businessId?: string }) {
  return requestJson<RemoteAuthResponse>("/auth/login", input);
}
