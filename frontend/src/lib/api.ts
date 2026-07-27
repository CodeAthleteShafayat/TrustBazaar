const API_URL = (import.meta.env.VITE_API_URL as string) || "/api";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  if (!res.ok) {
    const err = body?.error || { code: "internal", message: "Request failed" };
    throw new ApiError(err.message, res.status, err.code);
  }
  return body as T;
}

export function setAuthToken(getter: () => string | null) {
  let cached: string | null = null;
  return (path: string, init: RequestInit = {}) => api(path, { ...init, token: cached ?? getter() });
}