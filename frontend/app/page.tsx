
"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CommandBox } from "@/components/command-box"
import { TriageView } from "@/components/triage-view"
import { EditorHeader } from "@/components/editor-header"
import { ChapterEditor } from "@/components/chapter-editor"
import {
  ScaffoldingSidebar,
  type StoryBullet,
} from "@/components/scaffolding-sidebar"
import { TetherOverlay } from "@/components/tether-overlay"
import {
  exampleChapter,
  exampleBullets,
  generateHighlights,
  type ChangeHighlight,
} from "@/lib/example-data"

type AppPhase = "landing" | "triage" | "editor"

export default function WriterAIPage() {
  const [phase, setPhase] = useState<AppPhase>("landing")
  const [chapterText, setChapterText] = useState("")
  const [bullets, setBullets] = useState<StoryBullet[]>([])
  const [isRefactoring, setIsRefactoring] = useState(false)
  const [refactorProgress, setRefactorProgress] = useState(0)
  const [highlights, setHighlights] = useState<ChangeHighlight[]>([])
  const [preRefactorText, setPreRefactorText] = useState("")
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [showTethers, setShowTethers] = useState(true)
  const workspaceRef = useRef<HTMLDivElement>(null)

  /* ── LANDING -> TRIAGE ── */
  const handleAnalyze = useCallback(() => {
    if (!chapterText.trim()) return
    const paragraphs = chapterText
      .split("\n\n")
      .filter((p) => p.trim().length > 0)
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
    setHighlights([])
    setPhase("triage")
  }, [chapterText])

  const handleTryExample = useCallback(() => {
    setChapterText(exampleChapter)
    setBullets(exampleBullets)
    setHighlights([])
    setPhase("triage")
  }, [])

  /* ── TRIAGE -> EDITOR ── */
  const handleWeave = useCallback(() => {
    setPhase("editor")
  }, [])

  const handleBackToLanding = useCallback(() => {
    setPhase("landing")
    setHighlights([])
  }, [])

  const handleBackToTriage = useCallback(() => {
    setPhase("triage")
    setHighlights([])
  }, [])

  const handleClearHighlights = useCallback(() => {
    setHighlights([])
  }, [])

  const handleRefactor = useCallback(() => {
    if (isRefactoring) return
    setPreRefactorText(chapterText)
    setHighlights([])
    setIsRefactoring(true)
    setRefactorProgress(0)
  }, [isRefactoring, chapterText])

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
  }, [isRefactoring, bullets, preRefactorText])

  const wordCount = chapterText.split(/\s+/).filter(Boolean).length

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-background">
      <AnimatePresence mode="wait">
        {/* ════════════ LANDING ════════════ */}
        {phase === "landing" && (
          <motion.div
            key="landing"
            className="flex-1 flex flex-col items-center justify-center px-4"
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Ambient background glow */}
            <div
              className="pointer-events-none fixed inset-0"
              aria-hidden="true"
            >
              <div
                className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full opacity-[0.04] blur-[120px]"
                style={{ background: "oklch(0.65 0.18 250)" }}
              />
            </div>

            <CommandBox
              text={chapterText}
              onTextChange={setChapterText}
              onAnalyze={handleAnalyze}
              onTryExample={handleTryExample}
              isUnfolded={false}
            />

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-12 text-[11px] text-muted-foreground/40 tracking-wide"
            >
              Structural analysis for narrative writers
            </motion.p>
          </motion.div>
        )}

        {/* ════════════ TRIAGE ════════════ */}
        {phase === "triage" && (
          <TriageView
            key="triage"
            bullets={bullets}
            onBulletsChange={setBullets}
            onWeave={handleWeave}
          />
        )}

        {/* ════════════ EDITOR ════════════ */}
        {phase === "editor" && (
          <motion.div
            key="editor"
            className="flex-1 flex flex-col min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Compact Header */}
            <EditorHeader
              onBack={handleBackToTriage}
              wordCount={wordCount}
              bulletCount={bullets.length}
              highlightCount={highlights.length}
            />

            {/* 70/30 Split Pane */}
            <div
              ref={workspaceRef}
              className="flex-1 flex min-h-0 relative"
            >
              {/* Left: prose slides in from left */}
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
                  text={chapterText}
                  onTextChange={setChapterText}
                  highlights={highlights}
                  onClearHighlights={handleClearHighlights}
                  bullets={bullets}
                  activeBulletIndex={hoveredIndex}
                  onBulletHover={setHoveredIndex}
                />
              </motion.div>

              {/* Right: sidebar slides in from right */}
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
                  bullets={bullets}
                  onBulletsChange={setBullets}
                  activeBulletIndex={hoveredIndex}
                  onBulletHover={setHoveredIndex}
                  showTethers={showTethers}
                  onToggleTethers={() => setShowTethers((v) => !v)}
                />
              </motion.div>

              <TetherOverlay
                containerRef={workspaceRef}
                bulletCount={bullets.length}
                activeBulletIndex={hoveredIndex}
                isRefactoring={isRefactoring}
                showTethers={showTethers}
              />
            </div>

            {/* ── FLOATING REFACTOR BUTTON ── */}
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
              {/* Fade-out gradient */}
              <div className="absolute inset-0 bg-linear-to-t from-background via-background/90 to-transparent pointer-events-none" />

              <div className="relative">
                {/* Progress ring */}
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
                  onClick={handleRefactor}
                  disabled={isRefactoring || bullets.length === 0}
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
        )}
      </AnimatePresence>
    </main>
  )
}
