"use client"

import { useState } from "react"
import { motion, Reorder, AnimatePresence } from "framer-motion"
import { GripHorizontal, X, Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { StoryBullet } from "@/components/plotflow/scaffolding-sidebar"

const tagColors = [
  { bg: "rgba(100,140,255,0.15)", text: "oklch(0.75 0.14 250)", border: "rgba(100,140,255,0.25)" },
  { bg: "rgba(52,211,153,0.15)", text: "oklch(0.75 0.17 162)", border: "rgba(52,211,153,0.25)" },
  { bg: "rgba(251,191,36,0.15)", text: "oklch(0.80 0.16 80)", border: "rgba(251,191,36,0.25)" },
  { bg: "rgba(251,113,133,0.15)", text: "oklch(0.73 0.18 15)", border: "rgba(251,113,133,0.25)" },
  { bg: "rgba(34,211,238,0.15)", text: "oklch(0.78 0.12 200)", border: "rgba(34,211,238,0.25)" },
]

interface TriageViewProps {
  bullets: StoryBullet[]
  onBulletsChange: (bullets: StoryBullet[]) => void
  onWeave: () => void
}

function TriageCard({
  bullet,
  index,
  onUpdate,
  onDelete,
}: {
  bullet: StoryBullet
  index: number
  onUpdate: (id: string, field: "label" | "content", value: string) => void
  onDelete: (id: string) => void
}) {
  const [isFocused, setIsFocused] = useState(false)
  const color = tagColors[index % tagColors.length]

  return (
    <Reorder.Item
      value={bullet}
      id={bullet.id}
      layoutId={`triage-card-${bullet.id}`}
      initial={{ opacity: 0, x: 40, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileDrag={{
        scale: 1.05,
        rotate: 1,
        boxShadow:
          "0 24px 70px rgba(0,0,0,0.55), 0 0 50px rgba(100,140,255,0.2), 0 0 0 1px rgba(100,140,255,0.35)",
        zIndex: 50,
      }}
      className={`group relative flex-shrink-0 w-[280px] rounded-2xl border backdrop-blur-xl transition-all duration-300 cursor-default ${
        isFocused
          ? "border-primary/40 shadow-[0_0_35px_oklch(0.65_0.18_250_/_0.18)]"
          : "border-[rgba(100,140,255,0.12)] hover:border-[rgba(100,140,255,0.25)]"
      }`}
      style={{
        background: isFocused
          ? "linear-gradient(160deg, rgba(100,140,255,0.10) 0%, rgba(30,30,50,0.75) 50%, rgba(20,20,40,0.85) 100%)"
          : "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 50%, rgba(100,140,255,0.03) 100%)",
        boxShadow: isFocused
          ? "0 0 35px oklch(0.65 0.18 250 / 0.14), inset 0 1px 0 rgba(255,255,255,0.05)"
          : "0 0 18px rgba(100,140,255,0.05), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div className="flex flex-col p-5 h-full">
        {/* Top row: badge + delete */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg"
            style={{
              background: color.bg,
              color: color.text,
              border: `1px solid ${color.border}`,
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <button
            onClick={() => onDelete(bullet.id)}
            className="size-6 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60 transition-all duration-200"
            aria-label={`Delete beat ${index + 1}`}
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Label */}
        <input
          value={bullet.label}
          onChange={(e) => onUpdate(bullet.id, "label", e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="bg-transparent text-sm font-semibold text-foreground/90 focus:text-foreground focus:outline-none placeholder:text-muted-foreground/40 mb-2.5 truncate"
          placeholder="Beat label..."
        />

        {/* Content */}
        <textarea
          value={bullet.content}
          onChange={(e) => onUpdate(bullet.id, "content", e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          rows={4}
          className="flex-1 w-full bg-transparent text-xs text-muted-foreground/80 leading-relaxed resize-none focus:outline-none focus:text-foreground/70 placeholder:text-muted-foreground/30"
          placeholder="Describe this beat..."
        />

        {/* Drag handle at bottom */}
        <div className="flex items-center justify-center pt-3 mt-auto cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors touch-none">
          <GripHorizontal className="size-4" />
        </div>
      </div>
    </Reorder.Item>
  )
}

export function TriageView({
  bullets,
  onBulletsChange,
  onWeave,
}: TriageViewProps) {
  const updateBullet = (
    id: string,
    field: "label" | "content",
    value: string
  ) => {
    onBulletsChange(
      bullets.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    )
  }

  const deleteBullet = (id: string) => {
    onBulletsChange(bullets.filter((b) => b.id !== id))
  }

  const addBullet = () => {
    onBulletsChange([
      ...bullets,
      {
        id: crypto.randomUUID(),
        label: "",
        content: "",
      },
    ])
  }

  return (
    <motion.div
      key="triage"
      className="flex-1 flex flex-col min-h-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      transition={{ duration: 0.5 }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[800px] h-[500px] rounded-full opacity-[0.03] blur-[120px]"
          style={{ background: "oklch(0.65 0.18 250)" }}
        />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="text-center pt-10 pb-8 px-4 flex-shrink-0"
      >
        <h2 className="text-xl font-semibold tracking-tight text-foreground text-balance">
          The Threads of Your Story
        </h2>
        <p className="mt-2 text-sm text-muted-foreground/60 max-w-md mx-auto text-pretty">
          These are the structural beats we found. Drag to reorder, edit to
          refine, or remove what doesn{"'"}t belong.
        </p>
      </motion.div>

      {/* Horizontal scrolling card strip */}
      <div className="flex-1 flex items-center min-h-0 min-w-0">
        <div className="w-full overflow-x-auto overflow-y-hidden scrollbar-thin px-6">
          <Reorder.Group
            axis="x"
            values={bullets}
            onReorder={onBulletsChange}
            className="flex items-stretch gap-4 py-4"
            style={{
              paddingLeft: `max(1.5rem, calc((100% - ${bullets.length * 280 + (bullets.length - 1) * 16}px) / 2))`,
              paddingRight: `max(1.5rem, calc((100% - ${bullets.length * 280 + (bullets.length - 1) * 16}px) / 2))`,
            }}
          >
            <AnimatePresence initial={false}>
              {bullets.map((bullet, index) => (
                <TriageCard
                  key={bullet.id}
                  bullet={bullet}
                  index={index}
                  onUpdate={updateBullet}
                  onDelete={deleteBullet}
                />
              ))}
            </AnimatePresence>

            {/* Inline add button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: bullets.length * 0.07 + 0.3 }}
              className="flex-shrink-0"
            >
              <button
                onClick={addBullet}
                className="w-[280px] h-full min-h-[200px] flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/30 hover:border-border/60 text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-secondary/10 transition-all duration-300"
              >
                <Plus className="size-5" />
                <span className="text-xs font-medium">Add Step</span>
              </button>
            </motion.div>
          </Reorder.Group>
        </div>
      </div>

      {/* CTA + subtext */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col items-center pb-8 pt-4 flex-shrink-0"
      >
        <Button
          size="lg"
          onClick={onWeave}
          disabled={bullets.length === 0}
          className="relative bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 text-sm font-medium px-8 h-12 rounded-xl gap-2 shadow-[0_0_40px_oklch(0.65_0.18_250_/_0.3)] hover:shadow-[0_0_60px_oklch(0.65_0.18_250_/_0.45)] transition-all duration-300"
        >
          <Sparkles className="size-4" />
          Looks Good, Weave Prose
        </Button>
        <p className="mt-3 text-[11px] text-muted-foreground/40 text-center max-w-xs text-pretty">
          Reorder or edit these steps to change your chapter{"'"}s DNA.
        </p>
      </motion.div>
    </motion.div>
  )
}
