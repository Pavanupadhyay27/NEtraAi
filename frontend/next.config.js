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
          // Restrict browser feature APIs
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // Content Security Policy for the Next.js frontend
          // Allows inline scripts (needed by Next.js hydration) but blocks external untrusted origins
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js needs 'unsafe-inline' and 'unsafe-eval' for hydration — locked to self only
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              // Allow API calls to the backend and WebSocket connections
              `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || "https://netraai07-netra.hf.space"} ws: wss:`,
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
