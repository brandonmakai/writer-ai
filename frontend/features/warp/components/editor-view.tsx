"use client"

import { useRef } from "react"
import { motion } from "framer-motion"
import { RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EditorHeader } from "@/components/layout/editor-header"
import { ChapterEditor } from "./chapter-editor"
import { ScaffoldingSidebar } from "./scaffolding-sidebar"
import { TetherOverlay } from "./tether-overlay"
import type { WarpState } from "./editor-view-types"

export interface EditorViewProps {
  warp: WarpState
  isRefactoring: boolean
  refactorProgress: number
  onRefactor: () => void
}

export function EditorView({
  warp,
  isRefactoring,
  refactorProgress,
  onRefactor,
}: EditorViewProps) {
  const workspaceRef = useRef<HTMLDivElement>(null)

  return (
    <motion.div
      key="editor"
      className="flex-1 flex flex-col min-h-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <EditorHeader
        onBack={warp.handleBackToTriage}
        wordCount={warp.wordCount}
        bulletCount={warp.bullets.length}
        highlightCount={warp.highlights.length}
      />

      <div
        ref={workspaceRef}
        className="flex-1 flex min-h-0 relative"
      >
        <motion.div
          className="flex-7 min-w-0 flex flex-col min-h-0"
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.1,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <ChapterEditor
            text={warp.chapterText}
            onTextChange={warp.setChapterText}
            highlights={warp.highlights}
            onClearHighlights={warp.handleClearHighlights}
            bullets={warp.bullets}
            activeBulletIndex={warp.hoveredIndex}
            onBulletHover={warp.setHoveredIndex}
          />
        </motion.div>

        <motion.div
          className="hidden md:flex flex-3 min-w-[280px] max-w-[420px] flex-col min-h-0"
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.15,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <ScaffoldingSidebar
            bullets={warp.bullets}
            onBulletsChange={warp.setBullets}
            activeBulletIndex={warp.hoveredIndex}
            onBulletHover={warp.setHoveredIndex}
            showTethers={warp.showTethers}
            onToggleTethers={() => warp.setShowTethers((v) => !v)}
          />
        </motion.div>

        <TetherOverlay
          containerRef={workspaceRef}
          bulletCount={warp.bullets.length}
          activeBulletIndex={warp.hoveredIndex}
          isRefactoring={isRefactoring}
          showTethers={warp.showTethers}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.6,
          duration: 0.5,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="sticky bottom-0 flex items-center justify-center px-4 py-5"
      >
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/90 to-transparent pointer-events-none" />

        <div className="relative">
          {isRefactoring && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -inset-1.5 rounded-2xl overflow-hidden"
            >
              <div
                className="h-full rounded-2xl transition-all duration-300"
                style={{
                  background: `linear-gradient(90deg, oklch(0.65 0.18 250 / 0.3) ${refactorProgress}%, transparent ${refactorProgress}%)`,
                }}
              />
            </motion.div>
          )}

          <Button
            size="lg"
            onClick={onRefactor}
            disabled={isRefactoring || warp.bullets.length === 0}
            className="relative bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-8 text-sm font-medium shadow-[0_0_30px_oklch(0.65_0.18_250_/_0.25)] hover:shadow-[0_0_50px_oklch(0.65_0.18_250_/_0.4)] transition-all duration-300 rounded-xl h-12 gap-2.5"
          >
            {isRefactoring ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>
                  {"Weaving" +
                    ".".repeat(
                      Math.floor((refactorProgress / 100) * 3) + 1
                    )}
                </span>
                <span className="text-primary-foreground/60 text-xs ml-1 tabular-nums">
                  {refactorProgress}%
                </span>
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Refactor Chapter
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
