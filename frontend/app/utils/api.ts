const DEFAULT_BACKEND_URL = "https://netraai07-netra.hf.space/api/v1";

// Request timeout in milliseconds (10 seconds)
const REQUEST_TIMEOUT_MS = 10_000;

export function getBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    let url = process.env.NEXT_PUBLIC_API_URL.trim();
    if (url.endsWith("/")) url = url.slice(0, -1);
    if (!url.endsWith("/api/v1")) url = `${url}/api/v1`;
    return url;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.") ||
      host.endsWith(".local")
    ) {
      return `http://${host}:8000/api/v1`;
    }
  }
  return DEFAULT_BACKEND_URL;
}

/**
 * Wraps fetch with an AbortController timeout.
 * Always sends credentials (cookies) for automatic HttpOnly cookie attachment.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      // SECURITY: Always include credentials so HttpOnly cookies are sent automatically.
      // This is safe because CORS restricts which origins can trigger credentialed requests.
      credentials: "include",
    });
  } finally {
    clearTimeout(timer);
  }
}

// ─── User profile (non-sensitive, stored in localStorage for UI) ──────────────
// Note: TOKENS are now stored in HttpOnly cookies (set by backend, unreadable by JS).
// Only non-secret UI data (name, role, email) is kept in localStorage.

export function setUserProfile(user: any) {
  if (typeof window !== "undefined") {
    localStorage.setItem("user_profile", JSON.stringify(user));
  }
}

export function getUserProfile(): any | null {
  if (typeof window !== "undefined") {
    const data = localStorage.getItem("user_profile");
    try {
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function clearUserProfile() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("user_profile");
  }
}

/**
 * Clear session: removes user profile from localStorage and calls backend to clear cookies.
 * This is the secure logout — cookies cannot be cleared client-side (they're HttpOnly).
 */
export async function clearSession() {
  clearUserProfile();
  try {
    // Ask the backend to delete the HttpOnly cookies
    await fetchWithTimeout(`${getBackendUrl()}/auth/logout`, { method: "POST" });
  } catch {
    // Best-effort — even if this fails, the local profile is cleared
  }
}

// ─── DEPRECATED: localStorage token functions (kept for kiosk backward compat) ─
// Browser sessions now use HttpOnly cookies. These functions are only used
// by kiosk/SSE flows that cannot use cookie-based auth.

export function setTokens(access: string, refresh: string) {
  // No-op for browser sessions — tokens are now stored in HttpOnly cookies by backend.
  // Kiosk clients that need the token can read from the response body directly.
}

export function getAccessToken(): string | null {
  // HttpOnly cookies cannot be read by JS — this is intentional.
  // Return a truthy sentinel if user_profile exists (means user is logged in).
  // Actual token validation happens server-side via the cookie.
  if (typeof window !== "undefined") {
    const profile = localStorage.getItem("user_profile");
    return profile ? "cookie-session" : null;
  }
  return null;
}

export function getRefreshToken(): string | null {
  // Refresh token is in HttpOnly cookie — cannot be read by JS (by design).
  return null;
}

export function clearTokens() {
  // For backward compat — calls clearUserProfile
  clearUserProfile();
}

// ─── Main API fetch ────────────────────────────────────────────────────────────

export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${getBackendUrl()}${endpoint}`;
  const headers = new Headers(options.headers || {});

  // NOTE: We do NOT set Authorization header here for browser sessions.
  // The HttpOnly access_token cookie is sent automatically by the browser.
  // Kiosk clients that need Bearer auth should set Authorization header themselves.
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetchWithTimeout(url, { ...options, headers });

  if (response.status === 401 && endpoint !== "/auth/login") {
    // Attempt silent token refresh via cookie (backend reads refresh_token cookie,
    // sets new access_token cookie — no tokens ever touch JS memory)
    try {
      const refreshResponse = await fetchWithTimeout(
        `${getBackendUrl()}/auth/refresh`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      if (refreshResponse.ok) {
        // New access_token cookie is now set — retry the original request
        const retryResponse = await fetchWithTimeout(url, { ...options, headers });
        if (retryResponse.ok) {
          return await retryResponse.json();
        }
      }
    } catch {
      // Silent — don't log anything sensitive
    }
    // Refresh failed — clear session and redirect to login
    clearUserProfile();
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.href = "/";
    }
    throw new Error("Session expired. Please login again.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Unknown server error" }));
    let errMsg = "Server error occurred";
    if (typeof errorData.detail === "string") {
      errMsg = errorData.detail;
    } else if (Array.isArray(errorData.detail)) {
      errMsg = errorData.detail
        .map((err: any) => `${err.loc?.[err.loc.length - 1] ?? "field"}: ${err.msg}`)
        .join(", ");
    } else if (errorData.detail && typeof errorData.detail === "object") {
      errMsg = JSON.stringify(errorData.detail);
    }
    throw new Error(errMsg);
  }

  // Handle file responses (PDF, Excel, CSV)
  const contentType = response.headers.get("content-type");
  if (
    contentType &&
    (contentType.includes("pdf") ||
      contentType.includes("sheet") ||
      contentType.includes("csv"))
  ) {
    return await response.blob();
  }

  return await response.json();
}

export function parseDateTime(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const hasTimezone =
    dateStr.endsWith("Z") || dateStr.includes("+") || /-\d{2}:\d{2}$/.test(dateStr);
  const formattedStr = hasTimezone ? dateStr : dateStr.replace(" ", "T") + "Z";
  return new Date(formattedStr);
}

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
