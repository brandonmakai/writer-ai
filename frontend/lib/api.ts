/**
 * API client for the Writer AI FastAPI backend.
 * Types mirror backend schemas (app/schemas/*).
 */

const API_BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:8000";

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

/** Response from rewrite endpoint. */
export interface RewriteResponse {
  chapter_text: string;
  internal_structure: {
    bullets: string[];
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

/**
 * Extract structural bullets from chapter text.
 * POST /api/v1/chapter/outline
 */
export async function fetchOutline(
  body: OutlineRequest
): Promise<OutlineResponse> {
  const res = await fetch(`${API_BASE}/api/v1/chapter/outline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new Error(message || `Outline failed: ${res.status}`);
  }
  return res.json() as Promise<OutlineResponse>;
}

/**
 * Refactor chapter from outline (chapter + bullets).
 * POST /api/v1/chapter/rewrite
 */
export async function fetchRewrite(
  body: RewriteRequest
): Promise<RewriteResponse> {
  const res = await fetch(`${API_BASE}/api/v1/chapter/rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new Error(message || `Rewrite failed: ${res.status}`);
  }
  return res.json() as Promise<RewriteResponse>;
}
