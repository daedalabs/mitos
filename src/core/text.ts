// Shared, headless text similarity helpers — zero Obsidian imports allowed.

/** Tokenize text for Jaccard comparison, ignoring punctuation and short words. */
export function tokenizeForSimilarity(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
}

/**
 * Token Jaccard similarity in the `[0, 1]` range.
 *
 * Used by both vault-memory de-duplication and cross-episode hook checks so
 * the two paths cannot drift apart.
 */
export function computeTokenJaccard(a: string, b: string): number {
  const setA = tokenizeForSimilarity(a);
  const setB = tokenizeForSimilarity(b);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
