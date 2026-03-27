import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchOutline, fetchRewrite, fetchEdit } from "./api"

describe("fetchOutline", () => {
  const mockFetch = vi.fn()
  const outlineUrl = "/api/v1/chapter/outline"

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
  })

  it("POSTs to outline endpoint with chapter body and returns parsed response", async () => {
    const body = { chapter: { text: "Chapter one." } }
    const resBody = {
      bullets: [
        { content: "Beat 1", anchor_text: "Chapter one." },
        { content: "Beat 2", anchor_text: "Next." },
        { content: "Beat 3", anchor_text: "End." },
      ],
      suggested_index: 1,
    }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(resBody), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Remaining-Attempts": "4",
        },
      })
    )

    const result = await fetchOutline(body)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(outlineUrl),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    )
    expect(result.outline).toEqual(resBody)
    expect(result.remainingAttempts).toBe(4)
  })

  it("throws on non-OK response with parsed error message", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Validation failed" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      })
    )

    await expect(fetchOutline({ chapter: { text: "" } })).rejects.toThrow(
      "Validation failed"
    )
  })

  it("throws on non-OK when detail is array (first msg)", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: [{ msg: "Field required" }],
        }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      )
    )

    await expect(fetchOutline({ chapter: { text: "" } })).rejects.toThrow(
      "Field required"
    )
  })
})

describe("fetchRewrite", () => {
  const mockFetch = vi.fn()
  const rewriteUrl = "/api/v1/chapter/rewrite"

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
  })

  it("POSTs to rewrite endpoint with chapter and bullets and returns parsed response", async () => {
    const body = {
      chapter: { text: "Old chapter." },
      bullets: ["Bullet one", "Bullet two", "Bullet three"],
    }
    const resBody = {
      chapter_text: "New chapter text.",
      internal_structure: {
        bullets: [
          { content: "B1", anchor_text: "Anchor one." },
          { content: "B2", anchor_text: "Anchor two." },
          { content: "B3", anchor_text: "Anchor three." },
        ],
        scene_summaries: [],
      },
      change_highlights: [
        { original: "old phrase", updated: "new phrase" },
      ],
    }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(resBody), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Remaining-Attempts": "3",
        },
      })
    )

    const result = await fetchRewrite(body)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(rewriteUrl),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    )
    expect(result.rewrite).toEqual(resBody)
    expect(result.remainingAttempts).toBe(3)
  })

  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    )

    await expect(
      fetchRewrite({
        chapter: { text: "x" },
        bullets: ["a", "b", "c"],
      })
    ).rejects.toThrow("Server error")
  })
})

describe("fetchEdit", () => {
  const mockFetch = vi.fn()
  const editUrl = "/api/v1/chapter/edit"

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
  })

  it("POSTs to edit endpoint and returns chapter_text with change_highlights", async () => {
    const body = {
      chapter: { text: "She walked to the window. The rain had not stopped." },
      bullets: ["She moves to the window.", "Rain continues."],
      instruction: "Make her run instead of walk.",
    }
    const resBody = {
      chapter_text: "She ran to the window. The rain had not stopped.",
      change_highlights: [
        { original: "walked to the window", updated: "ran to the window" },
      ],
      internal_structure: {
        bullets: [
          { label: "The Sprint", content: "She runs to the window.", anchor_text: "She ran to the window." },
          { label: "The Rain", content: "Rain continues.", anchor_text: "The rain had not stopped." },
        ],
        scene_summaries: [],
      },
      edits_applied: 1,
    }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(resBody), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Remaining-Attempts": "2",
        },
      })
    )

    const result = await fetchEdit(body)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(editUrl),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    )
    expect(result.edit.chapter_text).toBe(resBody.chapter_text)
    expect(result.edit.change_highlights).toHaveLength(1)
    expect(result.edit.change_highlights[0].updated).toBe("ran to the window")
    expect(result.edit.change_highlights[0].original).toBe("walked to the window")
    expect(result.edit.internal_structure.bullets[0].label).toBe("The Sprint")
    expect(result.edit.edits_applied).toBe(1)
    expect(result.remainingAttempts).toBe(2)
  })

  it("returns empty change_highlights when edits_applied is 0", async () => {
    const resBody = {
      chapter_text: "She walked to the window. The rain had not stopped.",
      change_highlights: [],
      internal_structure: {
        bullets: [
          { label: null, content: "Beat one.", anchor_text: "She walked to the window." },
          { label: null, content: "Beat two.", anchor_text: "The rain had not stopped." },
          { label: null, content: "Beat three.", anchor_text: "." },
        ],
        scene_summaries: [],
      },
      edits_applied: 0,
    }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(resBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const result = await fetchEdit({
      chapter: { text: "She walked to the window. The rain had not stopped." },
      bullets: ["Beat one.", "Beat two.", "Beat three."],
      instruction: "Change nothing.",
    })

    expect(result.edit.change_highlights).toHaveLength(0)
    expect(result.edit.edits_applied).toBe(0)
    expect(result.remainingAttempts).toBeNull()
  })

  it("throws on non-OK response with parsed error message", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Edit failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    )

    await expect(
      fetchEdit({
        chapter: { text: "x" },
        bullets: ["a", "b", "c"],
        instruction: "do something",
      })
    ).rejects.toThrow("Edit failed")
  })
})
