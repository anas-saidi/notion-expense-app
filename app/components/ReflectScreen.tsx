"use client";

import { HeroSkeleton, Skeleton, SkeletonRegion, SkeletonRows } from "./ui/Skeleton";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Account, BudgetScope, Category, MonthlySummary, Transaction } from "./app-types";
import { buildMonthlyOverBudget, buildMoneyFlow, buildSpendingBreakdown, isReflectInflow, reflectAccountId, reflectPreset, UNKNOWN_ACCOUNT, type ReflectCategory, type ReflectPeriod } from "./reflect-utils";
import { fmt, fmtDate, today } from "./app-utils";
import { Money } from "./Money";
import { DatePickerTrigger, MonthPicker } from "./DatePicker";
import { ReflectActivity } from "./ReflectActivity";
import { ReflectFlowChart } from "./ReflectFlowChart";
import { ScreenChip } from "./ui/ScreenChip";
import { ScreenToolbar } from "./ui/ScreenLayout";
import { SCREEN_HERO_CHART_HEIGHT } from "./ui/hero-tokens";
import { ScreenHero } from "./ui/ScreenHero";
import { MASCOT_HERO_SIZE, MascotHero } from "./mascot/MascotHero";
import { motion, useReducedMotion } from "motion/react";
import { MascotTap } from "./mascot/MascotTap";
import { spendingJarItems } from "./mascot/budgetJar";
import { BottomSheet } from "./ui/BottomSheet";
import { BlurScrollArea } from "./ui/ProgressiveBlur";
import { Banner } from "./ui/Banner";
import { CategoryIcon } from "./ui/CategoryIcon";
import { Fact, Summary, joinClauses } from "./ui/Summary";
import { TransactionRow } from "./ui/TransactionRow";
import { SlidersIcon, XIcon } from "./ui/icons";

type Props = {
  transactions: Transaction[];
  monthlySummary: MonthlySummary | null;
  categories: Category[];
  accounts: Account[];
  budgetScope: BudgetScope;
  period: ReflectPeriod;
  onPeriodChange: (period: ReflectPeriod) => void;
  view: "spending" | "activity";
  onViewChange: (view: "spending" | "activity") => void;
  transactionsLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onAddExpense: () => void;
  onClickTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => boolean | Promise<boolean>;
};
const monthName = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString("en", { month: "short", year: "numeric" });
const periodName = ({ start, end }: ReflectPeriod) => !start ? "All time" : start === end ? monthName(start) : `${monthName(start)} – ${monthName(end)}`;
const tone = (index: number) => `color-mix(in srgb, var(--select-ink) ${Math.max(20, 92 - index * 12)}%, var(--surface2))`;

