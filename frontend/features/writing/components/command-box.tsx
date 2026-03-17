"use client"

import { motion } from "framer-motion"
import { Sparkles, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CommandBoxProps {
  text: string
  onTextChange: (text: string) => void
  onAnalyze: () => void
  onTryExample: () => void
  isUnfolded: boolean
  isAnalyzing?: boolean
  analyzeError?: string | null
  remainingAttempts?: number | null
}

export function CommandBox({
  text,
  onTextChange,
  onAnalyze,
  onTryExample,
  isAnalyzing = false,
  analyzeError = null,
  remainingAttempts = null,
}: CommandBoxProps) {
  return (
    <motion.div
      layout
      className="w-full max-w-2xl min-w-0"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Branding */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8 text-center"
      >
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 border border-primary/20">
            <BookOpen className="size-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
            Writer AI
          </h1>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto text-pretty">
          Transform messy chapters into structured narratives.
          <br />
          Paste your text below and let the scaffolding reveal itself.
        </p>
      </motion.div>

      {/* Command Box with glow */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative group"
      >
        {/* Outer glow on focus */}
        <div
          className="absolute -inset-px rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-md pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.65 0.18 250 / 0.35), oklch(0.55 0.15 280 / 0.15), oklch(0.65 0.18 250 / 0.35))",
          }}
        />
        {/* Inner glow on focus */}
        <div
          className="absolute -inset-px rounded-xl opacity-0 group-focus-within:opacity-60 transition-opacity duration-500 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.65 0.18 250 / 0.12), transparent, oklch(0.65 0.18 250 / 0.12))",
          }}
        />

        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Paste your messy chapter here..."
            className="w-full bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 font-sans text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all duration-300 px-5 py-4 min-h-[180px]"
            rows={6}
          />
        </div>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="flex flex-col items-center gap-3 mt-5"
      >
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="default"
            onClick={onTryExample}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary/60 text-sm gap-1.5"
          >
            <Sparkles className="size-3.5" />
            Try an Example
          </Button>
          <Button
            onClick={onAnalyze}
            disabled={!text.trim() || isAnalyzing}
            size="default"
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed text-sm px-6 shadow-[0_0_24px_oklch(0.65_0.18_250_/_0.2)] hover:shadow-[0_0_32px_oklch(0.65_0.18_250_/_0.35)] transition-all duration-300"
          >
            {isAnalyzing ? "Analyzing…" : "Analyze Structure"}
          </Button>
        </div>
        {remainingAttempts !== null && (
          <p className="text-center text-xs text-muted-foreground">
            {remainingAttempts} attempt{remainingAttempts !== 1 ? "s" : ""} left
          </p>
        )}
        {analyzeError && (
          <p role="alert" className="text-center text-sm text-destructive">
            {analyzeError}
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}
