"use client"

import { AnimatePresence } from "framer-motion"
import { useWarpState } from "@/features/warp/hooks/use-warp-state"
import { useRefactorSimulation } from "@/features/warp/hooks/use-refactor-simulation"
import { LandingView } from "@/features/warp/components/landing-view"
import { TriageView } from "@/features/warp/components/triage-view"
import { EditorView } from "@/features/warp/components/editor-view"
import { generateHighlights } from "@/lib/example-data"

export default function WriterAIPage() {
  const warp = useWarpState()
  const { isRefactoring, refactorProgress, handleRefactor } =
    useRefactorSimulation({
      bullets: warp.bullets,
      chapterText: warp.chapterText,
      setChapterText: warp.setChapterText,
      setHighlights: warp.setHighlights,
      generateHighlights,
    })

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-background">
      <AnimatePresence mode="wait">
        {warp.phase === "landing" && (
          <LandingView
            chapterText={warp.chapterText}
            onTextChange={warp.setChapterText}
            onAnalyze={warp.handleAnalyze}
            onTryExample={warp.handleTryExample}
          />
        )}
        {warp.phase === "triage" && (
          <TriageView
            key="triage"
            bullets={warp.bullets}
            onBulletsChange={warp.handleBulletsChangeFromTriage}
            onWeave={warp.handleWeave}
            suggestedBulletId={warp.suggestedBulletId}
            onSuggestedChange={warp.setSuggestedBulletId}
          />
        )}
        {warp.phase === "editor" && (
          <EditorView
            warp={warp}
            isRefactoring={isRefactoring}
            refactorProgress={refactorProgress}
            onRefactor={handleRefactor}
          />
        )}
      </AnimatePresence>
    </main>
  )
}
