"use client"

import { useMemo, useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight } from "lucide-react"
import type { ChangeHighlight } from "@/lib/example-data"
import { getAnchorSegments } from "@/lib/anchor-segments"

interface HighlightedTextProps {
  text: string
  highlights: ChangeHighlight[]
  bullets: { anchor_text?: string }[]
  activeBulletIndex?: number | null
  onBulletHover?: (index: number | null) => void
}

interface TextSegment {
  text: string
  highlight: ChangeHighlight | null
}

function splitTextByHighlights(
  text: string,
  highlights: ChangeHighlight[]
): TextSegment[] {
  if (!highlights.length) return [{ text, highlight: null }]

  const sorted = [...highlights]
    .map((h) => ({ ...h, index: text.indexOf(h.updated) }))
    .filter((h) => h.index !== -1)
    .sort((a, b) => a.index - b.index)

  const segments: TextSegment[] = []
  let cursor = 0
  for (const h of sorted) {
    const pos = text.indexOf(h.updated, cursor)
    if (pos === -1) continue

    if (pos > cursor) {
      segments.push({ text: text.slice(cursor, pos), highlight: null })
    }
    segments.push({
      text: h.updated,
      highlight: { updated: h.updated, original: h.original },
    })
    cursor = pos + h.updated.length
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlight: null })
  }

  return segments.length > 0 ? segments : [{ text, highlight: null }]
}

function DiffPopup({
  highlight,
  anchorRect,
  containerRect,
}: {
  highlight: ChangeHighlight
  anchorRect: DOMRect
  containerRect: DOMRect
}) {
  const top = anchorRect.bottom - containerRect.top + 8
  let left = anchorRect.left - containerRect.left + anchorRect.width / 2
  const popupWidth = 320
  const maxLeft = containerRect.width - popupWidth / 2 - 16
  const minLeft = popupWidth / 2 + 16
  left = Math.max(minLeft, Math.min(maxLeft, left))

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="absolute z-50 pointer-events-none"
      style={{ top, left, transform: "translateX(-50%)" }}
    >
      <div className="flex justify-center mb-[-5px] relative z-10">
        <div
          className="size-2.5 rotate-45 border-t border-l"
          style={{
            background: "oklch(0.16 0.01 270)",
            borderColor: "oklch(0.72 0.17 162 / 0.3)",
          }}
        />
      </div>
      <div
        className="rounded-xl border shadow-2xl backdrop-blur-xl px-4 py-3.5 w-full max-w-[min(320px,calc(100vw-2rem))]"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.16 0.01 270 / 0.97), oklch(0.13 0.008 270 / 0.97))",
          borderColor: "oklch(0.72 0.17 162 / 0.2)",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.5), 0 0 20px oklch(0.72 0.17 162 / 0.06)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div
            className="size-1.5 rounded-full"
            style={{ background: "oklch(0.72 0.17 162)" }}
          />
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "oklch(0.72 0.17 162)" }}
          >
            AI Change
          </span>
        </div>
        <div className="mb-2.5">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 block mb-1">
            Original
          </span>
          <p
            className="text-[12px] leading-relaxed font-serif line-through decoration-muted-foreground/30"
            style={{ color: "oklch(0.6 0.02 270)" }}
          >
            {highlight.original}
          </p>
        </div>
        <div className="flex items-center gap-2 my-1.5">
          <div className="flex-1 h-px bg-border/40" />
          <ArrowRight
            className="size-3 shrink-0"
            style={{ color: "oklch(0.72 0.17 162)" }}
          />
          <div className="flex-1 h-px bg-border/40" />
        </div>
        <div className="mt-2.5">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50 block mb-1">
            Updated
          </span>
          <p
            className="text-[12px] leading-relaxed font-serif font-medium"
            style={{ color: "oklch(0.88 0.1 162)" }}
          >
            {highlight.updated}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function HighlightedSpan({
  highlight,
  index,
  onHover,
  onLeave,
}: {
  highlight: ChangeHighlight
  index: number
  onHover: (rect: DOMRect) => void
  onLeave: () => void
}) {
  const ref = useRef<HTMLSpanElement>(null)

  const handleMouseEnter = useCallback(() => {
    if (ref.current) {
      onHover(ref.current.getBoundingClientRect())
    }
  }, [onHover])

  return (
    <span
      ref={ref}
      data-change-highlight={index}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onLeave}
      className="relative cursor-help rounded-sm transition-colors duration-200"
      style={{
        background: "oklch(0.65 0.17 162 / 0.22)",
        color: "oklch(0.88 0.1 162)",
        padding: "1px 3px",
        margin: "0 -1px",
      }}
    >
      {highlight.updated}
    </span>
  )
}

