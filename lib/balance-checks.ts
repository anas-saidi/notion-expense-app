import type { Transaction } from "../app/components/app-types";

export type BalanceCheck = {
  accountId: string;
  version: string;
  actualBalance: number;
  ledgerBalance: number;
  checkedAt: string;
  checkedDay: string;
  /** Transactions already reflected in the physical count. */
  knownTransactionIds: string[];
};
export type BalanceCountReview = { accountId: string; actualBalance: number; reportedDay?: string };
export type BalanceCheckView = Omit<BalanceCheck, "knownTransactionIds"> & { estimatedActual: number };
export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const accountKey = (id: string) => id.replace(/-/g, "").toLowerCase();
export const casablancaDay = (date = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);

/** Category transfers have no account cash effect. A transfer within one account nets to zero. */
export function cashMovement(transaction: Transaction, accountId: string): number {
  const same = (id?: string | null) => !!id && accountKey(id) === accountKey(accountId);
  if (!Number.isFinite(transaction.amount)) return 0;
  if (transaction.type === "Expense" && same(transaction.accountId)) return -transaction.amount;
  if (transaction.type === "Income" && same(transaction.accountId)) return transaction.amount;
  if (transaction.type === "Transfer") return (same(transaction.toAccountId) ? transaction.amount : 0) - (same(transaction.fromAccountId) ? transaction.amount : 0);
  return 0;
}

export function checkView(check: BalanceCheck, transactions: Transaction[], day = casablancaDay()): BalanceCheckView {
  const known = new Set(check.knownTransactionIds.map(accountKey));
  const movement = transactions.reduce((sum, transaction) => {
    // Late historical entries explain the gap, rather than spending the count again.
    // Same-day missing entries are explicitly included through the review flow.
    if (known.has(accountKey(transaction.id)) || !transaction.date || transaction.date.slice(0, 10) < check.checkedDay || transaction.date.slice(0, 10) > day) return sum;
    return sum + cashMovement(transaction, check.accountId);
  }, 0);
  const { knownTransactionIds: _, ...view } = check;
  return { ...view, estimatedActual: money(check.actualBalance + movement) };
}

export function checkedFundsAfter(check: BalanceCheckView | undefined, amount: number): number | null {
  return check && Number.isFinite(amount) ? money(check.estimatedActual - amount) : null;
}
