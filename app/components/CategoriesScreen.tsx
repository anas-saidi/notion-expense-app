"use client";

import { useMemo, useState, useRef, useEffect, type CSSProperties } from "react";
import type { Account, BudgetScope, Category, MonthlySummary } from "./app-types";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { CheckIcon, ChevronRightIcon, PlusIcon, TransferIcon } from "./ui/icons";
import { ScreenChip } from "./ui/ScreenChip";
import { SearchField } from "./ui/SearchField";
import { AnimatedCounter } from "./ui/AnimatedCounter";
import { Banner } from "./ui/Banner";
import { BUDGET_SCOPE_LABELS, fmt, getCategoryScope, scopeFromAccountLabel } from "./app-utils";

type Props = {
  categories: Category[];
  frozenCategories: Category[];
  accounts: Account[];
  readyToAssignByScope: Record<BudgetScope, number>;
  contributionRemainingByScope: Record<BudgetScope, number>;
  monthlySummary: MonthlySummary;
  homeMonth: string;
  budgetScope: BudgetScope;
  selectedCategoryId: string;
  onSelectCategory: (cat: Category) => void;
  onOpenCategoryDetails: (cat: Category) => void;
  onOpenRebalance: () => void;
  onFreezeCategory: (cat: Category) => void;
  onReviveCategory: (cat: Category) => void;
  onFundCategory: (cat: Category) => void;
  onMoveContribution: () => void;
  onOpenNewCategory?: (defaultType: string) => void;
  loading?: boolean;
};

type ScopeChip = BudgetScope;
type Health = "over" | "low" | "funded" | "unfunded";

const HEALTH_SORT: Record<Health, number> = { over: 0, low: 1, funded: 2, unfunded: 3 };


function getHealth(spent: number, assigned: number, available: number | null): Health {
  if (available !== null && available < 0) return "over";
  if (assigned <= 0) return "unfunded";
  if ((spent / assigned) >= 0.82) return "low";
  return "funded";
}

/* ─── Main screen ─────────────────────────────────────────────── */

