import { NextRequest, NextResponse } from "next/server";
import { GET as readAccounts } from "../../app/api/accounts/route";
import { GET as readCategories } from "../../app/api/categories/route";
import { GET as readTransactions } from "../../app/api/transactions/route";
import { GET as readSummary } from "../../app/api/monthly-summary/route";
import { POST as writeIncome } from "../../app/api/monthly-income/route";
import { POST as writeRebalance } from "../../app/api/transfer/route";
import { createNotionExpense } from "../notion-transactions";
import { withMirrorMutation } from "../mirror/routes";
import { mirrorReadContext } from "../mirror/context";
import { mirrorScope } from "../mirror/store";
import { mcpOperations } from "./operations";
import { queryDatabaseAll } from "../notion-api";
import { mapCategoryPage } from "../notion-category-record";
import { readBills } from "../notion-bills";
import { billToday, deriveOccurrences, earmarkedByCategory, normalizedId } from "../bills";
import { getCategoryScope } from "../../app/components/app-utils";
import { isSavingsCategory } from "../../app/components/wallet-utils";
import { buildMonthlyOverBudget, buildSpendingBreakdown } from "../../app/components/reflect-utils";
import type { Account, BudgetScope, Category } from "../../app/components/app-types";

const req = (path: string, body?: unknown) => new NextRequest(`https://finance.internal${path}`, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function json(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not complete finance request");
  return data;
}
export async function accounts() {
  const response = await readAccounts(req("/api/accounts"));
  const data = await json(response);
  return { accounts: data.accounts, currency: "MAD", readAt: new Date().toISOString(),
    source: response.headers.get("X-Finance-Data-Source"), syncedAt: response.headers.get("X-Finance-Synced-At"),
    balanceNote: "Ledger balances may combine bank and cash. This is not a live bank feed." };
}
export async function categories() {
  return json(await readCategories(req("/api/categories?includeSnoozed=true")));
}
export async function transactions(input: { start: string; end: string; accountId?: string; categoryId?: string }) {
  const data = await json(await readTransactions(req(`/api/transactions?start=${input.start}&end=${input.end}`)));
  return { transactions: data.transactions.filter((t: any) => (!input.accountId || [t.accountId,t.fromAccountId,t.toAccountId].includes(input.accountId)) && (!input.categoryId || [t.category,t.fromCategoryId,t.toCategoryId].includes(input.categoryId))), currency: "MAD" };
}
export async function monthlyReport(input: { month: string; scope: BudgetScope }) {
  const [data, catalog, wallets] = await Promise.all([
    json(await readSummary(req(`/api/monthly-summary?month=${input.month}&includeTransactions=true`))), categories(), accounts(),
  ]);
  const breakdown = buildSpendingBreakdown(data.transactions, catalog.categories, wallets.accounts, input.scope);
  const assigned = data.summary.assignedByCategory.filter((a: any) => {
    const c = catalog.categories.find((c: Category) => c.id === a.categoryId);
    return c && !isSavingsCategory(c) && getCategoryScope(c, wallets.accounts) === input.scope;
  });
  return { month: input.month, scope: input.scope, currency: "MAD", netSpent: breakdown.total,
    assigned: assigned.reduce((sum: number, a: any) => sum + a.total, 0),
    spending: breakdown.spending.map(({ transactions: _, ...row }) => row),
    overBudget: buildMonthlyOverBudget(breakdown.spending, assigned, catalog.categories).map(({ transactions: _, ...row }) => row),
    comparison: "Net spending above saved monthly assignments. Available, carry-over and rebalancing do not change the baseline." };
}
async function liveCatalog() {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("Finance data is not configured");
  const [pages, accountPages] = await Promise.all([
    queryDatabaseAll(token, process.env.NOTION_CATEGORIES_DB ?? "1926a2be-8922-8029-9b90-c7d8bb55fabd"),
    queryDatabaseAll(token, process.env.NOTION_ACCOUNTS_DB ?? "1926a2be-8922-8014-bb54-d9f5e9d1234b"),
  ]);
  return { token, categories: pages.filter(p => !p.archived && !p.in_trash).map(mapCategoryPage) as Category[], accounts: accountPages.filter(p => !p.archived && !p.in_trash && !Object.entries(p.properties ?? {}).some(([name, value]: [string, any]) => /^(disabled|inactive|archived)$/i.test(name) && value.checkbox)).map(p => ({ id: p.id, label: (Object.values(p.properties ?? {}).find((v: any) => v.type === "title") as any)?.title?.map((t: any) => t.plain_text ?? t.text?.content ?? "").join("") ?? "", icon: "", type: null, balance: null, readyToAssign: null })) as Account[] };
}
function activeCategory(all: Category[], id: string) {
  const category = all.find(c => c.id === id);
  if (!category || category.snoozed || category.archived) throw new Error("Choose an active category returned by list_categories");
  return category;
}
export async function write(tool: "record_expense" | "record_income" | "rebalance_budget", input: Record<string, any>) {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("Finance data is not configured");
  const { requestId, ...values } = input;
  return mcpOperations().once(mirrorScope(token), requestId, tool, values, async () => {
    // Writes and every preflight stay outside mirror read contexts.
    return mirrorReadContext.run({ enabled: false, sources: new Set(), syncedAt: [], databases: new Map() }, async () => {
      const catalog = await liveCatalog();
      if (tool !== "rebalance_budget" && !catalog.accounts.some(a => a.id === input.accountId)) throw new Error("Choose an active account returned by get_accounts");
      if (tool === "record_expense") {
        const category = activeCategory(catalog.categories, input.categoryId);
        if (category.available === null || !Number.isFinite(category.available)) throw new Error("The category balance could not be verified");
        const save = withMirrorMutation(async () => NextResponse.json({ success: true, transaction: await createNotionExpense(token, values as any) }));
        return json(await save());
      }
      if (tool === "record_income") return json(await writeIncome(req("/api/monthly-income", values)));
      if (input.fromCategoryId === input.toCategoryId) throw new Error("Source and destination must differ");
      if (input.date.slice(0, 7) !== billToday().slice(0, 7)) throw new Error("Budget rebalancing is available for the current month only");
      const from = activeCategory(catalog.categories, input.fromCategoryId);
      const to = activeCategory(catalog.categories, input.toCategoryId);
      if (isSavingsCategory(from) || isSavingsCategory(to)) throw new Error("Use the app's savings flow for savings categories");
      if (getCategoryScope(from, catalog.accounts) !== getCategoryScope(to, catalog.accounts)) throw new Error("Budget moves must stay within one wallet scope");
      if (from.available === null || !Number.isFinite(from.available)) throw new Error("The source category balance could not be verified");
      const bills = await readBills(token);
      const today = billToday();
      const end = new Date(Date.UTC(Number(today.slice(0,4)), Number(today.slice(5,7)), 0)).toISOString().slice(0,10);
      const reserved = earmarkedByCategory(deriveOccurrences(bills.schedules, bills.payments, today, today.slice(0,7)), end);
      const free = Math.max(0, from.available - (reserved[normalizedId(from.id)] ?? 0));
      if (Math.round(input.amount * 100) > Math.round(free * 100)) throw new Error("Insufficient free category funds after unpaid bill reservations");
      return json(await writeRebalance(req("/api/transfer", values)));
    });
  });
}
