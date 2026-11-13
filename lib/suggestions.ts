/**
 * Suggestion pills are rules over your own data, not AI: every pill points at something real.
 * No rule matches → no pills (never a generic example).
 */

export type SuggestionTransaction = { name: string; amount: number; date: string; type?: string | null };

const MAX = 3;
const DAY_MS = 86_400_000;
const dayIndex = (date: string) => Math.floor(Date.parse(`${date}T12:00:00Z`) / DAY_MS);
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/**
 * Writing view, while empty. A pill is a habit:
 * 1. Habits: a description logged at least 3 times in the last 60 days, ranked by how often.
 *    The amount is your usual one for it (median of the last five).
 * 2. Right day: habits you usually log on today's weekday rank first.
 * 3. Not done yet: one already logged today is hidden, unless you log it more than once a day.
 * Callers pass transactions already limited to the current scope (rule 4).
 */
export function habitSuggestions(transactions: SuggestionTransaction[], today: string): string[] {
  const now = dayIndex(today);
  const groups = new Map<string, SuggestionTransaction[]>();
  for (const t of transactions) {
    if (t.type && t.type !== "Expense") continue;
    const name = t.name?.trim().toLowerCase();
    if (!name || !(t.amount > 0) || !/^\d{4}-\d{2}-\d{2}/.test(t.date)) continue;
    const age = now - dayIndex(t.date.slice(0, 10));
    if (age < 0 || age > 60) continue;
    groups.set(name, [...(groups.get(name) ?? []), { ...t, date: t.date.slice(0, 10) }]);
  }
  const habits = [...groups].flatMap(([name, entries]) => {
    if (entries.length < 3) return [];
    const perDay = new Map<string, number>();
    for (const e of entries) perDay.set(e.date, (perDay.get(e.date) ?? 0) + 1);
    const severalADay = [...perDay.values()].some(count => count > 1);
    if (perDay.has(today) && !severalADay) return [];
    const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(e => e.amount).sort((a, b) => a - b);
    const middle = Math.floor(recent.length / 2);
    const usual = recent.length % 2 ? recent[middle] : (recent[middle - 1] + recent[middle]) / 2;
    const onThisDay = entries.filter(e => weekday(e.date) === weekday(today)).length;
    return [{ name, usual: Math.round(usual), count: entries.length, onThisDay }];
  });
  return habits
    .sort((a, b) => (b.onThisDay > 0 ? 1 : 0) - (a.onThisDay > 0 ? 1 : 0) || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, MAX)
    .map(h => `${h.name} ${h.usual}`);
}

export type RebalanceCategory = { id: string; name: string; available: number };
export type DueBill = { name: string; categoryId: string; amount: number; dueDate: string };

/**
 * Rebalance prompt. Each pill fixes a real number Suggest moves can act on (it only moves money between
 * categories; unassigned money and savings stay with the slider):
 * 1. Cover what's short: "Cover {name}" for each category below zero, most negative first.
 * 2. Fund a bill: "Cover the {amount} {bill} bill in {category}" when a bill is due within 7 days and its
 *    category can't cover it. Gemini never receives bill names, so the pill names the category and amount.
 */
export function rebalanceSuggestions({ categories, bills, today, formatAmount }: {
  categories: RebalanceCategory[]; bills: DueBill[]; today: string; formatAmount: (value: number) => string;
}): string[] {
  const norm = (id: string) => id.replace(/-/g, "").toLowerCase();
  const byId = new Map(categories.map(c => [norm(c.id), c]));
  const short = categories.filter(c => c.available < -0.5).sort((a, b) => a.available - b.available);
  const covered = new Set(short.map(c => norm(c.id)));
  const pills = short.map(c => `Cover ${c.name}`);
  const now = dayIndex(today);
  // Bills in the same category draw on the same money, so add them up before comparing.
  const dueSoon = bills.filter(b => { const days = dayIndex(b.dueDate) - now; return days <= 7; }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const needByCategory = new Map<string, number>();
  for (const bill of dueSoon) {
    const key = norm(bill.categoryId);
    const need = (needByCategory.get(key) ?? 0) + bill.amount;
    needByCategory.set(key, need);
    const category = byId.get(key);
    if (!category || covered.has(key) || category.available >= need - 0.5) continue;
    covered.add(key);
    pills.push(`Cover the ${formatAmount(Math.round(bill.amount))} ${bill.name} bill in ${category.name}`);
  }
  return pills.slice(0, MAX);
}
