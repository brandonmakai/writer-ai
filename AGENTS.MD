Follow:
- docs/PRODUCT.md for feature behavior
- docs/LLM_SPEC.md for model output contract
- docs/ENGINEERING_GUIDELINES.md for commit and testing rules (includes frontend best practices, styles, tests, and commit-after-changes).

Backend: lives in `/backend` (FastAPI + uv). See backend/README.md for run/test commands and backend/ARCHITECTURE.md for layout and where to change prompts/LLM wiring.

Frontend: lives in `/frontend` (Next.js 15+, React 19, Tailwind v4). See frontend/README.md for commands and docs/ENGINEERING_GUIDELINES.md for styles, tests, and pre-commit.