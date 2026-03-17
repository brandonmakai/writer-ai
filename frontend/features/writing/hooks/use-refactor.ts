"use client"

import { useState, useCallback, useEffect } from "react"
import type { StoryBullet } from "@/features/writing/types"
import type { ChangeHighlight } from "@/lib/example-data"
import { fetchRewrite } from "@/lib/api"

const REFACTOR_STEP_LABELS = [
  "Analyzing structure…",
  "Refactoring scenes…",
  "Applying your edits…",
  "Finalizing…",
] as const
const REFACTOR_STEP_INTERVAL_MS = 2500

export interface UseRefactorOptions {
  bullets: StoryBullet[]
  chapterText: string
  setChapterText: (text: string) => void
  setHighlights: (highlights: ChangeHighlight[]) => void
  setBullets: (bullets: StoryBullet[]) => void
  setRemainingAttempts?: (n: number | null) => void
}

export function useRefactor({
  bullets,
  chapterText,
  setChapterText,
  setHighlights,
  setBullets,
  setRemainingAttempts,
}: UseRefactorOptions) {
  const [isRefactoring, setIsRefactoring] = useState(false)
  const [refactorProgress, setRefactorProgress] = useState(0)
  const [refactorStepIndex, setRefactorStepIndex] = useState(0)
  const [refactorError, setRefactorError] = useState<string | null>(null)

  useEffect(() => {
    if (!isRefactoring) return
    const id = setInterval(() => {
      setRefactorStepIndex((i) => (i + 1) % REFACTOR_STEP_LABELS.length)
    }, REFACTOR_STEP_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isRefactoring])

  const refactorStepLabel = isRefactoring
    ? REFACTOR_STEP_LABELS[refactorStepIndex]
    : ""

  const handleRefactor = useCallback(async () => {
    if (isRefactoring || bullets.length === 0) return
    setIsRefactoring(true)
    setRefactorProgress(0)
    setRefactorStepIndex(0)
    setRefactorError(null)
    try {
      const { rewrite, remainingAttempts: n } = await fetchRewrite({
        chapter: { text: chapterText },
        bullets: bullets.map((b) => b.content),
      })
      setChapterText(rewrite.chapter_text)
      setHighlights(
        rewrite.change_highlights.map((h) => ({
          updated: h.updated,
          original: h.original,
        }))
      )
      const mappedBullets: StoryBullet[] = rewrite.internal_structure.bullets.map(
        (b, i) => ({
          id: crypto.randomUUID(),
          label: `Beat ${i + 1}`,
          content: b.content,
          anchor_text: b.anchor_text,
        })
      )
      setBullets(mappedBullets)
      setRemainingAttempts?.(n ?? null)
      setRefactorProgress(100)
    } catch (err) {
      console.error("Rewrite API error:", err)
      setRefactorError(
        err instanceof Error ? err.message : "Refactor failed. Please try again."
      )
    } finally {
      setIsRefactoring(false)
      setRefactorProgress(0)
    }
  }, [
    isRefactoring,
    bullets,
    chapterText,
    setChapterText,
    setHighlights,
    setBullets,
    setRemainingAttempts,
  ])

  return {
    isRefactoring,
    refactorProgress,
    refactorStepLabel,
    handleRefactor,
    refactorError,
  }
}
