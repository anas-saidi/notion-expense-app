/** Deterministic, local parsing. Ambiguous amounts/dates require correction. */
export type TypedTransaction = { name: string; amount: number; date: string; type: "Expense" | "Income" };
export type ParsedTransactionLine = { line: number; source: string } & (
  | { transaction: TypedTransaction; error?: never }
  | { transaction?: never; error: string }
);

const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function parseTransactionLines(text: string, reference = new Date(), defaultDate?: string): ParsedTransactionLine[] {
  return text.split(/\r?\n/).flatMap((source, index) => {
    if (!source.trim()) return [];
    const base = { line: index + 1, source };
    const fail = (error: string): ParsedTransactionLine[] => [{ ...base, error }];
    let remaining = source.trim();
    if (/\b(?:every|recurs?|weekly|monthly|yearly)\b/i.test(remaining)) return fail("Repeating transactions aren't supported yet. Enter each payment separately.");
    let date = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate(), 12);
    const dates = [...remaining.matchAll(/\b(?:day before yesterday|today|yesterday|tomorrow|\d+ days? ago|(?:last |on )?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|\d{4}-\d{2}-\d{2})\b/gi)];
    if (dates.length > 1) return fail("Use just one date per line.");
    if (dates.length) {
      const match = dates[0];
      const value = match[0].toLowerCase();
      if (/^\d{4}-/.test(value)) {
        const [year, month, day] = value.split("-").map(Number);
        date = new Date(year, month - 1, day, 12);
        if (dateString(date) !== value) return fail("That date doesn't exist. Use YYYY-MM-DD.");
      } else if (value === "yesterday") date.setDate(date.getDate() - 1);
      else if (value === "day before yesterday") date.setDate(date.getDate() - 2);
      else if (value === "tomorrow") date.setDate(date.getDate() + 1);
      else if (/days? ago$/.test(value)) {
        const days = Number(value.split(" ")[0]);
        if (days > 36500) return fail("Use a date within the last 100 years.");
        date.setDate(date.getDate() - days);
      } else if (value !== "today") {
        const weekday = weekdays.indexOf(value.replace(/^(last |on )/, ""));
        const offset = (date.getDay() - weekday + 7) % 7;
        date.setDate(date.getDate() - (offset || (value.startsWith("last ") ? 7 : 0)));
      }
      remaining = `${remaining.slice(0, match.index)} ${remaining.slice(match.index! + match[0].length)}`.trim();
      remaining = remaining.replace(/\bon\s*$/i, "").trim();
    }
    if (/\b(?:last|next|ago|week|month|january|february|march|april|may|june|july|august|september|october|november|december)\b|\d[/-]\d/i.test(remaining)) {
      return fail("Use today, yesterday, a weekday, days ago, or YYYY-MM-DD for dates.");
    }
    if (/[$€£¥]|\b(?:usd|eur|gbp)\b/i.test(remaining)) return fail("Enter the amount in MAD; currency conversion isn't supported.");
    const amounts = [...remaining.matchAll(/(?:^|\s)([+-]?(?:\d[\d.,]*|[.,]\d+))(?:\s*(?:MAD|DHS?|dirhams?))?(?=\s|$)/gi)];
    if (amounts.length !== 1) return fail(amounts.length ? "More than one amount found. Use one amount per line." : "Add an amount, like pizza 19 yesterday.");
    const match = amounts[0];
    const raw = match[1];
    // Comma decimals and comma-grouped thousands, never silently guess 1.234 or 1,234.
    if (!/^[+-]?(?:\d+(?:[.,]\d{1,2})?|\d{1,3}(?:,\d{3})+\.\d{1,2}|[.,]\d{1,2})$/.test(raw)) {
      return fail("Use a positive amount with up to two decimals, like 19.50 or 1250.");
    }
    const amount = Math.abs(Number(raw.includes(".") ? raw.replace(/,/g, "") : raw.replace(",", ".")));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999) return fail("Enter an amount between 0.01 and 999,999,999 MAD.");
    let name = `${remaining.slice(0, match.index)} ${remaining.slice(match.index! + match[0].length)}`.replace(/\s+/g, " ").trim();
    const incomeWords = /^(?:income|received|earned|got paid|salary|paycheck|wages|refund|cashback|bonus|dividend|sold)\b/i.test(name);
    const expenseWords = /^(?:expense|spent|paid|bought)\b/i.test(name);
    if ((raw.startsWith("-") && incomeWords) || (raw.startsWith("+") && expenseWords)) return fail("The sign and wording disagree. Use + for income or − for expenses.");
    const type = raw.startsWith("+") || incomeWords ? "Income" as const : "Expense" as const;
    name = name.replace(/^(?:income|expense|received|earned|got paid|spent|paid)\s+/i, "");
    if (!name) return fail("Add a description, like pizza 19.");
    if (/\d/.test(name)) return fail("Keep only one number per line: the amount. Spell out numbers in descriptions.");
    if (name.length > 200) return fail("Keep the description under 200 characters.");
    return [{ ...base, transaction: { name, amount, date: dates.length ? dateString(date) : defaultDate ?? dateString(date), type } }];
  });
}

export type TypedTransactionDraft = TypedTransaction & { accountId: string; categoryId: string; type: "Expense" | "Income" };

/** Sequential writes stop at the first failure; callers retain only unsaved lines. */
export async function saveTypedBatch<T>(items: T[], save: (item: T) => Promise<void>, onSaved: (item: T) => void) {
  let saved = 0;
  for (const item of items) {
    try { await save(item); }
    catch (error) { return { saved, error: error instanceof Error ? error.message : "Could not save transaction." }; }
    saved++;
    onSaved(item);
  }
  return { saved, error: null };
}

/** Preserve explicit choices when other lines are inserted, removed, or edited. */
export function reconcileTypedChoices<T>(before: string, after: string, choices: Record<number, T>): Record<number, T> {
  const bySource = new Map<string, (T | undefined)[]>();
  before.split(/\r?\n/).forEach((source, index) => {
    const queue = bySource.get(source) ?? [];
    queue.push(choices[index + 1]);
    bySource.set(source, queue);
  });
  const next: Record<number, T> = {};
  after.split(/\r?\n/).forEach((source, index) => {
    const choice = bySource.get(source)?.shift();
    if (choice !== undefined) next[index + 1] = choice;
  });
  return next;
}
