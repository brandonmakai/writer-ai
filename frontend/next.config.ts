import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /**
   * Proxy all /api/v1/* requests to the backend.
   * BACKEND_URL is a server-side env var (no NEXT_PUBLIC_ prefix) — never
   * exposed to the browser. The browser only sees same-origin /api/v1/ paths.
   * Vercel resolves this rewrite server-side before the response is returned.
   */
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL
    if (!backendUrl) {
      // In local dev without BACKEND_URL set, rewrites are no-ops.
      // Set NEXT_PUBLIC_API_URL in .env.local instead for local dev.
      return []
    }
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ]
  },

  async headers() {
    // posthog-js is installed via npm and bundled — no external script CDN needed.
    // Per PostHog CSP docs, npm installs only require connect-src for ingestion.
    // unsafe-eval is only needed by Next.js HMR in dev; production builds are safe.
    const isDev = process.env.NODE_ENV === "development"
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'"

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Tells browsers to cache the HTTPS-only policy for 2 years and never
          // attempt a plain-HTTP connection, even before a redirect fires.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // unsafe-inline required for Tailwind v4 runtime styles and framer-motion
              "style-src 'self' 'unsafe-inline'",
              scriptSrc,
              // posthog-js bundled via npm: only the ingestion endpoint is needed
              "connect-src 'self' https://us.i.posthog.com",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "frame-ancestors 'none'",
              // Instructs browsers to upgrade any remaining plain-HTTP sub-resource
              // requests (images, scripts, etc.) to HTTPS automatically
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
