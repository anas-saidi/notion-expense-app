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
  const monthLabel = formatMonthLabel(monthlySummary.start);
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
  const householdRemaining = readyToAssignByScope.household ?? 0;

  return (
    <section
      aria-label="Shared budget"
      style={heroShellStyle}
    >
      <div style={heroHeaderStyle}>
        <div style={{ minWidth: 0 }}>
          <div style={heroEyebrowStyle}>
            This month
          </div>
          <h2 style={heroTitleStyle}>{monthLabel}</h2>
        </div>
        <div style={heroHeaderAsideStyle}>
          <div style={heroRemainingWrapStyle}>
            <span style={heroRemainingLabelStyle}>Still to assign</span>
            <strong style={heroRemainingValueStyle(householdRemaining < 0)}>
              {householdRemaining < 0 ? "-" : ""}
              {Math.abs(householdRemaining).toLocaleString("fr-MA")}
              <span style={{ marginLeft: 4, fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>MAD</span>
            </strong>
          </div>
          <button
            type="button"
            onClick={onOpenPlan}
            aria-label="Open monthly planning"
            title="Open monthly planning"
            style={planTriggerStyle}
          >
            <CalendarIcon />
            <span>Shared plan</span>
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

function formatMonthLabel(start: string) {
  const source = start || new Date().toISOString().slice(0, 10);
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return "This month";
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(parsed);
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
  minHeight: 44,
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--border2) 78%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 52%, white)",
  color: "var(--text2)",
  cursor: "pointer",
  boxShadow: "none",
  fontSize: 11,
  fontWeight: 600,
};

const heroShellStyle = {
  display: "grid",
  gap: 12,
  paddingBottom: 14,
  borderBottom: "1px solid color-mix(in srgb, var(--border2) 28%, transparent)",
  animation: "fadeUp 0.36s 0.02s ease both",
};

const heroHeaderStyle = {
  display: "grid",
  gap: 12,
};

const heroEyebrowStyle = {
  fontSize: 10,
  letterSpacing: 0.28,
  textTransform: "uppercase" as const,
  color: "color-mix(in srgb, var(--muted) 82%, transparent)",
  fontWeight: 600,
};

const heroTitleStyle = {
  marginTop: 4,
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.22rem, 5.1vw, 1.45rem)",
  lineHeight: 1.02,
  letterSpacing: -0.12,
  color: "var(--text2)",
  fontWeight: 600,
};

const heroHeaderAsideStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap" as const,
};

const heroRemainingWrapStyle = {
  display: "grid",
  gap: 3,
  minWidth: 0,
};

const heroRemainingLabelStyle = {
  fontSize: 9,
  letterSpacing: 0.22,
  textTransform: "uppercase" as const,
  color: "color-mix(in srgb, var(--muted) 82%, transparent)",
  fontWeight: 500,
};

const heroRemainingValueStyle = (isNegative: boolean) => ({
  color: isNegative ? "color-mix(in srgb, var(--danger) 78%, var(--text2))" : "var(--text2)",
  fontFamily: "var(--font-body)",
  fontSize: "clamp(0.92rem, 3.7vw, 1.06rem)",
  lineHeight: 1.05,
  letterSpacing: -0.04,
  fontWeight: 500,
});
