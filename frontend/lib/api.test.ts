import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchOutline, fetchRewrite } from "./api"

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
        headers: { "Content-Type": "application/json" },
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
    expect(result).toEqual(resBody)
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
        bullets: ["B1", "B2", "B3"],
        scene_summaries: [],
      },
      change_highlights: [
        { original: "old phrase", updated: "new phrase" },
      ],
    }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(resBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
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
    expect(result).toEqual(resBody)
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
