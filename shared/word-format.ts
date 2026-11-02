/** Remove a translation wrapper only when its pair straddles the two fields.
 * Balanced parentheses inside either language remain part of the content. */
export function cleanBilingualPair(term: string, meaning: string) {
  let nextTerm = term.trim(),
    nextMeaning = meaning.trim();
  const pairs = [
    ['(', ')'],
    ['（', '）'],
    ['[', ']'],
    ['【', '】'],
  ] as const;
  for (const [open, close] of pairs) {
    const balance = (value: string) =>
      [...value].reduce((sum, char) => sum + (char === open ? 1 : char === close ? -1 : 0), 0);
    while (
      nextTerm.endsWith(open) &&
      nextMeaning.endsWith(close) &&
      balance(nextTerm) > 0 &&
      balance(nextMeaning) < 0 &&
      nextTerm.slice(0, -open.length).trim().length > 0 &&
      nextMeaning.slice(0, -close.length).trim().length > 0
    ) {
      nextTerm = nextTerm.slice(0, -open.length).trimEnd();
      nextMeaning = nextMeaning.slice(0, -close.length).trimEnd();
    }
  }
  return { term: nextTerm, meaning: nextMeaning };
}
