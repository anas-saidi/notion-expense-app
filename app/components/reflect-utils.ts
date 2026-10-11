import type { Account, BudgetScope, Category, Transaction } from "./app-types";
import { isExpenseTransaction, scopeFromAccountLabel, transactionMatchesScope } from "./app-utils";

export type ReflectPeriod = { start: string; end: string };
export type ReflectCategory = { id: string; name: string; icon: string | null; spent: number; inflow: number; net: number; share: number; transactions: Transaction[] };
export const UNCATEGORIZED = "__uncategorized__";
export const UNKNOWN_ACCOUNT = "__unknown_account__";
/** A partner's money that went to Joint: transfers to the joint account and joint expenses paid from their own account. */
export const TO_JOINT = "__to_joint__";
const cents = (amount: number) => Math.round(amount * 100);

const accountScopeOf = (id: string | null | undefined, accounts: Account[]) => {
  const account = id ? accounts.find(entry => entry.id === id) : undefined;
  return account ? scopeFromAccountLabel(account.label) : null;
};

/**
 * Whether a transaction belongs in a partner's "To Joint" row. Joint's own view
 * counts this money as its money in (see isMoneyIn), so each view counts it once.
 * Joint → partner account transfers count too, as inflows that net the row down.
 */
function isToJoint(transaction: Transaction, categories: Category[], accounts: Account[], scope: BudgetScope) {
  if (scope === "joint") return false;
  if (transaction.type === "Transfer") {
    if (transaction.fromCategoryId || transaction.toCategoryId) return false;
    const from = accountScopeOf(transaction.fromAccountId, accounts);
    const to = accountScopeOf(transaction.toAccountId, accounts);
    return (from === scope && to === "joint") || (from === "joint" && to === scope);
  }
  return isExpenseTransaction(transaction)
    && accountScopeOf(transaction.accountId, accounts) === scope
    && transactionMatchesScope(transaction, categories, "joint", accounts);
}

/** Money coming back: income, refunds (negative amounts), and transfers not headed to Joint. */
export const isReflectInflow = (transaction: Transaction, accounts: Account[]) =>
  transaction.type === "Income" || transaction.amount < 0
  || (transaction.type === "Transfer" && accountScopeOf(transaction.toAccountId, accounts) !== "joint");

/** The scope's own account on a transaction: for transfers, the side that isn't Joint. */
export const reflectAccountId = (transaction: Transaction, accounts: Account[]) =>
  (transaction.type === "Transfer"
    ? isReflectInflow(transaction, accounts) ? transaction.toAccountId : transaction.fromAccountId
    : transaction.accountId || transaction.toAccountId) || UNKNOWN_ACCOUNT;

