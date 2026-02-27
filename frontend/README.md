# Writer AI Frontend

Next.js 15+ (App Router), React 19, Tailwind v4. See [docs/ENGINEERING_GUIDELINES.md](../docs/ENGINEERING_GUIDELINES.md) for commit rules, frontend best practices, and quality gates.

## Getting Started

From this directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

## Styles

- **Tailwind v4** via PostCSS. Use utility classes and design tokens (e.g. `text-foreground`, `bg-background`, `border-border`).
- Use the `cn()` helper from `@/lib/utils` for conditional or merged class names.
- **Responsive**: The UI is built mobile-first. Horizontal padding uses `--app-px` and safe-area insets (see `app/globals.css`). Use responsive padding (e.g. `px-4 sm:px-6`) and at least 44px touch targets for interactive elements on small screens. Triage "Other beats" use a stacked layout on small screens; in the editor, structural beats are available via the header list icon (full-screen panel) below the `md` breakpoint.

## Tests

- **Unit**: Vitest + React Testing Library in `frontend/`. Tests live next to code (e.g. `lib/utils.test.ts`). Run: `npm run test`.
- **E2E / smoke**: Playwright specs in `frontend/e2e/`. Run: `npm run smoke-test` (starts dev server if needed).

Before committing, run `npm run lint && npm run type-check && npm run test`. Pre-commit runs these when `frontend/` files change. **Commit after making changes** so work is saved and hooks can run.
