"use client";

import { useEffect, useState } from "react";
import { AllocationFlow, type AllocationGroup } from "./AllocationFlow";
import type { Account, Category, MonthlyCategoryTotal, PlanningAllocationItem } from "./app-types";
import { categoryMatchesScope } from "./app-utils";

type JointAllocateSheetProps = {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
  accounts: Account[];
  categories: Category[];
  assignedByCategory?: MonthlyCategoryTotal[];
  selectedMonth: string;
  jointUnassigned: number;
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

export function JointAllocateSheet({
  open,
  onClose,
  onComplete,
  accounts,
  categories,
  assignedByCategory = [],
  selectedMonth,
  jointUnassigned,
}: JointAllocateSheetProps) {
  const [items, setItems] = useState<PlanningAllocationItem[]>([]);
  // Snapshot of already-planned joint amounts, taken at load time — never from
  // live edits (see AllocationFlow's own note on why this must stay stable).
  const [initialAssigned, setInitialAssigned] = useState(0);

  useEffect(() => {
    if (!open) return;
    const plannedByCategory = new Map(assignedByCategory.map((entry) => [entry.categoryId, entry.total]));
    const jointCategories = categories.filter((category) => categoryMatchesScope(category, "joint"));
    const nextItems = jointCategories.map((category) =>
      toAllocationItem(category, plannedByCategory.get(category.id) ?? 0),
    );
    setItems(nextItems);
    setInitialAssigned(nextItems.reduce((sum, item) => sum + item.amount, 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, categories, assignedByCategory]);

  const pool = Math.max(0, jointUnassigned) + initialAssigned;

  const groups: AllocationGroup[] = [
    { key: "joint", label: "Joint", items, onChange: setItems },
  ];

  return (
    <AllocationFlow
      open={open}
      selectedMonth={selectedMonth}
      onCancel={onClose}
      onComplete={onComplete}
      accounts={accounts}
      groups={groups}
      poolOverride={pool}
      poolLabel="Joint balance"
      title="Allocate Joint Balance"
      balancedLabel="Fully allocated"
      saveButtonLabel="Allocate"
      heroPool
      headerControls={<></>}
      onSave={async ({ month, budgetItems, snapshot }) => {
        const response = await fetch("/api/monthly-planning/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, budgetItems, snapshot }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to allocate");
      }}
    />
  );
}
