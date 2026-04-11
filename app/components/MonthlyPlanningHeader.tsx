"use client";

import type { MonthlyPlanningSnapshot } from "./app-types";
import { NumbersHeaderCard } from "./NumbersHeaderCard";

type MonthlyPlanningHeaderProps = {
  monthLabel: string;
  snapshot: MonthlyPlanningSnapshot;
  isUsingFallbackData: boolean;
  compact?: boolean;
};

export function MonthlyPlanningHeader({
  monthLabel,
  snapshot,
  isUsingFallbackData,
  compact = false,
}: MonthlyPlanningHeaderProps) {
  return (
    <NumbersHeaderCard
      primary={{
        label: "Current balance",
        value: snapshot.availablePool,
        meta: monthLabel,
      }}
      secondary={{
        label: "Current left to assign",
        value: snapshot.leftToAssign,
        tone:
          snapshot.leftToAssign < 0
            ? "danger"
            : snapshot.leftToAssign === 0
              ? "warning"
              : "default",
      }}
      chip={isUsingFallbackData ? "Estimated" : undefined}
      sticky
      compact={compact}
    />
  );
}
