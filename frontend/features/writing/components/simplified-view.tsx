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

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-lg font-semibold text-gray-900 mb-10 tracking-tight">
          Narrate AI
        </h1>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your story here..."
          rows={12}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 leading-relaxed resize-none focus:outline-none focus:border-gray-400 placeholder:text-gray-400"
          spellCheck={false}
        />

        <div className="mt-2 mb-6 flex items-center gap-3">
          <label
            htmlFor="file-upload"
            className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 hover:underline underline-offset-2 select-none"
          >
            Upload file (.txt, .docx)
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".txt,.docx"
            onChange={handleFileUpload}
            className="sr-only"
          />
          {uploadError && (
            <span className="text-xs text-red-500">{uploadError}</span>
          )}
        </div>

        <div className="flex items-center gap-5">
          <button
            onClick={handleAnalyze}
            disabled={!text.trim() || isAnalyzing}
            className="px-5 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? "Analyzing…" : "Analyze Structure"}
          </button>
          <button
            onClick={handleCopy}
            disabled={!hasBeats}
            className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={handleDownload}
            disabled={!hasBeats}
            className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Download
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-500">{error}</p>
        )}

        {hasBeats && (
          <div className="mt-12 space-y-6 border-t border-gray-100 pt-10">
            {beats.map((beat, i) => (
              <div key={beat.id}>
                <p className="text-sm font-medium text-gray-900">
                  {i + 1}. {beat.label}
                </p>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
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