export function buildSpendingBreakdown(transactions: Transaction[], categories: Category[], accounts: Account[], scope: BudgetScope, excludedCategories: string[] = [], excludedAccounts: string[] = []) {
  const buckets = new Map<string, ReflectCategory>();
  for (const transaction of transactions) {
    if (!Number.isFinite(transaction.amount)) continue;
    const toJoint = isToJoint(transaction, categories, accounts, scope);
    if (!toJoint) {
      if (transaction.type === "Transfer" || !transactionMatchesScope(transaction, categories, scope, accounts)) continue;
      if (!isExpenseTransaction(transaction) && !(transaction.type === "Income" && transaction.category)) continue;
    }
    const id = toJoint ? TO_JOINT : transaction.category || UNCATEGORIZED;
    if (excludedCategories.includes(id) || excludedAccounts.includes(reflectAccountId(transaction, accounts))) continue;
    const category = categories.find(item => item.id === id);
    const name = toJoint ? "To Joint" : category?.name ?? (id === UNCATEGORIZED ? "Uncategorized" : "Archived category");
    const bucket = buckets.get(id) ?? { id, name, icon: toJoint ? "🤝" : category?.icon ?? null, spent: 0, inflow: 0, net: 0, share: 0, transactions: [] };
    const amount = cents(transaction.amount);
    if (isReflectInflow(transaction, accounts)) bucket.inflow += Math.abs(amount);
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

export type FlowPoint = { key: string; label: string; spent: number; moneyIn: number };

/**
 * Money that came into the wallet: Income into its accounts (category-linked
 * inflows are refunds, already netted in spending). Joint is funded by the
 * partners, so for Joint it's their transfers into the joint account plus joint
 * expenses they paid from their own accounts, the same "direct spend" the
 * contribution status counts.
 */
export function isMoneyIn(transaction: Transaction, categories: Category[], accounts: Account[], scope: BudgetScope) {
  if (transaction.type === "Income") return !transaction.category && transactionMatchesScope(transaction, categories, scope, accounts);
  if (scope !== "joint") return false;
  const isPartner = (id: string | null | undefined) => { const owner = accountScopeOf(id, accounts); return owner !== null && owner !== "joint"; };
  if (isExpenseTransaction(transaction)) {
    return transaction.amount > 0 && isPartner(transaction.accountId) && transactionMatchesScope(transaction, categories, "joint", accounts);
  }
  if (transaction.type !== "Transfer" || transaction.fromCategoryId || transaction.toCategoryId) return false;
  return accountScopeOf(transaction.toAccountId, accounts) === "joint" && isPartner(transaction.fromAccountId);
}

/**
 * Cumulative spending against cumulative money in, across the period: by day for
 * a single month (stopping at today in the current month), by month otherwise.
 * Spending comes from the breakdown's own transactions, so it ends on its total.
 */
export function buildMoneyFlow(
  spending: ReflectCategory[],
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  scope: BudgetScope,
  period: ReflectPeriod,
  excludedAccounts: string[] = [],
  now = new Date(),
): FlowPoint[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const firstDate = transactions.map(t => t.date).filter(d => /^\d{4}-\d{2}/.test(d)).sort()[0];
  const start = period.start || firstDate?.slice(0, 7) || thisMonth;
  const end = period.end || thisMonth;
  const daily = start === end;

  const keys: string[] = [];
  if (daily) {
    const [y, m] = start.split("-").map(Number);
    const last = start === thisMonth ? now.getDate() : new Date(y, m, 0).getDate();
    for (let d = 1; d <= last; d++) keys.push(`${start}-${pad(d)}`);
  } else {
    for (let [y, m] = start.split("-").map(Number); `${y}-${pad(m)}` <= end; m === 12 ? (y++, m = 1) : m++) keys.push(`${y}-${pad(m)}`);
  }
  const bucketOf = (date: string) => daily ? date.slice(0, 10) : date.slice(0, 7);
  const spentBy = new Map<string, number>();
  const inBy = new Map<string, number>();
  const add = (map: Map<string, number>, date: string, value: number) => map.set(bucketOf(date), (map.get(bucketOf(date)) ?? 0) + cents(value));

  for (const row of spending) {
    for (const t of row.transactions) add(spentBy, t.date, isReflectInflow(t, accounts) ? -Math.abs(t.amount) : t.amount);
  }
  for (const t of transactions) {
    if (!Number.isFinite(t.amount) || !isMoneyIn(t, categories, accounts, scope)) continue;
    if (excludedAccounts.includes(t.toAccountId || t.accountId || UNKNOWN_ACCOUNT)) continue;
    add(inBy, t.date, Math.abs(t.amount));
  }

  let spent = 0;
  let moneyIn = 0;
  return keys.map(key => {
    spent += spentBy.get(key) ?? 0;
    moneyIn += inBy.get(key) ?? 0;
    const label = daily
      ? String(Number(key.slice(8)))
      : new Date(`${key}-01T12:00:00`).toLocaleDateString("en", { month: "short" });
    return { key, label, spent: spent / 100, moneyIn: moneyIn / 100 };
  });
}
