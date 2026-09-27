"use client";

import { useMemo, useState, useRef, useEffect, type CSSProperties } from "react";
import { Currency } from "./Money";
import { MonthPicker } from "./DatePicker";
import type { Account, BudgetScope, Category, MonthlySummary } from "./app-types";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { AlertTriangleIcon, CalendarIcon, ChevronRightIcon, FundIcon, PlusIcon, TransferIcon } from "./ui/icons";
import { ScreenChip } from "./ui/ScreenChip";
import { SearchField } from "./ui/SearchField";
import { AnimatedCounter } from "./ui/AnimatedCounter";
import { Banner, bannerActionStyle } from "./ui/Banner";
import { BUDGET_SCOPE_LABELS, fmt, getCategoryScope, getJointAccountUnassigned } from "./app-utils";
import { getCategoryAvailableByScope, isSavingsCategory, scopeMonthlySummary } from "./wallet-utils";
import { MascotHero, MASCOT_HERO_SIZE } from "./mascot/MascotHero";
import { MascotSpill } from "./mascot/MascotSpill";
import { budgetJarItems } from "./mascot/budgetJar";
import { JointFamily } from "./WalletCardSwitcher";
import type { ContributionStatus } from "./contribution-utils";

import { isPastMonth } from "./app-utils";

type Props = {
  categories: Category[];
  frozenCategories: Category[];
  accounts: Account[];
  readyToAssignByScope: Record<BudgetScope, number>;
  /** Signed: what's left once categories and dues are covered; negative = accounts fall short. */
  assignBalanceByScope?: Record<BudgetScope, number>;
  contributionRemainingByScope: Record<BudgetScope, number>;
  monthlySummary: MonthlySummary;
  homeMonth: string;
  onHomeMonthChange: (month: string) => void;
  budgetScope: BudgetScope;
  onOpenCategoryDetails: (cat: Category) => void;
  onOpenRebalance: () => void;
  onReviveCategory: (cat: Category) => void;
  onMoveContribution: () => void;
  onOpenNewCategory?: (defaultType: string) => void;
  monthError?: boolean;
  onRetryMonth: () => void;
  loading?: boolean;
  /** Partners' contributions to Joint: shown as their jars beside the Joint pool, as on Home. */
  contribStatus?: ContributionStatus | null;
  /** "YYYY-MM" of the month that can be planned (next month). */
  planMonth?: string;
  onOpenPlan?: () => void;
};

type Health = "over" | "low" | "funded" | "unfunded";

const HEALTH_SORT: Record<Health, number> = { over: 0, low: 1, funded: 2, unfunded: 3 };

/**
 * Categories with money in them come first so they're one tap away; overspent ones
 * lead because they need action. Empty ones sink to the bottom, the ones touched
 * this month (spent to zero) before the untouched.
 */
