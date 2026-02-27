"use client"

import { useState, useCallback } from "react"
import type { StoryBullet } from "@/features/writing/types"
import type { ChangeHighlight } from "@/lib/example-data"
import { fetchRewrite } from "@/lib/api"

export interface UseRefactorOptions {
  bullets: StoryBullet[]
  chapterText: string
  setChapterText: (text: string) => void
  setHighlights: (highlights: ChangeHighlight[]) => void
}

export function useRefactor({
  bullets,
  chapterText,
  setChapterText,
  setHighlights,
}: UseRefactorOptions) {
  const [isRefactoring, setIsRefactoring] = useState(false)
  const [refactorProgress, setRefactorProgress] = useState(0)
  const [refactorError, setRefactorError] = useState<string | null>(null)

  const handleRefactor = useCallback(async () => {
    if (isRefactoring || bullets.length === 0) return
    setIsRefactoring(true)
    setRefactorProgress(0)
    setRefactorError(null)
    try {
      const res = await fetchRewrite({
        chapter: { text: chapterText },
        bullets: bullets.map((b) => b.content),
      })
      setChapterText(res.chapter_text)
      setHighlights(
        res.change_highlights.map((h) => ({ updated: h.updated, original: h.original }))
      )
      setRefactorProgress(100)
    } catch (err) {
      console.error("Rewrite API error:", err)
      setRefactorError("Refactor failed. Please try again.")
    } finally {
      setIsRefactoring(false)
      setRefactorProgress(0)
    }
  }, [isRefactoring, bullets, chapterText, setChapterText, setHighlights])

  return { isRefactoring, refactorProgress, handleRefactor, refactorError }
}
