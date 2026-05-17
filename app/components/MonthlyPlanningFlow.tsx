"use client";

import { useEffect, useState } from "react";
import { AllocationFlow, type AllocationGroup } from "./AllocationFlow";
import type { Account, Category, MonthlyCategoryTotal, PlanningAllocationItem } from "./app-types";

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
  isUsingFallbackData,
}: MonthlyPlanningFlowProps) {
  const [householdItems, setHouseholdItems] = useState<PlanningAllocationItem[]>([]);
  const [wifeItems, setWifeItems] = useState<PlanningAllocationItem[]>([]);
  const [husbandItems, setHusbandItems] = useState<PlanningAllocationItem[]>([]);
  const [savingsItems, setSavingsItems] = useState<PlanningAllocationItem[]>([]);

  useEffect(() => {
    const plannedByCategory = new Map(assignedByCategory.map((item) => [item.categoryId, item.total]));
    const resolvePlannedAmount = (category: Category) => (plannedByCategory.has(category.id) ? plannedByCategory.get(category.id) ?? 0 : 0);

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

    const savingsCategories = categories.filter(isSavingsCategory);
    const householdCategories = categories.filter(isHouseholdCategory);
    const wifeCategories = categories.filter((category) => !isHouseholdCategory(category) && isWifeCategory(category));
    const husbandCategories = categories.filter((category) => !isHouseholdCategory(category) && isHusbandCategory(category));
    const fallbackHouseholdCategories = categories.filter(
      (category) => !isHouseholdCategory(category) && !isSavingsCategory(category) && !isWifeCategory(category) && !isHusbandCategory(category),
    );

    const toItem = (category: Category) => toAllocationItem(category, resolvePlannedAmount(category));
    setHouseholdItems([...householdCategories, ...fallbackHouseholdCategories].map(toItem));
    setWifeItems(wifeCategories.map(toItem));
    setHusbandItems(husbandCategories.map(toItem));
    setSavingsItems(savingsCategories.map(toItem));
  }, [categories, assignedByCategory]);

  const groups: AllocationGroup[] = [
    { key: "household", label: "Joint", items: householdItems, onChange: setHouseholdItems },
    { key: "wife", label: "Salma", items: wifeItems, onChange: setWifeItems },
    { key: "husband", label: "Anas", items: husbandItems, onChange: setHusbandItems },
    { key: "savings", label: "Savings", items: savingsItems, onChange: setSavingsItems },
  ];

  return (
    <AllocationFlow
      open={open}
      selectedMonth={selectedMonth}
      onSelectedMonthChange={onSelectedMonthChange}
      onCancel={onCancel}
      onComplete={onComplete}
      accounts={accounts}
      groups={groups}
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
