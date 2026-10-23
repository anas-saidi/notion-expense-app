import type { Account, Category, MonthlySummary, Transaction } from "./app-types";
import { getCategoryScope, scopeFromAccountLabel } from "./app-utils";
import { isSavingsCategory } from "./wallet-utils";
import { normalizeId } from "../../lib/savings-funding";

export type JointDebt = { anas: number; salma: number; anasRepaid: number; salmaRepaid: number };

/** Ordinary personal-to-joint transfers repay earlier borrowing first. Only the
 * remainder is a contribution. Rebuild from the ledger so edits, deletions and
 * prior months never leave stale obligations. Dedicated savings stay separate. */
export function calculateJointDebt(accounts: Account[], categories: Category[], transactions: Transaction[], range: Pick<MonthlySummary, "start" | "end">): JointDebt {
  const balance = { anas: 0, salma: 0 };
  const repaid = { anas: 0, salma: 0 };
  const scope = (id: string | null | undefined) => {
    const account = accounts.find(a => normalizeId(a.id) === normalizeId(id));
    return account && !/saving/i.test(account.label) ? scopeFromAccountLabel(account.label) : null;
  };
  const cents = (amount: number) => Math.round(amount * 100);
  const ordered = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id.localeCompare(b.id));
  for (const transaction of ordered) {
    const day = transaction.date.slice(0, 10);
    if (!day || day > range.end || !Number.isFinite(transaction.amount)) continue;
    if ((transaction.type == null || transaction.type === "Expense") && scope(transaction.accountId) === "joint") {
      const category = categories.find(c => normalizeId(c.id) === normalizeId(transaction.category));
      if (!category || isSavingsCategory(category)) continue;
      const owner = getCategoryScope(category, accounts);
      if (owner === "anas" || owner === "salma") balance[owner] += cents(transaction.amount);
    } else if (transaction.type === "Transfer" && scope(transaction.toAccountId) === "joint" && !transaction.savingsFundingOperation && !transaction.savingsFundingTarget) {
      const owner = scope(transaction.fromAccountId);
      if (owner !== "anas" && owner !== "salma") continue;
      const paid = Math.min(Math.max(0, balance[owner]), Math.max(0, cents(transaction.amount)));
      balance[owner] -= paid;
      if (day >= range.start) repaid[owner] += paid;
    }
  }
  return { anas: Math.max(0, balance.anas) / 100, salma: Math.max(0, balance.salma) / 100, anasRepaid: repaid.anas / 100, salmaRepaid: repaid.salma / 100 };
}
