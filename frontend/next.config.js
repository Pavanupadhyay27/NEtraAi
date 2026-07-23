const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: __dirname,

  // ─── Security Headers ──────────────────────────────────────────────────────
  // Applied to every page & API route served by Next.js
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    const connectSrc = [
      "'self'",
      "https://netraai07-netra.hf.space",
      "https://pawankr007-netra.hf.space",
      process.env.NEXT_PUBLIC_API_URL || "",
      "ws:",
      "wss:",
      isDev ? "http://localhost:8000 http://127.0.0.1:8000 ws://localhost:8000 ws://127.0.0.1:8000" : "",
    ].filter(Boolean).join(" ");

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `connect-src ${connectSrc}`,
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ];

    if (!isDev) {
      cspDirectives.push("upgrade-insecure-requests");
    }

    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking — page cannot be framed
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Legacy XSS filter for older browsers
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Limit referrer leakage
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Force HTTPS for 2 years
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Restrict browser feature APIs — allow camera/mic/geo for kiosk face recognition
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=()" },
          // Content Security Policy for the Next.js frontend
          {
            key: "Content-Security-Policy",
            value: cspDirectives.join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

