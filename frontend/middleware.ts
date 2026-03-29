import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Vercel Edge middleware — blocks known bad bots on API proxy routes.
 * Runs before the /api/v1/* → Railway rewrite, so blocked requests never
 * reach the backend or consume Gemini quota.
 *
 * Scope: /api/v1/* only. Page routes are excluded so search engine crawlers
 * (Googlebot, Bingbot) can index the landing page normally.
 */

const BLOCKED_USER_AGENTS = [
  "facebookexternalhit",
  "Facebot",
  "facebookcatalog",
  "python-requests",
  "curl/",
  "Go-http-client",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
]

export function middleware(request: NextRequest): NextResponse {
  const userAgent = request.headers.get("user-agent") ?? ""

  // Block empty user agents (bots without UA strings)
  if (!userAgent.trim()) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  // Block known bad bots
  const uaLower = userAgent.toLowerCase()
  const isBlocked = BLOCKED_USER_AGENTS.some((pattern) =>
    uaLower.includes(pattern.toLowerCase())
  )

  if (isBlocked) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  // Apply only to the API proxy routes — not to pages, static files, or _next
  matcher: "/api/v1/:path*",
}
