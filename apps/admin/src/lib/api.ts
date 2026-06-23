const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const SUPPORT_KEY = process.env.NEXT_PUBLIC_SUPPORT_API_KEY ?? "";

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(SUPPORT_KEY ? { "x-support-key": SUPPORT_KEY } : {}),
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}
