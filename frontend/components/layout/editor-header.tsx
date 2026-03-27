"use client"

import { motion } from "framer-motion"
import { BookOpen, ArrowLeft, Sparkles, List } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EditorHeaderProps {
  onBack: () => void
  wordCount: number
  bulletCount: number
  highlightCount: number
  onOpenBullets?: () => void
  highlightBeatsTrigger?: boolean
}

export function EditorHeader({
  onBack,
  wordCount,
  bulletCount,
  highlightCount,
  onOpenBullets,
  highlightBeatsTrigger,
}: EditorHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 flex items-center gap-2 sm:gap-3 px-4 py-3 sm:px-5 border-b border-border/60 bg-card/40 backdrop-blur-xl min-w-0"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground min-h-11 h-11 px-2.5 gap-1.5 touch-manipulation"
        aria-label="Go back"
      >
        <ArrowLeft className="size-3.5" />
        <span className="text-xs hidden sm:inline">Back</span>
      </Button>

      <div className="h-4 w-px bg-border/60" />

      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center size-7 rounded-lg bg-primary/10 border border-primary/20">
          <BookOpen className="size-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Writer AI
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink-0">
        {onOpenBullets && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenBullets}
            className={cn(
              "min-h-11 h-11 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground touch-manipulation",
              highlightBeatsTrigger && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background animate-pulse"
            )}
            aria-label="Open structural beats"
          >
            <List className="size-4" />
            <span className="text-xs font-medium">Beats</span>
          </Button>
        )}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50 shrink-0">
          <span className="tabular-nums">{wordCount} words</span>
          <span className="hidden sm:inline text-border">|</span>
          <span className="hidden sm:inline tabular-nums">{bulletCount} beats</span>
          {highlightCount > 0 && (
            <>
              <span className="text-border">|</span>
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 tabular-nums"
                style={{ color: "oklch(0.78 0.14 75)" }}
              >
                {highlightCount} changes
              </motion.span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {highlightCount > 0 ? (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="size-1.5 rounded-full"
                style={{ background: "oklch(0.78 0.14 75)" }}
              />
              <span
                className="text-[11px] font-medium"
                style={{ color: "oklch(0.78 0.14 75)" }}
              >
                Rewritten
              </span>
            </>
          ) : (
            <>
              <Sparkles className="size-3 text-emerald-400/70" />
              <span className="text-[11px] text-emerald-400/70 font-medium">
                Ready
              </span>
            </>
          )}
        </div>
      </div>
    </motion.header>
  )
}
