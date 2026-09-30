"use client";

import { useMemo, useState, useRef, useEffect, type CSSProperties } from "react";
import { Currency } from "./Money";
import { MonthPicker } from "./DatePicker";
import type { Account, BudgetScope, Category, MonthlySummary } from "./app-types";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { AlertTriangleIcon, CalendarIcon, ChevronRightIcon, FundIcon, PlusIcon, TransferIcon } from "./ui/icons";
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
import { budgetStatus, budgetStatusRank, monthProgress, pace } from "./category-status";
import { BudgetJarRow, SavingsJarRow } from "./CategoryJarRow";
import { SectionToggle } from "./ui/SectionToggle";

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



/** Sections in the plan sheet's order: savings first, then from must-pay to optional. */
const SECTION_ORDER = ["savings", "obligations", "long term", "wants"];

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
  // Sections start open; Frozen starts closed (same as the plan sheet).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["Frozen"]));
  const toggleSection = (label: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    return next;
  });

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

  const past = isPastMonth(homeMonth);
  const progress = monthProgress(homeMonth);
  const activeGroups = useMemo(() => {
    const q = search.toLowerCase().trim();
    const items = categories
      .filter(cat => {
        if (q && !cat.name.toLowerCase().includes(q) && !cat.type.some(t => t.toLowerCase().includes(q))) return false;
        if (getCategoryScope(cat, accounts) !== budgetScope) return false;
        return true;
      })
      .map(cat => {
        const planned = plannedByCategory.get(cat.id) ?? 0;  // this month's Funds DB
        const spent = spentByCategory.get(cat.id) ?? 0;
        const savings = isSavingsCategory(cat);
        const status = budgetStatus({ available: cat.available, spent, planned, past, progress });
        const section = savings ? "Savings" : cat.type[0] ?? "Other";
        return { cat, planned, spent, savings, status, section };
      })
      .sort((a, b) => budgetStatusRank(a.status) - budgetStatusRank(b.status) || b.status.amount - a.status.amount);

    const map = new Map<string, typeof items>();
    for (const row of items) {
      if (!map.has(row.section)) map.set(row.section, []);
      map.get(row.section)!.push(row);
    }
    // Same order as the plan sheet: savings first, then from must-pay to optional.
    const order = (label: string) => {
      const i = SECTION_ORDER.indexOf(label.toLowerCase());
      return i === -1 ? SECTION_ORDER.length : i;
    };
    return Array.from(map.entries())
      .map(([label, rows]) => ({ label, rows }))
      .sort((a, b) => order(a.label) - order(b.label) || a.label.localeCompare(b.label));
  }, [categories, search, budgetScope, accounts, spentByCategory, plannedByCategory, past, progress]);

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
  const poolPace = pace(poolLevel, progress);
  const poolWarn = poolPace === "good" ? null : poolPace;
  const jarDetails = jarItems.length > 0
    ? `Money left in ${jarItems.length} categor${jarItems.length === 1 ? "y" : "ies"}`
    : "No category has money left";
  const budgetJar = (
    <MascotSpill size={MASCOT_HERO_SIZE} label={jarDetails} details={jarDetails} onOpenChange={setJarOpen}>
      <MascotHero variant="pool" scope={budgetScope} level={poolLevel} warn={poolWarn} items={jarOpen ? jarItems : undefined} spentPct={jarSpentPct} unassigned={leftToAllocate} />
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
            <section aria-label={`${fmt(Math.round(availableInCategories))} MAD allocated in categories${Math.round(leftToAllocate) !== 0 ? `; ${fmt(Math.round(leftToAllocate))} MAD unassigned` : ""}`} style={budgetHealthStyle}>
              {/* The same liquid jar as Home (Joint with its family around it). As on Home, the
                  emojis stay tucked away until the jar is tapped; then every category that still
                  has money drops in, sized by its share of Available. */}
              {budgetScope === "joint" && contribStatus ? (
                <JointFamily contribStatus={contribStatus}>{budgetJar}</JointFamily>
              ) : (
                <div style={{ marginBottom: 4 }}>{budgetJar}</div>
              )}
              {/* Not money to assign: what's still in categories after spending. */}
              <span style={budgetHealthLabelStyle}>Allocated</span>
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

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <MonthPicker
                value={homeMonth}
                aria-label="Filter planned and spent by month"
                onChange={(event) => event.target.value && onHomeMonthChange(event.target.value)}
                triggerClassName="composer-picker-chip"
                showChevron={false}
              />
              {/* Next month's plan sits with the month it follows. */}
              {planMonth && onOpenPlan && !past && (
                <button type="button" className="composer-picker-chip" onClick={onOpenPlan} style={planChipStyle}>
                  <CalendarIcon size={16} aria-hidden="true" />
                  Plan {new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(`${planMonth}-01T00:00:00`))}
                </button>
              )}
            </div>
            {monthError && !loading && (
              <Banner tone="danger" title="Couldn't load this month" action={<button type="button" onClick={onRetryMonth} style={bannerActionStyle}>Retry</button>} />
            )}

            {loading && (
              <section aria-label="Loading budget categories" aria-busy="true" style={listSurfaceStyle}>
                <span style={srOnlyStyle} role="status">Loading budget categories</span>
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} style={skeletonRowStyle} aria-hidden="true">
                    <span className="skeleton" style={{ width: 60, height: 60, borderRadius: 20, flexShrink: 0 }} />
                    <span style={{ display: "grid", gap: 6, flex: 1 }}>
                      <span className="skeleton" style={{ width: "46%", height: 14, borderRadius: 5 }} />
                      <span className="skeleton" style={{ width: "28%", height: 10, borderRadius: 5 }} />
                    </span>
                    <span className="skeleton" style={{ width: 56, height: 16, borderRadius: 5 }} />
                  </div>
                ))}
              </section>
            )}

            {/* Categories as the plan sheet lists them: collapsible sections of jar rows. */}
            {!loading && !monthError && activeGroups.map((group) => {
              const open = !collapsed.has(group.label);
              const total = group.rows.reduce((sum, row) => sum + (row.savings ? Math.max(0, row.cat.available ?? 0) : row.status.amount), 0);
              const id = `budget-${group.label.toLowerCase().replace(/\s+/g, "-")}`;
              return (
                <section key={group.label} aria-labelledby={id} style={sectionStyle}>
                  <SectionToggle id={id} label={group.label} count={group.rows.length} total={total} open={open} onToggle={() => toggleSection(group.label)} />
                  {open && (
                    <div style={listSurfaceStyle}>
                      {group.rows.map(({ cat, planned, spent, savings, status }) => savings
                        ? <SavingsJarRow key={cat.id} cat={cat} scope={budgetScope} available={cat.available ?? 0} planned={planned} spent={spent} onOpen={() => onOpenCategoryDetails(cat)} />
                        : <BudgetJarRow key={cat.id} cat={cat} scope={budgetScope} status={status} spent={spent} onOpen={() => onOpenCategoryDetails(cat)} />)}
                      {onOpenNewCategory && (
                        <button type="button" onClick={() => onOpenNewCategory(group.label === "Savings" ? "Saving" : group.label)} style={addRowStyle}>
                          <PlusIcon size={16} aria-hidden="true" />
                          Add {group.label === "Savings" ? "a savings" : "a"} category
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}

            {!loading && frozenCategories.length > 0 && (
              <section aria-labelledby="budget-frozen" style={sectionStyle}>
                <SectionToggle id="budget-frozen" label="Frozen" count={frozenCategories.length} open={!collapsed.has("Frozen")} onToggle={() => toggleSection("Frozen")} />
                {!collapsed.has("Frozen") && (
                  <div style={listSurfaceStyle}>
                    {frozenCategories.map((cat) => (
                      <SwipeToDelete key={cat.id} variant="restore" deleteLabel={`Restore ${cat.name}`} onDelete={() => { onReviveCategory(cat); return true; }}>
                        <button type="button" onClick={() => onOpenCategoryDetails(cat)} style={frozenRowStyle} aria-label={cat.name}>
                          <CategoryIcon icon={cat.icon} size={24} style={{ opacity: 0.5, flexShrink: 0 }} />
                          <span style={frozenNameStyle}>{cat.name}</span>
                          <ChevronRightIcon size={16} aria-hidden="true" style={{ color: "var(--muted)" }} />
                        </button>
                      </SwipeToDelete>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
      }

    </div>
  );
}

/* ─── Category card (owns count-up + bar animation) ───────────── */

/* ─── Count-up animation hook ──────────────────────────────────── */

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


const sectionStyle: CSSProperties = { display: "grid", gap: 4, minWidth: 0 };

/** One shared surface per section; rows inside stay flat. */
const listSurfaceStyle: CSSProperties = { display: "grid", padding: "4px 0", borderRadius: "var(--radius-card)", background: "var(--surface)", border: "1px solid color-mix(in srgb, var(--border) 60%, transparent)" };

const skeletonRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minHeight: 76, padding: "8px 14px 8px 14px" };

const addRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "0 16px 0 24px", border: "none", background: "transparent", color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)", width: "100%" };

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

/* ─── Frozen preview ────────────────────────────────────────────── */

/* ─── Ghost add card ────────────────────────────────────────────── */

/* ─── Card ─────────────────────────────────────────────────────── */


// Flat, like the jar rows: the section's surface is the only container.
const frozenRowStyle: CSSProperties = {
  width: "100%",
  minHeight: 56,
  padding: "8px 16px 8px 20px",
  border: "none",
  borderRadius: 0,
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
