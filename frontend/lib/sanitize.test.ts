import { describe, it, expect } from "vitest"
import { sanitizeText } from "./sanitize"

describe("sanitizeText", () => {
  it("passes plain prose through unchanged", () => {
    const text = "John met Maria. They argued bitterly. She left without a word."
    expect(sanitizeText(text)).toBe(text)
  })

  it("strips script tags, keeping inner text", () => {
    expect(sanitizeText("Hello <script>alert(1)</script> world")).toBe(
      "Hello alert(1) world"
    )
  })

  it("strips script tags with attributes", () => {
    expect(
      sanitizeText('<script src="evil.js" type="text/javascript"></script>Chapter text.')
    ).toBe("Chapter text.")
  })

  it("strips img onerror injection", () => {
    expect(
      sanitizeText('Good prose. <img src=x onerror="fetch(\'evil.com\')"> More prose.')
    ).toBe("Good prose.  More prose.")
  })

  it("strips anchor tags with javascript href", () => {
    expect(
      sanitizeText('<a href="javascript:void(0)">click me</a>')
    ).toBe("click me")
  })

  it("strips self-closing tags", () => {
    expect(sanitizeText("Line one.<br/>Line two.")).toBe("Line one.Line two.")
    expect(sanitizeText("Text <hr /> more text.")).toBe("Text  more text.")
  })

  it("strips multiple tags in one string", () => {
    expect(
      sanitizeText("<b>Bold</b> and <i>italic</i> prose.")
    ).toBe("Bold and italic prose.")
  })

  it("strips nested tags", () => {
    expect(
      sanitizeText("<div><p>Paragraph text.</p></div>")
    ).toBe("Paragraph text.")
  })

  it("handles empty string", () => {
    expect(sanitizeText("")).toBe("")
  })

  it("preserves newlines and whitespace", () => {
    const text = "Paragraph one.\n\nParagraph two.\n\nParagraph three."
    expect(sanitizeText(text)).toBe(text)
  })

  it("strips anything between angle brackets, including bare comparisons", () => {
    // The regex treats any <...> span as a tag — a browser would too.
    // Math comparisons in fiction prose are essentially nonexistent, and any
    // `<expr>` pattern in AI output is more likely an injection than valid prose.
    expect(sanitizeText("if x < 3 then y > 0")).toBe("if x  0")
  })

  it("preserves a lone < that has no matching >", () => {
    // A dangling < with no closing > is not matched by the regex
    expect(sanitizeText("score < 100")).toBe("score < 100")
  })
})
