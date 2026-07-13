/**
 * Auth for the staff dashboard (RO/District/State users) -- separate from
 * the customer feedback session token used in src/app/feedback/[code].
 * JWT is decoded client-side purely to choose which dashboard view to
 * render; actual authorization is always re-checked server-side on every
 * API call (see backend RBAC enforcement) -- this decode is never trusted
 * as a security boundary, only a UI convenience.
 */
const TOKEN_KEY = "aircare_staff_access_token";
const REFRESH_KEY = "aircare_staff_refresh_token";

export interface JwtClaims {
  user_id: number;
  role: "SUPER_ADMIN" | "STATE_ADMIN" | "DO_ADMIN" | "DISTRICT_ADMIN" | "RO_USER";
  scope_type: "STATE" | "DO" | "DISTRICT" | "RO";
  scope_id: number | null;
  exp: number;
}

export function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getCurrentClaims(): JwtClaims | null {
  const token = getStoredToken();
  if (!token) return null;
  const claims = decodeJwt(token);
  if (!claims) return null;
  if (claims.exp * 1000 < Date.now()) return null; // expired
  return claims;
}

export function storeTokens(accessToken: string, refreshToken: string) {
  window.localStorage.setItem(TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function login(phone: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.detail?.error || body?.error;
    throw new ApiError(res.status, err?.code || "LOGIN_FAILED", err?.message || "Login failed.");
  }
  storeTokens(body.data.access_token, body.data.refresh_token);
}

export async function authFetch<T>(path: string): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.detail?.error || body?.error;
    throw new ApiError(res.status, err?.code || "REQUEST_FAILED", err?.message || "Request failed.");
  }
  return body as T;
}

export async function authPatch<T>(path: string, payload: object): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.detail?.error || body?.error;
    throw new ApiError(res.status, err?.code || "REQUEST_FAILED", err?.message || "Request failed.");
  }
  return body as T;
}
