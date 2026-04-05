# Narrate AI Frontend

Next.js 15+ (App Router), React 19, Tailwind v4. See [docs/ENGINEERING_GUIDELINES.md](../docs/ENGINEERING_GUIDELINES.md) for commit rules, frontend best practices, and quality gates.

## Getting Started

From this directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app proxies `/api/v1/*` to the backend. In local dev, set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local` (bypasses the Vercel rewrite; calls the local FastAPI directly). Run the backend from `backend/`: `uv run fastapi dev main.py`.

In production, `BACKEND_URL` is set on Vercel (server-side only, never sent to browser). Vercel rewrites all `/api/v1/*` requests to the Railway backend transparently.

## Commands

| Command | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint (run before committing) |
| `npm run type-check` | TypeScript check (`tsc --noEmit`) |
| `npm run test` | Unit tests (Vitest) |
| `npm run smoke-test` | E2E smoke test (Playwright) |

## Environment Variables

**Local dev** (`.env.local`, gitignored):
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Vercel (production)**:
```
BACKEND_URL=https://your-railway-domain.up.railway.app   # server-side only
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
RESEND_API_KEY=re_...                                     # server-side only
```

## Styles

- **Tailwind v4** via PostCSS. Use utility classes and design tokens (`text-foreground`, `bg-background`, `border-border`).
- Use the `cn()` helper from `@/lib/utils` for conditional or merged class names.
- **Responsive**: Mobile-first. Horizontal padding uses `--app-px` and safe-area insets (see `app/globals.css`). Use ≥44px touch targets on interactive elements.

## Tests

- **Unit**: Vitest + React Testing Library. Tests live next to code (`lib/utils.test.ts`). Run: `npm run test`.
- **E2E / smoke**: Playwright specs in `frontend/e2e/`. Run: `npm run smoke-test`.

Before committing: `npm run lint && npm run type-check && npm run test`. Pre-commit runs these when `frontend/` files change.
