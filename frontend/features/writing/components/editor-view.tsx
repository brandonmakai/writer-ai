"use client"

import { useRef, useState, useEffect, useCallback, useMemo, useId } from "react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { EditorHeader } from "@/components/layout/editor-header"
import { ChapterEditor } from "./chapter-editor"
import { ScaffoldingSidebar } from "./scaffolding-sidebar"
import { TetherOverlay } from "./tether-overlay"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import type { WarpState } from "./editor-view-types"
import { HARD_WORD_LIMIT } from "@/features/writing/types"

export interface EditorViewProps {
  warp: WarpState
  isRefactoring: boolean
  refactorProgress: number
  refactorStepLabel?: string
  onRefactor: () => void
  refactorError?: string | null
  isEditing?: boolean
  onEditInstruction?: (instruction: string) => void
  editError?: string | null
}

const EXHAUSTION_PHRASE = "free attempts"

function useCountdown(resetAt: number | null): { hms: string; exactTime: string } | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!resetAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [resetAt])

  return useMemo(() => {
    if (!resetAt) return null
    const ms = Math.max(0, resetAt - now)
    const totalSecs = Math.ceil(ms / 1000)
    const h = Math.floor(totalSecs / 3600)
    const m = Math.floor((totalSecs % 3600) / 60)
    const s = totalSecs % 60
    const hms = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    const exactTime = new Date(resetAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    return { hms, exactTime }
  }, [resetAt, now])
}

