import type { Account, BudgetScope } from "./app-types";

export type PlanAmounts = Record<BudgetScope, number>;
export type ContributionSplit = { anas: number; salma: number };
const cents = (amount: number) => Math.round(amount * 100);

/** Current commitments are already deducted from capacity. Only the future plan
 * is deducted here. Existing Joint cash covers its plan before new contributions. */
export function calculateMonthPlanCapacity(capacity: PlanAmounts, planned: PlanAmounts, split: ContributionSplit) {
  const cash = Math.max(0, cents(capacity.joint));
  const needed = Math.max(0, cents(planned.joint) - cash);
  const anasDue = Math.round(needed * split.anas);
  const salmaDue = needed - anasDue;
  const remaining = {
    anas: cents(capacity.anas) - cents(planned.anas),
    salma: cents(capacity.salma) - cents(planned.salma),
  };
  // A zero-share partner does not constrain Joint's contribution capacity.
  const maxContribution = Math.max(0, Math.floor(Math.min(
    split.anas > 0 ? remaining.anas / split.anas : Infinity,
    split.salma > 0 ? remaining.salma / split.salma : Infinity,
  )));
  const pool = {
    joint: (cash + maxContribution) / 100,
    anas: (cents(capacity.anas) - anasDue) / 100,
    salma: (cents(capacity.salma) - salmaDue) / 100,
  };
  const left = {
    joint: pool.joint - planned.joint,
    anas: (remaining.anas - anasDue) / 100,
    salma: (remaining.salma - salmaDue) / 100,
  };
  return { pool, left, due: { anas: anasDue / 100, salma: salmaDue / 100 } };
}

export function getPlanningSplit(accounts: Account[]): ContributionSplit {
  const find = (needle: string) => accounts.find((a) => !a.label.toLowerCase().includes("saving") && a.label.toLowerCase().includes(needle));
  const anas = find("hubb")?.contributionPercent;
  const salma = find("wife")?.contributionPercent;
  return anas != null && salma != null && anas >= 0 && salma >= 0 && Math.abs(anas + salma - 1) < 0.000001
    ? { anas, salma } : { anas: 0.65, salma: 0.35 };
}
