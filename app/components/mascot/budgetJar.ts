import type { Account, BudgetScope, Category } from "../app-types";
import { categoryMatchesScope } from "../app-utils";
import { isSavingsCategory } from "../wallet-utils";
import type { JarItem } from "./coinSimMatter";

/** Emoji radius bounds (body units): legible at the Budget jar's size, and no single category fills the jar. */
const MIN_RADIUS = 0.13;
const MAX_RADIUS = 0.34;
/** Area tracks share: the jar's usable area (~2.3 units² at ~70% packing) spread over the whole budget. */
const AREA_FACTOR = 0.7;

/**
 * The Budget jar: one emoji per category in the scope that still has money in
 * it, sized by its share of what's available. It shows what the hero number
 * says (Available across categories, savings excluded), so a category that's
 * been fully spent, or never funded, isn't in the jar.
 *
 * The id is the category's, so a changed share resizes its emoji in place
 * rather than swapping it for a new one.
 */
export function budgetJarItems(
  categories: Category[],
  scope: BudgetScope,
  accounts: Account[] = [],
): JarItem[] {
  const weighted = categories
    .filter(c => categoryMatchesScope(c, scope, accounts) && !isSavingsCategory(c))
    .map(c => ({ c, weight: Math.max(0, c.available ?? 0) }))
    .filter(x => x.weight > 0);
  const total = weighted.reduce((s, x) => s + x.weight, 0);
  if (total <= 0) return [];
  return weighted
    .sort((a, b) => b.weight - a.weight)
    .map(({ c, weight }) => {
      const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.sqrt(weight / total) * AREA_FACTOR));
      return { id: c.id, glyph: c.icon?.trim() || "🧾", radius };
    });
}

/** Emoji radius bounds for the pool's top spenders: only three, so a touch bigger than the Budget jar's, but leaving room for the face. */
const SPENT_MIN_RADIUS = 0.14;
const SPENT_MAX_RADIUS = 0.3;

/**
 * The pool's "where did it go": the top spending categories this month, one
 * emoji each, sized by how much of the pool (the month's plan) they took.
 */
export function topSpentJarItems(
  spentByCategory: Array<{ categoryId: string; total: number }>,
  categories: Category[],
  planned: number,
  count = 3,
): Array<JarItem & { name: string }> {
  if (!(planned > 0)) return [];
  const byId = new Map(categories.map(c => [c.id, c]));
  const totals = new Map<string, number>();
  for (const e of spentByCategory) if (e.total > 0) totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.total);
  return [...totals]
    .filter(([id]) => byId.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([id, total]) => {
      const c = byId.get(id)!;
      const radius = Math.min(SPENT_MAX_RADIUS, Math.max(SPENT_MIN_RADIUS, Math.sqrt(Math.min(1, total / planned)) * AREA_FACTOR));
      return { id: `spent:${id}`, glyph: c.icon?.trim() || "🧾", radius, name: c.name };
    });
}
