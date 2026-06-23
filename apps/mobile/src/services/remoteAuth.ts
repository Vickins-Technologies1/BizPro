import { env } from "@/config/env";

type RemoteAuthResponse = {
  accessToken: string;
  user: { id: string; businessId: string; role: string; fullName: string };
  business: { id: string; name: string; slug: string; businessType: string; currency: string; planTier: string; billingStatus: string };
};

async function requestJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export async function remoteRegister(input: {
  businessId: string;
  branchId: string;
  ownerUserId: string;
  ownerName: string;
  phone: string;
  password: string;
  businessName: string;
  businessType: string;
  planTier: string;
  currency: string;
  branchName: string;
  cashierPin?: string | null;
}) {
  return requestJson<RemoteAuthResponse>("/auth/register", input);
}

export async function remoteLogin(input: { identifier: string; passwordOrPin: string }) {
  return requestJson<RemoteAuthResponse>("/auth/login", input);
}
