/**
 * Sanity tests for HighlightedText highlight rendering.
 *
 * Key scenario: after a micro-edit the backend returns change_highlights whose
 * `updated` text lands inside an anchor segment.  Before the fix, anchor
 * segments used an exact full-string match so those highlights were silently
 * dropped.  After the fix, splitTextByHighlights runs on every segment
 * (anchor or not) so the green span is always rendered.
 */

import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import { HighlightedText } from "./highlighted-text"

// framer-motion uses browser APIs not available in jsdom; replace with passthrough
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const chapterText =
  "She walked to the window. The rain had not stopped for three days."

const bullets = [
  { anchor_text: "She walked to the window." },
  { anchor_text: "The rain had not stopped for three days." },
]

describe("HighlightedText", () => {
  afterEach(() => cleanup())
  it("renders a highlighted span for text that falls inside an anchor segment", () => {
    // The updated text is a substring of the first anchor segment —
    // this is the exact scenario the fix addresses.
    const highlights = [
      { updated: "walked to the window", original: "moved toward the glass" },
    ]

    render(
      <HighlightedText
        text={chapterText}
        highlights={highlights}
        bullets={bullets}
      />
    )

    // The updated text should be present and wrapped in a highlighted span.
    const span = screen.getByText("walked to the window")
    expect(span.tagName).toBe("SPAN")
    // Green background applied via inline style
    expect(span.style.background).toContain("oklch")
    expect(span.style.color).toContain("oklch")
  })

  it("renders a highlighted span for text that falls in a non-anchor segment", () => {
    const chapterWithGap =
      "Preamble text before anchors. " + chapterText
    const highlightInGap = [
      { updated: "Preamble text before anchors", original: "Some old text here" },
    ]

    render(
      <HighlightedText
        text={chapterWithGap}
        highlights={highlightInGap}
        bullets={bullets}
      />
    )

    const span = screen.getByText("Preamble text before anchors")
    expect(span.tagName).toBe("SPAN")
    expect(span.style.background).toContain("oklch")
  })

  it("renders plain text with no highlighted spans when there are no highlights", () => {
    const { container } = render(
      <HighlightedText
        text={chapterText}
        highlights={[]}
        bullets={bullets}
      />
    )

    // Nothing inside this render should carry the green highlight background
    const greenSpans = Array.from(container.querySelectorAll("span[style]")).filter(
      (el) => (el as HTMLElement).style.background.includes("oklch(0.65 0.17 162")
    )
    expect(greenSpans).toHaveLength(0)
    // Both anchor texts render as plain text
    expect(within(container).getAllByText(/She walked to the window/)).toBeTruthy()
  })

  it("renders multiple highlights across both anchor and non-anchor segments", () => {
    const multi = [
      { updated: "walked to the window", original: "moved toward the glass" },
      { updated: "rain had not stopped", original: "downpour continued unabated" },
    ]

    const { container } = render(
      <HighlightedText
        text={chapterText}
        highlights={multi}
        bullets={bullets}
      />
    )

    const greenSpans = Array.from(container.querySelectorAll("span[style]")).filter(
      (el) => (el as HTMLElement).style.background.includes("oklch(0.65 0.17 162")
    )
    expect(greenSpans).toHaveLength(2)
    expect(greenSpans[0].textContent).toBe("walked to the window")
    expect(greenSpans[1].textContent).toBe("rain had not stopped")
  })
})
