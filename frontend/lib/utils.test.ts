import { describe, it, expect } from "vitest"
import { cn, splitParagraphs } from "./utils"

describe("cn", () => {
  it("merges multiple class strings", () => {
    expect(cn("a", "b")).toBe("a b")
  })

  it("merges tailwind classes correctly (later wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("handles undefined and conditional inputs", () => {
    expect(cn("base", undefined, false && "hidden", "visible")).toBe(
      "base visible"
    )
  })

  it("handles empty inputs", () => {
    expect(cn()).toBe("")
    expect(cn("")).toBe("")
  })
})

describe("splitParagraphs", () => {
  it("returns empty array for empty string", () => {
    expect(splitParagraphs("")).toEqual([])
  })

  it("returns single paragraph for text with no double newlines", () => {
    expect(splitParagraphs("One paragraph")).toEqual(["One paragraph"])
  })

  it("splits on double newlines", () => {
    expect(splitParagraphs("A\n\nB")).toEqual(["A", "B"])
  })

  it("filters out blank paragraphs", () => {
    expect(splitParagraphs("A\n\n\n\nB")).toEqual(["A", "B"])
    expect(splitParagraphs("  \n\n  \n\nOnly")).toEqual(["Only"])
  })

  it("trims whitespace per paragraph but keeps content", () => {
    expect(splitParagraphs("  First  \n\n  Second  ")).toEqual([
      "  First  ",
      "  Second  ",
    ])
  })

  it("handles multiple paragraphs", () => {
    expect(
      splitParagraphs("Intro.\n\nMiddle.\n\nEnd.")
    ).toEqual(["Intro.", "Middle.", "End."])
  })
})
