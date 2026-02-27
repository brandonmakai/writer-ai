# LLM Output Contract

## Outline (chapter → bullets)

The outline model returns a JSON object with one key:

- **bullets** — array of 3–8 objects, each with:
  - **content** (string): short summary of the beat or scene.
  - **anchor_text** (string): exact verbatim sentence from the input chapter that this bullet addresses (first occurrence or most significant sentence).
- **suggested_index** (integer, 0-based): index into bullets of the one beat to highlight as the suggested edit in triage (most impactful to edit first, or pivot beat).

---

## Rewrite from Outline

The rewrite model MUST return structured JSON in the following format.

## Required Output Schema

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

---

## Field Definitions

- chapter_text → Final refactored chapter displayed to the user
- internal_structure → Structural scaffolding for future iterations
  - bullets → Array of objects with **content** (short summary of the beat) and **anchor_text** (exact verbatim sentence or phrase from the refactored chapter_text that this bullet addresses; used for UI tethers)
- change_highlights → Mapping between original and updated sections

---

## Prompt Template

{
  "input_chapter": "{user_chapter}",
  "structural_edits": ["{bullet_1}", "{bullet_2}", "{bullet_3}"],
  "output_format": { ...schema above... },
  "instructions": "Refactor the chapter coherently according to the bullets. Preserve tone, character arcs, and consistency. Return JSON only."
}

---

## Hard Rules

- Must return valid JSON
- Must not include markdown
- Must not include explanation text outside JSON
- Must preserve narrative coherence
- Must align rewritten content to provided structural edits