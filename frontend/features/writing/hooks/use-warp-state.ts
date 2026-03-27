"use client"

import { useState, useCallback, useEffect } from "react"
import type { StoryBullet } from "@/features/writing/types"
import type { ChangeHighlight } from "@/lib/example-data"
import { fetchOutline } from "@/lib/api"
import { exampleChapter, exampleBullets } from "@/lib/example-data"

export type WarpPhase = "landing" | "editor"

const DRAFT_KEY = "writer-ai-draft"

interface DraftSnapshot {
  chapterText: string
  bullets: StoryBullet[]
  phase: WarpPhase
}

function readDraft(): DraftSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as DraftSnapshot) : null
  } catch {
    return null
  }
}

function writeDraft(snapshot: DraftSnapshot): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot))
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}

function deleteDraft(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}

export function useWarpState() {
  const [phase, setPhase] = useState<WarpPhase>("landing")
  const [chapterText, setChapterText] = useState("")
  const [bullets, setBullets] = useState<StoryBullet[]>([])
  const [highlights, setHighlights] = useState<ChangeHighlight[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [showTethers, setShowTethers] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)

  // Restore draft on first client render
  useEffect(() => {
    const draft = readDraft()
    if (!draft) return
    setChapterText(draft.chapterText)
    setBullets(draft.bullets)
    setPhase(draft.phase)
  }, [])

  // Persist draft whenever editor state changes
  useEffect(() => {
    if (phase === "editor") {
      writeDraft({ chapterText, bullets, phase })
    }
  }, [phase, chapterText, bullets])

  const handleAnalyze = useCallback(async () => {
    if (!chapterText.trim()) return
    setIsAnalyzing(true)
    setAnalyzeError(null)
    try {
      const { outline, remainingAttempts: n } = await fetchOutline({
        chapter: { text: chapterText.trim() },
      })
      const mapped: StoryBullet[] = outline.bullets.map((b, i) => ({
        id: crypto.randomUUID(),
        label: `Beat ${i + 1}`,
        content: b.content,
        anchor_text: b.anchor_text,
      }))
      setBullets(mapped)
      setHighlights([])
      setRemainingAttempts(n ?? null)
      setPhase("editor")
    } catch (err) {
      console.error("Outline API error:", err)
      setAnalyzeError(
        err instanceof Error ? err.message : "Analysis failed. Please try again."
      )
    } finally {
      setIsAnalyzing(false)
    }
  }, [chapterText])

  const handleTryExample = useCallback(() => {
    setAnalyzeError(null)
    setChapterText(exampleChapter)
    setBullets(exampleBullets)
    setHighlights([])
    setPhase("editor")
  }, [])

  const handleBackToLanding = useCallback(() => {
    deleteDraft()
    setPhase("landing")
    setHighlights([])
  }, [])

  const handleClearHighlights = useCallback(() => {
    setHighlights([])
  }, [])

  const wordCount = chapterText.split(/\s+/).filter(Boolean).length

  return {
    phase,
    setPhase,
    chapterText,
    setChapterText,
    bullets,
    setBullets,
    highlights,
    setHighlights,
    hoveredIndex,
    setHoveredIndex,
    showTethers,
    setShowTethers,
    isAnalyzing,
    analyzeError,
    remainingAttempts,
    setRemainingAttempts,
    handleAnalyze,
    handleTryExample,
    handleBackToLanding,
    handleClearHighlights,
    wordCount,
  }
}
