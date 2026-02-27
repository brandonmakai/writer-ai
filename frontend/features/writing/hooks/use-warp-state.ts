"use client"

import { useState, useCallback } from "react"
import type { StoryBullet } from "@/features/writing/types"
import type { ChangeHighlight } from "@/lib/example-data"
import { fetchOutline } from "@/lib/api"
import { exampleChapter, exampleBullets } from "@/lib/example-data"

export type WarpPhase = "landing" | "triage" | "editor"

export function useWarpState() {
  const [phase, setPhase] = useState<WarpPhase>("landing")
  const [chapterText, setChapterText] = useState("")
  const [bullets, setBullets] = useState<StoryBullet[]>([])
  const [highlights, setHighlights] = useState<ChangeHighlight[]>([])
  const [suggestedBulletId, setSuggestedBulletId] = useState<string | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [showTethers, setShowTethers] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const handleAnalyze = useCallback(async () => {
    if (!chapterText.trim()) return
    setIsAnalyzing(true)
    setAnalyzeError(null)
    try {
      const res = await fetchOutline({
        chapter: { text: chapterText.trim() },
      })
      const mapped: StoryBullet[] = res.bullets.map((b, i) => ({
        id: crypto.randomUUID(),
        label: `Beat ${i + 1}`,
        content: b.content,
        anchor_text: b.anchor_text,
      }))
      setBullets(mapped)
      const suggested = mapped[res.suggested_index]
      setSuggestedBulletId(suggested?.id ?? mapped[0]?.id ?? null)
      setHighlights([])
      setPhase("triage")
    } catch (err) {
      console.error("Outline API error:", err)
      setAnalyzeError("Analysis failed. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }, [chapterText])

  const handleTryExample = useCallback(() => {
    setAnalyzeError(null)
    setChapterText(exampleChapter)
    setBullets(exampleBullets)
    setSuggestedBulletId(exampleBullets[2]?.id ?? null)
    setHighlights([])
    setPhase("triage")
  }, [])

  const handleBulletsChangeFromTriage = useCallback(
    (newBullets: StoryBullet[]) => {
      setBullets(newBullets)
      if (
        suggestedBulletId &&
        !newBullets.some((b) => b.id === suggestedBulletId)
      ) {
        setSuggestedBulletId(newBullets[0]?.id ?? null)
      }
    },
    [suggestedBulletId]
  )

  const handleWeave = useCallback(() => {
    setPhase("editor")
  }, [])

  const handleBackToLanding = useCallback(() => {
    setPhase("landing")
    setHighlights([])
    setSuggestedBulletId(null)
  }, [])

  const handleBackToTriage = useCallback(() => {
    setPhase("triage")
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
    suggestedBulletId,
    setSuggestedBulletId,
    hoveredIndex,
    setHoveredIndex,
    showTethers,
    setShowTethers,
    isAnalyzing,
    analyzeError,
    handleAnalyze,
    handleTryExample,
    handleBulletsChangeFromTriage,
    handleWeave,
    handleBackToLanding,
    handleBackToTriage,
    handleClearHighlights,
    wordCount,
  }
}
