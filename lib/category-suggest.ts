import Fuse from "fuse.js";

export type CategoryHistoryItem = { description: string; categoryId: string };
type SuggestableCategory = { id: string; name: string };

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const words = (value: string) => normalize(value).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3);

/**
 * Suggests a category for a description, learned from past transactions. In order:
 * 1. an exact past description that always went to one category,
 * 2. fuzzy matches on past descriptions (at least two agreeing, best total weight),
 * 3. a word of the description matching a category's name ("groceries 200" → Groceries).
 * Only categories in `categories` are suggested; returns null when nothing is clear.
 */
export function createCategorySuggester(history: CategoryHistoryItem[]) {
  const fuse = new Fuse(history, { keys: ["description"], threshold: 0.35, minMatchCharLength: 3, includeScore: true });
  const exact = new Map<string, Set<string>>();
  for (const item of history) {
    const key = normalize(item.description);
    if (!exact.has(key)) exact.set(key, new Set());
    exact.get(key)!.add(item.categoryId);
  }

  return (query: string, categories: SuggestableCategory[]): string | null => {
    const text = normalize(query);
    if (text.length < 3) return null;
    const allowed = new Set(categories.map((c) => c.id));

    const exactIds = [...(exact.get(text) ?? [])].filter((id) => allowed.has(id));
    if (exactIds.length === 1) return exactIds[0];

    const tally = new Map<string, { weight: number; count: number }>();
    for (const result of fuse.search(text)) {
      const id = result.item.categoryId;
      if (!allowed.has(id)) continue;
      const entry = tally.get(id) ?? { weight: 0, count: 0 };
      entry.weight += 1 - (result.score ?? 1);
      entry.count += 1;
      tally.set(id, entry);
    }
    const best = [...tally].filter(([, v]) => v.count >= 2).sort((a, b) => b[1].weight - a[1].weight)[0];
    if (best) return best[0];

    const queryWords = new Set(words(text));
    const byName = categories.filter((c) => words(c.name).some((word) => queryWords.has(word)));
    return byName.length === 1 ? byName[0].id : null;
  };
}
