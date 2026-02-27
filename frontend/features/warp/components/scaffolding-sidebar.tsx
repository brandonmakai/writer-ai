"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence, Reorder } from "framer-motion"
import { GripVertical, Plus, X, Link2, Link2Off } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import type { StoryBullet } from "@/features/warp/types"
import { BEAT_TAG_COLORS } from "@/features/warp/types"

export type { StoryBullet }

interface ScaffoldingSidebarProps {
  bullets: StoryBullet[]
  onBulletsChange: (bullets: StoryBullet[]) => void
  activeBulletIndex?: number | null
  onBulletHover?: (index: number | null) => void
  showTethers?: boolean
  onToggleTethers?: () => void
}

function BulletCard({
  bullet,
  index,
  onUpdate,
  onDelete,
  highlighted,
  onBulletHover,
}: {
  bullet: StoryBullet
  index: number
  onUpdate: (id: string, field: "label" | "content", value: string) => void
  onDelete: (id: string) => void
  highlighted?: boolean
  onBulletHover?: (index: number | null) => void
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
      <div className="flex items-start gap-2.5 p-3.5">
        <div className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors touch-none">
          <GripVertical className="size-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
              style={{
                background: color.bg,
                color: color.text,
                border: `1px solid ${color.border}`,
              }}
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

export function ScaffoldingSidebar({
  bullets,
  onBulletsChange,
  activeBulletIndex,
  onBulletHover,
  showTethers = true,
  onToggleTethers,
}: ScaffoldingSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

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
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    }, 100)
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
          onReorder={onBulletsChange}
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
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </ScrollArea>

      <div className="flex-shrink-0 px-3 py-3 pt-0 space-y-2 border-t border-border/60">
        <Button
          variant="ghost"
          size="sm"
          onClick={addBullet}
          className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground border border-dashed border-border/40 hover:border-border/70 hover:bg-secondary/30 h-9 rounded-lg"
        >
          <Plus className="size-3 mr-1.5" />
          Add Structural Step
        </Button>
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
