"use client";
import { LiquidButton } from "./ui/LiquidGlass";

import { SkeletonRows } from "./ui/Skeleton";

import { useMemo, useState, useRef, useEffect, type CSSProperties } from "react";
import { ScreenToolbar } from "./ui/ScreenLayout";
import { ScreenHero } from "./ui/ScreenHero";
import { Fact, Summary } from "./ui/Summary";
import { MonthPicker } from "./DatePicker";
import type { Account, BudgetScope, Category, MonthlySummary, Transaction } from "./app-types";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { CalendarIcon, ChevronDownIcon, ChevronRightIcon, ShuffleIcon, PlusIcon } from "./ui/icons";
import { SearchField } from "./ui/SearchField";
import { Banner } from "./ui/Banner";
import { BUDGET_SCOPE_LABELS, fmt, getCategoryScope, getJointAccountUnassigned, today, type ShortfallPart } from "./app-utils";
import { ShortfallBreakdown } from "./ShortfallBreakdown";
import { billShortfalls, type DueBill } from "@/lib/suggestions";
import { getCategoryAvailableByScope, isSavingsCategory, scopeMonthlySummary } from "./wallet-utils";
import { planningMood, spendingMood } from "./light-mood";
import { MascotHero, MASCOT_HERO_SIZE } from "./mascot/MascotHero";
import { GrainGlow } from "./grain/GrainGlow";
import { PALETTES } from "./grain/palettes";
import { MascotSpill } from "./mascot/MascotSpill";
import { budgetJarItems } from "./mascot/budgetJar";
import type { ContributionStatus } from "./contribution-utils";
import { budgetStatus, budgetStatusRank, monthProgress } from "./category-status";
import { runningLowCategories, runwayLabel } from "./category-runway";
import { BudgetJarRow, SavingsJarRow } from "./CategoryJarRow";
import { SectionToggle } from "./ui/SectionToggle";
import { ScreenChip } from "./ui/ScreenChip";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { SavingCover, useBlockingSave } from "./ui/SavingCover";

import { isPastMonth } from "./app-utils";

type Props = {
  categories: Category[];
  frozenCategories: Category[];
  accounts: Account[];
  readyToAssignByScope: Record<BudgetScope, number>;
  /** Joint's unassigned money after what it owes back to partners (same figure Home uses). */
  jointUnassigned?: number;
  /** Signed: what's left once categories and dues are covered; negative = accounts fall short. */
  assignBalanceByScope?: Record<BudgetScope, number>;
  contributionRemainingByScope: Record<BudgetScope, number>;
  monthlySummary: MonthlySummary;
  budgetTransactions?: Transaction[];
  homeMonth: string;
  onHomeMonthChange: (month: string) => void;
  budgetScope: BudgetScope;
  onOpenCategoryDetails: (cat: Category) => void;
  onOpenRebalance: () => void;
  /** What actually fixes "Short by" when Rebalance can't (advances owed back, over-assigned savings). */
  shortfallAction?: { label: string; onClick: () => void };
  /** The working behind "X short", and what fixes it (shown when the figure is tapped). */
  shortfallParts?: ShortfallPart[];
  shortfallFixes?: { label: string; onClick: () => void }[];
  /** A savings account holding less than its categories promise; the fix moves money in from the owner's checking. */
  savingsGap?: { account: Account; gap: number; source?: Account; onFix: () => void };
  /** Restoring is a write: the screen stays blocked until the returned promise settles. */
  onReviveCategory: (cat: Category) => void | Promise<void>;
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
  /** This month's unpaid bills; one due within a week that its category can't cover puts a dot on the row. */
  dueBills?: DueBill[];
  /** Money just moved: the jar plays a comet once. */
  moneyMoved?: { kind: "comet"; id: number } | null;
};



/** Sections in the plan sheet's order: savings first, then from must-pay to optional. */
const SECTION_ORDER = ["savings", "obligations", "long term", "wants"];

/* ─── Main screen ─────────────────────────────────────────────── */

