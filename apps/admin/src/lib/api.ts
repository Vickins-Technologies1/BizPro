const API_BASE = "/api";

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}