export function ReflectScreen(props: Props) {
  const reducedMotion = useReducedMotion();
  const [showPeriod, setShowPeriod] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [customPeriod, setCustomPeriod] = useState(props.period);
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  const [excludedAccounts, setExcludedAccounts] = useState<string[]>([]);
  const [showOverBudget, setShowOverBudget] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const currentMonth = today().slice(0, 7);
  useEffect(() => {
    const open = () => { props.onViewChange("activity"); setSearchOpen(true); };
    window.addEventListener("open-reflect-search", open);
    return () => window.removeEventListener("open-reflect-search", open);
  }, [props.onViewChange]);
  useEffect(() => { setExcludedCategories([]); setExcludedAccounts([]); setSelectedId(null); setShowOverBudget(false); }, [props.budgetScope]);
  useEffect(() => { setSelectedId(null); setShowOverBudget(false); }, [props.period.start, props.period.end]);

  const unfiltered = useMemo(() => buildSpendingBreakdown(props.transactions, props.categories, props.accounts, props.budgetScope), [props.transactions, props.categories, props.accounts, props.budgetScope]);
  const breakdown = useMemo(() => buildSpendingBreakdown(props.transactions, props.categories, props.accounts, props.budgetScope, excludedCategories, excludedAccounts), [props.transactions, props.categories, props.accounts, props.budgetScope, excludedCategories, excludedAccounts]);
  const allRows = [...breakdown.spending, ...breakdown.inflows, ...breakdown.settled];
  const selected = allRows.find(row => row.id === selectedId);
  const categoryOptions = [...unfiltered.spending, ...unfiltered.inflows, ...unfiltered.settled].sort((a, b) => a.name.localeCompare(b.name));
  const accountIds = new Set(categoryOptions.flatMap(row => row.transactions.map(transaction => reflectAccountId(transaction, props.accounts))));
  const accountOptions = [...accountIds].map(id => ({ id, name: props.accounts.find(account => account.id === id)?.label ?? (id === UNKNOWN_ACCOUNT ? "No account" : "Archived account") }));
  const filterCount = excludedCategories.length + excludedAccounts.length;
  const jarItems = useMemo(() => spendingJarItems(breakdown.spending), [breakdown.spending]);
  const flow = useMemo(
    () => buildMoneyFlow(unfiltered.spending, props.transactions, props.categories, props.accounts, props.budgetScope, props.period, []),
    [unfiltered.spending, props.transactions, props.categories, props.accounts, props.budgetScope, props.period],
  );
  const toggle = (id: string, values: string[], set: (values: string[]) => void) => set(values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
  const choosePeriod = (period: ReflectPeriod) => { props.onPeriodChange(period); setShowPeriod(false); };
  const label = periodName(props.period);
  const hasData = breakdown.transactionCount > 0;
  const singleMonth = Boolean(props.period.start && props.period.start === props.period.end);
  const budgetReady = singleMonth && props.monthlySummary?.start.slice(0, 7) === props.period.start
    && props.monthlySummary?.end.slice(0, 7) === props.period.end;
  const overBudget = useMemo(() => buildMonthlyOverBudget(breakdown.spending, props.monthlySummary?.assignedByCategory ?? [], props.categories), [breakdown.spending, props.monthlySummary, props.categories]);
  const overBudgetByCategory = new Map(budgetReady && excludedAccounts.length === 0 ? overBudget.map(row => [row.id, row] as const) : []);

  const overRows = budgetReady && excludedAccounts.length === 0 ? overBudget : [];
  // The current month is still running, so its recap speaks in the present.
  const ongoing = singleMonth && props.period.start === currentMonth;
  const recap = [
    // Actionable exceptions lead; concentration and period health follow.
    overRows.length === 1 && <span key="over"><Fact>{overRows[0].name}</Fact> {ongoing ? "is" : "went"} <Fact tone="danger" onClick={() => setSelectedId(overRows[0].id)} label={`${overRows[0].name} spending`}>{fmt(Math.round(overRows[0].overBudget))} over</Fact> budget</span>,
    overRows.length > 1 && <span key="over"><Fact onClick={() => setShowOverBudget(true)} label={`Review ${overRows.length} over-budget categories`}>{overRows.length} categories</Fact> {ongoing ? "are" : "went"} <Fact tone="danger">over budget</Fact></span>,
    breakdown.spending.length > 3 && <span key="top">top 3 categories account for <Fact>{Math.round(breakdown.spending.slice(0, 3).reduce((sum, row) => sum + row.share, 0) * 100)}%</Fact> of spending</span>,
    budgetReady && excludedAccounts.length === 0 && overRows.length === 0 && <span key="within">all categories <Fact tone="success">{ongoing ? "are within budget" : "stayed within budget"}</Fact></span>,
  ].filter(Boolean);

  const categoryRow = (row: ReflectCategory, index: number, inflow = false) => {
    const variance = !inflow ? overBudgetByCategory.get(row.id) : undefined;
    return <li key={row.id}>
    <button type="button" onClick={() => setSelectedId(row.id)} aria-label={`${row.name}, ${inflow ? "net inflow" : "spent"} ${Math.abs(row.net)} MAD${!inflow && row.share > 0 ? `, ${(row.share * 100).toFixed(1)} percent` : ""}${variance ? `, ${variance.overBudget} MAD over budget, assigned ${variance.assigned} MAD` : ""}, view transactions`} style={categoryButtonStyle}>
      <CategoryIcon icon={row.icon} categoryName={row.name} size={32} />
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 8 }}>
        <span style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ overflowWrap: "anywhere", color: "var(--text2)", fontSize: 15, fontWeight: 500 }}>{row.name}</span>
          <span style={{ flexShrink: 0, color: inflow ? "var(--action-income)" : "var(--text2)", fontSize: 15, fontWeight: 600 }}>{inflow ? "+" : ""}<Money value={Math.abs(row.net)} /></span>
        </span>
        <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {!inflow && row.net > 0 && <span aria-hidden="true" style={{ height: 4, flex: 1, borderRadius: 4, background: "var(--surface2)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${row.share * 100}%`, background: variance ? "var(--danger)" : tone(index), borderRadius: 4 }} /></span>}
          <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{row.net > 0 ? `${(row.share * 100).toFixed(1)}%` : `${row.transactions.length} transactions`}</span>
        </span>
        {variance && <span style={{ fontSize: 13, color: "var(--danger)" }}><Money value={variance.overBudget} /> over budget</span>}
      </span>
    </button>
  </li>;
  };

  const periodControls = <ScreenToolbar label="Reflect period and filters" className="reflect-period-toolbar">
    <DatePickerTrigger label={label} open={showPeriod} className="composer-picker-chip" showChevron={false}
      ariaLabel={`Time period: ${label}`} onClick={() => { setCustomPeriod(props.period.start ? props.period : reflectPreset("month")); setShowPeriod(true); }} />
    {props.view === "spending" && <button type="button" title="Filter spending" aria-label={`Filter spending${filterCount ? `, ${filterCount} exclusions` : ""}`} aria-haspopup="dialog" aria-expanded={showFilters}
      onClick={() => setShowFilters(true)} style={{ ...quietButtonStyle, width: 44, height: 44, padding: 0, flexShrink: 0, borderRadius: "50%", border: "1px solid color-mix(in srgb, var(--border) 44%, transparent)", background: filterCount ? "var(--select-wash)" : "transparent", color: filterCount ? "var(--select-ink)" : "var(--text2)" }}>
      <SlidersIcon size={20} aria-hidden="true" />
    </button>}
  </ScreenToolbar>;

  const viewControls = <div className="reflect-hero-switch" role="group" aria-label="Reflect view">
    <ScreenChip minHeight={44} selected={props.view === "spending"} onClick={() => props.onViewChange("spending")}>Spending</ScreenChip>
    <ScreenChip minHeight={44} selected={props.view === "activity"} onClick={() => props.onViewChange("activity")}>Activity</ScreenChip>
  </div>;

  const flowTotals = flow[flow.length - 1] ?? { spent: 0, moneyIn: 0 };
  const flowDifference = Math.round((flowTotals.moneyIn - flowTotals.spent) * 100) / 100;
  const activitySummary = flowTotals.spent === 0 && flowTotals.moneyIn === 0
    ? <Summary>No money in or spending this period.</Summary>
    : flowDifference === 0 ? <Summary>Money in matched spending this period.</Summary>
    : <Summary>{flowDifference > 0 ? "Money in exceeded spending" : "Spending exceeded money in"} by <Fact><Money value={Math.abs(flowDifference)} currency /></Fact> this period.</Summary>;

  const heroVisual = <div className="reflect-hero-visual" data-view={props.view}>
    {viewControls}
    <motion.div key={props.view} initial={{ opacity: 0.65 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.22 }} style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", minWidth: 0 }}>
    {props.view === "activity"
      ? <section className="reflect-hero-chart" aria-label="Spending and money in over this period">{props.transactionsLoading
        ? <SkeletonRegion label="Loading activity chart" style={{ height: SCREEN_HERO_CHART_HEIGHT, display: "grid", gridTemplateRows: "16px 1fr", gap: 16 }}><Skeleton style={{ width: "60%", height: 16, marginInline: "auto" }} /><Skeleton style={{ height: "100%", borderRadius: 8 }} /></SkeletonRegion>
        : <ReflectFlowChart points={flow} height={SCREEN_HERO_CHART_HEIGHT} />}</section>
      : props.transactionsLoading ? <HeroSkeleton /> : <MascotTap label="React to spending" style={jarButtonStyle}>
        <MascotHero variant="split" scope={props.budgetScope} items={jarItems} spentPct={null} size={MASCOT_HERO_SIZE} />
      </MascotTap>}
    </motion.div>
  </div>;

  return <div id="panel-history" className="screen-layout" role="tabpanel" aria-labelledby="tab-history" style={{ display: "grid", gap: 24, minWidth: 0, paddingBottom: 100 }}>
    <div className="reflect-desktop-panels">
      <section className="reflect-desktop-overview screen-overview" aria-label="Spending breakdown">
        <ScreenHero
          mascot={heroVisual}
          label="Spent" showMetric={props.view === "spending"} loading={props.transactionsLoading} value={props.transactionsLoading || props.error ? null : breakdown.total}
          summary={props.transactionsLoading ? <Skeleton style={{ height: "1.4em", width: "70%" }} /> : props.error ? null : props.view === "activity" ? activitySummary : recap.length > 0 ? <Summary>{joinClauses(recap)}.</Summary> : null}
        />
        {periodControls}
      </section>
      <section className="reflect-desktop-categories screen-content" aria-label="Reflect results">
        {props.error ? <Banner tone="danger" role="alert" title="Could not load this period" action={<button onClick={props.onRetry} style={quietButtonStyle}>Retry</button>}>Records unchanged. Refresh Reflect to retry.</Banner>
          : props.transactionsLoading ? <SkeletonRegion label="Loading Reflect"><SkeletonRows /></SkeletonRegion>
          : props.view === "activity" ? <ReflectActivity {...props} periodLabel={label} searchOpen={searchOpen} onSearchClose={() => setSearchOpen(false)} />
          : !hasData ? <section style={{ padding: "40px 0", textAlign: "center" }}><h2 style={{ fontSize: 20, fontWeight: 500 }}>{filterCount ? "No matching spending" : "No spending yet"}</h2><p style={mutedStyle}>{filterCount ? "Include more categories or accounts to see the breakdown." : "Choose another period or add an expense."}</p>{filterCount > 0 ? <button type="button" style={quietButtonStyle} onClick={() => { setExcludedAccounts([]); setExcludedCategories([]); }}>Reset filters</button> : <button type="button" style={quietButtonStyle} onClick={event => { event.currentTarget.focus(); props.onAddExpense(); }}>Add expense</button>}</section>
          : <ul aria-label="Spending by category" style={listStyle}>{breakdown.spending.map((row, index) => categoryRow(row, index))}</ul>}
      </section>
    </div>
    {!props.error && !props.transactionsLoading && props.view === "spending" && <>
      {breakdown.inflows.length > 0 && <section aria-label="Positive category inflows"><h2 style={sectionTitleStyle}>More came back than went out</h2><p style={mutedStyle}>Net inflows in these categories are separate from the spending chart.</p><ul style={listStyle}>{breakdown.inflows.map((row, index) => categoryRow(row, index, true))}</ul></section>}
      {breakdown.settled.length > 0 && <section aria-label="Fully offset categories"><h2 style={sectionTitleStyle}>Balanced out</h2><p style={mutedStyle}>Category inflows covered the spending.</p><ul style={listStyle}>{breakdown.settled.map((row, index) => categoryRow(row, index))}</ul></section>}
    </>}

    <BottomSheet open={showOverBudget} onClose={() => setShowOverBudget(false)} label="Over-budget categories" size="compact" contentStyle={sheetContentStyle}>
      <SheetHeader title="Over-budget categories" onClose={() => setShowOverBudget(false)} />
      <BlurScrollArea style={sheetScrollStyle}>
        <ul style={listStyle}>{overRows.map(row => <li key={row.id}><button type="button" style={{ ...categoryButtonStyle, justifyContent: "space-between" }} onClick={() => { setShowOverBudget(false); setSelectedId(row.id); }} aria-label={`${row.name}, ${fmt(row.overBudget)} MAD over budget, view transactions`}><span>{row.name}</span><span style={{ color: "var(--danger)" }}><Money value={row.overBudget} /> over</span></button></li>)}</ul>
      </BlurScrollArea>
    </BottomSheet>

    <BottomSheet open={showPeriod} onClose={() => setShowPeriod(false)} label="Time period" size="compact" contentStyle={sheetContentStyle}>
      <SheetHeader title="Time period" onClose={() => setShowPeriod(false)} />
      <BlurScrollArea style={sheetScrollStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {([["month", "This month"], ["last-month", "Last month"], ["3", "Last 3 months"], ["6", "Last 6 months"], ["12", "Last 12 months"], ["year", "This year"], ["last-year", "Last year"], ["all", "All time"]] as const).map(([key, name]) => { const period = reflectPreset(key); const selected = props.period.start === period.start && props.period.end === period.end; return <button type="button" key={key} aria-pressed={selected} onClick={() => choosePeriod(period)} style={{ ...quietButtonStyle, justifyContent: "center", background: selected ? SELECTED_FLAT : "var(--surface2)", color: selected ? "var(--select-ink)" : "var(--text2)" }}>{name}</button>; })}
        </div>
        <h3 style={{ ...sectionTitleStyle, margin: "24px 0 12px" }}>Choose your own range</h3>
        <div style={{ display: "grid", gap: 16 }}><label style={mutedStyle}>From<MonthPicker value={customPeriod.start} max={currentMonth} aria-label="Start month" onChange={event => setCustomPeriod({ ...customPeriod, start: event.target.value })} /></label><label style={mutedStyle}>Through<MonthPicker value={customPeriod.end} max={currentMonth} aria-label="End month" onChange={event => setCustomPeriod({ ...customPeriod, end: event.target.value })} /></label></div>
        {customPeriod.start > customPeriod.end && <p role="alert" style={{ ...mutedStyle, color: "var(--danger)" }}>The end month must follow the start month.</p>}
      </BlurScrollArea>
      <button disabled={!customPeriod.start || !customPeriod.end || customPeriod.start > customPeriod.end || customPeriod.end > currentMonth} onClick={() => choosePeriod(customPeriod)} style={primaryButtonStyle}>Apply range</button>
    </BottomSheet>

    <BottomSheet open={showFilters} onClose={() => setShowFilters(false)} label="Filter spending" size="standard" desktopHeight="fill" contentStyle={sheetContentStyle}>
      <SheetHeader title="Filter spending" onClose={() => setShowFilters(false)} />
      <BlurScrollArea style={sheetScrollStyle}>
        <FilterGroup title="Categories" items={categoryOptions} excluded={excludedCategories} onToggle={id => toggle(id, excludedCategories, setExcludedCategories)} onAll={() => setExcludedCategories([])} onNone={() => setExcludedCategories(categoryOptions.map(row => row.id))} />
        <FilterGroup title="Accounts" items={accountOptions} excluded={excludedAccounts} onToggle={id => toggle(id, excludedAccounts, setExcludedAccounts)} onAll={() => setExcludedAccounts([])} onNone={() => setExcludedAccounts(accountOptions.map(row => row.id))} />
      </BlurScrollArea>
      <button onClick={() => setShowFilters(false)} style={primaryButtonStyle}>Show breakdown</button>
    </BottomSheet>

    <BottomSheet open={Boolean(selected)} onClose={() => setSelectedId(null)} label={selected ? `${selected.name} spending` : "Category spending"} size="standard" desktopHeight="fill" contentStyle={sheetContentStyle}>
      {selected && <><SheetHeader title={selected.name} onClose={() => setSelectedId(null)} /><BlurScrollArea style={sheetScrollStyle}><p style={{ ...mutedStyle, marginTop: 0 }}>{label}</p><div style={{ fontSize: 32, fontWeight: 600, margin: "8px 0" }}><Money value={Math.abs(selected.net)} currency /></div><p style={mutedStyle}>{selected.net < 0 ? "Net inflow from" : "Net spending across"} {selected.transactions.length} {selected.transactions.length === 1 ? "transaction" : "transactions"}</p>{selected.inflow > 0 && <p style={mutedStyle}><span style={{ display: "block" }}><Money value={selected.spent} /> out</span><span style={{ display: "block" }}><Money value={selected.inflow} /> in</span></p>}<div style={{ marginTop: 24 }}>{selected.transactions.map(transaction => { const income = isReflectInflow(transaction, props.accounts); return <TransactionRow key={transaction.id} title={transaction.name || selected.name} subtitle={props.accounts.find(account => account.id === reflectAccountId(transaction, props.accounts))?.label} date={fmtDate(transaction.date)} amount={transaction.amount} tone={income ? "income" : "expense"} prefix={income ? "+" : "−"} icon={<CategoryIcon icon={selected.icon} categoryName={selected.name} size={22} />} onClick={() => { setSelectedId(null); props.onClickTransaction(transaction); }} />; })}</div></BlurScrollArea></>}
    </BottomSheet>
  </div>;
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) { return <header className="sheet-header" style={{ display: "flex", flexShrink: 0, alignItems: "center", justifyContent: "space-between", gap: 16 }}><h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, overflowWrap: "anywhere" }}>{title}</h2><button type="button" aria-label="Close" onClick={onClose} style={{ ...quietButtonStyle, padding: 0, width: 44, flexShrink: 0 }}><XIcon size={20} /></button></header>; }
function FilterGroup({ title, items, excluded, onToggle, onAll, onNone }: { title: string; items: { id: string; name: string }[]; excluded: string[]; onToggle: (id: string) => void; onAll: () => void; onNone: () => void }) { return <fieldset style={{ border: 0, padding: 0, margin: "0 0 24px" }}><legend style={sectionTitleStyle}>{title}</legend><div style={{ display: "flex", gap: 8, marginBottom: 4 }}><button onClick={onAll} style={quietButtonStyle}>All</button><button onClick={onNone} style={quietButtonStyle}>None</button></div>{items.map(item => <label key={item.id} style={{ minHeight: 48, display: "flex", gap: 12, alignItems: "center", fontSize: 15, color: "var(--text2)", cursor: "pointer" }}><input type="checkbox" checked={!excluded.includes(item.id)} onChange={() => onToggle(item.id)} style={{ width: 20, height: 20, accentColor: "var(--select-ink)", flexShrink: 0 }} /><span style={{ overflowWrap: "anywhere" }}>{item.name}</span></label>)}{!items.length && <p style={mutedStyle}>No {title.toLowerCase()} in this period.</p>}</fieldset>; }
/** A flat selected fill: Joint's --select-wash is a gradient. */
const SELECTED_FLAT = "color-mix(in srgb, var(--select-ink) 12%, var(--surface))";
const jarButtonStyle: CSSProperties = { display: "grid", placeItems: "center", width: "100%", minHeight: MASCOT_HERO_SIZE, border: 0, padding: 0, background: "transparent", font: "inherit", cursor: "pointer", WebkitTapHighlightColor: "transparent" };
const mutedStyle: CSSProperties = { fontSize: 13, color: "var(--muted)", lineHeight: 1.5 };
const sectionTitleStyle: CSSProperties = { fontSize: 16, fontWeight: 600, margin: 0, color: "var(--text2)" };
const listStyle: CSSProperties = { listStyle: "none", margin: 0, padding: 0 };
const categoryButtonStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 76, border: 0, background: "transparent", padding: "12px 0", textAlign: "left", font: "inherit", cursor: "pointer" };
const quietButtonStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, border: 0, borderRadius: "var(--radius-control)", padding: "0 12px", background: "transparent", color: "var(--text2)", font: "inherit", fontSize: 13, cursor: "pointer" };
const primaryButtonStyle: CSSProperties = { minHeight: 48, flexShrink: 0, border: 0, borderRadius: "var(--radius-control)", background: "var(--accent)", color: "var(--accent-ink)", font: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" };
const sheetContentStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 16, padding: "var(--dialog-body-padding, 16px 20px max(20px, env(safe-area-inset-bottom)))", overflow: "hidden", boxSizing: "border-box" };
const sheetScrollStyle: CSSProperties = { flex: "1 1 auto", minHeight: 0, overflowY: "auto" };
