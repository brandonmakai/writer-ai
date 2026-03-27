"use client"

import { useState, useRef, useEffect, KeyboardEvent } from "react"
import { motion, AnimatePresence, Reorder } from "framer-motion"
import { GripVertical, X, Link2, Link2Off, ArrowUp, Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import type { StoryBullet } from "@/features/writing/types"
import { BEAT_TAG_COLORS } from "@/features/writing/types"
import { fetchOutline } from "@/lib/api"

export type { StoryBullet }

interface ScaffoldingSidebarProps {
  bullets: StoryBullet[]
  onBulletsChange: (bullets: StoryBullet[]) => void
  activeBulletIndex?: number | null
  onBulletHover?: (index: number | null) => void
  onBulletClick?: (index: number) => void
  showTethers?: boolean
  onToggleTethers?: () => void
  chapterText?: string
  onRemainingAttemptsChange?: (n: number | null) => void
  onEditInstruction?: (instruction: string) => void
  isEditing?: boolean
  editError?: string | null
  onBeatsEdited?: () => void
  pulseSignal?: number
}

function BulletCard({
  bullet,
  index,
  onUpdate,
  onDelete,
  highlighted,
  onBulletHover,
  onBulletClick,
  pulsing = false,
}: {
  bullet: StoryBullet
  index: number
  onUpdate: (id: string, field: "label" | "content", value: string) => void
  onDelete: (id: string) => void
  highlighted?: boolean
  onBulletHover?: (index: number | null) => void
  onBulletClick?: (index: number) => void
  pulsing?: boolean
}) {
  const [isFocused, setIsFocused] = useState(false)
  const color = BEAT_TAG_COLORS[index % BEAT_TAG_COLORS.length]

  return (
    <Reorder.Item
      value={bullet}
      id={bullet.id}
      data-bullet-index={index}
      onMouseEnter={() => onBulletHover?.(index)}
      onMouseLeave={() => onBulletHover?.(null)}
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: highlighted ? 1.05 : 1,
      }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{
        opacity: { duration: 0.3, delay: index * 0.04 },
        y: { duration: 0.3, delay: index * 0.04 },
        scale: { duration: 0.2, ease: "easeOut" },
      }}
      whileDrag={{
        scale: 1.03,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(100,140,255,0.2)",
        zIndex: 50,
      }}
      className={`group relative rounded-xl border backdrop-blur-md transition-colors duration-200 cursor-default ${
        isFocused
          ? "border-primary/30 shadow-[0_0_20px_oklch(0.65_0.18_250_/_0.1)]"
          : "border-border/40 hover:border-border/70"
      }`}
      style={{
        background: isFocused
          ? "linear-gradient(135deg, rgba(100,140,255,0.06), rgba(30,30,50,0.6))"
          : "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
      }}
    >
      {pulsing && (
        <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary/50 animate-[pulse_1s_ease-in-out_3]" />
      )}
      <div className="flex items-start gap-2.5 p-3.5">
        <div className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors touch-none">
          <GripVertical className="size-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              onClick={() => onBulletClick?.(index)}
              className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                background: color.bg,
                color: color.text,
                border: `1px solid ${color.border}`,
              }}
              title="Scroll to anchor"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <input
              value={bullet.label}
              onChange={(e) => onUpdate(bullet.id, "label", e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="flex-1 bg-transparent text-xs font-medium text-foreground/80 focus:text-foreground focus:outline-none placeholder:text-muted-foreground/40 truncate"
              placeholder="Beat label..."
            />
          </div>
          <textarea
            value={bullet.content}
            onChange={(e) => onUpdate(bullet.id, "content", e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            rows={2}
            className="w-full bg-transparent text-[11px] text-muted-foreground leading-relaxed resize-none focus:outline-none focus:text-foreground/70 placeholder:text-muted-foreground/30"
            placeholder="Describe what happens in this beat..."
          />
        </div>

        <button
          onClick={() => onDelete(bullet.id)}
          className="mt-0.5 size-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60 transition-all duration-200"
          aria-label={`Delete beat ${index + 1}`}
        >
          <X className="size-3" />
        </button>
      </div>
    </Reorder.Item>
  )
}

function BeatAgentBox({
  bullets,
  chapterText,
  onBulletsChange,
  onRemainingAttemptsChange,
  onEditInstruction,
  isEditing = false,
  editError = null,
  onBeatsEdited,
}: {
  bullets: StoryBullet[]
  chapterText?: string
  onBulletsChange: (bullets: StoryBullet[]) => void
  onRemainingAttemptsChange?: (n: number | null) => void
  onEditInstruction?: (instruction: string) => void
  isEditing?: boolean
  editError?: string | null
  onBeatsEdited?: () => void
}) {
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // When beats already exist, use the micro-edit endpoint; otherwise generate beats from scratch
  const hasBeats = bullets.length > 0
  const isBusy = hasBeats ? isEditing : isGenerating
  const canSubmit = prompt.trim().length > 0 && !!chapterText?.trim() && !isBusy

  const handleSubmit = async () => {
    if (!canSubmit) return
    if (error) setError(null)

    if (hasBeats && onEditInstruction) {
      // Micro-edit: delegate to parent hook (handles state + API call)
      onEditInstruction(prompt.trim())
      onBeatsEdited?.()
      setPrompt("")
      return
    }

    // No beats yet: generate beats from scratch via outline API
    setIsGenerating(true)
    setError(null)
    try {
      const { outline, remainingAttempts } = await fetchOutline({
        chapter: { text: chapterText!.trim(), tone: prompt.trim() },
      })
      const mapped: StoryBullet[] = outline.bullets.map((b, i) => ({
        id: crypto.randomUUID(),
        label: `Beat ${i + 1}`,
        content: b.content,
        anchor_text: b.anchor_text,
      }))
      onBulletsChange(mapped)
      onRemainingAttemptsChange?.(remainingAttempts)
      setPrompt("")
      textareaRef.current?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-1.5">
      <div
        className={`relative rounded-xl border transition-all duration-200 ${
          error
            ? "border-destructive/60"
            : "border-border/70 hover:border-border focus-within:border-primary/60 focus-within:shadow-[0_0_16px_oklch(0.65_0.18_250_/_0.12)]"
        }`}
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04))",
        }}
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={handleKeyDown}
          disabled={isBusy}
          rows={3}
          placeholder={
            !chapterText?.trim()
              ? "Paste a chapter first to generate beats"
              : hasBeats
              ? "Describe a change to apply…"
              : "Describe the beats you want to generate…"
          }
          className="w-full bg-transparent text-[12px] text-foreground/80 placeholder:text-muted-foreground/55 leading-relaxed resize-none focus:outline-none px-3 pt-3 pb-9 disabled:opacity-50"
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground/50 select-none">↵ {hasBeats ? "edit" : "generate"}</span>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center justify-center size-6 rounded-md bg-primary/80 hover:bg-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-primary-foreground"
            aria-label={hasBeats ? "Apply edit" : "Generate beats"}
          >
            {isBusy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ArrowUp className="size-3" />
            )}
          </button>
        </div>
      </div>
      {(error || (hasBeats && editError)) && (
        <p role="alert" className="text-[10px] text-destructive px-1">
          {error || editError}
        </p>
      )}
    </div>
  )
}

