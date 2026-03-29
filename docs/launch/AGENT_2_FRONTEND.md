# Agent 2 — Frontend Launch Hardening

**You are**: an autonomous coding agent (Cursor). Your task is to implement all frontend code changes required for production launch.

**Your worktree**: You are working in a git worktree on branch `feature/frontend-launch-hardening`. Your working directory contains the full monorepo. All your changes must be within the `frontend/` directory.

**Do not touch**: Anything in `backend/`, `docs/`, or repo root. The backend agent (Agent 1) owns those files and is working in a separate worktree simultaneously.

**Coordinate via interface contract**: Agent 1 (backend) is NOT changing any API routes or response schemas. The API paths remain exactly:
- `POST /api/v1/chapter/outline`
- `POST /api/v1/chapter/rewrite`
- `POST /api/v1/chapter/edit`
- `GET /health`

---

## Worktree Setup (run before starting)

```bash
# From the repo root, in your terminal:
git worktree add -b feature/frontend-launch-hardening ../writer-ai-frontend main
cd ../writer-ai-frontend/frontend
```

All commands below assume you are in `../writer-ai-frontend/frontend/`.

---

## Overview of Changes

| File | Change |
|---|---|
| `next.config.ts` | Add Vercel rewrites (proxy to backend) + security headers |
| `lib/api.ts` | Change `API_BASE` fallback to `""` so same-origin rewrites work |
| `middleware.ts` | New file — Vercel Edge middleware to block bad bots on API routes |
| `public/robots.txt` | New file — disallow bots, allow search engines |
| `app/layout.tsx` | Wrap with PostHog provider |
| `app/posthog.tsx` | New file — PostHog client-side provider |
| `app/sitemap.ts` | New file — Next.js App Router sitemap |
| `features/writing/hooks/use-warp-state.ts` | Add `chapter_analyzed` and `example_used` events |
| `features/writing/hooks/use-refactor.ts` | Add `rewrite_completed` and `edit_completed` events |
| `features/writing/components/chapter-editor.tsx` | Add `content_copied` and `content_downloaded` events |

---

## Task 1 — Install PostHog

From the `frontend/` directory:

```bash
npm install posthog-js
```

---

## Task 2 — Configure Vercel Rewrites and Security Headers

**File**: `frontend/next.config.ts`

Current state (empty config):
```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = { /* config options here */ };
export default nextConfig;
```

Replace with:

```typescript
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
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // unsafe-inline required for Tailwind v4 runtime styles and framer-motion
              "style-src 'self' 'unsafe-inline'",
              // unsafe-eval required by Next.js dev mode; remove in a future hardening pass
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com https://us-assets.i.posthog.com",
              "connect-src 'self' https://us.i.posthog.com",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

---

## Task 3 — Update API Base URL

**File**: `frontend/lib/api.ts`

Current state of `API_BASE` (lines 8–11):
```typescript
const API_BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:8000";
```

Replace with:

```typescript
// In production: NEXT_PUBLIC_API_URL is unset → API_BASE = "" → same-origin
// Vercel rewrites /api/v1/* to the Railway backend (server-side, URL hidden).
// In local dev: set NEXT_PUBLIC_API_URL=http://localhost:8000 in .env.local
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""
```

**Do not change any other line in this file.** All existing fetch calls already use `${API_BASE}/api/v1/chapter/...` which will resolve correctly:
- Production: `"" + "/api/v1/chapter/outline"` → `/api/v1/chapter/outline` → Vercel rewrites to Railway
- Local dev: `"http://localhost:8000" + "/api/v1/chapter/outline"` → direct to local FastAPI

Create `frontend/.env.local` if it does not exist:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

This file is gitignored — it will not be committed. It exists only for local development.

---

## Task 4 — Create Edge Middleware (Bot Blocker)

**File**: `frontend/middleware.ts` (new file at `frontend/middleware.ts`, not inside `app/`)

This runs on Vercel's Edge Network before requests reach the rewrite layer. It only applies to API proxy routes — not to page routes (so Googlebot can still crawl the homepage).

```typescript
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
```

---

## Task 5 — Add robots.txt

**File**: `frontend/public/robots.txt` (new file)

```
User-agent: *
Disallow: /api/

User-agent: Googlebot
Allow: /
Disallow: /api/

User-agent: Bingbot
Allow: /
Disallow: /api/

# Explicitly disallow high-volume social crawlers
User-agent: facebookexternalhit
Disallow: /

User-agent: Twitterbot
Disallow: /

User-agent: LinkedInBot
Disallow: /

Sitemap: https://yourdomain.com/sitemap.xml
```

> The human operator will replace `yourdomain.com` with the real domain before final deploy. Leave the placeholder — it is intentional.

---

## Task 6 — Add Sitemap

**File**: `frontend/app/sitemap.ts` (new file)

```typescript
import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://yourdomain.com",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ]
}
```

> Same domain placeholder — human operator updates before launch.

---

## Task 7 — PostHog Provider

**File**: `frontend/app/posthog.tsx` (new file)

This is the client-side PostHog initializer. It must be a Client Component because it uses `usePathname` and runs in the browser.

```typescript
"use client"