export function CategoriesScreen({
  categories,
  frozenCategories,
  accounts,
  readyToAssignByScope,
  contributionRemainingByScope,
  monthlySummary,
  homeMonth,
  budgetScope,
  onOpenCategoryDetails,
  onOpenRebalance,
  onFreezeCategory,
  onReviveCategory,
  onFundCategory,
  onMoveContribution,
  onOpenNewCategory,
  loading = false,
}: Props) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showFrozenAll, setShowFrozenAll] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  useEffect(() => {
    const openSearch = () => setSearchOpen(true);
    window.addEventListener("open-budget-search", openSearch);
    return () => window.removeEventListener("open-budget-search", openSearch);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthlySummary.spentByCategory ?? []) map.set(e.categoryId, e.total);
    return map;
  }, [monthlySummary.spentByCategory]);

  const plannedByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthlySummary.assignedByCategory ?? []) map.set(e.categoryId, e.total);
    return map;
  }, [monthlySummary.assignedByCategory]);

  const activeGroups = useMemo(() => {
    const q = search.toLowerCase().trim();
    const items = categories
      .filter(cat => {
        if (q && !cat.name.toLowerCase().includes(q) && !cat.type.some(t => t.toLowerCase().includes(q))) return false;
        if (getCategoryScope(cat, accounts) !== budgetScope) return false;
        return true;
      })
      .map(cat => {
        const assigned = plannedByCategory.get(cat.id) ?? 0;  // this month's Funds DB
        const spent = spentByCategory.get(cat.id) ?? 0;
        const available = cat.available;                       // Notion formula, no math
        const health = getHealth(spent, assigned, cat.available);
        const section = cat.type[0] ?? "Other";
        return { cat, planned: assigned, spent, available, health, section };
      })
      .sort((a, b) => HEALTH_SORT[a.health] - HEALTH_SORT[b.health]);

    const map = new Map<string, typeof items>();
    for (const row of items) {
      if (!map.has(row.section)) map.set(row.section, []);
      map.get(row.section)!.push(row);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [categories, search, budgetScope, accounts, spentByCategory, plannedByCategory]);

  const visibleSection = activeGroups.some(group => group.label === selectedSection)
    ? selectedSection
    : activeGroups[0]?.label ?? null;
  const visibleGroup = activeGroups.find(group => group.label === visibleSection);
  const budgetHealth = useMemo(() => {
    const rows = activeGroups.flatMap(group => group.items);
    // Available is the authoritative category balance: it includes carryover,
    // reversals, transfers, and expenses, unlike planned minus spent.
    const remaining = rows.reduce((sum, row) => sum + Math.max(0, row.available ?? 0), 0);
    return { remaining };
  }, [activeGroups]);
  const leftToAllocate = useMemo(
    () => readyToAssignByScope[budgetScope] ?? 0,
    [readyToAssignByScope, budgetScope],
  );
  const contributionRemaining = contributionRemainingByScope[budgetScope] ?? 0;
  const scopedBalance = useMemo(
    () => accounts.reduce((sum, account) => {
      const scope = scopeFromAccountLabel(account.label);
      return scope === null || scope === budgetScope ? sum + (account.balance ?? 0) : sum;
    }, 0),
    [accounts, budgetScope],
  );
  const monthLabel = useMemo(() => {
    const parsed = /^\d{4}-\d{2}$/.test(homeMonth) ? new Date(`${homeMonth}-01T12:00:00`) : new Date(homeMonth);
    return Number.isNaN(parsed.getTime()) ? "Monthly budget" : parsed.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [homeMonth]);

  const hasScopedCategories = categories.some(cat => getCategoryScope(cat, accounts) === budgetScope);

  return (
    <div id="panel-budget" role="tabpanel" aria-labelledby="tab-budget" className="categories-main" style={wrapStyle}>

      {/* Search */}
      {hasScopedCategories && searchOpen && (
        <SearchField
          ref={searchInputRef}
          value={search}
          onChange={setSearch}
          onClose={() => { setSearch(""); setSearchOpen(false); }}
          placeholder="Search categories"
          ariaLabel="Search categories"
        />
      )}

      {/* Active groups */}
      {activeGroups.length === 0
        ? hasScopedCategories
          ? <div style={emptyStyle}>No categories match “{search}”.</div>
          : onOpenNewCategory
            ? <button type="button" className="budget-empty-action" style={emptyActionStyle} onClick={() => onOpenNewCategory("Other")}>
                <PlusIcon size={15} />
                Add the first {BUDGET_SCOPE_LABELS[budgetScope].toLowerCase()} category
              </button>
            : null
        : <>
            <section aria-label={`${fmt(Math.round(budgetHealth.remaining))} MAD allocated in ${monthLabel}; ${fmt(Math.round(leftToAllocate))} MAD left to allocate; ${fmt(Math.round(scopedBalance))} MAD account balance`} style={budgetHealthStyle}>
              <span style={budgetHealthTitleStyle}>{monthLabel}</span>
              <span style={budgetHealthLabelStyle}>Allocated</span>
              <span style={budgetHealthAmountStyle}>
                <AnimatedCounter value={budgetHealth.remaining} animateOnMount />
                <small style={budgetHealthCurrencyStyle}>MAD</small>
              </span>
              <span style={budgetHealthSecondaryRowStyle}>
                <span style={budgetHealthSecondaryStyle}>
                  <span>Left</span>
                  <strong>{fmt(Math.round(leftToAllocate))} MAD</strong>
                </span>
                <span style={budgetHealthSecondaryStyle}>
                  <span>Balance</span>
                  <strong>{fmt(Math.round(scopedBalance))} MAD</strong>
                </span>
              </span>
            </section>

            {budgetScope !== "joint" && contributionRemaining > 0 && (
              <Banner
                tone="accent"
                icon={<TransferIcon size={18} strokeWidth={2.2} />}
                title={`${fmt(Math.round(contributionRemaining))} MAD still due to Joint`}
                action={(
                  <button type="button" onClick={onMoveContribution} style={contributionActionStyle}>
                    Move money
                  </button>
                )}
              >
                Transfer the remaining contribution from your personal account.
              </Banner>
            )}

            <div role="tablist" aria-label="Budget category groups" style={groupPillsStyle}>
              {activeGroups.map(group => {
                const selected = !showFrozenAll && group.label === visibleSection;
                const groupAvailable = group.items.reduce((sum, item) => sum + (item.available ?? 0), 0);
                return (
                  <ScreenChip
                    key={group.label}
                    mode="tab"
                    selected={selected}
                    ariaLabel={`${group.label}, ${fmt(Math.round(groupAvailable))} MAD available`}
                    onClick={() => { setShowFrozenAll(false); setSelectedSection(group.label); }}
                    badge={fmt(Math.round(groupAvailable))}
                    badgeTone="metric"
                  >
                    {group.label}
                  </ScreenChip>
                );
              })}
              {frozenCategories.length > 0 && (
                <ScreenChip
                  mode="tab"
                  selected={showFrozenAll}
                  ariaLabel={`Frozen, ${frozenCategories.length} categories`}
                  onClick={() => setShowFrozenAll(true)}
                  badge={frozenCategories.length}
                >
                  Frozen
                </ScreenChip>
              )}
            </div>

            {!showFrozenAll && loading && (
              <section aria-label="Loading budget categories" aria-busy="true" style={{ minWidth: 0 }}>
                <span style={srOnlyStyle} role="status">Loading budget categories</span>
                <div style={railStyle}>
                  {Array.from({ length: 3 }, (_, index) => <CategoryCardSkeleton key={index} />)}
                </div>
              </section>
            )}
            {!showFrozenAll && !loading && visibleGroup && (
              <section key={visibleGroup.label} style={{ minWidth: 0 }} aria-label={`${visibleGroup.label} categories`}>
                <div className="home-scroll-rail" style={railStyle}>
                  {visibleGroup.items.map(({ cat, available, spent, planned, health }, i) => (
                    <CategoryCard
                      key={cat.id}
                      cat={cat}
                      available={available}
                      spent={spent}
                      planned={planned}
                      health={health}
                      index={i}
                      onOpenDetails={() => onOpenCategoryDetails(cat)}
                    />
                  ))}
                  {onOpenNewCategory && (
                    <button
                      type="button"
                      onClick={() => onOpenNewCategory(visibleGroup.label)}
                      aria-label={`Add new ${visibleGroup.label} category`}
                      className="ghost-card"
                      style={ghostCardStyle}
                    >
                      <PlusIcon size={20} style={{ color: "var(--muted)", opacity: 0.55 }} />
                    </button>
                  )}
                </div>
              </section>
            )}
            {showFrozenAll && (
              <section style={{ minWidth: 0 }} aria-label="Frozen categories">
                <div className="home-scroll-rail" style={railStyle}>
                  {frozenCategories.map((cat, i) => (
                    <SwipeToDelete key={cat.id} variant="restore" deleteLabel={`Restore ${cat.name}`} onDelete={() => { onReviveCategory(cat); return true; }}>
                      <button type="button" onClick={() => onOpenCategoryDetails(cat)} style={{ ...frozenRowStyle, animation: `fadeUp 0.22s ${Math.min(i * 0.025, 0.2)}s ease both` }} aria-label={cat.name}>
                        <CategoryIcon icon={cat.icon} size={24} style={{ opacity: 0.5, flexShrink: 0 }} />
                        <span style={frozenNameStyle}>{cat.name}</span>
                        <ChevronRightIcon size={16} aria-hidden="true" style={{ color: "var(--muted)" }} />
                      </button>
                    </SwipeToDelete>
                  ))}
                </div>
              </section>
            )}
          </>
      }

    </div>
  );
}

function CategoryCardSkeleton() {
  return (
    <div className="budget-category-skeleton" style={skeletonCardStyle} aria-hidden="true">
      <span className="skeleton" style={skeletonIconStyle} />
      <div style={skeletonContentStyle}>
        <div style={skeletonTopStyle}>
          <span className="skeleton" style={{ width: "32%", height: 18, borderRadius: 5 }} />
          <span className="skeleton" style={{ width: 76, height: 18, borderRadius: 5 }} />
        </div>
        <span className="skeleton" style={{ width: "100%", height: 6, borderRadius: 999 }} />
        <span className="skeleton" style={{ width: 88, height: 12, borderRadius: 4 }} />
      </div>
    </div>
  );
}

/* ─── Category card (owns count-up + bar animation) ───────────── */

function CategoryCard({
  cat, available, spent, planned, health, index, onOpenDetails,
}: {
  cat: import("./app-types").Category;
  available: number | null; spent: number; planned: number;
  health: Health; index: number;
  onOpenDetails: () => void;
}) {
  const amountNum = Math.abs(available ?? 0);
  const availableAmount = Math.max(0, available ?? 0);
  const barTotal = Math.max(planned, spent + availableAmount, 1);
  const spentPct = Math.min(100, (spent / barTotal) * 100);
  const availablePct = Math.min(Math.max(0, 100 - spentPct), (availableAmount / barTotal) * 100);

  // Animate between values on updates; show instantly on mount
  const displayAmount = useCountUp(amountNum, 580);
  const amountStr = available === null ? "—" : fmt(Math.round(displayAmount));
  const unitStr   = available === null ? "" : "MAD";

  return (
    <div
      style={{ ...cardStyle, animation: `fadeUp 0.22s ${Math.min(index * 0.025, 0.2)}s ease both` }}
    >
      <span style={categoryIconStageStyle} aria-hidden="true">
        <CategoryIcon icon={cat.icon} size={36} decorative />
      </span>
      <button type="button" onClick={onOpenDetails} style={cardBodyStyle}
        aria-label={`${cat.name}${health === "over" ? ", overbudget" : health === "low" ? ", low" : health === "funded" ? ", funded" : ", unfunded"}`}>
        <span style={categoryContentStyle}>
          <span style={cardTopStyle}>
            <span style={cardNameStyle}>{cat.name}</span>
            <span style={cardBottomStyle}>
              <span style={cardAmountStyle(health)}>{amountStr}</span>
              <span style={cardUnitStyle}>{unitStr}</span>
            </span>
          </span>
          <span style={budgetBarStyle} aria-hidden="true">
            {health === "over" ? (
              <span style={{ ...budgetBarSegmentStyle, width: "100%", background: "var(--danger)" }} />
            ) : (
              <>
                <span style={{ ...budgetBarSegmentStyle, width: `${spentPct}%`, background: health === "low" ? "var(--warning-dim)" : "var(--accent-dim)" }} />
                <span style={{ ...budgetBarSegmentStyle, width: `${availablePct}%`, background: health === "low" ? "var(--warning)" : "var(--accent)" }} />
              </>
            )}
          </span>
          <span style={budgetMetaStyle}>
            <span style={budgetSpentStyle(spent)}>{fmt(Math.round(spent))} spent</span>
            {health === "over" && <span>{fmt(Math.round(Math.abs(available ?? 0)))} overspent</span>}
          </span>
        </span>
      </button>
    </div>
  );
}

/* ─── Count-up animation hook ──────────────────────────────────── */

function useCountUp(target: number, duration = 750, from = target): number {
  const [display, setDisplay] = useState(from);
  const prevTarget = useRef(from);
  useEffect(() => {
    const startFrom = prevTarget.current;
    prevTarget.current = target;
    if (startFrom === target) return;
    const startTime = performance.now();
    let raf: number;
    function step(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(startFrom + eased * (target - startFrom)));
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      prevTarget.current = startFrom; // reset so effect re-runs (e.g. Strict Mode) restart the animation
    };
  }, [target, duration]);
  return display;
}

/* ─── Budget Distribution Chart ───────────────────────────────── */

function BudgetDistributionChart({
  categories,
  monthlySummary,
  homeMonth,
  scope,
  onSelectCategory,
}: {
  categories: Category[];
  monthlySummary: MonthlySummary;
  homeMonth: string;
  scope: ScopeChip;
  onSelectCategory: (cat: Category) => void;
}) {
  const chartData = useMemo(() => {
    const scopedCategories = categories.filter(cat => getCategoryScope(cat) === scope);
    const items = scopedCategories
      .map(cat => {
        const available = Math.max(0, cat.available ?? 0);
        return { cat, available };
      })
      .filter(({ available }) => available > 0)
      .sort((a, b) => b.available - a.available);

    const total = items.reduce((s, { available }) => s + available, 0);
    return { items, total, hasCategories: scopedCategories.length > 0 };
  }, [categories, scope]);
  const countedTotal = useCountUp(chartData.total);
  const largest = chartData.items[0]?.available ?? 1;

  // ── All spent empty state ──────────────────────────────────────
  if (chartData.total === 0 || chartData.items.length === 0) {
    return (
      <div style={{ ...chartWrapStyle, animation: "modeIn 180ms cubic-bezier(0.22,1,0.36,1) both" }}>
        <div style={emptyChartStyle}>
          {chartData.hasCategories ? <CheckIcon size={24} /> : <PlusIcon size={22} />}
          <strong>{chartData.hasCategories ? "Nothing left" : "No categories yet"}</strong>
          <span>{chartData.hasCategories ? "All available funds are assigned or spent." : "Add a category below to start planning."}</span>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="budget-available-heading" style={{ ...chartWrapStyle, animation: "modeIn 180ms var(--ease-standard) both" }}>
      <div style={chartSummaryStyle}>
        <div>
          <span id="budget-available-heading" style={chartEyebrowStyle}>Available by category</span>
          <strong style={chartTotalStyle}>{fmt(countedTotal)} <small>MAD</small></strong>
        </div>
        <span style={chartSummaryCopyStyle}>{chartData.items.length} funded categor{chartData.items.length === 1 ? "y" : "ies"}</span>
      </div>
      <div style={rankedListStyle}>
        {chartData.items.map(({ cat, available }, index) => (
          <button key={cat.id} type="button" onClick={() => onSelectCategory(cat)} style={rankedRowStyle}>
            <span style={rankStyle}>{String(index + 1).padStart(2, "0")}</span>
            <CategoryIcon icon={cat.icon} size={22} decorative />
            <span style={rankedCopyStyle}>
              <span style={rankedNameStyle}>{cat.name}</span>
              <span style={barTrackStyle} aria-hidden="true">
                <span style={{ ...barFillStyle, width: `${Math.max(5, (available / largest) * 100)}%` }} />
              </span>
            </span>
            <strong style={rankedAmountStyle}>{fmt(Math.round(available))}<small>MAD</small></strong>
            <ChevronRightIcon size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

const chartWrapStyle: CSSProperties = {
  borderRadius: "var(--radius-card)",
  background: "var(--surface)",
  padding: "16px 16px 18px",
  boxShadow: "var(--elevation-card)",
  display: "grid",
  gap: 16,
};

const emptyChartStyle: CSSProperties = { minHeight: 160, display: "grid", placeItems: "center", alignContent: "center", gap: 8, color: "var(--muted)", textAlign: "center", fontSize: 13 };
const chartSummaryStyle: CSSProperties = { display: "flex", alignItems: "end", justifyContent: "space-between", gap: 16 };
const chartEyebrowStyle: CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.5, textTransform: "uppercase" };
const chartTotalStyle: CSSProperties = { display: "block", marginTop: 6, fontSize: 30, lineHeight: 1, color: "var(--text)", fontVariantNumeric: "tabular-nums" };
const chartSummaryCopyStyle: CSSProperties = { fontSize: 12, color: "var(--muted)", paddingBottom: 2 };
const rankedListStyle: CSSProperties = { display: "grid", gap: 4 };
const rankedRowStyle: CSSProperties = { width: "100%", minHeight: 56, display: "grid", gridTemplateColumns: "24px 26px minmax(0, 1fr) auto 16px", alignItems: "center", gap: 10, border: 0, borderRadius: "var(--radius-control)", background: "transparent", color: "var(--text2)", textAlign: "left", cursor: "pointer", padding: "8px 4px" };
const rankStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--muted)", fontVariantNumeric: "tabular-nums" };
const rankedCopyStyle: CSSProperties = { minWidth: 0, display: "grid", gap: 7 };
const rankedNameStyle: CSSProperties = { fontSize: 14, fontWeight: 650, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" };
const barTrackStyle: CSSProperties = { height: 5, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" };
const barFillStyle: CSSProperties = { display: "block", height: "100%", borderRadius: 999, background: "var(--accent)" };
const rankedAmountStyle: CSSProperties = { display: "inline-flex", alignItems: "baseline", gap: 4, fontSize: 14, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

/* ─── Scope chip button ────────────────────────────────────────── */

/* ─── Styles ──────────────────────────────────────────────────── */

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  paddingBottom: 80,
  animation: "fadeUp 0.2s ease both",
  minWidth: 0,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
  paddingTop: 8,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const titleStyle: CSSProperties = {
  margin: "4px 0 0",
  fontFamily: "var(--font-display)",
  fontSize: 34,
  lineHeight: 0.95,
  color: "var(--text)",
};

const rebalanceBtnStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 8px",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  flexShrink: 0,
  opacity: 0.65,
};

const backBtnStyle: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
  flexShrink: 0,
};

const pillRailStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const searchWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 12,
  background: "color-mix(in srgb, var(--surface) 86%, var(--surface2))",
  border: "1px solid color-mix(in srgb, var(--border2) 55%, transparent)",
};

const searchInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "transparent",
  padding: 0,
  border: "none",
  fontSize: 14,
  color: "var(--text2)",
  outline: "none",
};

const groupsStyle: CSSProperties = {
  display: "grid",
  gap: 20,
  minWidth: 0,
};

const budgetHealthStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 8,
  padding: "20px 16px 28px",
  background: "transparent",
  boxShadow: "none",
  position: "relative",
  isolation: "isolate",
};

const budgetHealthTitleStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1,
  fontWeight: 600,
  color: "var(--muted)",
};

const budgetHealthLabelStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const budgetHealthAmountStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  justifyContent: "center",
  gap: 6,
  fontSize: "clamp(40px, 12vw, 56px)",
  lineHeight: 1,
  fontWeight: 500,
  letterSpacing: "-0.035em",
  color: "var(--text)",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const budgetHealthCurrencyStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 500,
  letterSpacing: 0,
  color: "var(--muted)",
};

const budgetHealthSecondaryStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 6,
  padding: "5px 9px",
  borderRadius: 8,
  background: "var(--surface2)",
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
};

const budgetHealthSecondaryRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 2,
};

const contributionActionStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 12px",
  border: 0,
  borderRadius: "var(--radius-control)",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontSize: 12,
  fontWeight: 750,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const groupPillsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  padding: "0 0 4px",
  scrollbarWidth: "none",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: 8,
  paddingLeft: 2,
};

const railStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: "0 0 8px",
  minWidth: 0,
};

/* ─── Frozen preview ────────────────────────────────────────────── */

const frozenPreviewWrapStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const frozenPreviewHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingLeft: 2,
};

const frozenPreviewLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "var(--muted)",
  opacity: 0.65,
};

const seeAllBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: "4px 0",
  border: "none",
  background: "transparent",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text2)",
  cursor: "pointer",
  opacity: 0.65,
};

/* ─── Ghost add card ────────────────────────────────────────────── */

const ghostCardStyle: CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 16,
  border: "1.5px dashed color-mix(in srgb, var(--border) 55%, transparent)",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "border-color 0.15s ease, background 0.15s ease",
};

/* ─── Card ─────────────────────────────────────────────────────── */

const cardStyle: CSSProperties = {
  width: "100%",
  borderRadius: "var(--radius-card)",
  background: "transparent",
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
  boxShadow: "none",
  position: "relative",
  overflow: "visible",
  marginTop: 32,
};


const cardBodyStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  position: "relative",
  minHeight: 100,
  padding: "26px 16px 12px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "none",
  cursor: "pointer",
  width: "100%",
  textAlign: "left",
  overflow: "visible",
  borderRadius: "var(--radius-card)",
};

const categoryIconStageStyle: CSSProperties = {
  position: "absolute",
  left: 16,
  top: -28,
  width: 56,
  height: 56,
  borderRadius: 0,
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "none",
  zIndex: 2,
  pointerEvents: "none",
};

const categoryContentStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  display: "grid",
  gap: 8,
  position: "relative",
  zIndex: 1,
};

const frozenRowStyle: CSSProperties = {
  width: "100%",
  minHeight: 64,
  padding: "12px 16px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-card)",
  background: "var(--surface)",
  boxShadow: "none",
  color: "var(--text2)",
  display: "grid",
  gridTemplateColumns: "32px minmax(0, 1fr) 20px",
  alignItems: "center",
  gap: 12,
  textAlign: "left",
  cursor: "pointer",
};

const frozenNameStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  fontSize: 14,
  fontWeight: 650,
};

const cardTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  minWidth: 0,
};

const cardBottomStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-end",
  alignItems: "baseline",
  gap: 4,
  width: "auto",
  minWidth: 88,
};

const cardNameStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "var(--text)",
  lineHeight: 1.2,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  maxWidth: "min(42vw, 180px)",
  textAlign: "left",
};

const cardAmountStyle = (health: Health): CSSProperties => ({
  fontFamily: "var(--font-body)",
  fontSize: 17,
  fontWeight: 700,
  lineHeight: 1,
  color: health === "over"      ? "var(--danger)"
       : health === "low"       ? "var(--warning)"
       : health === "unfunded"  ? "var(--muted)"
       :                          "var(--text2)",
});

const cardUnitStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 400,
  color: "var(--muted)",
  lineHeight: 1,
};

const budgetBarStyle: CSSProperties = {
  width: "100%",
  height: 6,
  borderRadius: 999,
  background: "var(--surface2)",
  overflow: "hidden",
  display: "flex",
};

const budgetBarSegmentStyle: CSSProperties = {
  display: "block",
  height: "100%",
};

const budgetMetaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "var(--muted)",
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
};

const budgetSpentStyle = (spent: number): CSSProperties => ({
  color: spent > 0 ? "var(--danger)" : "var(--muted)",
  fontWeight: spent > 0 ? 650 : 500,
});

const skeletonCardStyle: CSSProperties = {
  position: "relative",
  minHeight: 132,
  marginTop: 32,
  padding: "26px 16px 12px",
  borderRadius: "var(--radius-card)",
  background: "var(--surface)",
  border: "1px solid var(--border)",
};

const skeletonIconStyle: CSSProperties = {
  position: "absolute",
  insetInlineStart: 16,
  top: -28,
  width: 56,
  height: 56,
  borderRadius: 14,
};

const skeletonContentStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const skeletonTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
};

const srOnlyStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const cardActionStyle: CSSProperties = {
  margin: "0 10px 10px",
  padding: "5px 0",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text2)",
  cursor: "pointer",
  alignSelf: "stretch",
};

const emptyStyle: CSSProperties = {
  padding: "22px 10px",
  color: "var(--muted)",
  fontSize: 14,
  textAlign: "center",
};

const emptyActionStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 16px",
  border: "1px solid var(--border)",
  borderRadius: 14,
  background: "var(--surface)",
  color: "var(--text2)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  fontFamily: "var(--font-body)",
  fontSize: 12,
  fontWeight: 650,
  cursor: "pointer",
};
