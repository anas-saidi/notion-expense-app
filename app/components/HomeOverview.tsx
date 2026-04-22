import type { Category, MonthlySummary } from "./app-types";
import { HouseholdStatCard, type Scope } from "./HouseholdStatCard";
import { CalendarIcon } from "./ui/icons";

type HomeOverviewProps = {
  onOpenPlan: () => void;
  categories: Category[];
  monthlySummary: MonthlySummary;
  scope: Scope;
  onScopeChange: (nextScope: Scope) => void;
  readyToAssignByScope: Record<Scope, number>;
  contributionDueByScope: { wife: number; husband: number; total: number };
  householdSpentByPartner: { wife: number; husband: number; other: number; total: number };
};

export function HomeOverview({
  onOpenPlan,
  categories,
  monthlySummary,
  scope,
  onScopeChange,
  readyToAssignByScope,
  contributionDueByScope,
  householdSpentByPartner,
}: HomeOverviewProps) {
  const wifeCategoryIds = new Set(
    categories
      .filter(isWifeCategory)
      .map((category) => category.id),
  );

  const husbandCategoryIds = new Set(
    categories
      .filter(isHusbandCategory)
      .map((category) => category.id),
  );

  const householdCategoryIds = new Set(
    categories
      .filter((category) => category.isTeamFund)
      .map((category) => category.id),
  );

  const householdAssigned = sumForCategoryIds(monthlySummary.assignedByCategory, householdCategoryIds);
  const householdSpent = sumForCategoryIds(monthlySummary.spentByCategory, householdCategoryIds);
  const wifeAssigned = sumForCategoryIds(monthlySummary.assignedByCategory, wifeCategoryIds);
  const wifeSpent = sumForCategoryIds(monthlySummary.spentByCategory, wifeCategoryIds);
  const husbandAssigned = sumForCategoryIds(monthlySummary.assignedByCategory, husbandCategoryIds);
  const husbandSpent = sumForCategoryIds(monthlySummary.spentByCategory, husbandCategoryIds);

  return (
    <section
      aria-label="Budget health"
      style={{
        display: "grid",
        gap: 10,
        paddingBottom: 14,
        borderBottom: "1px solid color-mix(in srgb, var(--border2) 62%, transparent)",
        animation: "fadeUp 0.36s 0.02s ease both",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: 0.3, textTransform: "uppercase", color: "color-mix(in srgb, var(--muted) 80%, #9a9288)" }}>
          Budget health
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={onOpenPlan}
            aria-label="Open monthly planning"
            title="Open monthly planning"
            style={planTriggerStyle}
          >
            <CalendarIcon />
          </button>
        </div>
      </div>
      <HouseholdStatCard
        views={{
          household: {
            planned: householdAssigned,
            spent: householdSpent,
          },
          wife: {
            planned: wifeAssigned,
            spent: wifeSpent,
          },
          husband: {
            planned: husbandAssigned,
            spent: husbandSpent,
          },
        }}
        scope={scope}
        onScopeChange={onScopeChange}
        readyToAssignByScope={readyToAssignByScope}
        contributionDueByScope={contributionDueByScope}
        householdSpentByPartner={householdSpentByPartner}
      />
    </section>
  );
}

function sumForCategoryIds(items: MonthlySummary["assignedByCategory"], categoryIds: Set<string>) {
  return items.reduce((sum, item) => {
    if (!categoryIds.has(item.categoryId)) return sum;
    return sum + item.total;
  }, 0);
}

function isWifeCategory(category: Category) {
  return !category.isTeamFund && (category.owner?.toLowerCase().includes("salma") ?? false);
}

function isHusbandCategory(category: Category) {
  return !category.isTeamFund && (category.owner?.toLowerCase().includes("anas") ?? false);
}

const planTriggerStyle = {
  width: 44,
  height: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  border: "1px solid color-mix(in srgb, var(--ink-strong) 6%, #e6ded2)",
  background: "linear-gradient(180deg, #fffdf8 0%, #fff9f2 100%)",
  color: "color-mix(in srgb, var(--text) 80%, #4a423a)",
  cursor: "pointer",
  boxShadow: "rgba(0,0,0,0.02) 0px 2px 6px, rgba(255,255,255,0.75) 0px 1px 0px inset",
};


