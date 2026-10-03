"use client";

import { Skeleton, SkeletonRegion, SkeletonRows } from "./ui/Skeleton";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Account, BudgetScope, Category, Transaction } from "./app-types";
import { buildMoneyFlow, buildSpendingBreakdown, reflectMonthCount, reflectPreset, UNKNOWN_ACCOUNT, type ReflectCategory, type ReflectPeriod } from "./reflect-utils";
import { fmt, fmtDate, today } from "./app-utils";
import { Money } from "./Money";
import { MonthPicker } from "./DatePicker";
import { ReflectActivity } from "./ReflectActivity";
import { ReflectFlowChart } from "./ReflectFlowChart";
import { MascotHero } from "./mascot/MascotHero";
import { useAppHaptics } from "./ui/useAppHaptics";
import { spendingJarItems } from "./mascot/budgetJar";
import { BottomSheet } from "./ui/BottomSheet";
import { BlurScrollArea } from "./ui/ProgressiveBlur";
import { Banner } from "./ui/Banner";
import { ScreenChip } from "./ui/ScreenChip";
import { CategoryIcon } from "./ui/CategoryIcon";
import { TransactionRow } from "./ui/TransactionRow";
import { CalendarRangeIcon, ChevronDownIcon, SlidersIcon, XIcon } from "./ui/icons";

type Props = {
  transactions: Transaction[];
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
  onClickTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => boolean | Promise<boolean>;
};
const monthName = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString("en", { month: "short", year: "numeric" });
const periodName = ({ start, end }: ReflectPeriod) => !start ? "All time" : start === end ? monthName(start) : `${monthName(start)} – ${monthName(end)}`;
/** Bigger than the other heroes: here the jar is the chart, not a companion to a number. */
const REFLECT_JAR_SIZE = 250;
const tone = (index: number) => `color-mix(in srgb, var(--select-ink) ${Math.max(20, 92 - index * 12)}%, var(--surface2))`;

