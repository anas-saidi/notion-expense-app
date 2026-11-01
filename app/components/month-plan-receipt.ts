import type { BudgetScope } from "./app-types";
import type { ContributionAgreement } from "../../lib/contribution-agreements";

export type PlanReceiptItem = { id: string; name: string; scope: BudgetScope; amount: number };
export type PlanReceipt = {
  month: string;
  items: PlanReceiptItem[];
  total: number;
  wallets: Record<BudgetScope, number>;
  contributions?: ContributionAgreement["targets"];
  warning?: string;
};

/** Copy the submitted values: later refreshes or wallet changes must not alter this confirmation. */
export function createPlanReceipt(month: string, items: PlanReceiptItem[]): PlanReceipt {
  const planned = items.filter(item => item.amount > 0).map(item => ({ ...item }));
  const wallets = { joint: 0, anas: 0, salma: 0 };
  for (const item of planned) wallets[item.scope] += item.amount;
  return { month, items: planned.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)), total: planned.reduce((sum, item) => sum + item.amount, 0), wallets };
}

/** Use the server-confirmed agreement, never infer contribution targets from wallet allocations. */
export function confirmPlanReceipt(receipt: PlanReceipt, agreement?: ContributionAgreement, warning?: string): PlanReceipt {
  return { ...receipt, contributions: agreement?.month === receipt.month ? { ...agreement.targets } : undefined, warning };
}

/** A contribution failure must never disguise a successfully saved plan as a failed save. */
export async function persistMonthPlan(payload: unknown, contribution?: unknown): Promise<{ agreement?: ContributionAgreement; warning?: string }> {
  const response = await fetch("/api/monthly-planning/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Couldn't save the plan");
  if (!contribution) return {};
  try {
    const response = await fetch("/api/contribution-agreements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contribution) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Use Set monthly contributions to retry.");
    return { agreement: result.agreement };
  } catch (error) {
    return { warning: `Contributions were not confirmed. ${error instanceof Error ? error.message : "Use Set monthly contributions to retry."}` };
  }
}
