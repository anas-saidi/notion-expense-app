import type { Account, BudgetScope, Category, Transaction } from "./app-types";
import { isExpenseTransaction, transactionMatchesScope } from "./app-utils";

export type ReflectPeriod = { start: string; end: string };
export type ReflectCategory = { id: string; name: string; icon: string | null; spent: number; inflow: number; net: number; share: number; transactions: Transaction[] };
export const UNCATEGORIZED = "__uncategorized__";
export const UNKNOWN_ACCOUNT = "__unknown_account__";
const cents = (amount: number) => Math.round(amount * 100);

export function buildSpendingBreakdown(transactions: Transaction[], categories: Category[], accounts: Account[], scope: BudgetScope, excludedCategories: string[] = [], excludedAccounts: string[] = []) {
  const scoped = transactions.filter(transaction => transactionMatchesScope(transaction, categories, scope, accounts));
  const buckets = new Map<string, ReflectCategory>();
  for (const transaction of scoped) {
    if (!Number.isFinite(transaction.amount) || transaction.type === "Transfer") continue;
    if (!isExpenseTransaction(transaction) && !(transaction.type === "Income" && transaction.category)) continue;
    const id = transaction.category || UNCATEGORIZED;
    if (excludedCategories.includes(id) || excludedAccounts.includes(transaction.accountId || transaction.toAccountId || UNKNOWN_ACCOUNT)) continue;
    const category = categories.find(item => item.id === id);
    const bucket = buckets.get(id) ?? { id, name: category?.name ?? (id === UNCATEGORIZED ? "Uncategorized" : "Archived category"), icon: category?.icon ?? null, spent: 0, inflow: 0, net: 0, share: 0, transactions: [] };
    const amount = cents(transaction.amount);
    if (transaction.type === "Income" || amount < 0) bucket.inflow += Math.abs(amount);
    else bucket.spent += amount;
    bucket.transactions.push(transaction);
    buckets.set(id, bucket);
  }
  const rows = [...buckets.values()].map(bucket => ({ ...bucket, spent: bucket.spent / 100, inflow: bucket.inflow / 100, net: (bucket.spent - bucket.inflow) / 100, transactions: bucket.transactions.sort((a, b) => b.date.localeCompare(a.date)) }));
  const total = rows.reduce((sum, row) => sum + Math.max(0, cents(row.net)), 0) / 100;
  rows.forEach(row => { row.share = total > 0 && row.net > 0 ? row.net / total : 0; });
  return {
    total,
    spending: rows.filter(row => row.net > 0).sort((a, b) => b.net - a.net || a.name.localeCompare(b.name)),
    inflows: rows.filter(row => row.net < 0).sort((a, b) => a.net - b.net),
    settled: rows.filter(row => row.net === 0),
    transactionCount: rows.reduce((sum, row) => sum + row.transactions.length, 0),
  };
}

export function reflectPreset(preset: "month" | "last-month" | "3" | "6" | "12" | "year" | "last-year" | "all", now = new Date()): ReflectPeriod {
  const month = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const end = month(now);
  if (preset === "all") return { start: "", end: "" };
  if (preset === "month") return { start: end, end };
  if (preset === "last-month") { const value = month(new Date(now.getFullYear(), now.getMonth() - 1, 1)); return { start: value, end: value }; }
  if (preset === "year") return { start: `${now.getFullYear()}-01`, end };
  if (preset === "last-year") return { start: `${now.getFullYear() - 1}-01`, end: `${now.getFullYear() - 1}-12` };
  return { start: month(new Date(now.getFullYear(), now.getMonth() - Number(preset) + 1, 1)), end };
}

export function reflectMonthCount(period: ReflectPeriod, transactions: Transaction[], now = new Date()) {
  const firstDate = transactions.map(transaction => transaction.date).filter(date => /^\d{4}-\d{2}/.test(date)).sort()[0];
  const start = period.start || firstDate?.slice(0, 7) || reflectPreset("month", now).start;
  const end = period.end || reflectPreset("month", now).end;
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return Math.max(1, (ey - sy) * 12 + em - sm + 1);
}
