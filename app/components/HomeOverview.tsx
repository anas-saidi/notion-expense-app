import { ListChecks } from "lucide-react";
import { Money } from "./Money";
import type { BudgetScope, MonthlySummary } from "./app-types";
import { ChipTabs } from "./ui/ChipTabs";
import { BUDGET_SCOPE_LABELS } from "./app-utils";

type HomeOverviewProps = {
  onOpenPlan: () => void;
  monthlySummary: MonthlySummary;
  readyToAssignByScope: Record<BudgetScope, number>;
  budgetScope: BudgetScope;
  homeMonth: string;
  onHomeMonthChange: (month: string) => void;
  planDone?: boolean;
};

export function HomeOverview({
  onOpenPlan,
  monthlySummary,
  readyToAssignByScope,
  budgetScope,
  homeMonth,
  onHomeMonthChange,
  planDone,
}: HomeOverviewProps) {
  const todayMonth = new Date().toISOString().slice(0, 7);
  const tabs = [shiftMonth(todayMonth, -1), todayMonth, shiftMonth(todayMonth, +1)] as const;
  const isCurrentMonth = homeMonth === todayMonth;
  const chipTabItems = tabs.map((month) => ({
    key: month,
    label: monthShortLabel(month),
  }));

  const totalAssigned = monthlySummary.totalAssigned;
  const totalSpent = monthlySummary.totalSpent;
  const available = isCurrentMonth ? readyToAssignByScope[budgetScope] : totalAssigned - totalSpent;
  const primaryLabel = isCurrentMonth ? "Left to assign" : "Available";

  return (
    <section aria-label="Monthly budget hub" className="home-hero" style={heroShellStyle}>
      <div style={heroToolbarStyle}>
        <div style={monthTabsWrapStyle}>
          <ChipTabs
            items={chipTabItems}
            activeKey={homeMonth}
            ariaLabel="Select month"
            onChange={onHomeMonthChange}
          />
        </div>
        {!planDone && (
          <button
            type="button"
            className="cta-save home-hero__plan"
            onClick={onOpenPlan}
            aria-label="Plan this month"
            title="Plan this month"
            style={planTriggerStyle}
          >
            <ListChecks size={18} />
          </button>
        )}
      </div>

      <div key={homeMonth} style={{ ...heroCopyStyle, animation: "fadeUp 0.22s ease both" }}>
        <div style={heroRemainingWrapStyle}>
          <span style={heroRemainingLabelStyle}>
            {BUDGET_SCOPE_LABELS[budgetScope]} {primaryLabel}
          </span>
          <strong style={heroRemainingValueStyle(available < 0)}>
            <Money value={available} absolute={!isCurrentMonth && available < 0} />
          </strong>
          <span style={heroRemainingMetaStyle}>
            {isCurrentMonth ? "Unassigned money for this month" : formatMonthLabel(homeMonth)}
          </span>
          {(totalAssigned > 0 || totalSpent > 0) && (
            <span style={heroSummaryLineStyle}>
              <Money value={totalAssigned} /> assigned · <Money value={totalSpent} /> spent
            </span>
          )}
        </div>
      </div>
    </section>
  );
}


function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthShortLabel(ym: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit" }).format(new Date(`${ym}-01`));
}

function formatMonthLabel(ym: string) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${ym}-01`));
}

const planTriggerStyle = {
  width: 52,
  height: 52,
  padding: 0,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 16,
  border: "1px solid color-mix(in srgb, var(--border2) 54%, transparent)",
  background: "var(--surface)",
  color: "var(--success)",
  cursor: "pointer",
  boxShadow: "0 8px 18px color-mix(in srgb, var(--ink-strong) 6%, transparent)",
};

const heroShellStyle = {
  display: "grid",
  gap: 22,
  padding: "18px 18px 20px",
  borderRadius: 24,
  border: "1px solid color-mix(in srgb, var(--border) 68%, transparent)",
  background:
    "radial-gradient(circle at 78% 30%, color-mix(in srgb, var(--accent) 18%, transparent) 0 22%, transparent 42%), linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, var(--accent-dim)) 0%, var(--surface) 72%)",
  boxShadow: "0 18px 38px color-mix(in srgb, var(--ink-strong) 8%, transparent)",
  animation: "fadeUp 0.36s 0.02s ease both",
};

const heroToolbarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minWidth: 0,
};

const monthTabsWrapStyle = {
  minWidth: 0,
  flex: 1,
};


const heroCopyStyle = {
  display: "grid",
  minWidth: 0,
};

const heroRemainingWrapStyle = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const heroRemainingLabelStyle = {
  fontSize: 10,
  letterSpacing: 0.36,
  textTransform: "uppercase" as const,
  color: "var(--muted)",
  fontWeight: 700,
};

const heroRemainingValueStyle = (isNegative: boolean) => ({
  color: isNegative ? "var(--danger)" : "var(--text)",
  fontFamily: "var(--font-display)",
  fontSize: "clamp(3.2rem, 15vw, 5.35rem)",
  lineHeight: 0.92,
  letterSpacing: 0,
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
});

const heroRemainingMetaStyle = {
  color: "var(--text2)",
  fontSize: 13,
  lineHeight: 1.35,
};

const heroSummaryLineStyle = {
  fontSize: 12,
  color: "var(--muted)",
  letterSpacing: 0.1,
};