import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { useEffect } from "react"

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

    if (!key) return // do nothing in local dev without key set

    posthog.init(key, {
      api_host: host ?? "https://us.i.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      // Disable session recording for privacy — writers paste their work here
      disable_session_recording: true,
      // Do not capture text inputs or text content anywhere
      autocapture: false,
      loaded(ph) {
        if (process.env.NODE_ENV === "development") {
          // Silence PostHog in dev so it doesn't pollute your prod data
          ph.opt_out_capturing()
        }
      },
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
```

---

## Task 8 — Wrap Layout with PostHog Provider

**File**: `frontend/app/layout.tsx`

Current state (full file):
```typescript
import type { Metadata, Viewport } from 'next'
import { Inter, Merriweather } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

// ... font config ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${_inter.variable} ${_merriweather.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="bottom-right" />
        <Analytics />
      </body>
    </html>
  )
}
```

Add the PostHog import and wrap `{children}` with the provider. Do not remove `<Analytics />` — keep Vercel Analytics alongside PostHog.

Change only:
1. Add import: `import { PostHogProvider } from "./posthog"`
2. Wrap `{children}` in `<PostHogProvider>`:

```typescript
import type { Metadata, Viewport } from 'next'
import { Inter, Merriweather } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { PostHogProvider } from './posthog'
import './globals.css'

// ... preserve existing font config unchanged ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${_inter.variable} ${_merriweather.variable}`}>
      <body className="font-sans antialiased">
        <PostHogProvider>
          {children}
          <Toaster position="bottom-right" />
          <Analytics />
        </PostHogProvider>
      </body>
    </html>
  )
}
```

---

## Task 9 — Instrument Events: use-warp-state.ts

**File**: `frontend/features/writing/hooks/use-warp-state.ts`

> **Note**: There is a file named `use-warp-state 2.ts` (with a space) in the same directory — this is an accidental duplicate. Edit `use-warp-state.ts` only. Do not touch the `" 2.ts"` file.

This hook contains `handleAnalyze` (fires after outline succeeds) and `handleTryExample` (fires when example is loaded). Add PostHog events to each.

**Add the import** at the top of the file (after existing imports):
```typescript
import posthog from "posthog-js"
```

**In `handleAnalyze`**, after `setPhase("editor")`:
```typescript
posthog.capture("chapter_analyzed", {
  word_count: chapterText.trim().split(/\s+/).filter(Boolean).length,
  beat_count: mapped.length,
})
```

**In `handleTryExample`**, before or after `setPhase("editor")`:
```typescript
posthog.capture("example_used")
```

The full updated `handleAnalyze` try-block should look like:
```typescript
try {
  const { outline, remainingAttempts: n } = await fetchOutline({
    chapter: { text: chapterText.trim() },
  })
  const mapped: StoryBullet[] = outline.bullets.map((b, i) => ({
    id: crypto.randomUUID(),
    label: `Beat ${i + 1}`,
    content: b.content,
    anchor_text: b.anchor_text,
  }))
  setBullets(mapped)
  setHighlights([])
  setRemainingAttempts(n ?? null)
  setPhase("editor")
  posthog.capture("chapter_analyzed", {
    word_count: chapterText.trim().split(/\s+/).filter(Boolean).length,
    beat_count: mapped.length,
  })
} catch (err) {
  // ... existing error handling unchanged ...
}
```

---

## Task 10 — Instrument Events: use-refactor.ts

**File**: `frontend/features/writing/hooks/use-refactor.ts`

> **Note**: There is a file named `use-refactor 2.ts` (with a space) in the same directory — this is an accidental duplicate. Edit `use-refactor.ts` only.

This hook contains `handleRefactor` (rewrite) and `handleEdit` (micro-edit).

**Add the import** at the top:
```typescript
import posthog from "posthog-js"
```

**In `handleRefactor`**, after `setRefactorProgress(100)` (i.e., after a successful rewrite):
```typescript
posthog.capture("rewrite_completed", {
  word_count: rewrite.chapter_text.split(/\s+/).filter(Boolean).length,
  change_count: rewrite.change_highlights.length,
  beats_used: bullets.length,
})
```

**In `handleEdit`**, after the `setBullets(mappedBullets)` line in the success path:
```typescript
posthog.capture("edit_completed", {
  instruction_length: instruction.length,
  edits_applied: edit.edits_applied,
})
```

**Additionally**, in `handleRefactor`'s catch block — add an `attempt_limit_hit` event when a 429 is received. The error message from the backend includes "free attempts" when the limit is hit:
```typescript
} catch (err) {
  console.error("Rewrite API error:", err)
  const message = err instanceof Error ? err.message : "Rewrite failed. Please try again."
  if (message.includes("free attempts")) {
    posthog.capture("attempt_limit_hit")
  }
  setRefactorError(message)
}
```

Apply the same pattern in `handleEdit`'s catch block.

---

## Task 11 — Instrument Events: chapter-editor.tsx

**File**: `frontend/features/writing/components/chapter-editor.tsx`

This file contains `handleCopy` and `handleDownload` handlers. Current state of those functions (lines ~50–64):

```typescript
const handleCopy = async () => {
  await navigator.clipboard.writeText(text)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}

