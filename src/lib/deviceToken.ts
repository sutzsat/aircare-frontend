/**
 * Persistent per-browser device token (SECURITY.md Addendum 5 on the
 * backend). Generated once, stored in localStorage, reused on every visit
 * from this browser -- lets the backend catch the same phone submitting
 * under different typed-in mobile numbers, without any hardware access
 * (which browsers never expose -- there is no IMEI equivalent on the web).
 *
 * Resets if the customer clears browser data or uses a private/incognito
 * window -- a deterrent against casual misuse, not a hard guarantee.
 */
const STORAGE_KEY = "aircare_device_token";

export function getOrCreateDeviceToken(): string | null {
  if (typeof window === "undefined") return null; // SSR/build time -- no browser storage

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const token = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, token);
    return token;
  } catch {
    // localStorage blocked (private browsing in some browsers, or
    // disabled by the user) -- fail open, never block the customer over
    // this. The backend treats a missing token as "skip this check."
    return null;
  }
}
