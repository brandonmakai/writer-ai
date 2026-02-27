/**
 * Splits chapter text into segments by bullet anchor_text.
 * Each anchor is the first occurrence of that verbatim sentence in the chapter.
 * Used for tether overlay: anchor segments get data-anchor-for-bullet and hover.
 */

export type AnchorSegment =
  | { type: "text"; text: string }
  | { type: "anchor"; text: string; bulletIndex: number }

export function getAnchorSegments(
  chapterText: string,
  bullets: { anchor_text?: string }[]
): AnchorSegment[] {
  const anchors: { start: number; end: number; bulletIndex: number }[] = []
  for (let i = 0; i < bullets.length; i++) {
    const anchor = bullets[i].anchor_text?.trim()
    if (!anchor) continue
    const start = chapterText.indexOf(anchor)
    if (start === -1) continue
    anchors.push({ start, end: start + anchor.length, bulletIndex: i })
  }
  anchors.sort((a, b) => a.start - b.start)

  const segments: AnchorSegment[] = []
  let cursor = 0
  for (const { start, end, bulletIndex } of anchors) {
    if (start > cursor) {
      segments.push({ type: "text", text: chapterText.slice(cursor, start) })
    }
    segments.push({
      type: "anchor",
      text: chapterText.slice(start, end),
      bulletIndex,
    })
    cursor = end
  }
  if (cursor < chapterText.length) {
    segments.push({ type: "text", text: chapterText.slice(cursor) })
  }
  return segments.length > 0 ? segments : [{ type: "text", text: chapterText }]
}
