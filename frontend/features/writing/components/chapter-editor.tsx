"use client"

import { useState, useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import posthog from "posthog-js"
import { Copy, Download, Check, Pen, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { HighlightedText } from "./highlighted-text"
import type { ChangeHighlight } from "@/lib/example-data"
import { getAnchorSegments } from "@/lib/anchor-segments"
import type { StoryBullet } from "@/features/writing/types"

interface ChapterEditorProps {
  text: string
  onTextChange: (text: string) => void
  highlights: ChangeHighlight[]
  onClearHighlights: () => void
  bullets: StoryBullet[]
  activeBulletIndex: number | null
  onBulletHover: (index: number | null) => void
  onAnchorClick?: (bulletIndex: number) => void
}

export function ChapterEditor({
  text,
  onTextChange,
  highlights,
  onClearHighlights,
  bullets,
  activeBulletIndex,
  onBulletHover,
  onAnchorClick,
}: ChapterEditorProps) {
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const hasHighlights = highlights.length > 0

  const paragraphs = useMemo(
    () => text.split("\n\n").filter((p) => p.trim().length > 0),
    [text]
  )

  const anchorSegments = useMemo(
    () => getAnchorSegments(text, bullets),
    [text, bullets]
  )
  const useAnchorView = bullets.some((b) => b.anchor_text?.trim())

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    posthog.capture("content_copied")
  }

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "chapter.txt"
    a.click()
    URL.revokeObjectURL(url)
    posthog.capture("content_downloaded")
  }

  const handleToggleEdit = useCallback(() => {
    if (!isEditing) {
      onClearHighlights()
    }
    setIsEditing((prev) => !prev)
  }, [isEditing, onClearHighlights])

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col h-full min-h-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6 border-b border-border/60 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-2 rounded-full bg-primary/60" />
          <h2 className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Chapter
          </h2>
          <span className="text-[10px] text-muted-foreground/40 ml-1">
            {text.split(/\s+/).filter(Boolean).length} words
          </span>
          {hasHighlights && !isEditing && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: "oklch(0.65 0.17 162 / 0.12)",
                color: "oklch(0.72 0.17 162)",
                border: "1px solid oklch(0.72 0.17 162 / 0.2)",
              }}
            >
              {highlights.length} changes
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleEdit}
            className="min-h-11 h-11 px-2.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 gap-1.5 touch-manipulation"
          >
            {isEditing ? (
              <>
                <Eye className="size-3" />
                View
              </>
            ) : (
              <>
                <Pen className="size-3" />
                Edit
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="min-h-11 h-11 px-2.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 gap-1.5 touch-manipulation"
          >
            {copied ? (
              <Check className="size-3 text-emerald-400" />
            ) : (
              <Copy className="size-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="min-h-11 h-11 px-2.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 gap-1.5 touch-manipulation"
          >
            <Download className="size-3" />
            Download
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isEditing ? (
          <div className="p-4 sm:p-6">
            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              className="w-full min-h-[calc(100vh-220px)] bg-transparent font-serif text-[15px] text-foreground/90 leading-[1.9] resize-none focus:outline-none"
              spellCheck={false}
              autoFocus
            />
          </div>
        ) : hasHighlights ? (
          <div className="p-4 sm:p-6">
            <HighlightedText
              text={text}
              highlights={highlights}
              bullets={bullets}
              activeBulletIndex={activeBulletIndex}
              onBulletHover={onBulletHover}
            />
          </div>
        ) : useAnchorView && anchorSegments.length > 0 ? (
          <div className="p-4 sm:p-6">
            <div className="font-serif text-[15px] leading-[1.9] rounded-lg px-4 py-2 sm:px-3 sm:-mx-3 transition-all duration-300 whitespace-pre-wrap">
              {anchorSegments.map((seg, i) =>
                seg.type === "anchor" ? (
                  <span
                    key={`a-${seg.bulletIndex}-${i}`}
                    data-anchor-for-bullet={seg.bulletIndex}
                    onMouseEnter={() => onBulletHover(seg.bulletIndex)}
                    onMouseLeave={() => onBulletHover(null)}
                    onClick={() => onAnchorClick?.(seg.bulletIndex)}
                    className="rounded-sm transition-colors duration-200 cursor-pointer"
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
                    {seg.text}
                  </span>
                ) : (
                  <span key={`t-${i}`}>{seg.text}</span>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            {paragraphs.length > 0 ? (
              paragraphs.map((para, i) => (
                <p
                  key={i}
                  className="mb-6 font-serif text-[15px] leading-[1.9] cursor-text rounded-lg px-4 py-2 sm:px-3 sm:-mx-3"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newParagraphs = [...paragraphs]
                    newParagraphs[i] = e.currentTarget.textContent || ""
                    onTextChange(newParagraphs.join("\n\n"))
                  }}
                >
                  {para}
                </p>
              ))
            ) : (
              <textarea
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                className="w-full h-full min-h-[calc(100vh-220px)] bg-transparent font-serif text-[15px] text-foreground/90 leading-[1.9] resize-none focus:outline-none placeholder:text-muted-foreground/40"
                placeholder="Your chapter text appears here. Edit freely..."
                spellCheck={false}
              />
            )}
          </div>
        )}
      </ScrollArea>
    </motion.div>
  )
}
