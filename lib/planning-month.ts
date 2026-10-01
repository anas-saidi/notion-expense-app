export type PlanningFund = { categoryId: string; planned: number; reverse?: boolean };

/** Keep an unfunded current month actionable after the calendar rolls over. */
export function getPlanningMonth(currentMonth: string, currentFunds: PlanningFund[]): string {
  if (!currentFunds.some(fund => !fund.reverse && fund.planned > 0)) return currentMonth;
  return getNextMonth(currentMonth);
}

export function getNextMonth(currentMonth: string): string {
  const [year, month] = currentMonth.split("-").map(Number);
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}