export function ScaffoldingSidebar({
  bullets,
  onBulletsChange,
  activeBulletIndex,
  onBulletHover,
  onBulletClick,
  showTethers = true,
  onToggleTethers,
  chapterText,
  onRemainingAttemptsChange,
  onEditInstruction,
  isEditing = false,
  editError = null,
  onBeatsEdited,
  pulseSignal = 0,
}: ScaffoldingSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pulsingFirstBeat, setPulsingFirstBeat] = useState(false)

  // Pulse the first beat when the parent signals it — initial onboarding and tooltip hover.
  // EditorView owns all pulse timing so the sequence (toast → pulse) stays coordinated.
  useEffect(() => {
    if (!pulseSignal) return
    const t1 = setTimeout(() => setPulsingFirstBeat(true), 0)
    const t2 = setTimeout(() => setPulsingFirstBeat(false), 3200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [pulseSignal])

  const updateBullet = (
    id: string,
    field: "label" | "content",
    value: string
  ) => {
    onBulletsChange(
      bullets.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    )
    onBeatsEdited?.()
  }

  const deleteBullet = (id: string) => {
    onBulletsChange(bullets.filter((b) => b.id !== id))
    onBeatsEdited?.()
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col h-full min-h-0 border-l border-border/60"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 100%)",
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-emerald-500/60" />
          <h2 className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Structural Scaffolding
          </h2>
        </div>
        <span className="text-[10px] font-medium text-muted-foreground/50 tabular-nums">
          {bullets.length} beats
        </span>
      </div>

      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <Reorder.Group
          axis="y"
          values={bullets}
          onReorder={(newBullets) => {
            onBulletsChange(newBullets)
            onBeatsEdited?.()
          }}
          className="flex flex-col gap-2.5 p-3"
        >
          <AnimatePresence initial={false}>
            {bullets.map((bullet, index) => (
              <BulletCard
                key={bullet.id}
                bullet={bullet}
                index={index}
                onUpdate={updateBullet}
                onDelete={deleteBullet}
                highlighted={activeBulletIndex === index}
                onBulletHover={onBulletHover}
                onBulletClick={onBulletClick}
                pulsing={index === 0 && pulsingFirstBeat}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </ScrollArea>

      <div className="flex-shrink-0 px-3 py-3 pt-3 space-y-2 border-t border-border/60">
        <BeatAgentBox
          bullets={bullets}
          chapterText={chapterText}
          onBulletsChange={(newBullets) => {
            onBulletsChange(newBullets)
            setTimeout(() => {
              scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
            }, 100)
          }}
          onRemainingAttemptsChange={onRemainingAttemptsChange}
          onEditInstruction={onEditInstruction}
          isEditing={isEditing}
          editError={editError}
          onBeatsEdited={onBeatsEdited}
        />
        {onToggleTethers && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleTethers}
            className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground border border-border/40 hover:border-border/70 hover:bg-secondary/30 h-9 rounded-lg gap-1.5"
          >
            {showTethers ? (
              <>
                <Link2Off className="size-3" />
                Hide connection lines
              </>
            ) : (
              <>
                <Link2 className="size-3" />
                Show connection lines
              </>
            )}
          </Button>
        )}
      </div>
    </motion.div>
  )
}
