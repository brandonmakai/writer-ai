"use client"

import { useState, useCallback } from "react"
import type { StoryBullet } from "@/features/writing/types"
import type { ChangeHighlight } from "@/lib/example-data"
import { fetchOutline } from "@/lib/api"
import { exampleChapter, exampleBullets } from "@/lib/example-data"

export type WarpPhase = "landing" | "editor"

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
