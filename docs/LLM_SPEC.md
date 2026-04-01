# LLM Output Contract

## Outline (chapter → beats)

The outline model returns a JSON object with one key:

- **bullets** — array of 3–8 objects, each with:
  - **label** (string): short evocative title for the beat (2–5 words, e.g. "Confrontation", "The Turning Point"). Displayed as the beat heading in the sidebar UI.
  - **content** (string): short summary of the beat or scene.
  - **anchor_text** (string): exact verbatim sentence from the input chapter that this beat addresses (first occurrence or most significant sentence).
- **suggested_index** (integer, 0-based): index of the beat most impactful to address first. Reserved for future triage UI; not currently consumed by the frontend.

Beats returned by the outline endpoint are **read-only in the UI**. Users reshape structure by submitting natural language prompts through the agent box, which calls the micro-edit endpoint to update beats before a rewrite.

---

## Micro-edit (prompt → updated beats)

When beats already exist and the user submits a prompt, the micro-edit endpoint updates the beat structure without rewriting the full chapter.

Request body: `{ chapter: { text }, bullets: [...], instruction: "user prompt string" }`

Returns the same shape as the outline response: updated `bullets` array.

---

## Rewrite from Structure

The rewrite model takes the chapter text and the current beat structure (as modified by prompt) and returns a refined chapter.

### Required Output Schema

```json
{
  "chapter_text": "string",
  "internal_structure": {
    "bullets": [
      { "content": "string", "anchor_text": "string" }
    ],
    "scene_summaries": [
      {
        "summary": "string",
        "characters": ["string"],
        "purpose": "string"
      }
    ]
  },
  "change_highlights": [
    {
      "original": "string",
      "updated": "string"
    }
  ]
}
```

---

## Field Definitions

- **chapter_text** — Final refined chapter displayed to the user
- **internal_structure** — Structural scaffolding for future iterations
  - **bullets** — Array of objects with `content` (short beat summary) and `anchor_text` (exact verbatim sentence from `chapter_text`; used for UI tether overlays)
- **change_highlights** — Mapping between original and updated sections; drives the diff highlight UI

---

## Prompt Template (rewrite)

```json
{
  "input_chapter": "{user_chapter}",
  "structural_edits": ["{beat_1}", "{beat_2}", "{beat_3}"],
  "output_format": { "...schema above..." },
  "instructions": "Refine the chapter coherently according to the structural beats. Preserve tone, character arcs, and consistency. Return JSON only."
}
```

`structural_edits` reflects the current beat state — either the original outline or beats updated by a user prompt via the micro-edit endpoint.

---

## Hard Rules

- Must return valid JSON
- Must not include markdown
- Must not include explanation text outside JSON
- Must preserve narrative coherence
- Must align rewritten content to provided structural beats
