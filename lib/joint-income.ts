export type IncomeUse = "contributions" | "unassigned";
export const PROP_INCOME_UNASSIGNED = "Unassigned income";
export const PROP_INCOME_BASELINE = "Unassigned allocation baseline";

export const isJointIncomeAccount = (label: string) =>
  /joined|joint/i.test(label) && !/saving/i.test(label);

const cents = (value: number) => Math.round(value * 100);
const clamp = (value: number, maximum: number) => Math.max(0, Math.min(maximum, value));
export type UnassignedIncome = { amount: number; baseline: number; createdAt: string; id: string };

/** Baselines capture total net assignments when each income arrives. Changes to
 * those assignments consume free money first; reversing them restores it. Using
 * cumulative assignments supports edited plans and carry-over across months. */
export function remainingUnassignedIncome(incomes: UnassignedIncome[], assigned: number): number {
  let reserve = 0;
  let credited = 0;
  let baseline = 0;
  for (const income of [...incomes].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
    if (credited) reserve = clamp(reserve - (cents(income.baseline) - baseline), credited);
    credited += cents(income.amount);
    reserve += cents(income.amount);
    baseline = cents(income.baseline);
  }
  return clamp(reserve - (cents(assigned) - baseline), credited) / 100;
}
