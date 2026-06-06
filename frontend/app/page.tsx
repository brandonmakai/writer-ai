"use client"

import { AnimatePresence } from "framer-motion"
import { useWarpState } from "@/features/writing/hooks/use-warp-state"
import { useRefactor } from "@/features/writing/hooks/use-refactor"
import { LandingView } from "@/features/writing/components/landing-view"
import { EditorView } from "@/features/writing/components/editor-view"
import { SimplifiedView } from "@/features/writing/components/simplified-view"

const SIMPLIFIED = process.env.NEXT_PUBLIC_SIMPLIFIED_EXPERIMENT_MODE === "true"

export default function WriterAIPage() {
  if (SIMPLIFIED) return <SimplifiedView />
  return <FullApp />
}

function FullApp() {
  const warp = useWarpState()
  const {
    isRefactoring,
    refactorProgress,
    refactorStepLabel,
    handleRefactor,
    refactorError,
    handleEdit,
    isEditing,
    editError,
  } = useRefactor({
    bullets: warp.bullets,
    chapterText: warp.chapterText,
    setChapterText: warp.setChapterText,
    setHighlights: warp.setHighlights,
    setBullets: warp.setBullets,
    setRemainingAttempts: warp.setRemainingAttempts,
    setResetAt: warp.setResetAt,
  })

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-background app-padding-x">
      <AnimatePresence mode="wait">
        {warp.phase === "landing" && (
          <LandingView
            chapterText={warp.chapterText}
            onTextChange={warp.setChapterText}
            onAnalyze={warp.handleAnalyze}
            onTryExample={warp.handleTryExample}
            isAnalyzing={warp.isAnalyzing}
            analyzeError={warp.analyzeError}
            wordCount={warp.wordCount}
          />
        )}
        {warp.phase === "editor" && (
          <EditorView
            warp={warp}
            isRefactoring={isRefactoring}
            refactorProgress={refactorProgress}
            refactorStepLabel={refactorStepLabel}
            onRefactor={handleRefactor}
            refactorError={refactorError}
            onEditInstruction={handleEdit}
            isEditing={isEditing}
            editError={editError}
          />
        )}
      </AnimatePresence>
    </main>
  )
}
