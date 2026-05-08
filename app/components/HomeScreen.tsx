import { useMemo, useState } from "react";
import type { Category, MonthlySummary } from "./app-types";
import { HomeOverview } from "./HomeOverview";
import type { Scope } from "./HouseholdStatCard";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { ChipTabs } from "./ui/ChipTabs";
import { PlusIcon, SearchIcon, SlidersIcon } from "./ui/icons";

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
  readyToAssignByScope: Record<Scope, number>;
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
  readyToAssignByScope,
  homeMonth,
  onHomeMonthChange,
  planDone,
}: HomeScreenProps) {
  const [scope, setScope] = useState<Scope>("household");
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
    if (scope === "household") return categories.filter(isHouseholdCategory);
    if (scope === "wife") return categories.filter(isWifeCategory);
    return categories.filter(isHusbandCategory);
  }, [categories, scope]);

  return (
    <div id="panel-home" role="tabpanel" aria-labelledby="tab-home">
      <div style={stickyHeaderWrapStyle}>
        <HomeOverview
          onOpenPlan={onOpenPlan}
          monthlySummary={monthlySummary}
          readyToAssignByScope={readyToAssignByScope}
          homeMonth={homeMonth}
          onHomeMonthChange={onHomeMonthChange}
          planDone={planDone}
        />
      </div>

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
              <p style={listSubtitleStyle}>{visibleCategories.length} in {scopeLabel(scope)}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onOpenRebalance} style={rebalanceButtonStyle}>
                <SlidersIcon size={13} className="rebalance-btn-icon" />
                Rebalance
              </button>
              <button type="button" onClick={onOpenAdd} style={quickAddStyle}>
                <PlusIcon size={13} />
                Add
              </button>
            </div>
          </div>

          <ChipTabs
            items={[
              { key: "household", label: "Joint" },
              { key: "wife", label: "Salma" },
              { key: "husband", label: "Anas" },
            ]}
            activeKey={scope}
            ariaLabel="Category scope"
            onChange={(nextScope) => setScope(nextScope as Scope)}
          />

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
                        ? "color-mix(in srgb, var(--accent) 18%, white)"
                        : "color-mix(in srgb, var(--surface2) 72%, white)",
                      borderColor: cat.id === selectedCategoryId
                        ? "color-mix(in srgb, var(--accent) 35%, transparent)"
                        : "color-mix(in srgb, var(--border) 58%, transparent)",
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

function isWifeCategory(category: Category) {
  return !category.isTeamFund && (category.owner?.toLowerCase().includes("salma") ?? false);
}

function isHusbandCategory(category: Category) {
  return !category.isTeamFund && (category.owner?.toLowerCase().includes("anas") ?? false);
}

function isHouseholdCategory(category: Category) {
  if (category.isTeamFund) return true;
  return category.type.some((value) => {
    const normalized = value.toLowerCase();
    return normalized.includes("team") || normalized.includes("household");
  });
}

const categoryRowWrapStyle = {
  minWidth: 0,
};

const stickyHeaderWrapStyle = {
  position: "sticky" as const,
  top: "calc(var(--safe-top) + 8px)",
  zIndex: 10,
  background: "var(--bg)",
  paddingBottom: 16,
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
  marginTop: 5,
  fontSize: 12,
  color: "var(--muted)",
};

const rebalanceButtonStyle = {
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid color-mix(in srgb, var(--border2) 58%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 48%, white)",
  color: "var(--text2)",
  fontSize: 12,
  fontWeight: 680,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

const quickAddStyle = {
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid color-mix(in srgb, var(--accent) 36%, transparent)",
  background: "color-mix(in srgb, var(--accent) 14%, white)",
  color: "var(--accent-ink)",
  fontSize: 12,
  fontWeight: 750,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
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
  gap: 10,
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
  padding: "12px 12px",
  background: "color-mix(in srgb, var(--surface) 92%, white)",
  border: "1px solid color-mix(in srgb, var(--border) 54%, transparent)",
  borderRadius: 16,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 12,
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 5%, transparent)",
};

const selectedCategoryRowStyle = {
  borderColor: "color-mix(in srgb, var(--accent) 38%, var(--border))",
  background: "linear-gradient(180deg, color-mix(in srgb, var(--accent-dim) 35%, var(--surface)) 0%, var(--surface) 84%)",
};

const categoryIconWrapStyle = {
  width: 42,
  height: 42,
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--border) 58%, transparent)",
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
  fontSize: 10,
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
  fontSize: 12,
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

function scopeLabel(scope: Scope) {
  if (scope === "wife") return "Salma";
  if (scope === "husband") return "Anas";
  return "Joint";
}
