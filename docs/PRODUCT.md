# Loveable for Writers — MVP Product Spec

## Goal

Ship a single high-value feature that lets beginner writers edit story structure and instantly see coherent chapter updates.

Focus on speed, simplicity, and validation — not polish or full platform functionality.

---

## Core Principles

- Ship fast, iterate fast
- One feature done well > multiple features done decently
- Guided structural edits with minimal cognitive load
- Immediate feedback (seconds, not minutes)
- Exportable output (copy or download)

---

## MVP Feature: "Rewrite from Outline"

### Description

Users edit a chapter’s structure at a bullet-point level.
The system refactors the full chapter coherently while preserving:

- Tone
- Character arcs
- Narrative consistency

---

## User Flow

1. User lands on a clean single-page interface.
2. User pastes an existing chapter (or uses a generated draft).
3. System breaks chapter into 3–8 structural bullet points.
4. User edits or replaces bullet points describing structural changes.
5. User clicks **Refactor Chapter**.
6. Backend calls Gemini LLM with structured prompt.
7. LLM returns refactored chapter + structured metadata.
8. Frontend displays results.
9. User can copy or download the output.

Primary validation signal: copy/download actions.

---

## Example Interaction

| Step | Example |
|------|---------|
| Original | “John confronts Maria about betrayal. Argument escalates. Maria leaves.” |
| Edited Bullets | - John suspects betrayal but suppresses it<br>- Maria manipulates him emotionally |
| Refactored | “John felt a twinge of suspicion but kept his composure. Maria smiled subtly, weaving words that left him uneasy.” |

---

## MVP Constraints

- No WYSIWYG editor
- No authentication
- No full formatting system
- No multi-feature expansion
- Optional temporary draft persistence (Supabase only if necessary)

---

## Key Metrics

- Chapters refactored per user per day
- % of users who copy/download output
- Qualitative feedback: “Did this help you edit your chapter?”