"use client"

import { useState, useCallback, useEffect } from "react"
import type { StoryBullet } from "@/features/writing/types"
import type { ChangeHighlight } from "@/lib/example-data"

export interface UseRefactorSimulationOptions {
  bullets: StoryBullet[]
  chapterText: string
  setChapterText: (text: string) => void
  setHighlights: (highlights: ChangeHighlight[]) => void
  generateHighlights: (oldText: string, newText: string) => ChangeHighlight[]
}

export function useRefactorSimulation({
  bullets,
  chapterText,
  setChapterText,
  setHighlights,
  generateHighlights,
}: UseRefactorSimulationOptions) {
  const [isRefactoring, setIsRefactoring] = useState(false)
  const [refactorProgress, setRefactorProgress] = useState(0)
  const [preRefactorText, setPreRefactorText] = useState("")

  const handleRefactor = useCallback(() => {
    if (isRefactoring) return
    setPreRefactorText(chapterText)
    setHighlights([])
    setIsRefactoring(true)
    setRefactorProgress(0)
  }, [isRefactoring, chapterText, setHighlights])

  useEffect(() => {
    if (!isRefactoring) return

    const steps = [
      { delay: 200, progress: 12 },
      { delay: 600, progress: 28 },
      { delay: 1100, progress: 45 },
      { delay: 1600, progress: 63 },
      { delay: 2100, progress: 80 },
      { delay: 2600, progress: 92 },
      { delay: 3000, progress: 100 },
    ]

    const timers = steps.map(({ delay, progress }) =>
      setTimeout(() => setRefactorProgress(progress), delay)
    )

    const finishTimer = setTimeout(() => {
      const newText = bullets.map((b) => b.content).join("\n\n")
      setChapterText(newText)
      const newHighlights = generateHighlights(preRefactorText, newText)
      setHighlights(newHighlights)
      setIsRefactoring(false)
      setRefactorProgress(0)
    }, 3400)

    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(finishTimer)
    }
  }, [isRefactoring, bullets, preRefactorText, setChapterText, setHighlights, generateHighlights])

  return { isRefactoring, refactorProgress, handleRefactor }
}
