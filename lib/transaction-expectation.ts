import type { Transaction } from "../app/components/app-types";
import { normalizeId } from "./savings-funding";

/** Compare the cached editable values before applying an offline edit/delete.
 * Notion has no atomic compare-and-swap; this catches changes visible at read time. */
export function checkTransactionExpectation(actual: Transaction, expected: unknown): { status: number; error: string } | null {
  if (expected === undefined) return null;
  const value = expected as Partial<Transaction> | null;
  if (!value || typeof value !== "object" || typeof value.name !== "string" || typeof value.amount !== "number" || !Number.isFinite(value.amount) || typeof value.date !== "string" ||
      [value.accountId, value.category, value.incomeUse].some(field => field != null && typeof field !== "string")) {
    return { status: 400, error: "Invalid saved transaction version. Refresh and review this change." };
  }
  if (actual.name !== value.name || Math.round(actual.amount * 100) !== Math.round(value.amount * 100) || actual.date !== value.date ||
      normalizeId(actual.accountId) !== normalizeId(value.accountId) || normalizeId(actual.category) !== normalizeId(value.category) ||
      (actual.type === "Income" && (actual.incomeUse ?? "contributions") !== (value.incomeUse ?? "contributions"))) {
    return { status: 409, error: "This transaction changed in Notion while you were offline. Refresh and review your edit before saving again." };
  }
  return null;
}
