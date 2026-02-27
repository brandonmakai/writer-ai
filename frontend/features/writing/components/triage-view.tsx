"use client"

import { useState, useCallback } from "react"
import { motion, Reorder, AnimatePresence } from "framer-motion"
import { GripHorizontal, X, Plus, Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { StoryBullet } from "@/features/writing/types"
import { BEAT_TAG_COLORS_TRIAGE } from "@/features/writing/types"

interface TriageViewProps {
  bullets: StoryBullet[]
  onBulletsChange: (bullets: StoryBullet[]) => void
  onWeave: () => void
  suggestedBulletId: string | null
  onSuggestedChange?: (id: string) => void
}

const tagColors = BEAT_TAG_COLORS_TRIAGE

function TriageCard({
  bullet,
  index,
  onUpdate,
  onDelete,
  asReorderItem = true,
}: {
  bullet: StoryBullet
  index: number
  onUpdate: (id: string, field: "label" | "content", value: string) => void
  onDelete: (id: string) => void
  asReorderItem?: boolean
}) {
  const [isFocused, setIsFocused] = useState(false)
  const color = tagColors[index % tagColors.length]

  const cardContent = (
    <div className="flex flex-col p-5 h-full">
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
      <input
        value={bullet.label}
        onChange={(e) => onUpdate(bullet.id, "label", e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="bg-transparent text-sm font-semibold text-foreground/90 focus:text-foreground focus:outline-none placeholder:text-muted-foreground/40 mb-2.5 truncate"
        placeholder="Beat label..."
      />
      <textarea
        value={bullet.content}
        onChange={(e) => onUpdate(bullet.id, "content", e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        rows={4}
        className="flex-1 w-full bg-transparent text-xs text-muted-foreground/80 leading-relaxed resize-none focus:outline-none focus:text-foreground/70 placeholder:text-muted-foreground/30"
        placeholder="Describe this beat..."
      />
      {asReorderItem && (
        <div className="flex items-center justify-center pt-3 mt-auto cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors touch-none">
          <GripHorizontal className="size-4" />
        </div>
      )}
    </div>
  )

  const className = `group relative flex-shrink-0 w-[280px] rounded-2xl border backdrop-blur-xl transition-all duration-300 cursor-default ${
    isFocused
      ? "border-primary/40 shadow-[0_0_35px_oklch(0.65_0.18_250_/_0.18)]"
      : "border-[rgba(100,140,255,0.12)] hover:border-[rgba(100,140,255,0.25)]"
  }`
  const style = {
    background: isFocused
      ? "linear-gradient(160deg, rgba(100,140,255,0.10) 0%, rgba(30,30,50,0.75) 50%, rgba(20,20,40,0.85) 100%)"
      : "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 50%, rgba(100,140,255,0.03) 100%)",
    boxShadow: isFocused
      ? "0 0 35px oklch(0.65 0.18 250 / 0.14), inset 0 1px 0 rgba(255,255,255,0.05)"
      : "0 0 18px rgba(100,140,255,0.05), inset 0 1px 0 rgba(255,255,255,0.03)",
  }

  if (asReorderItem) {
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
        className={className}
        style={style}
      >
        {cardContent}
      </Reorder.Item>
    )
  }

  return (
    <motion.div
      layoutId={`triage-card-${bullet.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      style={style}
    >
      {cardContent}
    </motion.div>
  )
}

export function TriageView({
  bullets,
  onBulletsChange,
  onWeave,
  suggestedBulletId,
  onSuggestedChange,
}: TriageViewProps) {
  const [hasEdited, setHasEdited] = useState(false)
  const [otherBeatsExpanded, setOtherBeatsExpanded] = useState(false)

  const markEdited = useCallback(() => {
    setHasEdited(true)
  }, [])

  const updateBullet = useCallback(
    (id: string, field: "label" | "content", value: string) => {
      markEdited()
      onBulletsChange(
        bullets.map((b) => (b.id === id ? { ...b, [field]: value } : b))
      )
    },
    [bullets, onBulletsChange, markEdited]
  )

  const deleteBullet = useCallback(
    (id: string) => {
      markEdited()
      onBulletsChange(bullets.filter((b) => b.id !== id))
    },
    [bullets, onBulletsChange, markEdited]
  )

  const addBullet = useCallback(() => {
    markEdited()
    onBulletsChange([
      ...bullets,
      {
        id: crypto.randomUUID(),
        label: "",
        content: "",
      },
    ])
  }, [bullets, onBulletsChange, markEdited])

  const suggestedBullet =
    bullets.find((b) => b.id === suggestedBulletId) ?? bullets[0] ?? null
  const suggestedIndex = suggestedBullet
    ? bullets.findIndex((b) => b.id === suggestedBullet.id)
    : -1
  const otherBullets = suggestedBullet
    ? bullets.filter((b) => b.id !== suggestedBullet.id)
    : bullets

  return (
    <motion.div
      key="triage"
      className="flex-1 flex flex-col min-h-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      transition={{ duration: 0.5 }}
    >
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[800px] h-[500px] rounded-full opacity-[0.03] blur-[120px]"
          style={{ background: "oklch(0.65 0.18 250)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 text-center pt-10 pb-4 px-4 sm:px-6 flex-shrink-0"
      >
        <h2 className="text-xl font-semibold tracking-tight text-foreground text-balance">
          The Threads of Your Story
        </h2>
        <p className="mt-2 text-sm text-muted-foreground/60 max-w-md mx-auto text-pretty">
          We found {bullets.length} structural beat{bullets.length !== 1 ? "s" : ""}.
        </p>
      </motion.div>

      <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 flex flex-col items-center min-h-0 w-full min-w-0">
        {suggestedBullet && (
          <>
            <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">
              Suggested edit
            </p>
            <div className="flex justify-center mb-6">
              <TriageCard
                bullet={suggestedBullet}
                index={suggestedIndex}
                onUpdate={updateBullet}
                onDelete={deleteBullet}
                asReorderItem={false}
              />
            </div>
          </>
        )}

        {otherBullets.length > 0 && (
          <div className="w-full max-w-2xl min-w-0">
            <button
              type="button"
              onClick={() => setOtherBeatsExpanded((e) => !e)}
              className="flex items-center gap-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground/80 transition-colors"
            >
              {otherBeatsExpanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
              Other beats ({otherBullets.length})
            </button>
            <AnimatePresence initial={false}>
              {otherBeatsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <Reorder.Group
                    axis="y"
                    values={otherBullets}
                    onReorder={(newOthers) => {
                      markEdited()
                      if (!suggestedBullet) {
                        onBulletsChange(newOthers)
                        return
                      }
                      const idx = bullets.findIndex((b) => b.id === suggestedBullet.id)
                      const full = [...newOthers]
                      full.splice(idx, 0, suggestedBullet)
                      onBulletsChange(full)
                    }}
                    className="flex flex-col gap-3 py-3"
                  >
                    {otherBullets.map((bullet) => {
                      const globalIndex = bullets.findIndex((b) => b.id === bullet.id)
                      return (
                        <Reorder.Item
                          key={bullet.id}
                          value={bullet}
                          id={bullet.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border border-border/50 bg-secondary/20 p-3"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 w-full sm:flex-1">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex-shrink-0"
                              style={{
                                background: tagColors[globalIndex % tagColors.length].bg,
                                color: tagColors[globalIndex % tagColors.length].text,
                                border: `1px solid ${tagColors[globalIndex % tagColors.length].border}`,
                                padding: "4px 8px",
                                borderRadius: "6px",
                              }}
                            >
                              {String(globalIndex + 1).padStart(2, "0")}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground/90 truncate">
                                {bullet.label || "Untitled beat"}
                              </div>
                              <div className="text-xs text-muted-foreground/70 line-clamp-2 sm:line-clamp-1">
                                {bullet.content || "—"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end sm:justify-start gap-1.5 flex-shrink-0">
                            {onSuggestedChange && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs min-h-9 touch-manipulation"
                                onClick={() => onSuggestedChange(bullet.id)}
                              >
                                <span className="sm:hidden">Set</span>
                                <span className="hidden sm:inline">Set as suggested</span>
                              </Button>
                            )}
                            <button
                              onClick={() => deleteBullet(bullet.id)}
                              className="size-9 sm:size-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60 flex-shrink-0 touch-manipulation"
                              aria-label="Delete beat"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        </Reorder.Item>
                      )
                    })}
                  </Reorder.Group>
                  <button
                    onClick={addBullet}
                    className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/30 hover:border-border/60 text-muted-foreground/50 hover:text-muted-foreground/80 hover:bg-secondary/10 transition-all text-sm"
                  >
                    <Plus className="size-4" />
                    Add structural step
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {bullets.length === 0 && (
          <button
            onClick={addBullet}
            className="py-6 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/30 hover:border-border/60 text-muted-foreground/40 hover:text-muted-foreground/60 w-full max-w-[280px]"
          >
            <Plus className="size-5" />
            <span className="text-sm font-medium">Add first beat</span>
          </button>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center pb-8 pt-4 px-4 sm:px-6 flex-shrink-0"
      >
        {hasEdited ? (
          <Button
            size="lg"
            onClick={onWeave}
            disabled={bullets.length === 0}
            className="relative bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 text-sm font-medium px-8 h-12 rounded-xl gap-2 shadow-[0_0_40px_oklch(0.65_0.18_250_/_0.3)] hover:shadow-[0_0_60px_oklch(0.65_0.18_250_/_0.45)] transition-all duration-300"
          >
            <Sparkles className="size-4" />
            Looks Good, Weave Prose
          </Button>
        ) : (
          <Button
            size="lg"
            variant="secondary"
            onClick={onWeave}
            disabled={bullets.length === 0}
            className="text-sm font-medium px-8 h-12 rounded-xl gap-2 disabled:opacity-30"
          >
            Skip
          </Button>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground/40 text-center max-w-xs text-pretty">
          {hasEdited
            ? "Reorder or edit these steps to change your chapter's DNA."
            : "No edits yet — skip to weave, or edit the suggested beat above."}
        </p>
      </motion.div>
    </motion.div>
  )
}
