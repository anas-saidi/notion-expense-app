import type { Account, Category, Transaction } from "../app/components/app-types";
import { getCategoryScope, scopeFromAccountLabel, monthBounds } from "../app/components/app-utils";
import { isSavingsCategory } from "../app/components/wallet-utils";
import { calculateJointDebt } from "../app/components/joint-debt-utils";
import { normalizeId } from "./savings-funding";

export type Partner = "anas" | "salma";
export type PartnerAmounts = Record<Partner, number>;
export type ContributionAgreement = {
  month: string;
  original: PartnerAmounts;
  targets: PartnerAmounts;
  shares: PartnerAmounts;
  confirmedAt: string;
  updatedAt: string;
  version: string;
  planAdditions?: Record<string, import("./plan-addition").PlanAddition>;
};
export type ContributionMonth = {
  month: string;
  agreement: ContributionAgreement;
  contributed: PartnerAmounts;
  aboveOriginal: PartnerAmounts;
  aboveAgreed: PartnerAmounts;
  repaid: PartnerAmounts;
  outstanding: PartnerAmounts;
};
export type ContributionLedger = {
  months: ContributionMonth[];
  outstanding: PartnerAmounts;
  carried: PartnerAmounts;
  repaymentCredit: PartnerAmounts;
  unappliedRepayments: PartnerAmounts;
};
export const REPAYMENT_PROPERTY = "Contribution repayment";
/** The contribution half of an applied advance carries "offset:<request id>": it counts as that month's contribution,
 *  while the repayment half (the plain request id) repays the advance. Together they move no cash. */
export const OFFSET_PREFIX = "offset:";
const isRepaymentLeg = (id: string | undefined) => Boolean(id) && !id!.startsWith(OFFSET_PREFIX);
export const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100);
export const money = (amount: number) => cents(amount) / 100;
export const emptyAmounts = (): PartnerAmounts => ({ anas: 0, salma: 0 });
export const validMonth = (month: unknown): month is string => typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

/** Agreements preserve intent. Contributions and repayments always rebuild from
 * the ledger, so corrected/deleted entries cannot leave a stale reimbursement. */
export function contributionLedger(accounts: Account[], categories: Category[], transactions: Transaction[], agreements: ContributionAgreement[], throughMonth: string): ContributionLedger {
  const scope = (id: string | null | undefined) => {
    const account = accounts.find(a => normalizeId(a.id) === normalizeId(id));
    return account && !/saving/i.test(account.label) ? scopeFromAccountLabel(account.label) : null;
  };
  const end = monthBounds(`${throughMonth}-01`).end;
  const entries = transactions.filter(t => t.date && t.date.slice(0, 10) <= end && Number.isFinite(t.amount));
  const months: ContributionMonth[] = [];
  const repaymentCredit = emptyAmounts();
  const unappliedRepayments = emptyAmounts();
  for (const agreement of [...agreements].filter(a => a.month <= throughMonth).sort((a, b) => a.month.localeCompare(b.month))) {
    const range = monthBounds(`${agreement.month}-01`);
    const credited = emptyAmounts();
    for (const t of entries) {
      if (t.date.slice(0, 7) !== agreement.month || isRepaymentLeg(t.contributionRepaymentId) || t.savingsFundingTarget === "separate") continue;
      if (t.type === "Transfer") {
        if (scope(t.toAccountId) === "joint") {
          const owner = scope(t.fromAccountId);
          if (owner === "anas" || owner === "salma") credited[owner] += cents(t.amount);
        }
        if (scope(t.fromAccountId) === "joint") {
          const owner = scope(t.toAccountId);
          if (owner === "anas" || owner === "salma") credited[owner] -= cents(t.amount);
        }
      } else if (t.type == null || t.type === "Expense") {
        const category = categories.find(c => normalizeId(c.id) === normalizeId(t.category));
        const owner = scope(t.accountId);
        if (category && !isSavingsCategory(category) && getCategoryScope(category, accounts) === "joint" && (owner === "anas" || owner === "salma")) credited[owner] += cents(t.amount);
      }
    }
    const debt = calculateJointDebt(accounts, categories, entries, range);
    const contributed = { anas: (credited.anas - cents(debt.anasRepaid)) / 100, salma: (credited.salma - cents(debt.salmaRepaid)) / 100 };
    const above = (targets: PartnerAmounts): PartnerAmounts => ({ anas: Math.max(0, money(contributed.anas - targets.anas)), salma: Math.max(0, money(contributed.salma - targets.salma)) });
    months.push({ month: agreement.month, agreement, contributed, aboveOriginal: above(agreement.original), aboveAgreed: above(agreement.targets), repaid: emptyAmounts(), outstanding: above(agreement.targets) });
  }
  // Explicit repayment transfers pay the oldest agreement first. Never consume
  // an advance from a later month; edits that exceed the debt remain visible.
  for (const t of [...entries].filter(t => isRepaymentLeg(t.contributionRepaymentId)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    const owner = scope(t.toAccountId);
    if (t.type !== "Transfer" || scope(t.fromAccountId) !== "joint" || (owner !== "anas" && owner !== "salma")) continue;
    let remaining = cents(t.amount);
    for (const month of months) {
      if (month.month > t.date.slice(0, 7)) continue;
      const paid = Math.min(remaining, cents(month.outstanding[owner]));
      month.repaid[owner] = money(month.repaid[owner] + paid / 100);
      month.outstanding[owner] = money(month.outstanding[owner] - paid / 100);
      remaining -= paid;
    }
    if (t.date.slice(0, 7) === throughMonth) repaymentCredit[owner] = money(repaymentCredit[owner] + t.amount);
    unappliedRepayments[owner] = money(unappliedRepayments[owner] + remaining / 100);
  }
  const outstanding = emptyAmounts(), carried = emptyAmounts();
  for (const month of months) for (const owner of ["anas", "salma"] as const) {
    outstanding[owner] = money(outstanding[owner] + month.outstanding[owner]);
    if (month.month < throughMonth) carried[owner] = money(carried[owner] + month.outstanding[owner]);
  }
  return { months, outstanding, carried, repaymentCredit, unappliedRepayments };
}
