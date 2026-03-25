/**
 * Shared types and constants for the warp (landing → editor) flow.
 */

export interface StoryBullet {
  id: string
  label: string
  content: string
  /** Verbatim sentence from the chapter this bullet addresses (for tether). */
  anchor_text?: string
}

export type BeatTagColor = {
  bg: string
  text: string
  border: string
}

/** Single source for beat tag styling in scaffolding sidebar. */
export const BEAT_TAG_COLORS: BeatTagColor[] = [
  { bg: "rgba(100,140,255,0.12)", text: "oklch(0.72 0.14 250)", border: "rgba(100,140,255,0.18)" },
  { bg: "rgba(52,211,153,0.12)", text: "oklch(0.72 0.17 162)", border: "rgba(52,211,153,0.18)" },
  { bg: "rgba(251,191,36,0.12)", text: "oklch(0.78 0.16 80)", border: "rgba(251,191,36,0.18)" },
  { bg: "rgba(251,113,133,0.12)", text: "oklch(0.70 0.18 15)", border: "rgba(251,113,133,0.18)" },
  { bg: "rgba(34,211,238,0.12)", text: "oklch(0.76 0.12 200)", border: "rgba(34,211,238,0.18)" },
]

// TODO: Remove word counts post-launch in favor of chapter segmentation
/** Soft word-count guidance (UI-only; backend hard cap is in app/schemas/common.py). */
export const SOFT_WORD_LIMIT = 2000
export const HARD_WORD_LIMIT = 2500
