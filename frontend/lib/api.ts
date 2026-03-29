/**
 * API client for the Writer AI FastAPI backend.
 * Types mirror backend schemas (app/schemas/*).
 */

// In production: NEXT_PUBLIC_API_URL is unset → API_BASE = "" → same-origin
// Vercel rewrites /api/v1/* to the Railway backend (server-side, URL hidden).
// In local dev: set NEXT_PUBLIC_API_URL=http://localhost:8000 in .env.local
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

/** Shared chapter context (mirrors backend ChapterBase). */
export interface ChapterBase {
  text: string;
  tone?: string;
  language?: string;
}

/** Request for outline endpoint. */
export interface OutlineRequest {
  chapter: ChapterBase;
}

/** One structural bullet with anchor text (mirrors backend BulletWithAnchor). */
export interface BulletWithAnchor {
  label?: string;
  content: string;
  anchor_text: string;
}

/** Response from outline endpoint. */
export interface OutlineResponse {
  bullets: BulletWithAnchor[];
  suggested_index: number;
}

/** Request for rewrite endpoint. */
export interface RewriteRequest {
  chapter: ChapterBase;
  bullets: string[];
}

/** One change highlight (mirrors backend ChangeHighlight). */
export interface ChangeHighlightDto {
  original: string;
  updated: string;
}

/** Response from rewrite endpoint (internal_structure.bullets mirror BulletWithAnchor). */
export interface RewriteResponse {
  chapter_text: string;
  internal_structure: {
    bullets: BulletWithAnchor[];
    scene_summaries: Array<{
      summary: string;
      characters: string[];
      purpose: string;
    }>;
  };
  change_highlights: ChangeHighlightDto[];
}

async function parseErrorResponse(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { detail?: string | { msg?: string }[] };
    if (typeof json.detail === "string") return json.detail;
    if (Array.isArray(json.detail) && json.detail[0]?.msg)
      return json.detail[0].msg;
  } catch {
    // ignore
  }
  return text || res.statusText;
}

function parseRemainingAttempts(res: Response): number | null {
  const raw = res.headers.get("X-Remaining-Attempts");
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Extract structural bullets from chapter text.
 * POST /api/v1/chapter/outline
 * Returns outline and remaining attempt count (when limited by backend).
 */
export async function fetchOutline(body: OutlineRequest): Promise<{
  outline: OutlineResponse;
  remainingAttempts: number | null;
}> {
  const res = await fetch(`${API_BASE}/api/v1/chapter/outline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new Error(message || `Outline failed: ${res.status}`);
  }
  const outline = (await res.json()) as OutlineResponse;
  return { outline, remainingAttempts: parseRemainingAttempts(res) };
}

/**
 * Refactor chapter from outline (chapter + bullets).
 * POST /api/v1/chapter/rewrite
 * Returns rewrite result and remaining attempt count (when limited by backend).
 */
export async function fetchRewrite(body: RewriteRequest): Promise<{
  rewrite: RewriteResponse;
  remainingAttempts: number | null;
}> {
  const res = await fetch(`${API_BASE}/api/v1/chapter/rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new Error(message || `Rewrite failed: ${res.status}`);
  }
  const rewrite = (await res.json()) as RewriteResponse;
  return { rewrite, remainingAttempts: parseRemainingAttempts(res) };
}

/** Request for micro-edit endpoint. */
export interface EditRequest {
  chapter: ChapterBase;
  bullets: string[];
  instruction: string;
}

/** Response from micro-edit endpoint. */
export interface EditResponse {
  chapter_text: string;
  change_highlights: ChangeHighlightDto[];
  internal_structure: {
    bullets: BulletWithAnchor[];
    scene_summaries: Array<{
      summary: string;
      characters: string[];
      purpose: string;
    }>;
  };
  edits_applied: number;
}

/**
 * Apply a targeted micro-edit to the chapter.
 * POST /api/v1/chapter/edit
 */
export async function fetchEdit(body: EditRequest): Promise<{
  edit: EditResponse;
  remainingAttempts: number | null;
}> {
  const res = await fetch(`${API_BASE}/api/v1/chapter/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new Error(message || `Edit failed: ${res.status}`);
  }
  const edit = (await res.json()) as EditResponse;
  return { edit, remainingAttempts: parseRemainingAttempts(res) };
}
