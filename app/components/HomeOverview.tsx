import { HomeBudgetChart } from "./HomeBudgetChart";
import type { Category, MonthlyCategoryTotal } from "./app-types";
import { Money } from "./Money";

type HomeOverviewProps = {
  categories: Category[];
  onOpenPlan: () => void;
  totalAssigned: number;
  totalSpent: number;
  assignedByCategory: MonthlyCategoryTotal[];
  spentByCategory: MonthlyCategoryTotal[];
};

export function HomeOverview({
  categories,
  onOpenPlan,
  totalAssigned,
  totalSpent,
  assignedByCategory,
  spentByCategory,
}: HomeOverviewProps) {
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
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--muted)" }}>
          Budget health
        </div>
        <button
          type="button"
          onClick={onOpenPlan}
          aria-label="Open monthly planning"
          title="Open monthly planning"
          style={planTriggerStyle}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7.5h16" />
            <path d="M7 3.5v4" />
            <path d="M17 3.5v4" />
            <rect x="4" y="6" width="16" height="14" rx="3" />
            <path d="M8 11h3" />
            <path d="M13 11h3" />
            <path d="M8 15h8" />
          </svg>
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--muted)" }}>
            Assigned this month
          </div>
          <div style={{ marginTop: 6, fontSize: 20, lineHeight: 1, color: "var(--text)", fontWeight: 700 }}>
            <Money value={totalAssigned} />
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--muted)" }}>
            Spent this month
          </div>
          <div style={{ marginTop: 6, fontSize: 20, lineHeight: 1, color: "var(--text)", fontWeight: 700 }}>
            <Money value={totalSpent} />
          </div>
        </div>
      </div>
      <HomeBudgetChart
        categories={categories}
        assignedByCategory={assignedByCategory}
        spentByCategory={spentByCategory}
      />
    </section>
  );
}

const planTriggerStyle = {
  width: 40,
  height: 40,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--border2) 72%, transparent)",
  background: "color-mix(in srgb, var(--surface) 88%, white)",
  color: "var(--text)",
  cursor: "pointer",
  boxShadow: "0 10px 22px color-mix(in srgb, var(--ink-strong) 8%, transparent)",
};
