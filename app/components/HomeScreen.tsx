import { useMemo, useState } from "react";
import type { BudgetScope, Category, MonthlySummary } from "./app-types";
import { WalletCardSwitcher } from "./WalletCardSwitcher";
import { WalletDetailsSheet } from "./WalletDetailsSheet";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SearchIcon, SlidersIcon } from "./ui/icons";
import { BUDGET_SCOPE_LABELS, categoryMatchesScope } from "./app-utils";

type HomeScreenProps = {
  categories: Category[];
  selectedCategoryId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectCategory: (category: Category) => void;
  onOpenCategoryDetails: (category: Category) => void;
  onOpenAdd: () => void;
  onOpenPlan: () => void;
  onOpenRebalance: () => void;
  monthlySummary: MonthlySummary;
  walletSummaries?: Partial<Record<BudgetScope, MonthlySummary>>;
  readyToAssignByScope: Record<BudgetScope, number>;
  budgetScope: BudgetScope;
  onBudgetScopeChange: (scope: BudgetScope) => void;
  homeMonth: string;
  onHomeMonthChange: (month: string) => void;
  planDone?: boolean;
};

export function HomeScreen({
  categories,
  selectedCategoryId,
  search,
  onSearchChange,
  onSelectCategory,
  onOpenCategoryDetails,
  onOpenAdd,
  onOpenPlan,
  onOpenRebalance,
  monthlySummary,
  walletSummaries,
  readyToAssignByScope,
  budgetScope,
  onBudgetScopeChange,
  homeMonth,
  onHomeMonthChange,
  planDone,
}: HomeScreenProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Inline editing disabled. All edits must go through the category modal.
  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of monthlySummary.spentByCategory ?? []) {
      map.set(entry.categoryId, entry.total);
    }
    return map;
  }, [monthlySummary.spentByCategory]);

  // Use FUNDS_DB planned amounts from the summary so historical months show correct planned figures
  const plannedByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of monthlySummary.assignedByCategory ?? []) {
      map.set(entry.categoryId, entry.total);
    }
    return map;
  }, [monthlySummary.assignedByCategory]);

  const visibleCategories = useMemo(() => {
    return categories.filter((category) => categoryMatchesScope(category, budgetScope));
  }, [budgetScope, categories]);

  return (
    <div id="panel-home" role="tabpanel" aria-labelledby="tab-home">
      <div style={walletSwitcherWrapStyle}>
        <WalletCardSwitcher
          value={budgetScope}
          onChange={onBudgetScopeChange}
          monthlySummary={monthlySummary}
          walletSummaries={walletSummaries}
          onCardTap={() => setSheetOpen(true)}
        />
      </div>

      <WalletDetailsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        budgetScope={budgetScope}
        monthlySummary={monthlySummary}
        readyToAssign={readyToAssignByScope[budgetScope]}
        categories={categories}
        homeMonth={homeMonth}
        onHomeMonthChange={onHomeMonthChange}
      />

      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gap: 10,
            animation: "fadeUp 0.35s 0.04s ease both",
          }}
        >
          <div style={listHeaderStyle}>
            <div>
              <h2 style={listTitleStyle}>Categories</h2>
              <p style={listSubtitleStyle}>{visibleCategories.length} in {BUDGET_SCOPE_LABELS[budgetScope]}</p>
            </div>
            <button type="button" onClick={onOpenRebalance} style={rebalanceButtonStyle} aria-label="Rebalance budget">
              <SlidersIcon size={15} className="rebalance-btn-icon" />
            </button>
          </div>

          <label style={searchWrapStyle}>
            <SearchIcon size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
            <input
              type="text"
              aria-label="Search categories"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search categories"
              style={{
                flex: 1,
                minWidth: 0,
                background: "transparent",
                padding: 0,
                border: "none",
                fontSize: 15,
                color: "var(--text)",
                outline: "none",
              }}
            />
          </label>
        </div>

        <section className="home-category-list" style={categoryListStyle}>
          {visibleCategories.map((cat, i) => {
            const isCurrentMonth = homeMonth === new Date().toISOString().slice(0, 7);
            const planned = plannedByCategory.get(cat.id) ?? 0;
            const spent = spentByCategory.get(cat.id) ?? 0;
            // For current month use Notion's formula (includes carryover); compute for other months
            const available = isCurrentMonth
              ? (cat.available ?? planned - spent)
              : planned - spent;
            const livePlanned = planned;
            const spentPct = Math.min(100, (Math.max(0, spent) / Math.max(1, livePlanned)) * 100);
            const spentTone = spent > livePlanned
              ? "color-mix(in srgb, var(--spend-over) 75%, var(--spend-over-deep))"
              : spentPct >= 85
              ? "color-mix(in srgb, var(--spend-warn) 70%, var(--spend-warn-deep))"
              : spentPct >= 65
              ? "color-mix(in srgb, var(--spend-caution) 70%, var(--spend-caution-deep))"
              : "color-mix(in srgb, var(--accent) 65%, #d8f3c9)";

            return (
              <article key={cat.id} style={categoryRowWrapStyle}>
                <button
                  onClick={() => {
                    onSelectCategory(cat);
                    onOpenCategoryDetails(cat);
                  }}
                  style={{
                    ...categoryRowStyle,
                    ...(cat.id === selectedCategoryId ? selectedCategoryRowStyle : null),
                    animation: `fadeUp 0.28s ${i * 0.03}s ease both`,
                  }}
                >
                  <div
                    style={{
                      ...categoryIconWrapStyle,
                      background: cat.id === selectedCategoryId
                        ? "color-mix(in srgb, var(--accent) 16%, var(--surface2))"
                        : "var(--surface2)",
                      borderColor: cat.id === selectedCategoryId
                        ? "color-mix(in srgb, var(--accent) 32%, var(--card-border))"
                        : "var(--card-border)",
                    }}
                  >
                    <CategoryIcon icon={cat.icon} size={19} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
                    <div style={categoryTitleRowStyle}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: cat.id === selectedCategoryId ? 750 : 680,
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          minWidth: 0,
                        }}
                      >
                        {cat.name}
                      </div>
                      <span style={percentPillStyle(spent > livePlanned && livePlanned > 0)}>
                        {Math.round(spentPct)}%
                      </span>
                    </div>
                    <div style={spentBarTrackStyle} aria-hidden="true">
                      <div style={{ ...spentBarFillStyle, width: `${spentPct}%`, background: spentTone }} />
                    </div>
                    <div style={categoryMetaRowStyle}>
                      <span>Assigned <Money value={planned} /></span>
                      <span>Spent <Money value={spent} /></span>
                    </div>
                  </div>
                  <div style={availableStackStyle(available < 0)}>
                    <span style={availableLabelStyle}>Available</span>
                    <strong style={availableValueStyle}>
                      <Money value={available} />
                    </strong>
                  </div>
                </button>
              </article>
            );
          })}

          {visibleCategories.length === 0 && (
            <div style={emptyStateStyle}>
              <div style={emptyStateIconStyle}>
                <SearchIcon size={18} />
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ fontSize: 14, color: "var(--text)" }}>No categories found</strong>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  Try a different search or switch budget scope.
                </span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const categoryRowWrapStyle = {
  minWidth: 0,
};

