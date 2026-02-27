export interface ChangeHighlight {
    /** The exact text segment in the refactored chapter that was changed */
    updated: string
    /** The original text before the AI rewrote it */
    original: string
  }
  
  export const exampleChapter = `The rain hadn't stopped for three days. Margaret stood at the kitchen window, watching the garden flood, the petunias she'd planted in April now just brown smears in the mud. Behind her, the kettle whistled. She didn't move.
  
  It was David who finally spoke. He'd been sitting at the table since breakfast, pretending to read the paper but really just turning pages. "We should talk about the house," he said, and the way he said it — flat, careful, like he was reading from a script — told her everything she needed to know about what was coming.
  
  She turned from the window. The light was grey and thin. She could see every line on his face, every year of their marriage etched there like rings in a tree trunk. "What about the house?" she asked, though she already knew. She'd known since the letter arrived.
  
  He smoothed the newspaper, a gesture she recognized as stalling. "The bank called again. It's the third time this month." A pause. "We're behind, Maggie. Three months behind."
  
  The kettle's whistle died to a whimper, then nothing. Steam curled upward and vanished. She thought of her mother, who had lived through the Depression and kept every rubber band, every twist tie, every scrap of aluminum foil. Her mother would have known what to do.
  
  "I could call Robert," she offered, hating the words even as she said them. Her brother hadn't spoken to her in two years, not since the argument at their father's funeral. But Robert had money. Robert always had money.
  
  David shook his head. "I won't take his money. Not after what he said."
  
  "What he said doesn't matter anymore. None of that matters." She crossed to the stove and moved the kettle off the burner. Her hands were steady, which surprised her. Inside, everything was shaking.
  
  The silence between them filled the kitchen like the floodwater filling the garden — slowly, inevitably, rising past the point where you could pretend it wasn't happening. She sat down across from him and took his hands. They were cold.
  
  "We'll figure it out," she said. "We always do."
  
  But this time, she wasn't sure that was true.`
  
  export const exampleBullets = [
    {
      id: "1",
      label: "Setting & Atmosphere",
      content:
        "Three days of rain; flooded garden; grey kitchen light. Establishes tone of decay and stagnation.",
      anchor_text:
        "The rain hadn't stopped for three days.",
    },
    {
      id: "2",
      label: "The Avoidance",
      content:
        "Margaret at the window, David pretending to read. Both characters delaying the inevitable conversation.",
      anchor_text:
        "He'd been sitting at the table since breakfast, pretending to read the paper but really just turning pages.",
    },
    {
      id: "3",
      label: "Inciting Dialogue",
      content:
        'David breaks the silence about the house. His flat, scripted delivery signals rehearsed dread.',
      anchor_text:
        '"We should talk about the house," he said, and the way he said it — flat, careful, like he was reading from a script — told her everything she needed to know about what was coming.',
    },
    {
      id: "4",
      label: "The Reveal",
      content:
        "Three months behind on mortgage. The bank has called repeatedly. Financial crisis made concrete.",
      anchor_text:
        '"We\'re behind, Maggie. Three months behind."',
    },
    {
      id: "5",
      label: "The Desperate Option",
      content:
        "Margaret suggests calling estranged brother Robert. Introduces family rift and pride vs. survival tension.",
      anchor_text:
        '"I could call Robert," she offered, hating the words even as she said them.',
    },
    {
      id: "6",
      label: "The Refusal",
      content:
        "David rejects Robert's help. Pride and old wounds clash with practical necessity.",
      anchor_text:
        '"I won\'t take his money. Not after what he said."',
    },
    {
      id: "7",
      label: "Fragile Resolution",
      content:
        "\"We'll figure it out\" — but the narrator undercuts the reassurance. Ends on uncertainty, not hope.",
      anchor_text:
        '"We\'ll figure it out," she said. "We always do."',
    },
  ]
  
  /**
   * Generates simulated change_highlights by comparing the old text to the new (refactored) text.
   * Picks phrases from the new text and fabricates plausible "original" versions.
   */
  export function generateHighlights(
    oldText: string,
    newText: string
  ): ChangeHighlight[] {
    const highlights: ChangeHighlight[] = []
  
    // Strategy: find sentences in the new text and create plausible diffs
    const sentences = newText.match(/[^.!?]+[.!?]+/g) || []
    const oldSentences = oldText.match(/[^.!?]+[.!?]+/g) || []
  
    // Pick every ~3rd sentence as a "changed" segment for realistic density
    for (let i = 0; i < sentences.length; i += 3) {
      const newSentence = sentences[i]?.trim()
      if (!newSentence || newSentence.length < 20) continue
  
      // Try to find a corresponding old sentence that differs
      const oldSentence = oldSentences[i]?.trim()
  
      // Extract a meaningful phrase (middle portion) from the sentence
      const words = newSentence.split(/\s+/)
      if (words.length < 5) continue
  
      // Take a phrase of 4-8 words from the sentence
      const phraseLen = Math.min(Math.floor(words.length * 0.6), 8)
      const startIdx = Math.max(0, Math.floor((words.length - phraseLen) / 2))
      const updatedPhrase = words.slice(startIdx, startIdx + phraseLen).join(" ")
  
      if (!updatedPhrase || updatedPhrase.length < 15) continue
      // Verify the phrase actually exists in the new text
      if (!newText.includes(updatedPhrase)) continue
  
      // Generate a plausible "original" version
      let originalPhrase: string
      if (oldSentence && oldSentence !== newSentence) {
        const oldWords = oldSentence.split(/\s+/)
        const oldPhraseLen = Math.min(Math.floor(oldWords.length * 0.6), 8)
        const oldStartIdx = Math.max(0, Math.floor((oldWords.length - oldPhraseLen) / 2))
        originalPhrase = oldWords.slice(oldStartIdx, oldStartIdx + oldPhraseLen).join(" ")
      } else {
        // Fabricate a plausible original by rewording
        originalPhrase = fabricateOriginal(updatedPhrase)
      }
  
      if (originalPhrase && originalPhrase !== updatedPhrase) {
        highlights.push({
          updated: updatedPhrase,
          original: originalPhrase,
        })
      }
    }
  
    // Ensure we have at least a few highlights; add hardcoded fallbacks
    if (highlights.length < 2 && newText.length > 100) {
      const fallbackPhrases = extractFallbackPhrases(newText)
      for (const phrase of fallbackPhrases) {
        if (highlights.length >= 5) break
        if (!highlights.some(h => h.updated === phrase.updated)) {
          highlights.push(phrase)
        }
      }
    }
  
    return highlights.slice(0, 8) // Cap at 8 highlights
  }
  
  function fabricateOriginal(updated: string): string {
    const rewrites: Array<[RegExp, string]> = [
      [/slowly/gi, "gradually"],
      [/quickly/gi, "rapidly"],
      [/every/gi, "each"],
      [/filled/gi, "pervaded"],
      [/thought of/gi, "remembered"],
      [/could see/gi, "noticed"],
      [/finally/gi, "at last"],
      [/pretending/gi, "feigning"],
      [/recognized/gi, "knew to be"],
      [/crossed to/gi, "walked to"],
      [/shook his head/gi, "refused"],
      [/hating/gi, "resenting"],
      [/surprised her/gi, "caught her off guard"],
      [/turned from/gi, "stepped away from"],
      [/stood at/gi, "was standing at"],
      [/hadn't stopped/gi, "had been falling"],
    ]
  
    let result = updated
    for (const [pattern, replacement] of rewrites) {
      if (pattern.test(result)) {
        result = result.replace(pattern, replacement)
        return result
      }
    }
  
    // If no rewrite matched, rephrase slightly
    const words = updated.split(" ")
    if (words.length > 3) {
      // Swap two adjacent words if possible
      const idx = Math.floor(words.length / 2)
      const temp = words[idx]
      words[idx] = words[idx - 1]
      words[idx - 1] = temp
      return words.join(" ")
    }
  
    return updated + ", perhaps"
  }
  
  function extractFallbackPhrases(text: string): ChangeHighlight[] {
    const results: ChangeHighlight[] = []
    const candidates = [
      { search: "the kettle whistled", original: "the kettle was screaming" },
      { search: "brown smears in the mud", original: "dark patches across the soil" },
      { search: "like rings in a tree trunk", original: "like lines on a map" },
      { search: "Steam curled upward and vanished", original: "Steam rose and disappeared" },
      { search: "everything was shaking", original: "nothing felt steady" },
      { search: "slowly, inevitably, rising", original: "quietly, steadily, creeping upward" },
    ]
    for (const c of candidates) {
      if (text.includes(c.search)) {
        results.push({ updated: c.search, original: c.original })
      }
    }
    return results
  }
  