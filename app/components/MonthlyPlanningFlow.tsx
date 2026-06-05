"use client";

import { useEffect, useState } from "react";
import { AllocationFlow, type AllocationGroup } from "./AllocationFlow";
import type { Account, BudgetScope, Category, MonthlyCategoryTotal, PlanningAllocationItem } from "./app-types";
import { BUDGET_SCOPE_LABELS, categoryMatchesScope } from "./app-utils";

type MonthlyPlanningFlowProps = {
  open: boolean;
  selectedMonth: string;
  onSelectedMonthChange: (nextMonth: string) => void;
  onCancel: () => void;
  onComplete?: () => void;
  onOpenAddTransaction?: (payload: { accountId: string; amount: number; name?: string }) => void;
  accounts: Account[];
  categories: Category[];
  assignedByCategory?: MonthlyCategoryTotal[];
  budgetScope?: BudgetScope;
  availablePool?: number;
  isUsingFallbackData: boolean;
};

function toAllocationItem(category: Category, plannedAmount: number): PlanningAllocationItem {
  return {
    categoryId: category.id,
    name: category.name,
    icon: category.icon,
    amount: plannedAmount,
    available: category.available,
    lastMonthSpent: category.lastMonthSpent,
    defaultAccount: category.defaultAccount,
  };
}

export function MonthlyPlanningFlow({
  open,
  selectedMonth,
  onSelectedMonthChange,
  onCancel,
  onComplete,
  accounts,
  categories,
  assignedByCategory = [],
  budgetScope = "joint",
  availablePool,
  isUsingFallbackData,
}: MonthlyPlanningFlowProps) {
  const [householdItems, setHouseholdItems] = useState<PlanningAllocationItem[]>([]);
  const [wifeItems, setWifeItems] = useState<PlanningAllocationItem[]>([]);
  const [husbandItems, setHusbandItems] = useState<PlanningAllocationItem[]>([]);
  const [savingsItems, setSavingsItems] = useState<PlanningAllocationItem[]>([]);
  // Snapshot of already-planned amounts taken at load time (never from live edits).
  // If this were computed from the mutable items, scopedPool would grow in lockstep
  // with user edits, keeping leftToAssign constant and making the slider unbounded.
  const [initialAssignments, setInitialAssignments] = useState(0);

  useEffect(() => {
    const plannedByCategory = new Map(assignedByCategory.map((item) => [item.categoryId, item.total]));
    const resolvePlannedAmount = (category: Category) => (plannedByCategory.has(category.id) ? plannedByCategory.get(category.id) ?? 0 : 0);
    const scopedCategories = categories.filter((category) => categoryMatchesScope(category, budgetScope));

    const savingsTypeHints = ["saving", "savings", "sinking", "goal", "fund"];
    const isHouseholdCategory = (category: Category) => {
      if (category.isTeamFund) return true;
      return category.type.some((value) => {
        const normalized = value.toLowerCase();
        return normalized.includes("team") || normalized.includes("household");
      });
    };
    const isWifeCategory = (category: Category) => category.owner?.toLowerCase() === "salma";
    const isHusbandCategory = (category: Category) => category.owner?.toLowerCase() === "anas";
    const isSavingsCategory = (category: Category) => {
      const types = category.type.map((v) => v.toLowerCase());
      if (isHouseholdCategory(category)) return false;
      return types.some((value) => savingsTypeHints.some((hint) => value.includes(hint)));
    };

    const savingsCategories = scopedCategories.filter(isSavingsCategory);
    const householdCategories = scopedCategories.filter(isHouseholdCategory);
    const wifeCategories = scopedCategories.filter((category) => !isHouseholdCategory(category) && isWifeCategory(category));
    const husbandCategories = scopedCategories.filter((category) => !isHouseholdCategory(category) && isHusbandCategory(category));
    const fallbackHouseholdCategories = scopedCategories.filter(
      (category) => !isHouseholdCategory(category) && !isSavingsCategory(category) && !isWifeCategory(category) && !isHusbandCategory(category),
    );

    const toItem = (category: Category) => toAllocationItem(category, resolvePlannedAmount(category));
    const hh = [...householdCategories, ...fallbackHouseholdCategories].map(toItem);
    const wf = wifeCategories.map(toItem);
    const hu = husbandCategories.map(toItem);
    const sv = savingsCategories.map(toItem);

    setHouseholdItems(hh);
    setWifeItems(wf);
    setHusbandItems(hu);
    setSavingsItems(sv);
    // Pool = readyToAssign + already-planned budget (non-savings) only.
    // Savings is a separate commitment managed at joint level — including it here
    // would require showing savings as editable in this flow so the user could
    // reduce it to free up money, which creates more complexity than it's worth.
    setInitialAssignments([...hh, ...wf, ...hu].reduce((s, i) => s + i.amount, 0));
  }, [categories, assignedByCategory, budgetScope]);

  const scopedPool = typeof availablePool === "number" ? availablePool + initialAssignments : undefined;
  const scopeLabel = BUDGET_SCOPE_LABELS[budgetScope];

  const plannedGroups: AllocationGroup[] = [
    { key: "household", label: "Joint", items: householdItems, onChange: setHouseholdItems },
    { key: "wife", label: "Salma", items: wifeItems, onChange: setWifeItems },
    { key: "husband", label: "Anas", items: husbandItems, onChange: setHusbandItems },
    // Savings excluded: pool = readyToAssign + budget assignments only.
    // Savings is managed separately at joint level (household savings funds
    // appear in the household group via isTeamFund / household type).
  ].filter((group) => group.items.length > 0);
  const groups: AllocationGroup[] = plannedGroups.length
    ? plannedGroups
    : [{ key: budgetScope, label: scopeLabel, items: [], onChange: () => undefined }];

  return (
    <AllocationFlow
      open={open}
      selectedMonth={selectedMonth}
      onSelectedMonthChange={onSelectedMonthChange}
      onCancel={onCancel}
      onComplete={onComplete}
      accounts={accounts}
      groups={groups}
      poolOverride={scopedPool}
      poolLabel={`${scopeLabel} pool`}
      title={`Plan ${scopeLabel}`}
      saveButtonLabel="Save plan"
      isUsingFallbackData={isUsingFallbackData}
      onSave={async ({ month, budgetItems, savingsItems, snapshot }) => {
        const response = await fetch("/api/monthly-planning/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, budgetItems, savingsItems, snapshot }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to save plan");
      }}
    />
  );
}

export default MonthlyPlanningFlow;