const walletSwitcherWrapStyle = {
  paddingTop: 8,
  paddingBottom: 28,
  margin: "0 -20px",
};

const listHeaderStyle = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
};

const listTitleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: 22,
  lineHeight: 1,
  fontWeight: 780,
  color: "var(--text)",
};

const listSubtitleStyle = {
  marginTop: 8,
  fontSize: 12,
  color: "var(--muted)",
};

const rebalanceButtonStyle = {
  width: 44,
  height: 44,
  padding: 0,
  borderRadius: 12,
  border: "1px solid color-mix(in srgb, var(--border2) 58%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 48%, white)",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const searchWrapStyle = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 14,
  background: "color-mix(in srgb, var(--surface) 86%, var(--surface2))",
  border: "1px solid color-mix(in srgb, var(--border2) 55%, transparent)",
};

const categoryListStyle = {
  display: "grid",
  gap: 12,
  paddingBottom: 72,
};

const spentBarTrackStyle = {
  width: "100%",
  height: 6,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 65%, white)",
  overflow: "hidden",
  marginTop: 6,
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--border) 45%, transparent)",
};

const spentBarFillStyle = {
  height: "100%",
  borderRadius: 999,
  transition: "width 0.3s ease, background 0.4s ease",
};

const categoryRowStyle = {
  textAlign: "left" as const,
  width: "100%",
  minHeight: 78,
  padding: "14px 14px",
  background: "var(--surface)",
  border: "1px solid var(--card-border)",
  borderRadius: 16,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 12,
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
};

const selectedCategoryRowStyle = {
  borderColor: "color-mix(in srgb, var(--accent) 38%, var(--border))",
  background: "linear-gradient(180deg, color-mix(in srgb, var(--accent-dim) 35%, var(--surface)) 0%, var(--surface) 84%)",
};

const categoryIconWrapStyle = {
  width: 42,
  height: 42,
  borderRadius: 14,
  border: "1px solid var(--card-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  transition: "background-color 0.2s ease, border-color 0.2s ease",
};

const categoryTitleRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  minWidth: 0,
};

const categoryMetaRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  color: "var(--muted)",
  fontSize: 11,
  fontFamily: "'DM Mono', monospace",
  letterSpacing: 0.35,
  textTransform: "uppercase" as const,
};

const percentPillStyle = (isOver: boolean) => ({
  flexShrink: 0,
  minWidth: 38,
  textAlign: "center" as const,
  padding: "3px 7px",
  borderRadius: 999,
  background: isOver
    ? "color-mix(in srgb, var(--danger) 10%, white)"
    : "color-mix(in srgb, var(--surface2) 70%, white)",
  color: isOver ? "var(--danger)" : "var(--text2)",
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  fontWeight: 700,
});

const availableStackStyle = (isNegative: boolean) => ({
  textAlign: "right" as const,
  flexShrink: 0,
  display: "grid",
  gap: 4,
  justifyItems: "end",
  color: isNegative ? "var(--danger)" : "var(--text)",
  maxWidth: 112,
});

const availableLabelStyle = {
  fontSize: 10,
  letterSpacing: 0.4,
  textTransform: "uppercase" as const,
  color: "var(--muted)",
};

const availableValueStyle = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.4,
};

const emptyStateStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "18px 2px",
  color: "var(--muted)",
};

const emptyStateIconStyle = {
  width: 40,
  height: 40,
  borderRadius: 14,
  background: "color-mix(in srgb, var(--surface2) 76%, white)",
  border: "1px solid color-mix(in srgb, var(--border) 54%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--muted)",
};
