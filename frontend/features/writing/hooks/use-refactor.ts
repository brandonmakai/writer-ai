"use client"

import { useState, useCallback, useEffect } from "react"
import posthog from "posthog-js"
import type { StoryBullet } from "@/features/writing/types"
import type { ChangeHighlight } from "@/lib/example-data"
import { fetchRewrite, fetchEdit } from "@/lib/api"
import { sanitizeText } from "@/lib/sanitize"

const REFACTOR_STEP_LABELS = [
  "Analyzing structure…",
  "Rewriting scenes…",
  "Rewriting prose…",
  "Finalizing…",
] as const
const REFACTOR_STEP_INTERVAL_MS = 2500

function classifyError(err: unknown): string {
  if (err instanceof TypeError && err.message === "Failed to fetch") return "network_error"
  const msg = err instanceof Error ? err.message.toLowerCase() : ""
  if (msg.includes("free attempts")) return "rate_limit"
  if (msg.includes("parse") || msg.includes("502")) return "parse_error"
  if (msg.includes("timeout") || msg.includes("timed out")) return "timeout"
  return "api_error"
}

export interface UseRefactorOptions {
  bullets: StoryBullet[]
  chapterText: string
  setChapterText: (text: string) => void
  setHighlights: (highlights: ChangeHighlight[]) => void
  setBullets: (bullets: StoryBullet[]) => void
  setRemainingAttempts?: (n: number | null) => void
  setResetAt?: (n: number | null) => void
}

export function useRefactor({
  bullets,
  chapterText,
  setChapterText,
  setHighlights,
  setBullets,
  setRemainingAttempts,
  setResetAt,
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
    posthog.capture("rewrite_attempted", { beats_used: bullets.length })
    try {
      const { rewrite, remainingAttempts: n, resetIn, tokensUsed } = await fetchRewrite({
        chapter: { text: chapterText },
        bullets: bullets.map((b) => b.content),
      })
      setChapterText(sanitizeText(rewrite.chapter_text))
      setHighlights(
        rewrite.change_highlights.map((h) => ({
          updated: sanitizeText(h.updated),
          original: sanitizeText(h.original),
        }))
      )
      const mappedBullets: StoryBullet[] = rewrite.internal_structure.bullets.map(
        (b, i) => ({
          id: crypto.randomUUID(),
          label: `Beat ${i + 1}`,
          content: sanitizeText(b.content),
          anchor_text: sanitizeText(b.anchor_text),
        })
      )
      setBullets(mappedBullets)
      setRemainingAttempts?.(n ?? null)
      if (resetIn != null) setResetAt?.(Date.now() + resetIn * 1000)
      setRefactorProgress(100)
      posthog.capture("rewrite_completed", {
        word_count: rewrite.chapter_text.split(/\s+/).filter(Boolean).length,
        change_count: rewrite.change_highlights.length,
        beats_used: bullets.length,
        tokens_used: tokensUsed ?? 0,
      })
    } catch (err) {
      console.error("Rewrite API error:", err)
      const errorType = classifyError(err)
      const message =
        err instanceof Error ? err.message : "Rewrite failed. Please try again."
      if (errorType === "rate_limit") {
        posthog.capture("attempt_limit_hit")
      }
      posthog.capture("rewrite_failed", { error_type: errorType })
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
    setResetAt,
  ])

  const handleEdit = useCallback(
    async (instruction: string) => {
      if (isEditing || bullets.length === 0 || !instruction.trim()) return
      setIsEditing(true)
      setEditError(null)
      try {
        const { edit, remainingAttempts: n, resetIn, tokensUsed } = await fetchEdit({
          chapter: { text: chapterText },
          bullets: bullets.map((b) => b.content),
          instruction,
        })
        setChapterText(sanitizeText(edit.chapter_text))
        setHighlights(
          edit.change_highlights.map((h) => ({
            updated: sanitizeText(h.updated),
            original: sanitizeText(h.original),
          }))
        )
        const mappedBullets: StoryBullet[] =
          edit.internal_structure.bullets.map((b, i) => ({
            id: crypto.randomUUID(),
            label: b.label || `Beat ${i + 1}`,
            content: sanitizeText(b.content),
            anchor_text: sanitizeText(b.anchor_text),
          }))
        setBullets(mappedBullets)
        setRemainingAttempts?.(n ?? null)
        if (resetIn != null) setResetAt?.(Date.now() + resetIn * 1000)
        posthog.capture("edit_completed", {
          instruction_length: instruction.length,
          edits_applied: edit.edits_applied,
          tokens_used: tokensUsed ?? 0,
        })
      } catch (err) {
        console.error("Edit API error:", err)
        const errorType = classifyError(err)
        const isNetworkError = errorType === "network_error"
        const message = isNetworkError
          ? "Couldn't reach the server. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Edit failed. Please try again."
        if (errorType === "rate_limit") {
          posthog.capture("attempt_limit_hit")
        }
        posthog.capture("edit_failed", { error_type: errorType })
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
      setResetAt,
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
