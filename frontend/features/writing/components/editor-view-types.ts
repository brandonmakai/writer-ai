import type { StoryBullet } from "@/features/writing/types"
import type { ChangeHighlight } from "@/lib/example-data"

/** Subset of warp state and handlers required by EditorView. */
export interface WarpState {
  chapterText: string
  setChapterText: (text: string) => void
  bullets: StoryBullet[]
  setBullets: (bullets: StoryBullet[]) => void
  highlights: ChangeHighlight[]
  hoveredIndex: number | null
  setHoveredIndex: (index: number | null) => void
  showTethers: boolean
  setShowTethers: (fn: (v: boolean) => boolean) => void
  handleBackToLanding: () => void
  handleClearHighlights: () => void
  wordCount: number
}
