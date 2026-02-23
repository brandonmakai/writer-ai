## Loveable for Writers MVP — Design Document

### Goal

Ship a single high-value feature that lets beginner writers edit story structure and instantly see coherent chapter updates. Focus on speed, simplicity, and validation, not polish or full platform functionality.

---

### Core Principles

- **Ship fast, iterate fast**: Validate user interest first, not completeness.
- **High-impact feature**: One feature done well > multiple features done decently.
- **Guided structural edits**: Minimal cognitive load for beginners.
- **Immediate feedback**: Users see the chapter refactored within seconds.
- **Exportable output**: Users can copy or download the refactored chapter.

---

### MVP Feature: “Rewrite from Outline”

#### Description

Allows users to edit a chapter’s structure at a bullet-point level and automatically refactors the chapter text coherently, preserving consistency, tone, and character arcs.

#### Flow

1. User pastes an existing chapter (or system-generated first draft).
2. System breaks down each chapter into 3-8 bullet points.
2. User refactors bullet points describing the structure changes they want.
3. User submits changes → system refactors chapter based on the updated bullets.
4. System displays refactored chapter and optionally highlights changes.
5. User can copy or download the output.

---

### Example User Interaction

| Step | Example |
| --- | --- |
| **Original Chapter** | “John confronts Maria about betrayal. Argument escalates. Maria leaves.” |
| **User Refactor** | - John suspects betrayal but suppresses it<br>- Maria manipulates him emotionally |
| **Refactored Chapter** | “John felt a twinge of suspicion but kept his composure. Maria smiled subtly, weaving words that left him uneasy.” |

#### Structured JSON Output (MVP)

```json
{
  "chapter_text": "John felt a twinge of suspicion but kept his composure. Maria smiled subtly, weaving words that left him uneasy.",
  "internal_structure": {
    "bullets": [
      "John suspects betrayal but suppresses it",
      "Maria manipulates him emotionally"
    ],
    "scene_summaries": [
      {
        "summary": "John is uneasy but hides his suspicion",
        "characters": ["John", "Maria"],
        "purpose": "Establish tension and subtle manipulation"
      }
    ]
  },
  "change_highlights": [
    {
      "original": "John confronts Maria about betrayal.",
      "updated": "John felt a twinge of suspicion but kept his composure."
    },
    {
      "original": "Argument escalates.",
      "updated": "Maria smiled subtly, weaving words that left him uneasy."
    }
  ]
}
```

#### Output fields (MVP)

- **`chapter_text`** → Refactored chapter displayed to user
- **`internal_structure`** → Maintains scaffolding for future iterations
- **`change_highlights`** → Optional visual cue to show what changed

---

### MVP User Flow

1. User lands on a clean single-page interface.
2. User pastes chapter or system-generated draft.
3. User enters 3–5 bullet points for structure edits.
4. User clicks **Refactor Chapter**.
5. Backend calls Gemini LLM with structured prompt.
6. LLM returns refactored chapter + optional structured data.
7. Frontend displays results in a readable section.
8. User can copy or download the chapter.
9. Track engagement: copy/download events as proxy for validation.

---

### MVP Constraints

- No full editor or WYSIWYG interface.
- No login/auth or user accounts.
- No advanced formatting or styling beyond readable output.
- Focus entirely on one-click structural refactoring.
- Optional: Data storage via Supabase only if needed to persist drafts temporarily; otherwise, in-memory storage suffices.

---

### Key Metrics to Validate

- Number of chapters refactored per user per day
- % of users who copy/download output
- Qualitative feedback: “Did this help you edit your chapter?”

---

### Technical Stack

- **Frontend**: React / Next.js (single-page app)
- **Backend**: Python / FastAPI serverless function
- **LLM**: Gemini API for text generation and refactoring
- **Data storage**: Optional; use Supabase if temporary draft persistence is needed
- **Deployment**: Vercel

---

### LLM Prompt Example

```json
{
  "input_chapter": "{user_chapter}",
  "structural_edits": ["{bullet_1}", "{bullet_2}", "{bullet_3}"],
  "output_format": {
    "chapter_text": "string",
    "internal_structure": {
      "bullets": ["string"],
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
  },
  "instructions": "Refactor the chapter coherently according to the bullets. Preserve tone, character arcs, and consistency. Return JSON as specified."
}
```

---

### Summary

✅ Ship one feature (“Rewrite from Outline”) that takes a pasted chapter + 3–5 structural bullets and returns a coherent refactor within seconds, with copy/download as primary validation signals.

---

### Commit and scope guidelines

- **Scoped commits**: Prefer one logical change per commit. Do not combine unrelated changes in a single commit (e.g. one commit for app factory + config + routes). A single commit is appropriate when changes are directly related—for example, adding a new route, its documentation, and its unit test together.
- **Scope names**: Use conventional scope names that match the folder/package. Examples: `feat(api): add JWT support`, `feat(core): add settings validation`, `feat(web): add login page`, `fix(app): correct CORS config`.