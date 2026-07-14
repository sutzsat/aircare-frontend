/**
 * API client for the AirCare Challenge backend (Phase 5 contract).
 * Base URL is injected at build/runtime via NEXT_PUBLIC_API_URL so the same
 * static build can point at staging or production without a rebuild if
 * served through an environment that supports runtime env substitution —
 * otherwise, rebuild with the right value baked in for a pure static export.
 */

import { getOrCreateDeviceToken } from "@/lib/deviceToken";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = body?.error || body?.detail?.error;
    throw new ApiError(
      res.status,
      err?.code || "UNKNOWN_ERROR",
      err?.message || "Something went wrong. Please try again."
    );
  }

  return body as T;
}

export interface RoValidateResponse {
  data: { ro_code: string; ro_name: string; is_active: boolean };
}

export function validateRo(roCode: string) {
  return request<RoValidateResponse>(`/api/v1/ro/${encodeURIComponent(roCode)}/validate`);
}

export interface PublicConfigResponse {
  data: { self_check_enabled: boolean };
}

export function getPublicConfig() {
  return request<PublicConfigResponse>(`/api/v1/config/public`);
}

export interface MobileRegisterResponse {
  data: { feedback_session_token: string };
}

export function registerMobile(mobileNumber: string, roCode: string) {
  return request<MobileRegisterResponse>(`/api/v1/mobile/register`, {
    method: "POST",
    body: JSON.stringify({ mobile_number: mobileNumber, ro_code: roCode }),
  });
}

export interface SelfCheckRequestResponse {
  data: { challenge_id: string };
}

export function requestSelfCheck() {
  return request<SelfCheckRequestResponse>(`/api/v1/self-check/request`);
}

export interface SelfCheckVerifyResponse {
  data: {
    requires_escalation: boolean;
    feedback_session_token?: string;
  };
}

export function verifySelfCheck(
  challengeId: string,
  confirmed: boolean,
  honeypot: string,
  mobileNumber: string,
  roCode: string
) {
  return request<SelfCheckVerifyResponse>(`/api/v1/self-check/verify`, {
    method: "POST",
    body: JSON.stringify({
      challenge_id: challengeId,
      confirmed,
      honeypot,
      mobile_number: mobileNumber,
      ro_code: roCode,
    }),
  });
}

export function requestEscalationOtp(mobileNumber: string) {
  return request<{ message: string }>(`/api/v1/escalation/otp/request`, {
    method: "POST",
    body: JSON.stringify({ mobile_number: mobileNumber }),
  });
}

export interface EscalationOtpVerifyResponse {
  data: { feedback_session_token: string };
}

export function verifyEscalationOtp(mobileNumber: string, otpCode: string, roCode: string) {
  return request<EscalationOtpVerifyResponse>(`/api/v1/escalation/otp/verify`, {
    method: "POST",
    body: JSON.stringify({ mobile_number: mobileNumber, otp_code: otpCode, ro_code: roCode }),
  });
}

export type Rating = "SATISFIED" | "NEUTRAL" | "NOT_SATISFIED";

export interface PhotoUploadUrlResponse {
  data: {
    upload_url: string;
    upload_fields: Record<string, string>;
    photo_url: string;
    expires_in_seconds: number;
  };
}

export function requestPhotoUploadUrl(contentType: string, sessionToken: string) {
  return request<PhotoUploadUrlResponse>(`/api/v1/feedback/photo-upload-url`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ content_type: contentType }),
  });
}

/**
 * Uploads a file directly to S3 using a presigned POST (fields + url from
 * requestPhotoUploadUrl) -- the file's bytes never pass through our API
 * servers, matching the backend's storage_service design.
 */
export async function uploadPhotoToS3(
  file: File,
  uploadUrl: string,
  uploadFields: Record<string, string>
): Promise<void> {
  const formData = new FormData();
  Object.entries(uploadFields).forEach(([key, value]) => formData.append(key, value));
  formData.append("file", file); // must be appended last -- S3 POST policy requires it after the fields

  const res = await fetch(uploadUrl, { method: "POST", body: formData });
  if (!res.ok) {
    throw new ApiError(res.status, "PHOTO_UPLOAD_FAILED", "Photo upload failed. You can still submit without it.");
  }
}

export interface FeedbackSubmitPayload {
  ro_code: string;
  availability_rating: Rating;
  functionality_rating: Rating;
  promptness_rating: Rating;
  attendant_behaviour_rating: Rating;
  overall_experience_rating: Rating;
  nps_response?: "YES" | "MAYBE" | "NO";
  comment?: string;
  photo_url?: string;
  gps_lat?: number;
  gps_lng?: number;
}

export interface FeedbackResponse {
  data: { feedback_id: string; ro_code: string; status: string; submitted_at: string };
  message: string;
}

export function submitFeedback(payload: FeedbackSubmitPayload, sessionToken: string) {
  const deviceToken = getOrCreateDeviceToken();
  return request<FeedbackResponse>(`/api/v1/feedback`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(deviceToken ? { "X-Device-Token": deviceToken } : {}),
    },
    body: JSON.stringify(payload),
  });
}

/** Best-effort browser geolocation — never blocks submission if denied
 * (Phase 3 fraud-check design treats absent GPS as a soft signal only). */
export function getBrowserLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 4000 }
    );
  });
}
