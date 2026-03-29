"use client"

import { useState, useCallback, useEffect } from "react"
import posthog from "posthog-js"
import type { StoryBullet } from "@/features/writing/types"
import type { ChangeHighlight } from "@/lib/example-data"
import { fetchRewrite, fetchEdit } from "@/lib/api"

const REFACTOR_STEP_LABELS = [
  "Analyzing structure…",
  "Rewriting scenes…",
  "Rewriting prose…",
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
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

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
      posthog.capture("rewrite_completed", {
        word_count: rewrite.chapter_text.split(/\s+/).filter(Boolean).length,
        change_count: rewrite.change_highlights.length,
        beats_used: bullets.length,
      })
    } catch (err) {
      console.error("Rewrite API error:", err)
      const message =
        err instanceof Error ? err.message : "Rewrite failed. Please try again."
      if (message.includes("free attempts")) {
        posthog.capture("attempt_limit_hit")
      }
      setRefactorError(message)
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

  const handleEdit = useCallback(
    async (instruction: string) => {
      if (isEditing || bullets.length === 0 || !instruction.trim()) return
      setIsEditing(true)
      setEditError(null)
      try {
        const { edit, remainingAttempts: n } = await fetchEdit({
          chapter: { text: chapterText },
          bullets: bullets.map((b) => b.content),
          instruction,
        })
        setChapterText(edit.chapter_text)
        setHighlights(
          edit.change_highlights.map((h) => ({
            updated: h.updated,
            original: h.original,
          }))
        )
        const mappedBullets: StoryBullet[] =
          edit.internal_structure.bullets.map((b, i) => ({
            id: crypto.randomUUID(),
            label: b.label || `Beat ${i + 1}`,
            content: b.content,
            anchor_text: b.anchor_text,
          }))
        setBullets(mappedBullets)
        setRemainingAttempts?.(n ?? null)
        posthog.capture("edit_completed", {
          instruction_length: instruction.length,
          edits_applied: edit.edits_applied,
        })
      } catch (err) {
        console.error("Edit API error:", err)
        const isNetworkError =
          err instanceof TypeError && err.message === "Failed to fetch"
        const message = isNetworkError
          ? "Couldn't reach the server. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Edit failed. Please try again."
        if (message.includes("free attempts")) {
          posthog.capture("attempt_limit_hit")
        }
        setEditError(message)
      } finally {
        setIsEditing(false)
      }
    },
    [
      isEditing,
      bullets,
      chapterText,
      setChapterText,
      setHighlights,
      setBullets,
      setRemainingAttempts,
    ]
  )

  return {
    isRefactoring,
    refactorProgress,
    refactorStepLabel,
    handleRefactor,
    refactorError,
    isEditing,
    handleEdit,
    editError,
  }
}
