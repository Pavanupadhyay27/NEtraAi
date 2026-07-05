const DEFAULT_BACKEND_URL = "https://pawankr007-netra.hf.space/api/v1";

export function getBackendUrl(): string {
  // Check for environment variable configuration (e.g. on Vercel)
  if (process.env.NEXT_PUBLIC_API_URL) {
    let url = process.env.NEXT_PUBLIC_API_URL.trim();
    // Dynamically auto-correct the Vercel environment variable typo
    if (url.includes("pawankr007-netraai.hf.space")) {
      url = url.replace("pawankr007-netraai.hf.space", "pawankr007-netra.hf.space");
    }
    if (url.endsWith("/")) {
      url = url.slice(0, -1);
    }
    if (!url.endsWith("/api/v1")) {
      url = `${url}/api/v1`;
    }
    return url;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // If running on localhost or a local private IP network, connect to local port 8000
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

export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${getBackendUrl()}${endpoint}`;
  const headers = new Headers(options.headers || {});
  
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  if (response.status === 401 && endpoint !== "/auth/login") {
    // Attempt token refresh
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        const refreshResponse = await fetch(`${getBackendUrl()}/auth/refresh?refresh_token=${refresh}`, {
          method: "POST"
        });
        if (refreshResponse.ok) {
          const tokens = await refreshResponse.json();
          setTokens(tokens.access_token, tokens.refresh_token);
          // Retry the original request
          headers.set("Authorization", `Bearer ${tokens.access_token}`);
          const retryResponse = await fetch(url, { ...options, headers });
          if (retryResponse.ok) {
            return await retryResponse.json();
          }
        }
      } catch (err) {
        console.error("Token refresh failed", err);
      }
    }
    // Clear tokens and redirect to login if refresh fails
    clearTokens();
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.href = "/";
    }
    throw new Error("Session expired. Please login again.");
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Unknown server error" }));
    throw new Error(errorData.detail || "Server error occurred");
  }
  
  // Handle file responses (PDF, Excel, CSV)
  const contentType = response.headers.get("content-type");
  if (contentType && (contentType.includes("pdf") || contentType.includes("sheet") || contentType.includes("csv"))) {
    return await response.blob();
  }
  
  return await response.json();
}

export function parseDateTime(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // If the date string has a timezone, parse it as-is.
  // Otherwise, treat it as a local ISO string (do NOT append 'Z', as backend stores local time).
  const hasTimezone = dateStr.endsWith("Z") || dateStr.includes("+") || /-\d{2}:\d{2}$/.test(dateStr);
  const formattedStr = hasTimezone ? dateStr : dateStr.replace(" ", "T");
  return new Date(formattedStr);
}

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

