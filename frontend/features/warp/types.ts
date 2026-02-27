/**
 * Shared types and constants for the warp (landing → triage → editor) flow.
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

/** Single source for beat tag styling in triage and scaffolding sidebar. */
export const BEAT_TAG_COLORS: BeatTagColor[] = [
  { bg: "rgba(100,140,255,0.12)", text: "oklch(0.72 0.14 250)", border: "rgba(100,140,255,0.18)" },
  { bg: "rgba(52,211,153,0.12)", text: "oklch(0.72 0.17 162)", border: "rgba(52,211,153,0.18)" },
  { bg: "rgba(251,191,36,0.12)", text: "oklch(0.78 0.16 80)", border: "rgba(251,191,36,0.18)" },
  { bg: "rgba(251,113,133,0.12)", text: "oklch(0.70 0.18 15)", border: "rgba(251,113,133,0.18)" },
  { bg: "rgba(34,211,238,0.12)", text: "oklch(0.76 0.12 200)", border: "rgba(34,211,238,0.18)" },
]

/** Triage cards use slightly stronger opacity for focus states. */
export const BEAT_TAG_COLORS_TRIAGE: BeatTagColor[] = [
  { bg: "rgba(100,140,255,0.15)", text: "oklch(0.75 0.14 250)", border: "rgba(100,140,255,0.25)" },
  { bg: "rgba(52,211,153,0.15)", text: "oklch(0.75 0.17 162)", border: "rgba(52,211,153,0.25)" },
  { bg: "rgba(251,191,36,0.15)", text: "oklch(0.80 0.16 80)", border: "rgba(251,191,36,0.25)" },
  { bg: "rgba(251,113,133,0.15)", text: "oklch(0.73 0.18 15)", border: "rgba(251,113,133,0.25)" },
  { bg: "rgba(34,211,238,0.15)", text: "oklch(0.78 0.12 200)", border: "rgba(34,211,238,0.25)" },
]
