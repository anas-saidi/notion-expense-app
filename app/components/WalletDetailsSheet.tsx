"use client";

import { useMemo, type CSSProperties } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { ChipTabs } from "./ui/ChipTabs";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import type { BudgetScope, Category, MonthlySummary } from "./app-types";
import { BUDGET_SCOPE_LABELS, fmt } from "./app-utils";

const WALLET_TYPE: Record<BudgetScope, string> = {
  joint: "Shared",
  anas: "Personal",
  salma: "Personal",
};

type WalletDetailsSheetProps = {
  open: boolean;
  onClose: () => void;
  budgetScope: BudgetScope;
  monthlySummary: MonthlySummary;
  readyToAssign: number;
  categories: Category[];
  homeMonth: string;
  onHomeMonthChange: (month: string) => void;
};

export function WalletDetailsSheet({
  open,
  onClose,
  budgetScope,
  monthlySummary,
  readyToAssign,
  categories,
  homeMonth,
  onHomeMonthChange,
}: WalletDetailsSheetProps) {
  const todayMonth = new Date().toISOString().slice(0, 7);
  const tabs = [shiftMonth(todayMonth, -1), todayMonth, shiftMonth(todayMonth, +1)].map((m) => ({
    key: m,
    label: monthLabel(m),
  }));

  const { totalAssigned, totalSpent } = monthlySummary;
  const available = totalAssigned - totalSpent;
  const isNegative = available < 0;

  const topCategories = useMemo(() => {
    return monthlySummary.spentByCategory
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((entry) => ({
        ...entry,
        category: categories.find((c) => c.id === entry.categoryId) ?? null,
      }))
      .filter((item) => item.category !== null);
  }, [monthlySummary.spentByCategory, categories]);

  const maxSpent = topCategories[0]?.total ?? 1;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={`${BUDGET_SCOPE_LABELS[budgetScope]} wallet details`}
      detent="content"
      snapPoints={[0, 0.82]}
      initialSnap={1}
    >
      <div style={sheetContentStyle}>
        {/* Month selector */}
        <div style={monthRowStyle}>
          <ChipTabs
            items={tabs}
            activeKey={homeMonth}
            ariaLabel="Select month"
            onChange={onHomeMonthChange}
          />
        </div>

        {/* Wallet identity */}
        <div style={walletHeaderStyle}>
          <span style={walletInitialStyle(budgetScope)}>{BUDGET_SCOPE_LABELS[budgetScope][0]}</span>
          <div>
            <p style={walletNameStyle(budgetScope)}>{BUDGET_SCOPE_LABELS[budgetScope]}</p>
            <p style={walletSubStyle}>{WALLET_TYPE[budgetScope]}</p>
          </div>
        </div>

        {/* Available — hero number */}
        <div style={heroBlockStyle}>
          <p style={heroLabelStyle}>Available to spend</p>
          <p style={heroValueStyle(isNegative)}>
            <Money value={available} absolute={isNegative} />
          </p>
          {totalAssigned > 0 && (
            <p style={heroContextStyle(budgetScope)}>
              {isNegative ? "over " : "of "}
              {fmt(totalAssigned)} MAD planned
            </p>
          )}
          {totalAssigned > 0 && (
            <div style={progressTrackStyle}>
              <div
                style={{
                  ...progressFillStyle,
                  width: `${Math.min(100, (totalSpent / totalAssigned) * 100)}%`,
                  background: isNegative
                    ? "var(--danger)"
                    : totalSpent / totalAssigned > 0.85
                      ? "var(--spend-warn)"
                      : progressColor(budgetScope),
                }}
              />
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={statsRowStyle}>
          <StatCell label="Assigned" value={totalAssigned} />
          <div style={statDividerStyle} />
          <StatCell label="Spent" value={totalSpent} />
          <div style={statDividerStyle} />
          <StatCell label="Left to assign" value={readyToAssign} />
        </div>

        {/* Top categories */}
        {topCategories.length > 0 && (
          <div style={categoriesBlockStyle}>
            <p style={sectionLabelStyle}>Top spending</p>
            <div style={{ display: "grid", gap: 10 }}>
              {topCategories.map(({ category, total }) => {
                if (!category) return null;
                const pct = Math.round((total / maxSpent) * 100);
                return (
                  <div key={category.id} style={catRowStyle}>
                    <div style={catIconWrapStyle}>
                      <CategoryIcon icon={category.icon} size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
                      <div style={catNameRowStyle}>
                        <span style={catNameStyle}>{category.name}</span>
                        <span style={catAmountStyle}>
                          <Money value={total} />
                        </span>
                      </div>
                      <div style={catBarTrackStyle}>
                        <div style={{ ...catBarFillStyle, width: `${pct}%`, background: progressColor(budgetScope) }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCellStyle}>
      <span style={statLabelStyle}>{label}</span>
      <strong style={statValueStyle}>
        <Money value={value} />
      </strong>
    </div>
  );
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit" }).format(new Date(`${ym}-01`));
}

function progressColor(scope: BudgetScope): string {
  if (scope === "anas") return "var(--partner-husband)";
  if (scope === "salma") return "var(--partner-wife)";
  return "var(--accent)";
}

// ─── Styles ────────────────────────────────────────────────────────────────

const sheetContentStyle: CSSProperties = {
  display: "grid",
  gap: 24,
  padding: "8px 20px 40px",
};

const monthRowStyle: CSSProperties = {
  display: "flex",
};

const walletHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const walletInitialStyle = (scope: BudgetScope): CSSProperties => ({
  width: 44,
  height: 44,
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  fontWeight: 800,
  fontFamily: "var(--font-display)",
  flexShrink: 0,
  background:
    scope === "anas"
      ? "color-mix(in srgb, var(--partner-husband) 18%, var(--surface2))"
      : scope === "salma"
        ? "color-mix(in srgb, var(--partner-wife) 18%, var(--surface2))"
        : "color-mix(in srgb, var(--accent) 18%, var(--surface2))",
  color:
    scope === "anas"
      ? "var(--partner-husband-strong)"
      : scope === "salma"
        ? "var(--partner-wife-strong)"
        : "var(--text)",
});

const walletNameStyle = (scope: BudgetScope): CSSProperties => ({
  fontSize: 17,
  fontWeight: 760,
  fontFamily: "var(--font-display)",
  color:
    scope === "anas"
      ? "var(--partner-husband-strong)"
      : scope === "salma"
        ? "var(--partner-wife-strong)"
        : "var(--text)",
  lineHeight: 1.1,
});

const walletSubStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  letterSpacing: 0.4,
  textTransform: "uppercase",
  fontWeight: 600,
  marginTop: 2,
};

const heroBlockStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const heroLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const heroValueStyle = (isNegative: boolean): CSSProperties => ({
  fontFamily: "var(--font-display)",
  fontSize: "clamp(2.8rem, 13vw, 4.5rem)",
  fontWeight: 800,
  lineHeight: 0.92,
  color: isNegative ? "var(--danger)" : "var(--text)",
  letterSpacing: -1,
});

const heroContextStyle = (scope: BudgetScope): CSSProperties => ({
  fontSize: 13,
  color:
    scope === "anas"
      ? "color-mix(in srgb, var(--partner-husband-strong) 70%, var(--muted))"
      : scope === "salma"
        ? "color-mix(in srgb, var(--partner-wife-strong) 70%, var(--muted))"
        : "var(--text2)",
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
});

const progressTrackStyle: CSSProperties = {
  width: "100%",
  height: 5,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 70%, white)",
  overflow: "hidden",
  marginTop: 4,
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 0.4s ease",
};

const statsRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: 0,
  padding: "16px 0",
  borderTop: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
};

const statDividerStyle: CSSProperties = {
  width: 1,
  background: "color-mix(in srgb, var(--border) 60%, transparent)",
  flexShrink: 0,
};

const statCellStyle: CSSProperties = {
  flex: 1,
  display: "grid",
  gap: 4,
  paddingInline: 12,
  textAlign: "center",
};

const statLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const statValueStyle: CSSProperties = {
  fontSize: 13,
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
};

const categoriesBlockStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const catRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const catIconWrapStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  background: "color-mix(in srgb, var(--surface2) 70%, white)",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const catNameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const catNameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 650,
  color: "var(--text2)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
};

const catAmountStyle: CSSProperties = {
  fontSize: 12,
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  color: "var(--text2)",
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: "\"tnum\"",
};

const catBarTrackStyle: CSSProperties = {
  width: "100%",
  height: 4,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 60%, white)",
  overflow: "hidden",
};

const catBarFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 0.3s ease",
};
