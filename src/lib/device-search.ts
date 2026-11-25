/** Lower case without accents, so "cafe" finds "Café". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** The words of a search, folded. */
export const searchTerms = (query: string) => fold(query).split(/\s+/).filter(Boolean);

/**
 * Whether every word of the search appears in one of `fields`, so "kitchen lamp" finds the lamp in the kitchen and
 * "lights" finds a light. Nothing searched matches everything.
 */
export function matchesSearch(fields: (string | null | undefined)[], terms: string[]) {
  if (!terms.length) return true;
  const haystack = fold(fields.filter(Boolean).join(" "));
  return terms.every(term => haystack.includes(term) || (term.length > 3 && term.endsWith("s") && haystack.includes(term.replace(/e?s$/, ""))));
}

/** Items grouped under their room, rooms in alphabetical order and the ones without a room last, as `fallback`. */
export function groupByRoom<T>(items: T[], roomOf: (item: T) => string | null, fallback = "No room"): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const room = roomOf(item) ?? fallback;
    groups.set(room, [...(groups.get(room) ?? []), item]);
  }
  return [...groups].sort(([a], [b]) => a === fallback ? 1 : b === fallback ? -1 : a.localeCompare(b));
}
