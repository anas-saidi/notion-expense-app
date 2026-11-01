import type { BudgetScope } from "./app-types";

export type PlanDraftEntry = { amount: number; base: number; expression?: string };
export type LocalPlanDraft = { version: 1; month: string; scope: BudgetScope; savedAt: string; entries: Record<string, PlanDraftEntry> };
export const planDraftKey = (person: "anas" | "salma", month: string) => `monthPlanDraft:v1:${person}:${month}`;

export function parsePlanDraft(raw: string | null, month: string): LocalPlanDraft | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (draft?.version !== 1 || draft.month !== month || !["joint", "anas", "salma"].includes(draft.scope) || (typeof draft.savedAt !== "string" || !Number.isFinite(Date.parse(draft.savedAt))) || !draft.entries || typeof draft.entries !== "object" || Array.isArray(draft.entries)) return null;
    const entries = Object.entries(draft.entries);
    if (entries.length > 1000 || entries.some(([id, value]) => {
      const entry = value as PlanDraftEntry;
      return !/^[a-z0-9]+$/i.test(id) || !entry || !Number.isFinite(entry.amount) || entry.amount < 0 || !Number.isFinite(entry.base) || entry.base < 0 || (entry.expression !== undefined && (typeof entry.expression !== "string" || entry.expression.length > 2000));
    })) return null;
    return draft;
  } catch { return null; }
}

export function restorePlanDraft(draft: LocalPlanDraft, saved: Map<string, number>, activeIds: Set<string>) {
  const amounts: Record<string, number> = {};
  const expressions: Record<string, string> = {};
  let changedSinceDraft = false, unavailable = 0;
  for (const [id, entry] of Object.entries(draft.entries)) {
    if (!activeIds.has(id)) { unavailable++; continue; }
    amounts[id] = entry.amount;
    if (entry.expression !== undefined) expressions[id] = entry.expression;
    if ((saved.get(id) ?? 0) !== entry.base && (saved.get(id) ?? 0) !== entry.amount) changedSinceDraft = true;
  }
  return { amounts, expressions, changedSinceDraft, unavailable };
}

/** A save finishing in one tab must not delete a newer draft saved in another. */
export function clearUnchangedPlanDraft(storage: Pick<Storage, "getItem" | "removeItem">, key: string, expected: string | null) {
  if (storage.getItem(key) === expected) storage.removeItem(key);
}
