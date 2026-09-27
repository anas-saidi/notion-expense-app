"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Mascot } from "./mascot/Mascot";
import type { Mood } from "./mascot/poses";
import type { Account, BudgetScope, Category, Transaction } from "./app-types";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { comparisonPeriods, getCategoryScope, isExpenseTransaction, resolveTransactionScopes, transactionMatchesScope, fmt } from "./app-utils";
import { ArrowDownIcon, ArrowUpIcon, BanknoteIcon, CalendarIcon, CalendarRangeIcon, ChartPieIcon, FlameIcon, TransferIcon } from "./ui/icons";
import { Banner } from "./ui/Banner";
import { ScreenChip } from "./ui/ScreenChip";
import { SearchField } from "./ui/SearchField";
import { TransactionRow } from "./ui/TransactionRow";
import { MonthPicker } from "./DatePicker";

/* ─── Types ──────────────────────────────────────────────────────── */

type Props = {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  budgetScope: BudgetScope;
  insightsMonth: string;
  onInsightsMonthChange: (m: string) => void;
  transactionsLoading?: boolean;
  onClickTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => boolean | Promise<boolean>;
};

/* ─── Constants ──────────────────────────────────────────────────── */


/* ─── Screen ─────────────────────────────────────────────────────── */

export function InsightsScreen({
  transactions,
  categories,
  accounts,
  budgetScope,
  insightsMonth,
  onInsightsMonthChange,
  onClickTransaction,
  onDeleteTransaction,
  transactionsLoading = false,
}: Props) {

  /* Month nav */
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const monthLabel = useMemo(() => {
    const [y, m] = insightsMonth.split("-").map(Number);
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  }, [insightsMonth]);
  /* Historical planned — fetched from monthly-summary per viewed month */
  type SummaryEntry = { categoryId: string; total: number; accountId?: string | null };
  const [assignedByCategory, setAssignedByCategory] = useState<SummaryEntry[] | null>(null);
  const [prevMonthTransactions, setPrevMonthTransactions] = useState<Transaction[] | null>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [activityQuery, setActivityQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activityType, setActivityType] = useState<"All" | "Expenses" | "Income" | "Transfers" | "Needs review">("All");

  useEffect(() => {
    const openSearch = () => setSearchOpen(true);
    window.addEventListener("open-insights-search", openSearch);
    return () => window.removeEventListener("open-insights-search", openSearch);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    setAssignedByCategory(null);
    setPrevMonthTransactions(null);
    setInsightsError(null);
    const periods = comparisonPeriods(insightsMonth);

    const readJson = async (url: string) => {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("application/json")) {
        throw new Error(`Unable to load insights (${response.status || "invalid response"})`);
      }
      return response.json();
    };

    Promise.all([
      readJson(`/api/monthly-summary?month=${insightsMonth}`),
      readJson(`/api/transactions?start=${periods.previous.start}&end=${periods.previous.end}`),
    ]).then(([curr, prevTx]) => {
      setAssignedByCategory(curr.summary?.assignedByCategory ?? null);
      setPrevMonthTransactions(prevTx.transactions ?? null);
    }).catch((error: unknown) => {
      setAssignedByCategory([]);
      setPrevMonthTransactions([]);
      setInsightsError(error instanceof Error ? error.message : "Unable to load insights");
    });
  }, [insightsMonth, retryKey]);

  /* Shared derivations */
  const scopedTransactions = useMemo(() => transactions.filter(t => transactionMatchesScope(t, categories, budgetScope, accounts)), [transactions, categories, budgetScope, accounts]);
  const unassignedTransactions = useMemo(() => transactions.filter(t => resolveTransactionScopes(t, categories, accounts).length === 0), [transactions, categories, accounts]);
  const activityTransactions = activityType === "Needs review" ? unassignedTransactions : scopedTransactions;
  const expenses = useMemo(() => scopedTransactions.filter(isExpenseTransaction), [scopedTransactions]);

  const totalSpent = useMemo(
    () => expenses.reduce((s, t) => s + t.amount, 0),
    [expenses],
  );

  const totalPlanned = useMemo(() => {
    if (!assignedByCategory) return 0;
    return assignedByCategory
      .filter(({ categoryId, accountId }) => {
        const label = (accountId ? (accounts.find(a => a.id === accountId)?.label ?? "") : "").toLowerCase();
        // Savings accounts are never part of operational planned budget
        if (label.includes("saving")) return false;
        // Primary: use account label
        if (label.includes("hubb")) return budgetScope === "anas";
        if (label.includes("wife")) return budgetScope === "salma";
        if (label.includes("joined")) return budgetScope === "joint";
        // Fallback: category scope
        const cat = categories.find(c => c.id === categoryId);
        if (!cat) return budgetScope === "joint";
        return getCategoryScope(cat) === budgetScope;
      })
      .reduce((s, { total }) => s + total, 0);
  }, [assignedByCategory, accounts, categories, budgetScope]);

  /* ── 1. Burn Rate ──────────────────────────────────────────────── */
  const lastMonthTotalSpent = useMemo(() => {
    if (!prevMonthTransactions) return 0;
    return prevMonthTransactions
      .filter(isExpenseTransaction)
      .filter(t => transactionMatchesScope(t, categories, budgetScope, accounts))
      .reduce((s, t) => s + t.amount, 0);
  }, [prevMonthTransactions, categories, budgetScope, accounts]);

  const burnRate = useMemo(() => {
    const [y, m] = insightsMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const isCurrentMonth = insightsMonth === currentMonthStr;
    const daysElapsed = isCurrentMonth ? new Date().getDate() : daysInMonth;
    const expectedSpend = totalPlanned > 0 ? (totalPlanned / daysInMonth) * daysElapsed : 0;
    const spentPct = totalPlanned > 0 ? Math.min(100, (totalSpent / totalPlanned) * 100) : 0;
    const expectedPct = (daysElapsed / daysInMonth) * 100;
    const isAhead = expectedSpend > 0 && totalSpent > expectedSpend;
    const isOver  = totalPlanned > 0 && totalSpent > totalPlanned;
    const gapPct  = expectedSpend > 0 ? Math.abs((totalSpent - expectedSpend) / expectedSpend * 100) : 0;
    const daysLeft = daysInMonth - daysElapsed;
    const vsLastMonth = lastMonthTotalSpent > 0
      ? Math.round(((totalSpent - lastMonthTotalSpent) / lastMonthTotalSpent) * 100)
      : null;
    return { spentPct, expectedPct, isAhead, isOver, gapPct, daysLeft, vsLastMonth };
  }, [insightsMonth, totalSpent, totalPlanned, lastMonthTotalSpent, currentMonthStr]);


  /* ── Transaction history (bottom section) ─────────────────────── */
  const txGroups = useMemo(() => {
    const now = new Date();
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const getGroupLabel = (dateStr: string) => {
      const d = new Date(`${dateStr}T00:00:00`);
      const diff = Math.round((nowDay - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
      if (diff <= 0) return "Today";
      if (diff === 1) return "Yesterday";
      return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(d);
    };
    const map = new Map<string, { label: string; items: Transaction[] }>();
    const query = activityQuery.trim().toLowerCase();
    const filtered = activityTransactions.filter(t => {
      const typeMatches = activityType === "All" || activityType === "Needs review" || (activityType === "Expenses" && isExpenseTransaction(t)) || (activityType === "Income" && t.type === "Income") || (activityType === "Transfers" && t.type === "Transfer");
      if (!typeMatches) return false;
      const related = [t.name, categories.find(c => c.id === t.category)?.name, accounts.find(a => a.id === t.accountId)?.label,
        categories.find(c => c.id === t.fromCategoryId)?.name, categories.find(c => c.id === t.toCategoryId)?.name,
        accounts.find(a => a.id === t.fromAccountId)?.label, accounts.find(a => a.id === t.toAccountId)?.label].filter(Boolean).join(" ").toLowerCase();
      return !query || related.includes(query);
    });
    for (const t of filtered) {
      const key = t.date || "undated";
      if (!map.has(key)) map.set(key, { label: t.date ? getGroupLabel(t.date) : "Undated", items: [] });
      map.get(key)!.items.push(t);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([, group]) => ({
      label: group.label,
      items: group.items,
      expenseTotal: group.items.filter(isExpenseTransaction).reduce((s, t) => s + t.amount, 0),
      incomeTotal: group.items.filter(t => t.type === "Income").reduce((s, t) => s + t.amount, 0),
    }));
  }, [activityTransactions, activityQuery, activityType, categories, accounts]);

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" className="categories-main" style={wrapStyle}>

      {/* ── Month control; scope is controlled globally by AppShell. ── */}
      <div style={controlsRowStyle}>
        <MonthPicker
          value={insightsMonth}
          max={currentMonthStr}
          aria-label="Filter insights by month"
          onChange={(event) => event.target.value && onInsightsMonthChange(event.target.value)}
          triggerIcon={<CalendarRangeIcon size={16} aria-hidden="true" />}
          triggerClassName="composer-picker-chip"
          showChevron={false}
        />
      </div>

      {insightsError && (
        <Banner
          role="alert"
          tone="danger"
          title="Insights could not be refreshed"
          action={<button type="button" onClick={() => setRetryKey(key => key + 1)} style={retryButtonStyle}>Try again</button>}
        >
          Your existing activity is still available. Check the connection and try again.
        </Banner>
      )}

      {assignedByCategory === null || transactionsLoading ? (
        <div className="skeleton" style={{ height: 84, borderRadius: 12 }} />
      ) : (
        <NarrativeSummary scope={budgetScope} burnRate={burnRate} totalPlanned={totalPlanned} totalSpent={totalSpent} />
      )}

      {/* ── Transaction history — full width ── */}
      <div className="insights-history">
        <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          {searchOpen && (
            <SearchField
              ref={searchInputRef}
              value={activityQuery}
              onChange={setActivityQuery}
              onClose={() => { setActivityQuery(""); setSearchOpen(false); }}
              placeholder="Search description, category or account"
              ariaLabel="Search activity"
            />
          )}
          <div role="group" aria-label="Activity filters" className="filter-chip-rail" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {(["All", "Expenses", "Income", "Transfers"] as const).map(filter => <ScreenChip key={filter} selected={activityType === filter} onClick={() => setActivityType(filter)}>{filter}</ScreenChip>)}
            {/* Transactions no scope claims (missing account/category) appear in no mode's
                history, so this chip surfaces them — but only while there's something to fix. */}
            {(unassignedTransactions.length > 0 || activityType === "Needs review") && <ScreenChip
              selected={activityType === "Needs review"}
              onClick={() => setActivityType("Needs review")}
              badge={unassignedTransactions.length || undefined}
              ariaLabel={`Needs review: ${unassignedTransactions.length} transactions missing an account or category`}
            >
              Needs review
            </ScreenChip>}
          </div>
        </div>
        {transactionsLoading && (
          <div style={{ display: "grid", gap: 20 }}>
            <div className="section-label" style={sectionDividerLabelStyle}>History</div>
            <div style={{ display: "grid", gap: 6 }}>
              {[1, 2, 3, 4].map(i => <TxRowSkeleton key={i} />)}
            </div>
          </div>
        )}
        {!transactionsLoading && txGroups.length > 0 && (
          <div style={{ display: "grid", gap: 20 }}>
            {txGroups.map(({ label, items, expenseTotal, incomeTotal }) => (
              <section key={label}>
                <div style={groupHeaderStyle}>
                  <span style={groupLabelStyle}>{label}</span>
                  {/* A day with one transaction already shows its amount on the row. */}
                  {items.length > 1 && <span style={groupSubtotalStyle}>{expenseTotal > 0 ? fmt(expenseTotal) : ""}{expenseTotal > 0 && incomeTotal > 0 ? " · " : ""}{incomeTotal > 0 ? `${fmt(incomeTotal)} income` : ""}</span>}
                </div>
                <div className="tx-group-list" style={transactionGroupStyle}>
                  {items.map(txn => {
                    const cat      = categories.find(c => c.id === txn.category);
                    const fromCat  = categories.find(c => c.id === txn.fromCategoryId);
                    const toCat    = categories.find(c => c.id === txn.toCategoryId);
                    const isIncome   = txn.type === "Income";
                    const isTransfer = txn.type === "Transfer";
                    const prefix = isIncome ? "+" : isTransfer ? "↔" : "−";
                    return (
                      <SwipeToDelete key={txn.id} flat deleteLabel={`Delete ${txn.name}`} onDelete={() => onDeleteTransaction(txn.id)}>
                        <TransactionRow
                          title={isTransfer && (fromCat || toCat) ? `${fromCat?.name ?? "—"} → ${toCat?.name ?? "—"}` : txn.name}
                          subtitle={!isTransfer ? cat?.name : undefined}
                          amount={txn.amount}
                          tone={isIncome ? "income" : isTransfer ? "transfer" : "expense"}
                          prefix={prefix}
                          icon={isIncome ? <BanknoteIcon size={13} /> : isTransfer ? <TransferIcon size={12} /> : <CategoryIcon icon={cat?.icon ?? null} size={22} />}
                          onClick={() => onClickTransaction(txn)}
                        />
                      </SwipeToDelete>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {!transactionsLoading && txGroups.length === 0 && (
          <section aria-label="Activity" style={emptyScreenStyle}>
            <div className="section-label" style={sectionDividerLabelStyle}>Activity</div>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>No matching transactions in {monthLabel}.</p>
          </section>
        )}
      </div>

    </div>
  );
}

function NarrativeSummary({ scope, burnRate, totalPlanned, totalSpent }: {
  scope: BudgetScope;
  burnRate: { spentPct: number; expectedPct: number; isAhead: boolean; isOver: boolean; gapPct: number; daysLeft: number; vsLastMonth: number | null };
  totalPlanned: number;
  totalSpent: number;
}) {
  if (totalPlanned <= 0) {
    return (
      <section aria-label="Monthly insight summary" style={narrativeSummaryStyle}>
        <span style={summaryHeaderStyle}>
          <Mascot target={{ scope, gap: 0, mood: "curious", fill: 0, outline: "partner" }} size={SUMMARY_MASCOT_SIZE} style={summaryMascotStyle} />
        </span>
        <span>No monthly plan is recorded for this period yet.</span>
      </section>
    );
  }

  const comparison = burnRate.vsLastMonth;
  // The mode's mascot keeps an eye on the month from the corner: its pool is
  // what's left of the plan, its face how the pace is going (over plan: sad;
  // spending ahead of the calendar: worried; on or behind pace: happy).
  const mood: Mood = burnRate.isOver ? "sad" : burnRate.isAhead ? "worried" : "happy";
  return (
    <section aria-label="Monthly insight summary" style={narrativeSummaryStyle}>
      {/* The mascot is the card's heading: it says whose month this is and how it's going. */}
      <span style={summaryHeaderStyle}>
        <Mascot
          target={{ scope, gap: 0, mood, fill: Math.max(0, 1 - totalSpent / totalPlanned), outline: "partner" }}
          size={SUMMARY_MASCOT_SIZE} warnWhenLow
          style={summaryMascotStyle}
        />
      </span>
      <span>
        This month’s plan is <InlineMetric icon={<ChartPieIcon size={12} />} label={fmt(totalPlanned)} tone="neutral" />. You’ve spent <InlineMetric icon={<FlameIcon size={12} />} label={`${fmt(totalSpent)} · ${Math.round(burnRate.spentPct)}%`} tone="danger" />.
        {comparison !== null && (
          <> Spending is <InlineMetric icon={comparison <= 0 ? <ArrowDownIcon size={12} /> : <ArrowUpIcon size={12} />} label={`${Math.abs(comparison)}% ${comparison <= 0 ? "lower" : "higher"}`} tone={comparison <= 0 ? "positive" : "warning"} /> than the prior period.</>
        )}
        {burnRate.daysLeft > 0 && <> You have <InlineMetric icon={<CalendarIcon size={12} />} label={`${burnRate.daysLeft} days`} tone="neutral" /> left.</>}
      </span>
    </section>
  );
}

function InlineMetric({ icon, label, tone }: { icon: ReactNode; label: string; tone: "neutral" | "accent" | "positive" | "warning" | "danger" }) {
  return <span role="img" aria-label={label} style={inlineMetricStyle(tone)}>{icon}<span aria-hidden="true">{label}</span></span>;
}

/* ─── Transaction row skeleton ───────────────────────────────────── */

function TxRowSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
      <div className="skeleton" style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0 }} />
      <div style={{ flex: 1, display: "grid", gap: 5 }}>
        <div className="skeleton" style={{ width: "60%", height: 13, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: "35%", height: 10, borderRadius: 4 }} />
      </div>
      <div style={{ display: "grid", gap: 5, alignItems: "flex-end" }}>
        <div className="skeleton" style={{ width: 70, height: 13, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 40, height: 10, borderRadius: 4, marginLeft: "auto" }} />
      </div>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  paddingBottom: 80,
  minWidth: 0,
  animation: "fadeUp 0.2s ease both",
};

const controlsRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const retryButtonStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  border: "none",
  borderRadius: "var(--radius-control)",
  background: "var(--text)",
  color: "var(--bg)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const narrativeSummaryStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  fontSize: 16,
  lineHeight: 1.75,
  fontWeight: 500,
  color: "var(--text2)",
  padding: "14px 16px 16px",
  border: "none",
  borderRadius: "var(--radius-card)",
  background: "color-mix(in srgb, var(--surface2) 58%, var(--surface))",
  boxShadow: "none",
};

const SUMMARY_MASCOT_SIZE = 87;

/** Where the label was: the mascot heads the card, top-left. */
const summaryHeaderStyle: CSSProperties = { display: "flex", alignItems: "center" };

/** Trims the mascot box's empty margin so the jar lines up with the text and adds little height. */
const summaryMascotStyle: CSSProperties = { margin: "-18px 0 -20px -14px" };

const inlineMetricStyle = (tone: "neutral" | "accent" | "positive" | "warning" | "danger"): CSSProperties => {
  const color = tone === "danger" ? "var(--danger)"
    : tone === "warning" ? "var(--warning)"
    : tone === "positive" ? "var(--success)"
    : tone === "accent" ? "var(--select-ink)"
    : "var(--text2)";
  const background = tone === "danger" ? "color-mix(in srgb, var(--danger) 10%, transparent)"
    : tone === "warning" ? "color-mix(in srgb, var(--warning) 12%, transparent)"
    : tone === "positive" ? "color-mix(in srgb, var(--success) 10%, transparent)"
    : tone === "accent" ? "var(--select-wash)"
    : "var(--surface2)";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    minHeight: 22,
    margin: "0 2px",
    padding: "1px 6px",
    borderRadius: 7,
    background,
    color,
    fontSize: 12,
    lineHeight: 1,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    verticalAlign: "baseline",
  };
};


/* Card */

/* Burn Rate */


/* Donut */

/* Transaction list */
const sectionDividerLabelStyle: CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: 0.7,
  textTransform: "uppercase", color: "var(--muted)",
};

const groupHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  marginBottom: 8, paddingLeft: 2,
};

const groupLabelStyle: CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: 0.7,
  textTransform: "uppercase", color: "var(--muted)",
};

const groupSubtotalStyle: CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--muted)",
};

const transactionGroupStyle: CSSProperties = {
  display: "grid",
  gap: 0,
};


const emptyScreenStyle: CSSProperties = {
  display: "grid", gap: 8, padding: "8px 2px 24px", animation: "fadeUp 0.3s ease both",
};
