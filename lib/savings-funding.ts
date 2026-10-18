import type { Category } from "../app/components/app-types";
import { isSavingsCategory } from "../app/components/wallet-utils";

export type SavingsFundingTarget = "separate" | "shared";
export const SAVINGS_UNDONE = "Savings deposit undone";
export const SAVINGS_TARGET = "Savings funding target";
export const FUNDING_OPERATION = "Savings funding operation";
export const FUNDING_AMOUNT = "Savings funding amount";
export const FUNDING_HOLDING = "Savings holding account";
export const normalizeId = (id: string | null | undefined) => (id ?? "").replace(/-/g, "").toLowerCase();
export const richText = (value: string) => ({ rich_text: [{ text: { content: value } }] });
export const readText = (property: any) => (property?.rich_text ?? []).map((part: any) => part.plain_text ?? part.text?.content ?? "").join("");

/** Reserve every saving held here, including personal and frozen categories. */
export function savingsHeldIn(categories: Category[], accountId: string): number | null {
  const held = categories.filter(category => isSavingsCategory(category) && normalizeId(category.defaultAccount) === normalizeId(accountId));
  if (held.some(category => category.available == null || !Number.isFinite(category.available))) return null;
  return held.reduce((sum, category) => sum + Math.max(0, category.available!), 0);
}
