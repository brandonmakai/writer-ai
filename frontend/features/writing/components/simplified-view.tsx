"use client"

import { useState } from "react"
import { fetchOutline } from "@/lib/api"
import { sanitizeText } from "@/lib/sanitize"
import type { StoryBullet } from "@/features/writing/types"

export function SimplifiedView() {
  const [text, setText] = useState("")
  const [beats, setBeats] = useState<StoryBullet[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleAnalyze = async () => {
    if (!text.trim() || isAnalyzing) return
    setIsAnalyzing(true)
    setError(null)
    try {
      const { outline } = await fetchOutline({ chapter: { text: text.trim() } })
      setBeats(
        outline.bullets.map((b, i) => ({
          id: crypto.randomUUID(),
          label: b.label ?? `Beat ${i + 1}`,
          content: sanitizeText(b.content),
          anchor_text: sanitizeText(b.anchor_text),
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    const ext = file.name.split(".").pop()?.toLowerCase()
    try {
      if (ext === "txt") {
        setText(await file.text())
      } else if (ext === "docx") {
        const mammoth = await import("mammoth")
        const { value } = await mammoth.extractRawText({
          arrayBuffer: await file.arrayBuffer(),
        })
        setText(value)
      } else {
        setUploadError("Unsupported format. Use .txt or .docx.")
      }
    } catch {
      setUploadError("Could not read file.")
    }
    e.target.value = ""
  }

  const beatsText = beats
    .map((b, i) => `${i + 1}. ${b.label}\n${b.content}`)
    .join("\n\n")

  const handleCopy = async () => {
    await navigator.clipboard.writeText(beatsText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([beatsText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "story-beats.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasBeats = beats.length > 0

  const secondaryBtnStyle: React.CSSProperties = {
    background: "transparent",
    border: "1px solid #d1d5db",
    color: "#374151",
    fontWeight: 500,
    fontSize: 15,
    padding: "12px 24px",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    opacity: 1,
  }

  return (
    <main style={{ minHeight: "100vh", background: "#ffffff" }}>
      <div style={{ maxWidth: 660, margin: "0 auto", padding: "80px 24px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 36, fontWeight: 600, color: "#111827", lineHeight: 1.15, margin: 0 }}>
            Narrate AI
          </h1>
          <p style={{ fontSize: 18, color: "#6b7280", marginTop: 8, lineHeight: 1.5, marginBottom: 0 }}>
            Paste any story. Get its structure back in seconds.
          </p>
        </div>

        {/* Input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your story here..."
          style={{
            display: "block",
            width: "100%",
            minHeight: 280,
            border: "1px solid #d1d5db",
            borderRadius: 12,
            background: "#fafafa",
            padding: 16,
            fontSize: 16,
            lineHeight: 1.6,
            resize: "none",
            outline: "none",
            boxSizing: "border-box",
            color: "#111827",
            fontFamily: "inherit",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#111" }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#d1d5db" }}
          spellCheck={false}
        />

        {/* File upload preserved but hidden; error announced to screen readers */}
        <input
          id="file-upload"
          type="file"
          accept=".txt,.docx"
          onChange={handleFileUpload}
          className="sr-only"
        />
        {uploadError && (
          <span className="sr-only" aria-live="polite">{uploadError}</span>
        )}

        {/* Actions */}
        <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleAnalyze}
            style={{
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 500,
              fontSize: 15,
              padding: "12px 24px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              opacity: 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#1d4ed8" }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#2563eb" }}
          >
            {isAnalyzing ? "Extracting beats…" : "Extract Story Beats"}
          </button>

          <button
            onClick={handleCopy}
            disabled={!hasBeats}
            style={{ ...secondaryBtnStyle, opacity: hasBeats ? 1 : 0.4, cursor: hasBeats ? "pointer" : "default" }}
            onMouseEnter={(e) => { if (hasBeats) e.currentTarget.style.borderColor = "#9ca3af" }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#d1d5db" }}
          >
            {copied ? "Copied" : "Copy"}
          </button>

          <button
            onClick={handleDownload}
            disabled={!hasBeats}
            style={{ ...secondaryBtnStyle, opacity: hasBeats ? 1 : 0.4, cursor: hasBeats ? "pointer" : "default" }}
            onMouseEnter={(e) => { if (hasBeats) e.currentTarget.style.borderColor = "#9ca3af" }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#d1d5db" }}
          >
            Download
          </button>
        </div>

        {error && (
          <p style={{ marginTop: 16, fontSize: 14, color: "#ef4444", margin: "16px 0 0" }}>{error}</p>
        )}

        {/* Output */}
        {hasBeats && (
          <div style={{ marginTop: 40 }}>
            {beats.map((beat, i) => (
              <div
                key={beat.id}
                style={{
                  borderTop: i > 0 ? "1px solid #f3f4f6" : "none",
                  paddingTop: i > 0 ? 24 : 0,
                  paddingBottom: 24,
                }}
              >
                <p style={{ fontSize: 15, fontWeight: 600, color: "#111827", margin: "0 0 4px 0" }}>
                  {i + 1}. {beat.label}
                </p>
                <p style={{ fontSize: 15, color: "#4b5563", lineHeight: 1.6, margin: 0 }}>
                  {beat.content}
                </p>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