function budgetRowRank(row: { health: Health; available: number | null; spent: number }): number {
  if (row.health === "over") return 0;
  if (Math.round(row.available ?? 0) > 0) return 1 + HEALTH_SORT[row.health] / 10;
  return Math.round(row.spent) !== 0 ? 2 : 3;
}


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
  assignBalanceByScope,
  contributionRemainingByScope,
  monthlySummary,
  homeMonth,
  onHomeMonthChange,
  budgetScope,
  onOpenCategoryDetails,
  onOpenRebalance,
  onReviveCategory,
  onMoveContribution,
  onOpenNewCategory,
  monthError = false,
  onRetryMonth,
  loading = false,
  contribStatus = null,
  planMonth,
  onOpenPlan,
}: Props) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showFrozenAll, setShowFrozenAll] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  useEffect(() => {
    const openSearch = () => setSearchOpen((isOpen) => {
      if (isOpen) setSearch("");
      return !isOpen;
    });
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

  // Available is today's figure; past months show 0 instead (see isPastMonth).
  const monthCategories = useMemo(
    () => isPastMonth(homeMonth)
      ? categories.map(cat => ({ ...cat, available: cat.available === null ? null : 0 }))
      : categories,
    [categories, homeMonth],
  );

  const activeGroups = useMemo(() => {
    const q = search.toLowerCase().trim();
    const items = monthCategories
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
      .sort((a, b) => budgetRowRank(a) - budgetRowRank(b) || (b.available ?? 0) - (a.available ?? 0));

    const map = new Map<string, typeof items>();
    for (const row of items) {
      if (!map.has(row.section)) map.set(row.section, []);
      map.get(row.section)!.push(row);
    }
    // Savings is money set aside, not this month's: its tab comes last, after everything spendable.
    return Array.from(map.entries())
      .map(([label, items]) => ({ label, items, savings: items.every(row => isSavingsCategory(row.cat)) }))
      .sort((a, b) => Number(a.savings) - Number(b.savings));
  }, [monthCategories, search, budgetScope, accounts, spentByCategory, plannedByCategory]);

  const visibleSection = activeGroups.some(group => group.label === selectedSection)
    ? selectedSection
    : activeGroups[0]?.label ?? null;
  const visibleGroup = activeGroups.find(group => group.label === visibleSection);
  // Same figure as Home: category Available (carry-over included), savings excluded.
  const availableInCategories = useMemo(
    () => getCategoryAvailableByScope(monthCategories, accounts)[budgetScope],
    [monthCategories, accounts, budgetScope],
  );
  // Joint's unassigned money is the joint account's own ready-to-assign, not the
  // partners' personal balances. Negative means over-assigned (covered by contributions).
  const leftToAllocate = useMemo(
    () => budgetScope === "joint" ? Math.max(0, getJointAccountUnassigned(accounts)) : readyToAssignByScope[budgetScope] ?? 0,
    [accounts, readyToAssignByScope, budgetScope],
  );
  const contributionRemaining = contributionRemainingByScope[budgetScope] ?? 0;
  // What the accounts can't cover: categories funded plus dues, beyond what's actually there.
  const shortBy = Math.max(0, -Math.round(assignBalanceByScope?.[budgetScope] ?? 0));
  // Budget jar: an emoji per category with money left, sized by its share of Available.
  const jarItems = useMemo(
    () => budgetJarItems(monthCategories, budgetScope, accounts),
    [monthCategories, budgetScope, accounts],
  );
  const [jarOpen, setJarOpen] = useState(false);
  // The jar's face follows the whole scope's month, never the search results.
  const jarSpentPct = useMemo(() => {
    let planned = 0;
    let spent = 0;
    for (const cat of categories) {
      if (getCategoryScope(cat, accounts) !== budgetScope) continue;
      planned += plannedByCategory.get(cat.id) ?? 0;
      spent += spentByCategory.get(cat.id) ?? 0;
    }
    return planned > 0 ? (spent / planned) * 100 : null;
  }, [categories, accounts, budgetScope, plannedByCategory, spentByCategory]);
  // The pool jar's level uses the exact figures Home uses, so it reads the same on both screens.
  const poolLevel = useMemo(() => {
    const scoped = scopeMonthlySummary(monthlySummary, categories, accounts, budgetScope);
    return scoped.totalAssigned > 0 ? 1 - scoped.totalSpent / scoped.totalAssigned : 1;
  }, [monthlySummary, categories, accounts, budgetScope]);
  const jarDetails = jarItems.length > 0
    ? `Money left in ${jarItems.length} categor${jarItems.length === 1 ? "y" : "ies"}`
    : "No category has money left";
  const budgetJar = (
    <MascotSpill size={MASCOT_HERO_SIZE} label={jarDetails} details={jarDetails} onOpenChange={setJarOpen}>
      <MascotHero variant="pool" scope={budgetScope} level={poolLevel} items={jarOpen ? jarItems : undefined} spentPct={jarSpentPct} unassigned={leftToAllocate} />
    </MascotSpill>
  );
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
          showClose={false}
        />
      )}

      {/* Active groups */}
      {activeGroups.length === 0
        ? hasScopedCategories
          ? <div style={emptyStyle}>No categories match “{search}”.</div>
          : onOpenNewCategory
            ? <button type="button" className="budget-empty-action" style={emptyActionStyle} onClick={() => onOpenNewCategory("Other")}>
                <PlusIcon size={15} />
                Add the first {BUDGET_SCOPE_LABELS[budgetScope]} category
              </button>
            : null
        : <>
            <section aria-label={`${fmt(Math.round(availableInCategories))} MAD left to spend in categories${Math.round(leftToAllocate) !== 0 ? `; ${fmt(Math.round(leftToAllocate))} MAD unassigned` : ""}`} style={budgetHealthStyle}>
              {/* The same liquid jar as Home (Joint with its family around it). As on Home, the
                  emojis stay tucked away until the jar is tapped; then every category that still
                  has money drops in, sized by its share of Available. */}
              {budgetScope === "joint" && contribStatus ? (
                <JointFamily contribStatus={contribStatus}>{budgetJar}</JointFamily>
              ) : (
                <div style={{ marginBottom: 4 }}>{budgetJar}</div>
              )}
              {/* Not money to assign: what's still in categories after spending. */}
              <span style={budgetHealthLabelStyle}>Left to spend</span>
              <span style={budgetHealthAmountStyle}>
                <AnimatedCounter value={Math.round(availableInCategories)} animateOnMount />
                <Currency />
              </span>
            </section>

            {/* One banner at a time, the most urgent first: accounts falling short, then money
                not yet in a category, then what's still due to Joint. Nothing to act on, no banner. */}
            {shortBy > 0 ? (
              <Banner
                tone="danger"
                icon={<AlertTriangleIcon size={18} strokeWidth={2.2} />}
                title={`Short by ${fmt(shortBy)}`}
                action={(
                  <button type="button" onClick={onOpenRebalance} style={bannerActionStyle}>
                    Rebalance
                  </button>
                )}
              />
            ) : Math.round(leftToAllocate) > 0 ? (
              <Banner
                tone="accent"
                icon={<FundIcon size={18} strokeWidth={2.2} />}
                title={`${fmt(Math.round(leftToAllocate))} unassigned`}
                action={(
                  <button type="button" onClick={onOpenRebalance} style={contributionActionStyle}>
                    Assign
                  </button>
                )}
              />
            ) : budgetScope !== "joint" && contributionRemaining > 0 ? (
              <Banner
                tone="accent"
                icon={<TransferIcon size={18} strokeWidth={2.2} />}
                title={`${fmt(Math.round(contributionRemaining))} due to Joint`}
                action={(
                  <button type="button" onClick={onMoveContribution} style={contributionActionStyle}>
                    Contribute
                  </button>
                )}
              />
            ) : null}

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
                    badge={Math.round(groupAvailable) !== 0 ? fmt(Math.round(groupAvailable)) : undefined}
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

            {!showFrozenAll && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <MonthPicker
                  value={homeMonth}
                  aria-label="Filter planned and spent by month"
                  onChange={(event) => event.target.value && onHomeMonthChange(event.target.value)}
                  triggerClassName="composer-picker-chip"
                  showChevron={false}
                />
                {/* Next month's plan sits with the month it follows. */}
                {planMonth && onOpenPlan && !isPastMonth(homeMonth) && (
                  <button type="button" className="composer-picker-chip" onClick={onOpenPlan} style={planChipStyle}>
                    <CalendarIcon size={16} aria-hidden="true" />
                    Plan {new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(`${planMonth}-01T00:00:00`))}
                  </button>
                )}
              </div>
            )}
            {!showFrozenAll && monthError && !loading && (
              <Banner tone="danger" title="Couldn't load this month" action={<button type="button" onClick={onRetryMonth} style={bannerActionStyle}>Retry</button>} />
            )}

            {!showFrozenAll && loading && (
              <section aria-label="Loading budget categories" aria-busy="true" style={{ minWidth: 0 }}>
                <span style={srOnlyStyle} role="status">Loading budget categories</span>
                <div style={railStyle}>
                  {Array.from({ length: 3 }, (_, index) => <CategoryCardSkeleton key={index} />)}
                </div>
              </section>
            )}
            {!showFrozenAll && !loading && !monthError && visibleGroup && (
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
                      savings={isSavingsCategory(cat)}
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
  cat, available, spent, planned, health, savings = false, index, onOpenDetails,
}: {
  cat: import("./app-types").Category;
  available: number | null; spent: number; planned: number;
  health: Health; savings?: boolean; index: number;
  onOpenDetails: () => void;
}) {
  const amountNum = Math.abs(available ?? 0);
  // One question per bar: how much of this month's money is still left? The fill is
  // Available, the track is what's been spent. Money moved out never shows as a gap.
  const availableAmount = Math.max(0, available ?? 0);
  const leftPct = Math.min(100, (availableAmount / Math.max(spent + availableAmount, 1)) * 100);

  const goal = savings ? Math.max(0, cat.goal ?? 0) : 0;
  const goalPct = goal > 0 ? Math.min(100, (availableAmount / goal) * 100) : 0;
  const goalReached = goal > 0 && availableAmount >= goal;
  const goalWhen = goalLabel(cat.goalDate);

  // Animate between values on updates; show instantly on mount
  const displayAmount = useCountUp(amountNum, 580);
  const amountStr = available === null ? "—" : fmt(Math.round(displayAmount));

  return (
    <div
      style={{ ...cardStyle, animation: `fadeUp 0.22s ${Math.min(index * 0.025, 0.2)}s ease both` }}
    >
      <span style={categoryIconStageStyle} aria-hidden="true">
        <CategoryIcon icon={cat.icon} size={36} decorative />
      </span>
      <button type="button" onClick={onOpenDetails} style={cardBodyStyle}
        aria-label={`${cat.name}${savings ? ", savings" : health === "over" ? ", overbudget" : health === "low" ? ", low" : health === "funded" ? ", funded" : ", unfunded"}`}>
        <span style={categoryContentStyle}>
          <span style={cardTopStyle}>
            <span style={cardNameStyle}>{cat.name}</span>
            <span style={cardBottomStyle}>
              <span style={cardAmountStyle(savings ? "funded" : health)}>{amountStr}</span>
            </span>
          </span>
          {/* Savings isn't spent down, so a spend bar says nothing: just what moved in or out this month. */}
          {savings ? <>
            {/* With a goal (Notion "Overall Goal"), the bar is progress towards it. */}
            {goal > 0 && (
              <span style={budgetBarStyle} aria-hidden="true">
                <span style={{ ...budgetBarSegmentStyle, width: `${goalPct}%`, background: "var(--select-color)" }} />
              </span>
            )}
            <span style={budgetMetaStyle}>
              {goal > 0 && <span>{goalReached ? "Goal reached" : `${Math.floor(goalPct)}% of ${fmt(Math.round(goal))}`}{goalWhen && !goalReached ? ` · ${goalWhen}` : ""}</span>}
              <span>
                {Math.round(planned) > 0 && <span style={savingsInStyle}>+{fmt(Math.round(planned))} this month</span>}
                {Math.round(planned) > 0 && Math.round(spent) > 0 && " · "}
                {Math.round(spent) > 0 && <span>{fmt(Math.round(spent))} used</span>}
                {Math.round(planned) <= 0 && Math.round(spent) <= 0 && <span>Nothing moved this month</span>}
              </span>
            </span>
          </> : <>
          <span style={budgetBarStyle} aria-hidden="true">
            {health === "over" ? (
              <span style={{ ...budgetBarSegmentStyle, width: "100%", background: "var(--danger)" }} />
            ) : (
              <span style={{ ...budgetBarSegmentStyle, width: `${leftPct}%`, background: health === "low" ? "var(--warning)" : "var(--select-color)" }} />
            )}
          </span>
          <span style={budgetMetaStyle}>
            {Math.round(spent) !== 0 && <span style={budgetSpentStyle(spent)}>{fmt(Math.round(spent))} spent</span>}
            {health === "over" && <span>{fmt(Math.round(Math.abs(available ?? 0)))} overspent</span>}
          </span>
          </>}
        </span>
      </button>
    </div>
  );
}

/** "by Dec 2026" for a future goal date, "due Dec 2025" once it has passed. */
function goalLabel(date: string | null | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}/.test(date)) return null;
  const [year, month] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
  return date.slice(0, 7) < new Date().toISOString().slice(0, 7) ? `due ${label}` : `by ${label}`;
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

/* ─── Styles ──────────────────────────────────────────────────── */

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  paddingBottom: 80,
  animation: "fadeUp 0.2s ease both",
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


const planChipStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border) 44%, transparent)",
  background: "var(--surface)",
  color: "var(--text2)",
  fontSize: 13,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  cursor: "pointer",
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

const railStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: "0 0 8px",
  minWidth: 0,
};

/* ─── Frozen preview ────────────────────────────────────────────── */

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

const savingsInStyle: CSSProperties = { color: "var(--success)", fontWeight: 650 };

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
