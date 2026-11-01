import { mapCategoryPage } from "./notion-category-record";
import { isSavingsCategory } from "../app/components/wallet-utils";
import { normalizeId } from "./savings-funding";
import { expenseBudgetGate, fmt, getCategoryScope, scopeFromAccountLabel } from "../app/components/app-utils";

const TRANSACTIONS_DB = process.env.NOTION_TRANSACTIONS_DB ?? "1926a2be-8922-80be-968a-efa6e6dace95";
const NOTION_VERSION = "2022-06-28";

export type CreateExpenseInput = {
  name: string;
  amount: number;
  accountId: string;
  categoryId: string;
  date: string;
  /** A personal account paid a joint category: Joint owes it back, so an empty category doesn't block it. */
  advance?: boolean;
  /** The person confirmed this spending was real: save it and let the category go below zero. */
  overspend?: boolean;
};

const notionHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
});

type BudgetError = Error & { status?: number; full?: unknown };

/**
 * The rule every expense follows, whichever route it comes through (app, Type it,
 * Shortcuts): a category must have the money before it's spent, unless the person
 * explicitly confirms the spending already happened (`overspend`), which lets the
 * category go below zero. Reads the category's live Available and throws a 409 when
 * the new spending doesn't fit and wasn't confirmed.
 * `originalAmount` is the amount already counted, when editing within the same category.
 */
export async function assertExpenseFitsBudget(token: string, { categoryId, amount, originalAmount = 0, accountId, advance = false, overspend = false }: { categoryId: string; amount: number; originalAmount?: number; accountId?: string; advance?: boolean; overspend?: boolean }) {
  const response = await fetch(`https://api.notion.com/v1/pages/${categoryId}`, { headers: notionHeaders(token), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.message || "Couldn't check the category's budget") as BudgetError;
    error.status = response.status;
    throw error;
  }
  const category = mapCategoryPage(data);
  if (isSavingsCategory(category) && accountId && (!category.defaultAccount || normalizeId(category.defaultAccount) !== normalizeId(accountId))) {
    throw Object.assign(new Error("Spend savings from the category’s holding account. Move money into it first."), { status: 409 });
  }
  const prop = data.properties?.Available;
  const available: number | null = prop?.formula?.number ?? prop?.number ?? null;
  const name: string = data.properties?.Category?.title?.[0]?.plain_text ?? "this category";
  // An advance is history, not a spending decision: the partner's own money already paid it.
  // Only a personal account paying a joint, non-savings category qualifies; anything else stays gated.
  if (advance) {
    if (!accountId || isSavingsCategory(category) || getCategoryScope(category) !== "joint") {
      throw Object.assign(new Error("Only a joint category paid from Anas's or Salma's own account can be saved as an advance."), { status: 409 });
    }
    const accountResponse = await fetch(`https://api.notion.com/v1/pages/${accountId}`, { headers: notionHeaders(token), cache: "no-store" });
    const account = await accountResponse.json();
    if (!accountResponse.ok) throw Object.assign(new Error(account?.message || "Couldn't check the paying account"), { status: accountResponse.status });
    const title = Object.values(account.properties ?? {}).find((p: any) => p?.type === "title") as any;
    const label: string = title?.title?.[0]?.plain_text ?? "";
    const owner = /saving/i.test(label) ? null : scopeFromAccountLabel(label);
    if (owner !== "anas" && owner !== "salma") {
      throw Object.assign(new Error("Only a joint category paid from Anas's or Salma's own account can be saved as an advance."), { status: 409 });
    }
    return;
  }
  // Money already spent can't be un-spent: a confirmed save records it and the deficit carries until covered.
  if (overspend) return;
  const gate = expenseBudgetGate({ available, amount, originalAmount });
  if (gate.unfunded || gate.overBudget) {
    const error = new Error(gate.unfunded
      ? `No budget in ${name}. Move money into it first.`
      : `Short ${fmt(gate.shortfall)} in ${name}. Move money into it first.`) as BudgetError;
    error.status = 409;
    error.full = { code: "over_budget", categoryId, shortfall: gate.shortfall };
    throw error;
  }
}

export async function createNotionExpense(token: string, input: CreateExpenseInput) {
  await assertExpenseFitsBudget(token, { categoryId: input.categoryId, amount: input.amount, accountId: input.accountId, advance: input.advance, overspend: input.overspend });
  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: notionHeaders(token),
    body: JSON.stringify({
      parent: { database_id: TRANSACTIONS_DB },
      properties: {
        Name: { title: [{ text: { content: input.name } }] },
        Amount: { number: input.amount },
        Date: { date: { start: input.date } },
        Account: { relation: [{ id: input.accountId }] },
        Category: { relation: [{ id: input.categoryId }] },
        Type: { select: { name: "Expense" } },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.message || "Failed to create transaction") as Error & {
      status?: number;
      full?: unknown;
    };
    error.status = response.status;
    error.full = data;
    throw error;
  }

  return {
    id: data.id,
    name: data.properties?.Name?.title?.[0]?.plain_text ?? input.name,
    amount: data.properties?.Amount?.number ?? input.amount,
    date: data.properties?.Date?.date?.start ?? input.date,
    categoryId: data.properties?.Category?.relation?.[0]?.id ?? input.categoryId,
    accountId: data.properties?.Account?.relation?.[0]?.id ?? input.accountId,
  };
}
