"use client"

import { useState, useCallback } from "react"
import type { StoryBullet } from "@/features/warp/types"
import type { ChangeHighlight } from "@/lib/example-data"
import { splitParagraphs } from "@/lib/utils"
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

  const handleAnalyze = useCallback(() => {
    if (!chapterText.trim()) return
    const paragraphs = splitParagraphs(chapterText)
    const generatedBullets: StoryBullet[] = paragraphs
      .slice(0, 7)
      .map((para, i) => {
        const trimmed = para.trim()
        const firstSentenceMatch = trimmed.match(/^[^.!?]*[.!?]/)
        const anchor_text = firstSentenceMatch
          ? firstSentenceMatch[0].trim()
          : trimmed
        return {
          id: crypto.randomUUID(),
          label: `Beat ${i + 1}`,
          content:
            trimmed.slice(0, 120) + (trimmed.length > 120 ? "..." : ""),
          anchor_text,
        }
      })
    setBullets(generatedBullets)
    const mid = Math.floor(generatedBullets.length / 2)
    setSuggestedBulletId(generatedBullets[mid]?.id ?? null)
    setHighlights([])
    setPhase("triage")
  }, [chapterText])

  const handleTryExample = useCallback(() => {
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
