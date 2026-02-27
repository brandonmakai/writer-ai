"use client"

import { motion } from "framer-motion"
import { CommandBox } from "./command-box"

interface LandingViewProps {
  chapterText: string
  onTextChange: (text: string) => void
  onAnalyze: () => void
  onTryExample: () => void
}

export function LandingView({
  chapterText,
  onTextChange,
  onAnalyze,
  onTryExample,
}: LandingViewProps) {
  return (
    <motion.div
      key="landing"
      className="flex-1 flex flex-col items-center justify-center px-4"
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
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
        onTextChange={onTextChange}
        onAnalyze={onAnalyze}
        onTryExample={onTryExample}
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
  )
}