export function EditorView({
  warp,
  isRefactoring,
  refactorProgress,
  refactorStepLabel = "",
  onRefactor,
  refactorError = null,
  isEditing = false,
  onEditInstruction,
  editError = null,
}: EditorViewProps) {
  const BEATS_TIP_SEEN_KEY = "writer-ai-beats-tip-seen"
  const workspaceRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const [bulletsDialogOpen, setBulletsDialogOpen] = useState(false)
  const [highlightBeatsTrigger, setHighlightBeatsTrigger] = useState(false)
  const [beatsEdited, setBeatsEdited] = useState(false)
  const [beatPulseSignal, setBeatPulseSignal] = useState(0)
  const [limitModalOpen, setLimitModalOpen] = useState(false)
  const prevIsRefactoringRef = useRef(false)
  const tooltipPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdown = useCountdown(warp.resetAt ?? null)
  const emailInputId = useId()
  const [emailValue, setEmailValue] = useState("")
  const [emailState, setEmailState] = useState<"idle" | "submitting" | "done" | "error">("idle")

  const handleEmailSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!emailValue.trim() || emailState === "submitting" || emailState === "done") return
    setEmailState("submitting")
    try {
      const res = await fetch("/api/collect-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue.trim() }),
      })
      setEmailState(res.ok ? "done" : "error")
    } catch {
      setEmailState("error")
    }
  }, [emailValue, emailState])
  const overHardLimit = warp.wordCount > HARD_WORD_LIMIT
  const isAtLimit = warp.remainingAttempts === 0
  const isExhaustionError = !!refactorError?.includes(EXHAUSTION_PHRASE)

  // Open the limit modal when attempts run out or a 429 is returned
  useEffect(() => {
    if (isAtLimit || isExhaustionError) {
      setLimitModalOpen(true)
      setEmailValue("")
      setEmailState("idle")
    }
  }, [isAtLimit, isExhaustionError])

  // Reset beatsEdited after a successful refactor so the user must edit again
  useEffect(() => {
    if (prevIsRefactoringRef.current && !isRefactoring && !refactorError) {
      const t = setTimeout(() => setBeatsEdited(false), 0)
      prevIsRefactoringRef.current = isRefactoring
      return () => clearTimeout(t)
    }
    prevIsRefactoringRef.current = isRefactoring
  }, [isRefactoring, refactorError])

  const handleBeatsEdited = useCallback(() => setBeatsEdited(true), [])

  // On first mount: show onboarding toast, then pulse the first beat after the
  // toast clears. Sequential order keeps attention focused — users read the toast,
  // it exits, then the pulse draws their eye to where to act.
  // The cleanup-on-re-run from React Strict Mode cancels Effect 1's timers; Effect 2
  // reschedules them and they fire exactly once — no ref guard needed.
  useEffect(() => {
    const beatCount = warp.bullets.length
    if (!beatCount) return

    const toastT = setTimeout(() => {
      toast(`Structure Mapped! ${beatCount} story beat${beatCount !== 1 ? "s" : ""} identified`, {
        description: "Adjust beats with a prompt (or reorder/delete one), then rewrite the chapter.",
        position: "top-center",
      })
    }, 800)

    // 800ms show delay + 4000ms sonner default duration + ~400ms exit animation
    const pulseT = setTimeout(() => setBeatPulseSignal((n) => n + 1), 5200)

    return () => {
      clearTimeout(toastT)
      clearTimeout(pulseT)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isMobile || typeof sessionStorage === "undefined" || sessionStorage.getItem(BEATS_TIP_SEEN_KEY)) return
    const id = setTimeout(() => setHighlightBeatsTrigger(true), 0)
    return () => clearTimeout(id)
  }, [isMobile])

  useEffect(() => {
    if (!highlightBeatsTrigger) return
    const t = setTimeout(() => setHighlightBeatsTrigger(false), 8000)
    return () => clearTimeout(t)
  }, [highlightBeatsTrigger])

  const handleBulletClick = useCallback((index: number) => {
    const el = workspaceRef.current?.querySelector(`[data-anchor-for-bullet="${index}"]`)
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [])

  const handleAnchorClick = useCallback((index: number) => {
    const el = workspaceRef.current?.querySelector(`[data-bullet-index="${index}"]`)
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [])

  const handleBulletsDialogOpenChange = (open: boolean) => {
    setBulletsDialogOpen(open)
    if (open) {
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(BEATS_TIP_SEEN_KEY, "1")
      setHighlightBeatsTrigger(false)
    }
  }

  return (
    <motion.div
      key="editor"
      className="flex-1 flex flex-col min-h-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <EditorHeader
        onBack={warp.handleBackToLanding}
        wordCount={warp.wordCount}
        bulletCount={warp.bullets.length}
        highlightCount={warp.highlights.length}
        onOpenBullets={isMobile ? () => setBulletsDialogOpen(true) : undefined}
        highlightBeatsTrigger={isMobile && highlightBeatsTrigger}
      />

      <div
        ref={workspaceRef}
        className="flex-1 flex min-h-0 w-full relative"
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
          {isRefactoring ? (
            <div className="flex flex-col h-full min-h-0">
              <div className="shrink-0 h-[53px] border-b border-border/60" />
              <div className="flex-1 min-h-0 overflow-auto">
                <div className="p-4 sm:p-6 space-y-3 min-h-full">
                  {Array.from({ length: 22 }, (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-4 rounded bg-muted/80 animate-[pulse_1.25s_ease-in-out_infinite]",
                        i % 6 === 0 && "w-full",
                        i % 6 === 1 && "w-11/12",
                        i % 6 === 2 && "w-full",
                        i % 6 === 3 && "w-4/5",
                        i % 6 === 4 && "w-full",
                        i % 6 === 5 && "w-3/4"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <ChapterEditor
              text={warp.chapterText}
              onTextChange={warp.setChapterText}
              highlights={warp.highlights}
              onClearHighlights={warp.handleClearHighlights}
              bullets={warp.bullets}
              activeBulletIndex={warp.hoveredIndex}
              onBulletHover={warp.setHoveredIndex}
              onAnchorClick={handleAnchorClick}
            />
          )}
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
            onBulletClick={handleBulletClick}
            showTethers={warp.showTethers}
            onToggleTethers={() => warp.setShowTethers((v) => !v)}
            chapterText={warp.chapterText}
            onRemainingAttemptsChange={warp.setRemainingAttempts}
            onEditInstruction={onEditInstruction}
            isEditing={isEditing}
            editError={editError}
            onBeatsEdited={handleBeatsEdited}
            pulseSignal={beatPulseSignal}
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

      {isMobile && (
        <Dialog open={bulletsDialogOpen} onOpenChange={handleBulletsDialogOpenChange}>
          <DialogContent
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-50 max-w-none w-full h-full translate-x-0 translate-y-0 rounded-none border-0 flex flex-col gap-0 p-0"
            showCloseButton={true}
          >
            <DialogTitle className="sr-only">Structural beats</DialogTitle>
            <div className="flex-1 min-h-0 overflow-auto">
              <ScaffoldingSidebar
                bullets={warp.bullets}
                onBulletsChange={warp.setBullets}
                activeBulletIndex={warp.hoveredIndex}
                onBulletHover={warp.setHoveredIndex}
                showTethers={warp.showTethers}
                onToggleTethers={() => warp.setShowTethers((v) => !v)}
                chapterText={warp.chapterText}
                onRemainingAttemptsChange={warp.setRemainingAttempts}
                onBeatsEdited={handleBeatsEdited}
                pulseSignal={beatPulseSignal}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={limitModalOpen} onOpenChange={setLimitModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>You&apos;ve reached your rewrite limit</DialogTitle>
            <DialogDescription className="pt-1">
              You&apos;ve used all 5 of your free AI rewrites. You can still read,
              copy, and download your story.
            </DialogDescription>
          </DialogHeader>
          {countdown ? (
            <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-center space-y-0.5">
              <p className="text-2xl font-mono font-semibold tabular-nums tracking-tight">
                {countdown.hms}
              </p>
              <p className="text-xs text-muted-foreground">
                Resets at {countdown.exactTime}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Come back in 24 hours to run more rewrites.
            </p>
          )}
          <div className="space-y-2">
            <label htmlFor={emailInputId} className="text-sm font-medium">
              Get notified when we add more rewrites
            </label>
            {emailState === "done" ? (
              <p className="text-sm text-muted-foreground">You&apos;re on the list.</p>
            ) : (
              <form onSubmit={handleEmailSubmit} className="flex gap-2">
                <Input
                  id={emailInputId}
                  type="email"
                  placeholder="your@email.com"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  disabled={emailState === "submitting"}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!emailValue.trim() || emailState === "submitting"}
                >
                  {emailState === "submitting" ? "…" : "Notify me"}
                </Button>
              </form>
            )}
            {emailState === "error" && (
              <p className="text-xs text-destructive">Something went wrong. Try again.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitModalOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.6,
          duration: 0.5,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="sticky bottom-0 z-20 flex items-center justify-center px-4 py-5 sm:px-6"
      >
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/90 to-transparent pointer-events-none" />

        <div className="relative min-w-0 max-w-full flex flex-col items-center">
          {isRefactoring && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -inset-1.5 rounded-2xl overflow-hidden pointer-events-none"
            >
              <div
                className="h-full rounded-2xl transition-all duration-300"
                style={{
                  background: `linear-gradient(90deg, oklch(0.65 0.18 250 / 0.3) ${refactorProgress}%, transparent ${refactorProgress}%)`,
                }}
              />
            </motion.div>
          )}

          <div className="relative flex flex-col items-center">
            <TooltipProvider>
              <Tooltip
                onOpenChange={(open) => {
                  if (open && !isAtLimit && !isExhaustionError) {
                    tooltipPulseTimeoutRef.current = setTimeout(
                      () => setBeatPulseSignal((n) => n + 1),
                      600
                    )
                  } else {
                    if (tooltipPulseTimeoutRef.current) {
                      clearTimeout(tooltipPulseTimeoutRef.current)
                      tooltipPulseTimeoutRef.current = null
                    }
                  }
                }}
              >
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      size="lg"
                      onClick={onRefactor}
                      disabled={
                        isRefactoring ||
                        isAtLimit ||
                        isExhaustionError ||
                        warp.bullets.length === 0 ||
                        overHardLimit ||
                        (!beatsEdited && warp.bullets.length > 0)
                      }
                      className="relative bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-6 py-3 sm:px-8 text-sm font-medium shadow-[0_0_30px_oklch(0.65_0.18_250/0.25)] hover:shadow-[0_0_50px_oklch(0.65_0.18_250/0.4)] transition-all duration-300 rounded-xl min-h-12 h-12 gap-2.5 min-w-0 touch-manipulation"
                    >
                      {isRefactoring ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span>{refactorStepLabel || "Rewriting…"}</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="size-4" />
                          Rewrite Chapter
                        </>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {(isAtLimit || isExhaustionError) ? (
                  <TooltipContent side="top" sideOffset={8} className="max-w-[240px] text-center">
                    You&apos;ve used all 5 free rewrites. Sign up for updates or come back tomorrow.
                  </TooltipContent>
                ) : !beatsEdited && warp.bullets.length > 0 && !isRefactoring && !overHardLimit ? (
                  <TooltipContent side="top" sideOffset={8} className="max-w-[240px] text-center">
                    Change beats with a prompt, or reorder/delete one — then rewrite the chapter.
                  </TooltipContent>
                ) : null}
              </Tooltip>
            </TooltipProvider>
            <div className="mt-2 space-y-1 flex flex-col items-center text-center max-w-[min(100%,18rem)] sm:max-w-sm">
              {warp.bullets.length > 0 && !overHardLimit && (
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  Prompts perform micro-edits and update beats only. Rewrite replaces the full chapter text to match them.
                </p>
              )}
              {overHardLimit && (
                <p className="text-xs text-destructive">
                  This preview is for single chapters up to {HARD_WORD_LIMIT.toLocaleString()} words.
                  Please shorten or split your text.
                </p>
              )}
            </div>
            {refactorError && !isExhaustionError && (
              <p role="alert" className="mt-3 max-w-sm text-center text-sm text-destructive">
                {refactorError}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