export function CategoriesScreen({
  dueBills = [],
  moneyMoved = null,
  categories,
  frozenCategories,
  accounts,
  readyToAssignByScope,
  jointUnassigned,
  assignBalanceByScope,
  contributionRemainingByScope,
  monthlySummary,
  budgetTransactions,
  homeMonth,
  onHomeMonthChange,
  budgetScope,
  onOpenCategoryDetails,
  onOpenRebalance,
  shortfallAction,
  shortfallParts,
  shortfallFixes = [],
  savingsGap,
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
  const restore = useBlockingSave();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Sections start open; Frozen starts closed (same as the plan sheet).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["Frozen"]));
  // Sections whose empty jars are listed one by one instead of folded into a single line.
  const [showEmpty, setShowEmpty] = useState<Set<string>>(() => new Set());
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
  const runningLow = useMemo(() => !loading && !monthError && homeMonth === today().slice(0, 7)
    ? runningLowCategories(categories.filter(cat => getCategoryScope(cat, accounts) === budgetScope), budgetTransactions ?? [], today())
    : [], [loading, monthError, homeMonth, categories, accounts, budgetScope, budgetTransactions]);
  const runwayByCategory = useMemo(() => new Map(runningLow.map(risk => [risk.category.id, risk])), [runningLow]);
  const firstLow = runningLow[0];
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
        const runway = runwayByCategory.get(cat.id);
        status.low = Boolean(runway);
        const section = savings ? "Savings" : cat.type[0] ?? "Other";
        return { cat, planned, spent, savings, status, section, runway };
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
  }, [categories, search, budgetScope, accounts, spentByCategory, plannedByCategory, past, progress, runwayByCategory]);

  // Same figure as Home: category Available (carry-over included), savings excluded.
  const availableInCategories = useMemo(
    () => getCategoryAvailableByScope(monthCategories, accounts)[budgetScope],
    [monthCategories, accounts, budgetScope],
  );
  // Joint's unassigned money is the joint account's own ready-to-assign minus what it owes back
  // to partners, not their personal balances. Negative means over-assigned (covered by contributions).
  const leftToAllocate = useMemo(
    () => budgetScope === "joint" ? Math.max(0, jointUnassigned ?? getJointAccountUnassigned(accounts)) : readyToAssignByScope[budgetScope] ?? 0,
    [accounts, jointUnassigned, readyToAssignByScope, budgetScope],
  );
  const contributionRemaining = contributionRemainingByScope[budgetScope] ?? 0;
  // What the accounts can't cover: categories funded plus dues, beyond what's actually there.
  const shortBy = Math.max(0, -Math.round(assignBalanceByScope?.[budgetScope] ?? 0));
  const [showWhyShort, setShowWhyShort] = useState(false);
  useEffect(() => { setShowWhyShort(false); }, [budgetScope]);
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
  // The light is the mood of Budget's number, To assign (design.md, Light): bright when everything
  // is placed, dimmer with money waiting, coral when over-assigned.
  // Couple has almost nothing to assign (joint money is planned from contributions up front), so its
  // Budget asks how the joint plan is holding: Left to spend, lit by spending pace like personal Home.
  const jointBudget = budgetScope === "joint";
  const jointSpent = useMemo(() => jointBudget ? scopeMonthlySummary(monthlySummary, categories, accounts, "joint").totalSpent : 0, [jointBudget, monthlySummary, categories, accounts]);
  const planning = loading || monthError || monthlySummary.contributionError ? null
    : jointBudget ? spendingMood(availableInCategories, jointSpent, progress) : planningMood(availableInCategories, leftToAllocate);
  const lightLevel = planning?.level ?? 0.35;
  const poolWarn = planning?.warn ?? null;
  const jarDetails = loading ? "Loading monthly details" : monthError ? "Monthly details unavailable" : jarItems.length > 0
    ? `Money left in ${jarItems.length} categor${jarItems.length === 1 ? "y" : "ies"}`
    : "No category has money left";
  // Loading keeps the light itself at its remembered level (pending), not a glass skeleton blob.
  // A failed month keeps the light with an alert signal; the screen's Banner carries the message and Retry.
  const monthFailed = !loading && !!monthError;
  const budgetJar = (
    <MascotSpill size={MASCOT_HERO_SIZE} label={jarDetails} details={jarDetails} onOpenChange={setJarOpen}>
      <MascotHero look="light" variant="pool" scope={budgetScope} level={lightLevel} warn={poolWarn} items={jarOpen && !monthFailed ? jarItems : undefined} spentPct={monthFailed ? null : jarSpentPct} unassigned={monthlySummary.contributionError || monthFailed ? undefined : leftToAllocate} once={moneyMoved} pending={loading}
        signal={monthFailed ? { kind: "alert", label: "Monthly details unavailable" } : undefined} />
    </MascotSpill>
  );
  const hasScopedCategories = categories.some(cat => getCategoryScope(cat, accounts) === budgetScope);
  const billShort = useMemo(() => billShortfalls(dueBills, categories, today()), [dueBills, categories]);

  return (
    <div id="panel-budget" role="tabpanel" aria-labelledby="tab-budget" className="categories-main screen-layout" style={wrapStyle}>

            <div className="budget-overview-context screen-overview">
            <section className="budget-desktop-overview grain-stage" aria-label="Category allocation overview">
              {/* The jar's light fills the hero, as bright as what's left of the plan (design.md, Light). */}
              <GrainGlow direction="room" scope={budgetScope} level={lightLevel} tones={PALETTES.partner} />
              <ScreenHero mascot={budgetJar} label={jointBudget ? "Left to spend" : "To assign"} loading={loading}
                value={loading || monthError || monthlySummary.contributionError ? null : Math.round(jointBudget ? availableInCategories : leftToAllocate)}
                done={!jointBudget && !loading && !monthError && !monthlySummary.contributionError && Math.round(leftToAllocate) === 0 ? "All assigned" : undefined}
                tone={!loading && Math.round(jointBudget ? availableInCategories : leftToAllocate) < 0 ? "danger" : undefined}
                summary={loading ? null : savingsGap ? <Summary><Fact>{savingsGap.account.label}</Fact> is <Fact tone="danger" onClick={savingsGap.onFix} label={savingsGap.source ? `Move money from ${savingsGap.source.label} to ${savingsGap.account.label}` : `Review ${savingsGap.account.label}`}>{fmt(savingsGap.gap)} short</Fact>.</Summary>
                  : shortBy > 0 ? <Summary><Fact tone="danger" onClick={() => setShowWhyShort(open => !open)} label={`${fmt(shortBy)} MAD short. ${showWhyShort ? "Hide" : "Show"} why`}>{fmt(shortBy)} short</Fact>.</Summary>
                  : firstLow ? <Summary>{runningLow.length === 1 ? <><Fact>{firstLow.category.name}</Fact> has <Fact tone="warning" onClick={onOpenRebalance} label={`Rebalance ${firstLow.category.name}`}>{runwayLabel(firstLow.daysCovered).toLowerCase()}</Fact></> : <><Fact>{runningLow.length} categories</Fact> are <Fact tone="warning" onClick={onOpenRebalance} label="Rebalance running low categories">running low</Fact></>}.</Summary>
                  : !monthlySummary.contributionError && Math.round(leftToAllocate) > 0 ? <Summary>{jointBudget ? <><Fact onClick={onOpenRebalance} label="Assign unassigned money">{fmt(Math.round(leftToAllocate))}</Fact> is <Fact>unassigned</Fact></> : <><Fact onClick={onOpenRebalance} label={`Assign ${fmt(Math.round(leftToAllocate))} MAD to categories`}>Assign it</Fact> to your categories</>}.</Summary>
                  : budgetScope !== "joint" && contributionRemaining > 0 ? <Summary><Fact onClick={onMoveContribution} label={`Contribute ${fmt(Math.round(contributionRemaining))} MAD to Couple`}>{fmt(Math.round(contributionRemaining))} due to Couple</Fact>.</Summary>
                  : null}
                actions={monthlySummary.contributionError ? <Banner tone="neutral" compact>Confirmed contributions and repayment reserves unavailable</Banner>
                  : shortBy > 0 && showWhyShort && !savingsGap && shortfallParts ? <ShortfallBreakdown id="budget-why-short" parts={shortfallParts} fixes={shortfallFixes} /> : null}
              />
            </section>
            <ScreenToolbar label="Budget period and planning" className="budget-desktop-controls">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <MonthPicker
                value={homeMonth}
                aria-label="Filter planned and spent by month"
                onChange={(event) => event.target.value && onHomeMonthChange(event.target.value)} variant="chip"
              />
              {/* Next month's plan sits with the month it follows, and only appears in the month's last week. */}
              {planMonth && onOpenPlan && !past && (planMonth === homeMonth || nextMonthPlanningOpen()) && (
                <ScreenChip mode="action" icon={<CalendarIcon size={16} />} disabled={!!monthlySummary.contributionError} title={monthlySummary.contributionError ? "Planning needs confirmed contributions" : undefined} onClick={onOpenPlan} ariaLabel={`Plan ${new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(`${planMonth}-01T00:00:00`))}`}>
                  {/* The month picker beside it already names this month. */}
                  {planMonth === homeMonth ? "Plan" : `Plan ${new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(`${planMonth}-01T00:00:00`))}`}
                </ScreenChip>
              )}
              </div>
              <LiquidButton type="button" className="app-top-action budget-rebalance-control" onClick={onOpenRebalance} aria-label="Rebalance budget" title="Rebalance budget" style={topActionStyle}><ShuffleIcon size={20} aria-hidden="true" /></LiquidButton>
            </ScreenToolbar>
            </div>
            <div className="budget-category-workspace screen-content">
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

            {!loading && !monthError && activeGroups.length === 0 && (hasScopedCategories
              ? <EmptyState announce>No categories match “{search}”.</EmptyState>
              : <EmptyState variant="screen" title="No categories yet" action={onOpenNewCategory ? <Button variant="secondary" size="compact" icon={<PlusIcon size={16} />} onClick={() => onOpenNewCategory("Other")}>Add category</Button> : undefined}>
                  Add a category to start planning.
                </EmptyState>)}
            {monthError && !loading && (
              <Banner tone="danger" role="alert" title="Could not load this month" action={<Button variant="quiet" size="compact" onClick={onRetryMonth}>Retry</Button>} />
            )}

            {loading && <div style={listSurfaceStyle}><SkeletonRows label="Loading budget categories" count={4} iconSize={60} /></div>}

            {/* Categories as the plan sheet lists them: collapsible sections of jar rows. */}
            {!loading && !monthError && activeGroups.map((group) => {
              const open = !collapsed.has(group.label);
              const total = group.rows.reduce((sum, row) => sum + (row.savings ? Math.max(0, row.cat.available ?? 0) : row.status.amount), 0);
              const id = `budget-${group.label.toLowerCase().replace(/\s+/g, "-")}`;
              return (
                <section className="budget-desktop-group" key={group.label} aria-labelledby={id} style={sectionStyle}>
                  <SectionToggle id={id} label={group.label} count={group.rows.length} total={total} open={open} onToggle={() => toggleSection(group.label)} />
                  {open && (
                    <div style={listSurfaceStyle}>
                      <div className="budget-table-head" aria-hidden="true">
                        <span>Category</span><span>Budgeted</span><span>Spent</span><span>Available</span>
                      </div>
                      {(() => {
                        // A run of identical empty jars says nothing row by row, so two or more fold into one line.
                        const empty = group.rows.filter(row => !row.savings && !billShort.has(row.cat.id) && (row.status.state === "empty" || row.status.state === "unfunded"));
                        const fold = empty.length >= 2 && !search.trim() && !showEmpty.has(group.label);
                        const rows = fold ? group.rows.filter(row => !empty.includes(row)) : group.rows;
                        return <>
                          {rows.map(({ cat, planned, spent, savings, status, runway }) => savings
                            ? <SavingsJarRow key={cat.id} cat={cat} scope={budgetScope} available={cat.available ?? 0} planned={planned} spent={spent} onOpen={() => onOpenCategoryDetails(cat)} />
                            : <BudgetJarRow key={cat.id} cat={cat} scope={budgetScope} status={status} runwayDays={runway?.daysCovered} planned={planned} spent={spent} billShort={billShort.get(cat.id)} onOpen={() => onOpenCategoryDetails(cat)} />)}
                          {fold && (
                            <Button variant="quiet" size="compact" block onClick={() => setShowEmpty(prev => new Set(prev).add(group.label))} style={rowActionStyle} aria-label={`Show ${empty.length} empty categories: ${empty.map(row => row.cat.name).join(", ")}`}
                              icon={<span style={emptyFoldIconsStyle}>{empty.slice(0, 4).map(row => <CategoryIcon key={row.cat.id} icon={row.cat.icon} categoryName={row.cat.name} size={20} style={{ opacity: 0.55 }} />)}</span>}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{empty.length} empty<ChevronDownIcon size={16} aria-hidden="true" /></span>
                            </Button>
                          )}
                        </>;
                      })()}
                      {onOpenNewCategory && (
                        <Button variant="quiet" size="compact" block onClick={() => onOpenNewCategory(group.label === "Savings" ? "Saving" : group.label)} style={rowActionStyle} aria-label={`Add category to ${group.label}`} icon={<PlusIcon size={16} />}>
                          Add
                        </Button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}

            {!loading && frozenCategories.length > 0 && (
              <section className="budget-desktop-group" aria-labelledby="budget-frozen" style={sectionStyle}>
                <SectionToggle id="budget-frozen" label="Frozen" count={frozenCategories.length} open={!collapsed.has("Frozen")} onToggle={() => toggleSection("Frozen")} />
                {!collapsed.has("Frozen") && (
                  <div style={listSurfaceStyle}>
                    {frozenCategories.map((cat) => (
                      <SwipeToDelete key={cat.id} variant="restore" deleteLabel={`Restore ${cat.name}`} onDelete={() => { void restore.run(async () => { await onReviveCategory(cat); }).catch(() => undefined); return true; }}>
                        <button type="button" onClick={() => onOpenCategoryDetails(cat)} style={frozenRowStyle} aria-label={cat.name}>
                          <CategoryIcon icon={cat.icon} categoryName={cat.name} size={60} style={{ opacity: 0.5, flexShrink: 0 }} />
                          <span style={frozenNameStyle}>{cat.name}</span>
                          <ChevronRightIcon size={16} aria-hidden="true" style={{ color: "var(--muted)" }} />
                        </button>
                      </SwipeToDelete>
                    ))}
                  </div>
                )}
              </section>
            )}
            </div>
      <SavingCover saving={restore.saving} fill="screen" />
    </div>
  );
}

/* ─── Category card (owns count-up + bar animation) ───────────── */

/* ─── Count-up animation hook ──────────────────────────────────── */

/* ─── Styles ──────────────────────────────────────────────────── */

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  paddingBottom: 96,
  minWidth: 0,
};

const sectionStyle: CSSProperties = { display: "grid", gap: 4, minWidth: 0 };

/** One shared surface per section; rows inside stay flat. */
// No box: the group header and the space between groups already group the rows.
// Rows keep their inner padding for the tap and hover fill; the negative margin lines the art and amounts up with the header.
const listSurfaceStyle: CSSProperties = { display: "grid", margin: "0 -24px 0 -12px" };


const emptyFoldIconsStyle: CSSProperties = { display: "inline-flex", gap: 4 };
// Row-level quiet actions (Add, the empty fold) start where the jar rows' art starts.
const rowActionStyle: CSSProperties = { justifyContent: "flex-start", padding: "0 24px 0 12px" };

/** Once this month is planned, next month's planning opens in the last week, not straight after saving. */
function nextMonthPlanningOpen() {
  const [year, month, day] = today().split("-").map(Number);
  return new Date(year, month, 0).getDate() - day < 7;
}

// Same geometry as the AppShell header icon actions.
const topActionStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: 0,
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};


/* ─── Frozen preview ────────────────────────────────────────────── */

/* ─── Ghost add card ────────────────────────────────────────────── */

/* ─── Card ─────────────────────────────────────────────────────── */


// Flat, like the jar rows: the section's surface is the only container.
const frozenRowStyle: CSSProperties = {
  width: "100%",
  minHeight: 76,
  padding: "8px 24px 8px 12px",
  border: "none",
  borderRadius: 0,
  background: "var(--surface)",
  boxShadow: "none",
  color: "var(--text2)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};

const frozenNameStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  fontSize: 15,
  fontWeight: 500,
};
