"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface TetherLine {
  index: number
  x1: number
  y1: number
  x2: number
  y2: number
}

interface TetherOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  bulletCount: number
  activeBulletIndex: number | null
  isRefactoring: boolean
  /** When false, overlay is not rendered. */
  showTethers: boolean
}

export function TetherOverlay({
  containerRef,
  bulletCount,
  activeBulletIndex,
  isRefactoring,
  showTethers,
}: TetherOverlayProps) {
  const [lines, setLines] = useState<TetherLine[]>([])
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const rafRef = useRef<number>(0)
  const svgRef = useRef<SVGSVGElement>(null)

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    setDims({ w: rect.width, h: rect.height })

    const newLines: TetherLine[] = []
    for (let i = 0; i < bulletCount; i++) {
      const anchorEl = container.querySelector(
        `[data-anchor-for-bullet="${i}"]`
      ) as HTMLElement | null
      const bulletEl = container.querySelector(
        `[data-bullet-index="${i}"]`
      ) as HTMLElement | null
      if (!anchorEl || !bulletEl) continue

      const aRect = anchorEl.getBoundingClientRect()
      const bRect = bulletEl.getBoundingClientRect()

      const x1 = aRect.right - rect.left
      const y1 = aRect.top + aRect.height / 2 - rect.top
      const x2 = bRect.left - rect.left
      const y2 = bRect.top + bRect.height / 2 - rect.top

      newLines.push({ index: i, x1, y1, x2, y2 })
    }

    setLines(newLines)
  }, [containerRef, bulletCount])

  useEffect(() => {
    const tick = () => {
      measure()
      rafRef.current = requestAnimationFrame(tick)
    }

    // Short delay for initial layout to settle
    const timer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick)
    }, 300)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(rafRef.current)
    }
  }, [measure])

  // Also remeasure when bullet count or active states change
  useEffect(() => {
    measure()
  }, [bulletCount, activeBulletIndex, measure])

  if (!showTethers || lines.length === 0 || dims.w === 0) return null

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none z-10"
      width={dims.w}
      height={dims.h}
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Base glow filter */}
        <filter id="tether-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Active glow filter */}
        <filter id="tether-glow-active" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Refactor vibration filter */}
        <filter id="tether-vibrate" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <AnimatePresence>
        {lines.map((line) => {
          const isActive = activeBulletIndex === line.index
          const midX = (line.x1 + line.x2) / 2

          // Cubic bezier control points for a smooth S-curve
          const cp1x = line.x1 + (midX - line.x1) * 0.7
          const cp1y = line.y1
          const cp2x = line.x2 - (line.x2 - midX) * 0.7
          const cp2y = line.y2

          const pathD = `M ${line.x1} ${line.y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${line.x2} ${line.y2}`

          const baseOpacity = isRefactoring ? 0.45 : isActive ? 0.65 : 0
          const strokeColor = isActive
            ? "oklch(0.75 0.14 250)"
            : isRefactoring
              ? "oklch(0.78 0.14 75)"
              : "oklch(0.65 0.14 250)"

          const filterUrl = isRefactoring
            ? "url(#tether-vibrate)"
            : isActive
              ? "url(#tether-glow-active)"
              : "url(#tether-glow)"

          return (
            <motion.path
              key={`tether-${line.index}`}
              d={pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isActive ? 1.8 : 1.2}
              strokeLinecap="round"
              filter={filterUrl}
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{
                opacity: baseOpacity,
                pathLength: 1,
                ...(isRefactoring
                  ? {
                      strokeWidth: [1.2, 2.2, 1.2],
                      opacity: [0.3, 0.6, 0.3],
                    }
                  : {}),
              }}
              exit={{ opacity: 0, pathLength: 0, transition: { duration: 0.4 } }}
              transition={
                isRefactoring
                  ? {
                      opacity: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
                      strokeWidth: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
                      pathLength: { duration: 0.6, ease: "easeOut" },
                    }
                  : {
                      opacity: { duration: 0.4 },
                      pathLength: { duration: 0.8, delay: line.index * 0.08, ease: "easeOut" },
                    }
              }
            />
          )
        })}
      </AnimatePresence>

      {/* Small dots at connection points */}
      <AnimatePresence>
        {lines.map((line) => {
          const isActive = activeBulletIndex === line.index

          return (
            <g key={`dots-${line.index}`}>
              {/* Left dot (anchor side) */}
              <motion.circle
                cx={line.x1}
                cy={line.y1}
                r={isActive ? 3 : 2}
                fill={
                  isRefactoring
                    ? "oklch(0.78 0.14 75)"
                    : isActive
                      ? "oklch(0.75 0.14 250)"
                      : "oklch(0.65 0.14 250)"
                }
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: isRefactoring ? 0.6 : isActive ? 0.7 : 0,
                  scale: 1,
                  ...(isRefactoring
                    ? { r: [2, 4, 2], opacity: [0.4, 0.8, 0.4] }
                    : {}),
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={
                  isRefactoring
                    ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.3, delay: line.index * 0.05 }
                }
              />
              {/* Right dot (bullet side) */}
              <motion.circle
                cx={line.x2}
                cy={line.y2}
                r={isActive ? 3 : 2}
                fill={
                  isRefactoring
                    ? "oklch(0.78 0.14 75)"
                    : isActive
                      ? "oklch(0.75 0.14 250)"
                      : "oklch(0.65 0.14 250)"
                }
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: isRefactoring ? 0.6 : isActive ? 0.7 : 0,
                  scale: 1,
                  ...(isRefactoring
                    ? { r: [2, 4, 2], opacity: [0.4, 0.8, 0.4] }
                    : {}),
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={
                  isRefactoring
                    ? { duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }
                    : { duration: 0.3, delay: line.index * 0.05 }
                }
              />
            </g>
          )
        })}
      </AnimatePresence>
    </svg>
  )
}