export function HighlightedText({
  text,
  highlights,
  bullets,
  activeBulletIndex,
  onBulletHover,
}: HighlightedTextProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeHighlight, setActiveHighlight] = useState<{
    highlight: ChangeHighlight
    anchorRect: DOMRect
  } | null>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect())
      }
    }
    update()
    window.addEventListener("resize", update)
    const scrollEl = containerRef.current?.closest(
      "[data-radix-scroll-area-viewport]"
    )
    scrollEl?.addEventListener("scroll", update)
    return () => {
      window.removeEventListener("resize", update)
      scrollEl?.removeEventListener("scroll", update)
    }
  }, [])

  const anchorSegments = useMemo(
    () => getAnchorSegments(text, bullets),
    [text, bullets]
  )

  const handleHover = useCallback(
    (highlight: ChangeHighlight, rect: DOMRect) => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect())
      }
      setActiveHighlight({ highlight, anchorRect: rect })
    },
    []
  )

  const handleLeave = useCallback(() => {
    setActiveHighlight(null)
  }, [])

  let highlightCounter = 0

  return (
    <div ref={containerRef} className="relative">
      <div className="font-serif text-[15px] leading-[1.9] rounded-lg px-4 py-2 sm:px-3 sm:-mx-3 transition-all duration-300 whitespace-pre-wrap">
        {anchorSegments.map((seg, i) =>
          seg.type === "anchor" ? (
            <span
              key={`a-${seg.bulletIndex}-${i}`}
              data-anchor-for-bullet={seg.bulletIndex}
              onMouseEnter={() => onBulletHover?.(seg.bulletIndex)}
              onMouseLeave={() => onBulletHover?.(null)}
              className="rounded-sm transition-colors duration-200"
              style={{
                color:
                  activeBulletIndex === seg.bulletIndex
                    ? "oklch(0.95 0 0)"
                    : "oklch(0.85 0 0 / 0.9)",
                boxShadow:
                  activeBulletIndex === seg.bulletIndex
                    ? "0 0 20px oklch(0.65 0.18 250 / 0.1), inset 0 0 0 1px oklch(0.65 0.18 250 / 0.15)"
                    : "none",
                background:
                  activeBulletIndex === seg.bulletIndex
                    ? "oklch(0.65 0.18 250 / 0.04)"
                    : "transparent",
              }}
            >
              {splitTextByHighlights(seg.text, highlights).map((part, si) =>
                part.highlight ? (
                  <HighlightedSpan
                    key={`${i}-${si}`}
                    highlight={part.highlight}
                    index={highlightCounter++}
                    onHover={(rect) => handleHover(part.highlight!, rect)}
                    onLeave={handleLeave}
                  />
                ) : (
                  <span key={`${i}-${si}`}>{part.text}</span>
                )
              )}
            </span>
          ) : (
            <span key={`t-${i}`}>
              {splitTextByHighlights(seg.text, highlights).map((part, si) =>
                part.highlight ? (
                  <HighlightedSpan
                    key={`${i}-${si}`}
                    highlight={part.highlight}
                    index={highlightCounter++}
                    onHover={(rect) => handleHover(part.highlight!, rect)}
                    onLeave={handleLeave}
                  />
                ) : (
                  <span key={`${i}-${si}`}>{part.text}</span>
                )
              )}
            </span>
          )
        )}
      </div>

      <AnimatePresence>
        {activeHighlight && containerRect && (
          <DiffPopup
            key={activeHighlight.highlight.updated}
            highlight={activeHighlight.highlight}
            anchorRect={activeHighlight.anchorRect}
            containerRect={containerRect}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
