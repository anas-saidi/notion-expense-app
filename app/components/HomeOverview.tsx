import { ListChecks } from "lucide-react";
import { Money } from "./Money";
import type { MonthlySummary } from "./app-types";
import type { Scope } from "./HouseholdStatCard";
import { ChipTabs } from "./ui/ChipTabs";

type HomeOverviewProps = {
  onOpenPlan: () => void;
  monthlySummary: MonthlySummary;
  readyToAssignByScope: Record<Scope, number>;
  homeMonth: string;
  onHomeMonthChange: (month: string) => void;
  planDone?: boolean;
};

export function HomeOverview({
  onOpenPlan,
  monthlySummary,
  readyToAssignByScope,
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
  const available = isCurrentMonth ? readyToAssignByScope.household : totalAssigned - totalSpent;

  return (
    <section aria-label="Monthly budget hub" style={heroShellStyle}>
      <div style={heroHeaderStyle}>
        <ChipTabs
          items={chipTabItems}
          activeKey={homeMonth}
          ariaLabel="Select month"
          onChange={onHomeMonthChange}
        />

        <div key={homeMonth} style={{ ...heroHeaderAsideStyle, animation: "fadeUp 0.22s ease both" }}>
          <div style={heroRemainingWrapStyle}>
            <span style={heroRemainingLabelStyle}>
              {isCurrentMonth ? "Monthly overview" : "Month snapshot"}
            </span>
            <strong style={heroRemainingValueStyle(available < 0)}>
              {isCurrentMonth ? "Ready to assign" : formatMonthLabel(homeMonth)}
            </strong>
          </div>
          {!planDone && (
            <button
              type="button"
              className="cta-save"
              onClick={onOpenPlan}
              aria-label="Plan this month"
              title="Plan this month"
              style={planTriggerStyle}
            >
              <ListChecks size={17} />
            </button>
          )}
        </div>
      </div>

      <div style={summaryGridStyle}>
        <MetricCard label="Assigned" value={totalAssigned} tone="default" />
        <MetricCard label="Spent" value={totalSpent} tone="default" />
        <MetricCard
          label={isCurrentMonth ? "Ready" : "Available"}
          value={available}
          tone={available < 0 ? "danger" : "default"}
        />
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "danger";
}) {
  return (
    <div
      style={{
        ...metricCardStyle,
        background:
          tone === "danger"
            ? "color-mix(in srgb, var(--danger) 8%, white)"
            : "color-mix(in srgb, var(--surface2) 58%, white)",
      }}
    >
      <span style={metricLabelStyle}>{label}</span>
      <strong style={{ ...metricValueStyle, color: tone === "danger" ? "var(--danger)" : "var(--text)" }}>
        <Money value={Math.abs(value)} />
      </strong>
    </div>
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
  minWidth: 44,
  minHeight: 44,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  border: "1px solid color-mix(in srgb, var(--accent) 42%, transparent)",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  cursor: "pointer",
};

const heroShellStyle = {
  display: "grid",
  gap: 14,
  padding: "0 0 4px",
  animation: "fadeUp 0.36s 0.02s ease both",
};

const heroHeaderStyle = {
  display: "grid",
  gap: 12,
};

const heroHeaderAsideStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap" as const,
  minHeight: 44,
};

const heroRemainingWrapStyle = {
  display: "grid",
  gap: 3,
  minWidth: 0,
};

const heroRemainingLabelStyle = {
  fontSize: 11,
  letterSpacing: 0.22,
  textTransform: "uppercase" as const,
  color: "var(--muted)",
  fontWeight: 500,
};

const heroRemainingValueStyle = (isNegative: boolean) => ({
  color: isNegative ? "color-mix(in srgb, var(--danger) 78%, var(--text2))" : "var(--text2)",
  fontFamily: "var(--font-body)",
  fontSize: "clamp(0.98rem, 4vw, 1.12rem)",
  lineHeight: 1.05,
  letterSpacing: -0.04,
  fontWeight: 650,
});

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const metricCardStyle = {
  display: "grid",
  gap: 6,
  minWidth: 0,
  padding: "12px 12px 11px",
  borderRadius: 16,
};

const metricLabelStyle = {
  fontSize: 10,
  letterSpacing: 0.24,
  textTransform: "uppercase" as const,
  color: "var(--muted)",
};

const metricValueStyle = {
  fontSize: 13,
  lineHeight: 1.25,
  fontWeight: 760,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
};
