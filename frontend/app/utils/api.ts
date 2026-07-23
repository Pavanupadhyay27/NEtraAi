const DEFAULT_BACKEND_URL = "https://netraai07-netra.hf.space/api/v1";

// Request timeout in milliseconds (45 seconds default, 90 seconds for AI heavy endpoints)
const DEFAULT_REQUEST_TIMEOUT_MS = 45_000;
const HEAVY_REQUEST_TIMEOUT_MS = 90_000;

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
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError" || String(err).includes("aborted")) {
      throw new Error("Request timed out while processing AI facial models. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Token storage ────────────────────────────────────────────────────────────
// Tokens are stored in localStorage because frontend (Vercel) and backend
// (HuggingFace) are on different domains — cross-origin HttpOnly cookies
// are treated as third-party cookies and blocked by modern browsers.

export function setTokens(access: string, refresh: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  }
}

export function getAccessToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("access_token");
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("refresh_token");
  }
  return null;
}

export function clearTokens() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_profile");
  }
}

if (typeof window !== "undefined") {
  (window as any).clearTokens = clearTokens;
}


// ─── User profile (non-sensitive, for UI rendering) ───────────────────────────

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
 * Clear session: removes tokens + profile from localStorage.
 */
export async function clearSession() {
  clearTokens();
  clearUserProfile();
}

// ─── Main API fetch ────────────────────────────────────────────────────────────

export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${getBackendUrl()}${endpoint}`;
  const headers = new Headers(options.headers || {});

  // Attach Bearer token for authentication
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const isHeavy = endpoint.includes("/enrollment/") || endpoint.includes("/kiosk/") || endpoint.includes("/analytics/") || options.body instanceof FormData;
  const timeoutMs = isHeavy ? HEAVY_REQUEST_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS;

  const response = await fetchWithTimeout(url, { ...options, headers }, timeoutMs);

  if (response.status === 401 && endpoint !== "/auth/login") {
    // Attempt silent token refresh
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshResponse = await fetchWithTimeout(
          `${getBackendUrl()}/auth/refresh`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${refreshToken}`,
            },
          }
        );
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.access_token) {
            setTokens(refreshData.access_token, refreshData.refresh_token || refreshToken);
            // Retry the original request with the new token
            headers.set("Authorization", `Bearer ${refreshData.access_token}`);
            const retryResponse = await fetchWithTimeout(url, { ...options, headers });
            if (retryResponse.ok) {
              return await retryResponse.json();
            }
          }
        }
      } catch {
        // Silent — refresh failed
      }
    }
    // Refresh failed — clear session and redirect to login
    clearTokens();
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
  const formattedStr = dateStr.replace(" ", "T");
  return new Date(formattedStr);
}

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
