# Narrate AI — MVP Product Spec

## Goal

Ship a single high-value feature that lets writers reshape story structure through natural language prompts and instantly see coherent chapter updates.

Focus on speed, simplicity, and validation — not polish or full platform functionality.

---

## Core Principles

- Ship fast, iterate fast
- One feature done well > multiple features done decently
- Prompt-driven structural edits with minimal cognitive load
- Immediate feedback (seconds, not minutes)
- Exportable output (copy or download)

---

## MVP Feature: "Refine from Structure"

### Description

The system analyzes a chapter and maps it to 3–8 structural beats.
Beats are read-only — they are the AI's structural interpretation, not a manual editing surface.
Users reshape structure by writing natural language prompts. The system applies the prompt to the beats and rewrites the chapter coherently, preserving:

- Tone
- Character arcs
- Narrative consistency

---

## User Flow

1. User lands on a clean single-page interface.
2. User pastes an existing chapter (or uses the example).
3. System maps the chapter into 3–8 structural beats (read-only).
4. User writes a prompt describing the structural change they want.
5. System applies the prompt, updating the beats.
6. User clicks **Refine Chapter**.
7. Backend calls Gemini with the updated beat structure.
8. LLM returns the refined chapter + change highlights.
9. Frontend displays results with highlighted changes.
10. User can copy or download the output.

Primary validation signal: copy/download actions and repeat refine sessions.

---

## Example Interaction

| Step | Example |
|------|---------|
| Original | "John confronts Maria about betrayal. Argument escalates. Maria leaves." |
| User prompt | "Make John suppress his suspicion instead of confronting directly" |
| Updated beats | - John suspects betrayal but holds back / Maria senses his hesitation |
| Refined | "John felt a twinge of suspicion but kept his composure. Maria smiled subtly, weaving words that left him uneasy." |

---

## MVP Constraints

- Beats are AI-generated and read-only — edits happen via prompt only
- No WYSIWYG editor
- No authentication
- No full formatting system
- No multi-feature expansion
- Draft persistence via localStorage (chapter text, beats, and phase restored on reload)

---

## Key Metrics

Tracked via PostHog (structural metadata only — no content captured):

| Event | What it measures |
|-------|-----------------|
| `chapter_analyzed` | Outline API success; word count + beat count |
| `example_used` | "Try an Example" engagement |
| `rewrite_completed` | Full rewrite success; word count, change count, beats used |
| `edit_completed` | Micro-edit success; instruction length, edits applied |
| `content_copied` | Copy-to-clipboard conversions |
| `content_downloaded` | Download conversions |
| `attempt_limit_hit` | Rate limit hits (signals demand vs. abuse) |

Primary validation signals: `content_copied` + `content_downloaded` rates, and repeat `rewrite_completed` sessions per visitor.
