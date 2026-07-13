import { authFetch, authPatch } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function authPost<T>(path: string, payload: object): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("aircare_staff_access_token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.detail?.error || body?.error;
    const { ApiError } = await import("@/lib/auth");
    throw new ApiError(res.status, err?.code || "REQUEST_FAILED", err?.message || "Request failed.");
  }
  return body as T;
}

export interface UserRecord {
  user_id: number;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  scope_type: string;
  scope_id: number | null;
  is_active: boolean;
  receives_daily_digest: boolean;
}

export function listUsers() {
  return authFetch<{ data: { users: UserRecord[] } }>(`/api/v1/admin/users`);
}

export interface CreateUserPayload {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: string;
  scope_type: string;
  scope_id?: number;
}

export function createUser(payload: CreateUserPayload) {
  return authPost<{ data: UserRecord }>(`/api/v1/admin/users`, payload);
}

export interface BulkRoRow {
  erp_code: string;
  name: string;
  phone: string;
}

export interface BulkImportResult {
  erp_code: string;
  success: boolean;
  user_id?: number;
  phone?: string;
  generated_password?: string;
  error?: string;
}

export function bulkImportRoUsers(rows: BulkRoRow[]) {
  return authPost<{ data: { results: BulkImportResult[]; succeeded: number; failed: number } }>(
    `/api/v1/admin/users/bulk-ro-import`,
    { rows }
  );
}

export function updateDigestSubscription(userId: number, receivesDailyDigest: boolean) {
  return authPatch(`/api/v1/admin/users/${userId}/digest-subscription`, { receives_daily_digest: receivesDailyDigest });
}

export interface OutletDashboardData {
  data: {
    ro_id: number;
    ro_name: string;
    score_date: string;
    today: {
      total_feedback: number;
      positive_count: number;
      neutral_count: number;
      negative_count: number;
      weightage: number;
      is_qualified: boolean;
    };
    open_tickets_count: number;
    recent_feedback: {
      feedback_id: string;
      rating: string;
      comment: string | null;
      photo_url: string | null;
      status: string;
      submitted_at: string;
    }[];
  };
}

export function getOutletDashboard(roId: number) {
  return authFetch<OutletDashboardData>(`/api/v1/dashboard/outlet/${roId}`);
}

export interface DistrictDashboardData {
  data: {
    district_id: number;
    score_date: string;
    rankings: { rank: number | null; ro_id: number; ro_name: string; weightage: number }[];
  };
}

export function getDistrictDashboard(districtId: number) {
  return authFetch<DistrictDashboardData>(`/api/v1/dashboard/district/${districtId}`);
}

export interface AdminOverviewData {
  data: {
    score_date: string;
    total_feedback: number;
    ro_reporting_count: number;
    ro_total_count: number;
    open_tickets_count: number;
    by_district: { district_id: number; district_name: string; avg_weightage: number; ro_count: number }[];
  };
}

export function getAdminOverview() {
  return authFetch<AdminOverviewData>(`/api/v1/dashboard/admin/overview`);
}

export interface TicketsData {
  data: {
    tickets: {
      ticket_id: number;
      ro_id: number;
      ro_name: string;
      category: string;
      status: string;
      photo_url: string | null;
      opened_at: string;
      resolution_note: string | null;
    }[];
  };
}

export function getTickets(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return authFetch<TicketsData>(`/api/v1/tickets${qs}`);
}

export function updateTicket(ticketId: number, status: string, resolutionNote?: string) {
  return authPatch(`/api/v1/tickets/${ticketId}`, { status, resolution_note: resolutionNote });
}

export function exportReport(period: "daily" | "weekly" | "monthly", format: "csv" | "excel" | "pdf") {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("aircare_staff_access_token") : null;
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return fetch(`${API_BASE}/api/v1/reports/export?period=${period}&format=${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