export function ReflectScreen(props: Props) {
  const { haptic } = useAppHaptics();
  const [showPeriod, setShowPeriod] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [customPeriod, setCustomPeriod] = useState(props.period);
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  const [excludedAccounts, setExcludedAccounts] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const currentMonth = today().slice(0, 7);
  useEffect(() => {
    const open = () => { props.onViewChange("activity"); setSearchOpen(true); };
    window.addEventListener("open-reflect-search", open);
    return () => window.removeEventListener("open-reflect-search", open);
  }, [props.onViewChange]);
  useEffect(() => { setExcludedCategories([]); setExcludedAccounts([]); setSelectedId(null); }, [props.budgetScope]);
  useEffect(() => { setSelectedId(null); }, [props.period.start, props.period.end]);

  const unfiltered = useMemo(() => buildSpendingBreakdown(props.transactions, props.categories, props.accounts, props.budgetScope), [props.transactions, props.categories, props.accounts, props.budgetScope]);
  const breakdown = useMemo(() => buildSpendingBreakdown(props.transactions, props.categories, props.accounts, props.budgetScope, excludedCategories, excludedAccounts), [props.transactions, props.categories, props.accounts, props.budgetScope, excludedCategories, excludedAccounts]);
  const allRows = [...breakdown.spending, ...breakdown.inflows, ...breakdown.settled];
  const selected = allRows.find(row => row.id === selectedId);
  const categoryOptions = [...unfiltered.spending, ...unfiltered.inflows, ...unfiltered.settled].sort((a, b) => a.name.localeCompare(b.name));
  const accountIds = new Set(categoryOptions.flatMap(row => row.transactions.map(transaction => transaction.accountId || transaction.toAccountId || UNKNOWN_ACCOUNT)));
  const accountOptions = [...accountIds].map(id => ({ id, name: props.accounts.find(account => account.id === id)?.label ?? (id === UNKNOWN_ACCOUNT ? "No account" : "Archived account") }));
  const filterCount = excludedCategories.length + excludedAccounts.length;
  const months = reflectMonthCount(props.period, props.transactions);
  const jarItems = useMemo(() => spendingJarItems(breakdown.spending), [breakdown.spending]);
  const [showFlow, setShowFlow] = useState(false);
  const flow = useMemo(
    () => buildMoneyFlow(breakdown.spending, props.transactions, props.categories, props.accounts, props.budgetScope, props.period, excludedAccounts),
    [breakdown.spending, props.transactions, props.categories, props.accounts, props.budgetScope, props.period, excludedAccounts],
  );
  const toggle = (id: string, values: string[], set: (values: string[]) => void) => set(values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
  const choosePeriod = (period: ReflectPeriod) => { props.onPeriodChange(period); setShowPeriod(false); };
  const label = periodName(props.period);
  const hasData = breakdown.transactionCount > 0;
  // One short line: the biggest category, and the monthly average over longer periods.
  const top = breakdown.spending[0];
  const summary = [
    top && `Mostly ${top.name} (${Math.round(top.share * 100)}%)`,
    months > 1 && `${fmt(Math.round(breakdown.total / months))} / month`,
  ].filter(Boolean).join(". ");

  const categoryRow = (row: ReflectCategory, index: number, inflow = false) => <li key={row.id}>
    <button type="button" onClick={() => setSelectedId(row.id)} aria-label={`${row.name}, ${inflow ? "net inflow" : "spent"} ${Math.abs(row.net)} MAD${!inflow && row.share > 0 ? `, ${(row.share * 100).toFixed(1)} percent` : ""}, view transactions`} style={categoryButtonStyle}>
      <CategoryIcon icon={row.icon} size={32} />
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 8 }}>
        <span style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ overflowWrap: "anywhere", color: "var(--text2)", fontSize: 15, fontWeight: 500 }}>{row.name}</span>
          <span style={{ flexShrink: 0, color: inflow ? "var(--action-income)" : "var(--text2)", fontSize: 15, fontWeight: 600 }}>{inflow ? "+" : ""}<Money value={Math.abs(row.net)} /></span>
        </span>
        <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {!inflow && row.net > 0 && <span aria-hidden="true" style={{ height: 4, flex: 1, borderRadius: 4, background: "var(--surface2)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${row.share * 100}%`, background: tone(index), borderRadius: 4 }} /></span>}
          <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{row.net > 0 ? `${(row.share * 100).toFixed(1)}%` : `${row.transactions.length} transactions`}</span>
        </span>
      </span>
    </button>
  </li>;

  return <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" style={{ display: "grid", gap: 24, minWidth: 0, paddingBottom: 100 }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Reflect</h1>
      <div role="group" aria-label="Reflect view" style={{ display: "flex", gap: 8 }}>
        <ScreenChip selected={props.view === "spending"} onClick={() => props.onViewChange("spending")}>Spending</ScreenChip>
        <ScreenChip selected={props.view === "activity"} onClick={() => props.onViewChange("activity")}>Activity</ScreenChip>
      </div>
    </header>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <button type="button" onClick={() => { setCustomPeriod(props.period.start ? props.period : reflectPreset("month")); setShowPeriod(true); }} aria-label={`Time period: ${label}`} aria-haspopup="dialog" style={quietButtonStyle}><CalendarRangeIcon size={16} /><span>{label}</span><ChevronDownIcon size={14} /></button>
      {props.view === "spending" && <button type="button" aria-label={`Filter spending${filterCount ? `, ${filterCount} exclusions` : ""}`} aria-haspopup="dialog" onClick={() => setShowFilters(true)} style={{ ...quietButtonStyle, background: filterCount ? "var(--select-wash)" : "transparent", color: filterCount ? "var(--select-ink)" : "var(--text2)" }}><SlidersIcon size={16} /><span>Filter{filterCount ? ` (${filterCount})` : ""}</span></button>}
    </div>
    {props.error ? <Banner tone="danger" role="alert" title="Could not load this period" action={<button onClick={props.onRetry} style={quietButtonStyle}>Try again</button>}>Your records are unchanged. Try refreshing Reflect.</Banner>
      : props.transactionsLoading ? <SkeletonRegion label="Loading Reflect" style={{ display: "grid", gap: 16 }}><Skeleton style={{ height: 220, borderRadius: 16 }} /><SkeletonRows /></SkeletonRegion>
      : props.view === "activity" ? <ReflectActivity {...props} periodLabel={label} searchOpen={searchOpen} onSearchClose={() => setSearchOpen(false)} />
      : <>
        {!hasData ? <section style={{ padding: "40px 0", textAlign: "center" }}><h2 style={{ fontSize: 20, fontWeight: 500 }}>{filterCount ? "Nothing matches these filters" : "No spending to reflect on yet"}</h2><p style={mutedStyle}>{filterCount ? "Include more categories or accounts to see the breakdown." : "Try another period, or add your first expense."}</p>{filterCount > 0 && <button style={quietButtonStyle} onClick={() => { setExcludedAccounts([]); setExcludedCategories([]); }}>Reset filters</button>}</section>
          : <>
            <section aria-label="Spending breakdown" style={{ display: "grid", justifyItems: "center", gap: 12 }}>
              {/* The period's spending as the scope's jar, one emoji per category sized by its share.
                  Tapping it swaps in spending against money in over the same period, and back. */}
              <button type="button" onClick={() => { haptic("light"); setShowFlow(open => !open); }} aria-pressed={showFlow} aria-label={showFlow ? "Show spending by category" : "Show spending against money in"} style={jarButtonStyle}>
                {showFlow
                  ? <ReflectFlowChart points={flow} height={REFLECT_JAR_SIZE - 44} />
                  : <MascotHero variant="split" scope={props.budgetScope} items={jarItems} spentPct={null} size={REFLECT_JAR_SIZE} style={{ margin: "-28px auto -16px" }} />}
              </button>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><span style={mutedStyle}>Spent</span><span style={{ fontSize: breakdown.total >= 1000000 ? 28 : 36, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--danger)" }}>{breakdown.total > 0 ? "−" : ""}<Money value={breakdown.total} currency /></span></div>
              {summary && <p style={summaryStyle}>{summary}</p>}
            </section>
            <section aria-label="Spending by category">
              <div style={sectionHeaderStyle}><h2 style={sectionTitleStyle}>Where it went</h2></div>
              <ul style={listStyle}>{breakdown.spending.map((row, index) => categoryRow(row, index))}</ul>
            </section>
            {breakdown.inflows.length > 0 && <section aria-label="Positive category inflows"><h2 style={sectionTitleStyle}>More came back than went out</h2><p style={mutedStyle}>Net inflows in these categories are separate from the spending chart.</p><ul style={listStyle}>{breakdown.inflows.map((row, index) => categoryRow(row, index, true))}</ul></section>}
            {breakdown.settled.length > 0 && <section aria-label="Fully offset categories"><h2 style={sectionTitleStyle}>Balanced out</h2><p style={mutedStyle}>Category inflows covered the spending.</p><ul style={listStyle}>{breakdown.settled.map((row, index) => categoryRow(row, index))}</ul></section>}
          </>}
      </>}

    <BottomSheet open={showPeriod} onClose={() => setShowPeriod(false)} label="Time period" maxWidth="440px" contentStyle={sheetContentStyle}>
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

    <BottomSheet open={showFilters} onClose={() => setShowFilters(false)} label="Filter spending" maxWidth="480px" contentStyle={sheetContentStyle}>
      <SheetHeader title="Filter spending" onClose={() => setShowFilters(false)} />
      <BlurScrollArea style={sheetScrollStyle}>
        <FilterGroup title="Categories" items={categoryOptions} excluded={excludedCategories} onToggle={id => toggle(id, excludedCategories, setExcludedCategories)} onAll={() => setExcludedCategories([])} onNone={() => setExcludedCategories(categoryOptions.map(row => row.id))} />
        <FilterGroup title="Accounts" items={accountOptions} excluded={excludedAccounts} onToggle={id => toggle(id, excludedAccounts, setExcludedAccounts)} onAll={() => setExcludedAccounts([])} onNone={() => setExcludedAccounts(accountOptions.map(row => row.id))} />
      </BlurScrollArea>
      <button onClick={() => setShowFilters(false)} style={primaryButtonStyle}>Show breakdown</button>
    </BottomSheet>

    <BottomSheet open={Boolean(selected)} onClose={() => setSelectedId(null)} label={selected ? `${selected.name} spending` : "Category spending"} maxWidth="500px" contentStyle={sheetContentStyle}>
      {selected && <><SheetHeader title={selected.name} onClose={() => setSelectedId(null)} /><BlurScrollArea style={sheetScrollStyle}><p style={{ ...mutedStyle, marginTop: 0 }}>{label}</p><div style={{ fontSize: 32, fontWeight: 600, margin: "8px 0" }}><Money value={Math.abs(selected.net)} currency /></div><p style={mutedStyle}>{selected.net < 0 ? "Net inflow from" : "Net spending across"} {selected.transactions.length} {selected.transactions.length === 1 ? "transaction" : "transactions"}</p>{selected.inflow > 0 && <p style={mutedStyle}><span style={{ display: "block" }}><Money value={selected.spent} /> out</span><span style={{ display: "block" }}><Money value={selected.inflow} /> in</span></p>}<div style={{ marginTop: 24 }}>{selected.transactions.map(transaction => { const income = transaction.type === "Income" || transaction.amount < 0; return <TransactionRow key={transaction.id} title={transaction.name || selected.name} subtitle={props.accounts.find(account => account.id === (transaction.accountId || transaction.toAccountId))?.label} date={fmtDate(transaction.date)} amount={transaction.amount} tone={income ? "income" : "expense"} prefix={income ? "+" : "−"} icon={<CategoryIcon icon={selected.icon} size={22} />} onClick={() => { setSelectedId(null); props.onClickTransaction(transaction); }} />; })}</div></BlurScrollArea></>}
    </BottomSheet>
  </div>;
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) { return <header style={{ display: "flex", flexShrink: 0, alignItems: "center", justifyContent: "space-between", gap: 16 }}><h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, overflowWrap: "anywhere" }}>{title}</h2><button type="button" aria-label="Close" onClick={onClose} style={{ ...quietButtonStyle, padding: 0, width: 44, flexShrink: 0 }}><XIcon size={20} /></button></header>; }
function FilterGroup({ title, items, excluded, onToggle, onAll, onNone }: { title: string; items: { id: string; name: string }[]; excluded: string[]; onToggle: (id: string) => void; onAll: () => void; onNone: () => void }) { return <fieldset style={{ border: 0, padding: 0, margin: "0 0 24px" }}><legend style={sectionTitleStyle}>{title}</legend><div style={{ display: "flex", gap: 8, marginBottom: 4 }}><button onClick={onAll} style={quietButtonStyle}>All</button><button onClick={onNone} style={quietButtonStyle}>None</button></div>{items.map(item => <label key={item.id} style={{ minHeight: 48, display: "flex", gap: 12, alignItems: "center", fontSize: 15, color: "var(--text2)", cursor: "pointer" }}><input type="checkbox" checked={!excluded.includes(item.id)} onChange={() => onToggle(item.id)} style={{ width: 20, height: 20, accentColor: "var(--select-ink)", flexShrink: 0 }} /><span style={{ overflowWrap: "anywhere" }}>{item.name}</span></label>)}{!items.length && <p style={mutedStyle}>No {title.toLowerCase()} in this period.</p>}</fieldset>; }
/** A flat selected fill: Joint's --select-wash is a gradient. */
const SELECTED_FLAT = "color-mix(in srgb, var(--select-ink) 12%, var(--surface))";
const summaryStyle: CSSProperties = { margin: 0, maxWidth: "100%", fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const jarButtonStyle: CSSProperties = { display: "grid", placeItems: "center", width: "100%", minHeight: REFLECT_JAR_SIZE - 44, border: 0, padding: 0, background: "transparent", font: "inherit", cursor: "pointer", WebkitTapHighlightColor: "transparent" };
const mutedStyle: CSSProperties = { fontSize: 13, color: "var(--muted)", lineHeight: 1.5 };
const sectionTitleStyle: CSSProperties = { fontSize: 16, fontWeight: 600, margin: 0, color: "var(--text2)" };
const sectionHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8 };
const listStyle: CSSProperties = { listStyle: "none", margin: 0, padding: 0 };
const categoryButtonStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 76, border: 0, background: "transparent", padding: "12px 0", textAlign: "left", font: "inherit", cursor: "pointer" };
const quietButtonStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, border: 0, borderRadius: "var(--radius-control)", padding: "0 12px", background: "transparent", color: "var(--text2)", font: "inherit", fontSize: 13, cursor: "pointer" };
const primaryButtonStyle: CSSProperties = { minHeight: 48, flexShrink: 0, border: 0, borderRadius: "var(--radius-control)", background: "var(--accent)", color: "var(--accent-ink)", font: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" };
const sheetContentStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 16, padding: "16px 20px max(20px, env(safe-area-inset-bottom))", overflow: "hidden", boxSizing: "border-box" };
const sheetScrollStyle: CSSProperties = { flex: "1 1 auto", minHeight: 0, overflowY: "auto" };