const handleDownload = () => {
  const blob = new Blob([text], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "chapter.txt"
  a.click()
  URL.revokeObjectURL(url)
}
```

**Add the import** at the top of the file (after existing imports):
```typescript
import posthog from "posthog-js"
```

**Update `handleCopy`**:
```typescript
const handleCopy = async () => {
  await navigator.clipboard.writeText(text)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
  posthog.capture("content_copied")
}
```

**Update `handleDownload`**:
```typescript
const handleDownload = () => {
  const blob = new Blob([text], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "chapter.txt"
  a.click()
  URL.revokeObjectURL(url)
  posthog.capture("content_downloaded")
}
```

---

## PostHog Event Summary

All 8 events instrumented across 4 files:

| Event | File | Fired When | Properties |
|---|---|---|---|
| `chapter_analyzed` | `use-warp-state.ts` | Outline API succeeds | `word_count`, `beat_count` |
| `example_used` | `use-warp-state.ts` | "Try an Example" clicked | none |
| `rewrite_completed` | `use-refactor.ts` | Rewrite API succeeds | `word_count`, `change_count`, `beats_used` |
| `edit_completed` | `use-refactor.ts` | Edit API succeeds | `instruction_length`, `edits_applied` |
| `attempt_limit_hit` | `use-refactor.ts` | 429 error received | none |
| `content_copied` | `chapter-editor.tsx` | Copy button clicked | none |
| `content_downloaded` | `chapter-editor.tsx` | Download button clicked | none |

**Privacy rule**: Never pass chapter text, instruction text, or any user-written content as a PostHog property. Only structural metadata (counts, lengths) is captured.

---

## Verification Checklist

Before committing, verify:

- [ ] `npm run lint` passes (no ESLint errors)
- [ ] `npm run type-check` passes (no TypeScript errors)
- [ ] `npm run test` passes (no unit test failures)
- [ ] `npm run build` succeeds locally (catches broken imports, CSP issues)
- [ ] `middleware.ts` exists at `frontend/middleware.ts` (not inside `app/`)
- [ ] `public/robots.txt` exists
- [ ] `app/posthog.tsx` exists and is a Client Component (`"use client"` at top)
- [ ] `app/sitemap.ts` exists
- [ ] `next.config.ts` exports rewrites and headers
- [ ] `lib/api.ts` has `API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""`
- [ ] No `NEXT_PUBLIC_API_URL` references in production config (it should only exist in `.env.local`)

### Local Dev Smoke Test

Start both services:
```bash
# Terminal 1 — backend (from repo root's backend-launch worktree or main)
cd backend && uv run uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

In the browser at `http://localhost:3000`:
1. Paste text → Analyze Structure → beats appear ✓
2. Click Rewrite → chapter updates ✓
3. Open browser DevTools → Network → confirm requests go to `localhost:3000/api/v1/...` NOT `localhost:8000` directly

> In local dev, `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local` causes the rewrite NOT to fire (the rewrite only activates when `BACKEND_URL` is set on the Vercel server). Instead, `API_BASE = "http://localhost:8000"` is used directly. This is the expected local dev behavior.

---

## Commit Instructions

Make a single commit with all frontend changes:

```bash
git add next.config.ts \
        lib/api.ts \
        middleware.ts \
        public/robots.txt \
        app/sitemap.ts \
        app/posthog.tsx \
        app/layout.tsx \
        features/writing/hooks/use-warp-state.ts \
        features/writing/hooks/use-refactor.ts \
        features/writing/components/chapter-editor.tsx \
        package.json \
        package-lock.json
git commit -m "feat(web): add vercel proxy, posthog analytics, bot protection, security headers

- Proxy /api/v1/* to Railway via Vercel rewrites (hides backend URL)
- Update API_BASE to same-origin empty string for production
- Add edge middleware to block bad bots on API routes
- Add security headers (CSP, X-Frame-Options, Referrer-Policy, etc.)
- Add PostHog provider + instrument 7 validation events
- Add robots.txt (disallow social crawlers, allow search engines)
- Add Next.js App Router sitemap"
```

---

## Interface Contract (for Agent 1 — Backend)

The frontend rewrites `/api/v1/:path*` → `${BACKEND_URL}/api/v1/:path*`.

Agent 1 must NOT rename or move any of these routes:
- `POST /api/v1/chapter/outline`
- `POST /api/v1/chapter/rewrite`
- `POST /api/v1/chapter/edit`
- `GET /health`

The `X-Remaining-Attempts` response header is read by `lib/api.ts:parseRemainingAttempts()`. Agent 1 must preserve this header in all three endpoint responses.
