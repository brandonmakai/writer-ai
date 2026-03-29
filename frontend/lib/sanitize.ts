/**
 * Sanitize AI-generated text before storing it in state or localStorage.
 *
 * Chapter prose is plain text — any HTML tag in an AI response is either a
 * hallucination or an injection attempt. We strip tags rather than HTML-encode
 * them so writers see clean readable text rather than &lt;script&gt; literals.
 *
 * This is intentionally lightweight and dependency-free. We are not trying to
 * preserve any HTML structure — the only correct output from the LLM is plain
 * prose, so any tag is by definition unwanted.
 */
export function sanitizeText(raw: string): string {
  // Matches only well-formed HTML tags: opening (<tag …>), closing (</tag>),
  // self-closing (<tag />), and declarations (<!…>).
  // Requiring a letter, /, or ! after < avoids stripping bare comparisons
  // like "x < 3 then y > 0" that happen to contain angle brackets in prose.
  return raw.replace(/<[/!a-zA-Z][^>]*>/g, "")
}
