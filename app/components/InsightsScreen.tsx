"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Account, BudgetScope, Category, Transaction } from "./app-types";
import { AnimatedCounter } from "./ui/AnimatedCounter";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { categoryMatchesScope, comparisonPeriods, getCategoryScope, isExpenseTransaction, resolveTransactionScopes, transactionMatchesScope, fmt, fmtDate } from "./app-utils";
import { ArrowDownIcon, ArrowUpIcon, BanknoteIcon, CalendarIcon, CalendarRangeIcon, ChartPieIcon, FlameIcon, TransferIcon } from "./ui/icons";
import { Banner } from "./ui/Banner";
import { ScreenChip } from "./ui/ScreenChip";
import { SearchField } from "./ui/SearchField";
import { TransactionRow } from "./ui/TransactionRow";
import { MonthPicker } from "./DatePicker";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, PieChart, Pie, Cell, Sector } from "recharts";
import type { PieSectorShapeProps } from "recharts";

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


const DONUT_COLORS = [
  "var(--accent)",
  "var(--partner-husband)",
  "var(--partner-wife)",
  "#a78bfa",
  "#fb923c",
  "#34d399",
];

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

  const spentByCatId = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of expenses) {
      if (t.category) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return map;
  }, [expenses]);

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


  /* ── 2. Spending Breakdown (donut) ────────────────────────────── */
  const donutData = useMemo(() => {
    const all = categories
      .filter(c => categoryMatchesScope(c, budgetScope))
      .map(c => ({ cat: c, spent: spentByCatId.get(c.id) ?? 0 }))
      .filter(({ spent }) => spent > 0)
      .sort((a, b) => b.spent - a.spent);

    const top5 = all.slice(0, 5);
    const othersSpent = all.slice(5).reduce((s, { spent }) => s + spent, 0);
    const items = othersSpent > 0
      ? [...top5, { cat: { id: "others", name: "Others", icon: null } as unknown as Category, spent: othersSpent }]
      : top5;
    const total = items.reduce((s, { spent }) => s + spent, 0);
    return { items, total };
  }, [categories, budgetScope, spentByCatId]);

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
        <NarrativeSummary burnRate={burnRate} totalPlanned={totalPlanned} totalSpent={totalSpent} />
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
            <ScreenChip
              selected={activityType === "Needs review"}
              onClick={() => setActivityType("Needs review")}
              badge={unassignedTransactions.length || undefined}
              ariaLabel={`Needs review: ${unassignedTransactions.length} transactions missing an account or category`}
            >
              Needs review
            </ScreenChip>
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
                  <span style={groupSubtotalStyle}>{expenseTotal > 0 ? `${fmt(expenseTotal)} MAD` : ""}{expenseTotal > 0 && incomeTotal > 0 ? " · " : ""}{incomeTotal > 0 ? `${fmt(incomeTotal)} MAD income` : ""}</span>
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
                          date={txn.date ? fmtDate(txn.date) : undefined}
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

function NarrativeSummary({ burnRate, totalPlanned, totalSpent }: {
  burnRate: { spentPct: number; expectedPct: number; isAhead: boolean; isOver: boolean; gapPct: number; daysLeft: number; vsLastMonth: number | null };
  totalPlanned: number;
  totalSpent: number;
}) {
  if (totalPlanned <= 0) {
    return (
      <section aria-label="Monthly insight summary" style={narrativeSummaryStyle}>
        <span style={summaryLabelStyle}><ChartPieIcon size={16} />Summary</span>
        <span>No monthly plan is recorded for this period yet.</span>
      </section>
    );
  }

  const comparison = burnRate.vsLastMonth;
  return (
    <section aria-label="Monthly insight summary" style={narrativeSummaryStyle}>
      <span style={summaryLabelStyle}><ChartPieIcon size={16} />Summary</span>
      <span>
        This month’s plan is <InlineMetric icon={<ChartPieIcon size={12} />} label={`${fmt(totalPlanned)} MAD`} tone="neutral" />. You’ve spent <InlineMetric icon={<FlameIcon size={12} />} label={`${fmt(totalSpent)} MAD · ${Math.round(burnRate.spentPct)}%`} tone={burnRate.isOver ? "danger" : "accent"} />.
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

/* ─── Card wrapper ───────────────────────────────────────────────── */

function InsightCard({ icon, title, subtitle, children }: {
  icon: ReactNode; title: string; subtitle: string; children: ReactNode;
}) {
  return (
    <div className="insights-card" style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span className="insight-card-icon">{icon}</span>
        <div>
          <div style={cardTitleStyle}>{title}</div>
          <div style={cardSubtitleStyle}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ─── 1. Burn Rate skeleton ─────────────────────────────────────── */

function BurnRateSkeleton() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="skeleton" style={{ width: 140, height: 40, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: "100%", height: 8, borderRadius: 999 }} />
      <div style={{ display: "flex", gap: 12 }}>
        <div className="skeleton" style={{ width: 70, height: 12, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 80, height: 12, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 100, height: 12, borderRadius: 4, marginLeft: "auto" }} />
      </div>
      <div className="skeleton" style={{ width: "85%", height: 12, borderRadius: 4 }} />
    </div>
  );
}


/* ─── 2. Spending Breakdown skeleton ────────────────────────────── */

function SpendingBreakdownSkeleton() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <div className="skeleton" style={{ width: 140, height: 140, borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "grid", gap: 9 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="skeleton" style={{ width: 8, height: 8, borderRadius: 2 }} />
            <div className="skeleton" style={{ flex: 1, height: 11, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 50, height: 11, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  );
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

/* ─── 1. Burn Rate body ──────────────────────────────────────────── */

function BurnRateBody({ burnRate, totalSpent, totalPlanned, lastMonthTotalSpent, periodRanges }: {
  burnRate: { spentPct: number; expectedPct: number; isAhead: boolean; isOver: boolean; gapPct: number; daysLeft: number; vsLastMonth: number | null };
  totalSpent: number;
  totalPlanned: number;
  lastMonthTotalSpent: number;
  periodRanges: ReturnType<typeof comparisonPeriods>;
}) {
  const { spentPct, isOver, vsLastMonth } = burnRate;

  const fillColor = isOver ? "var(--danger)" : "color-mix(in srgb, var(--accent) 65%, var(--bar-fill))";

  const copy = totalPlanned === 0
    ? "No monthly plan is recorded for this period."
    : `${fmt(totalSpent)} of ${fmt(totalPlanned)} MAD monthly plan spent.`;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Spend number + vs last month */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" as const }}>
        <span style={bigNumStyle(isOver)}><AnimatedCounter value={totalSpent} animateOnMount /></span>
        <span style={bigNumUnitStyle}>MAD spent</span>
        {vsLastMonth !== null && lastMonthTotalSpent > 0 && (
          <span style={{
            fontSize: 12, fontWeight: 600, letterSpacing: 0.2,
            color: "var(--muted)",
            marginLeft: 4,
          }}>
            {vsLastMonth > 0 ? "+" : "−"}{Math.abs(vsLastMonth)}% vs prior period
          </span>
        )}
      </div>

      {/* Neutral plan progress */}
      <div style={{ position: "relative", padding: "4px 0" }}>
        <div style={burnRailStyle}>
          <div style={{ ...burnFillStyle, transform: `scaleX(${spentPct / 100})`, background: fillColor }} />
        </div>
      </div>

      {/* Legend */}
      {totalPlanned > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={burnLegendItemStyle}>
            <span style={{ ...burnDotStyle, background: fillColor }} />
            {Math.round(spentPct)}% spent
          </span>
          <span style={{ ...burnLegendItemStyle, marginLeft: "auto" }}>
            {fmt(totalPlanned)} MAD planned
          </span>
        </div>
      )}

      <p style={copySentenceStyle}>{copy}</p>
      <p style={{ ...copySentenceStyle, marginTop: -6 }}>{periodRanges.current.start}–{periodRanges.current.end} vs {periodRanges.previous.start}–{periodRanges.previous.end}</p>
    </div>
  );
}


/* ─── 2. Spending Breakdown body ─────────────────────────────────── */

function SpendingBreakdownBody({ data, expenses, insightsMonth, totalPlanned }: {
  data: { items: Array<{ cat: Category; spent: number }>; total: number };
  expenses: Transaction[];
  insightsMonth: string;
  totalPlanned: number;
}) {
  const [view, setView] = useState<"donut" | "curve">("donut");
  const { items, total } = data;

  if (total === 0 || items.length === 0) {
    return <p style={emptyBodyStyle}>No expenses this month.</p>;
  }

  return (
    <div>
      <div role="group" aria-label="Chart view" style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button type="button" aria-pressed={view === "donut"} onClick={() => setView("donut")} style={filterButtonStyle(view === "donut")}>Breakdown</button>
        <button type="button" aria-pressed={view === "curve"} onClick={() => setView("curve")} style={filterButtonStyle(view === "curve")}>Trend</button>
      </div>
      {view === "donut"
        ? <DonutView items={items} total={total} />
        : <CurveView
            expenses={expenses}
            insightsMonth={insightsMonth}
            totalPlanned={totalPlanned}
            totalSpent={total}
          />
      }

    </div>
  );
}

function DonutView({ items, total }: {
  items: Array<{ cat: Category; spent: number }>;
  total: number;
}) {
  const segments = items.map(({ cat, spent }, i) => ({
    name: cat.name,
    value: spent,
    spent,
    cat,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <div style={{ position: "relative", flexShrink: 0, width: 140, height: 140 }}>
        <PieChart width={140} height={140} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={segments}
            cx={70} cy={70}
            innerRadius={44} outerRadius={60}
            paddingAngle={items.length > 1 ? 4 : 0}
            dataKey="value"
            startAngle={90} endAngle={-270}
            stroke="none"
            isAnimationActive={true}
            animationBegin={0}
            animationDuration={750}
            animationEasing="ease-out"
            shape={(props: PieSectorShapeProps) => {
              const sweep = Math.abs((props.endAngle ?? 0) - (props.startAngle ?? 0));
              const maxRadius = sweep * 60 * Math.PI / 180 / 2;
              const cr = Math.min(7, maxRadius);
              return <Sector {...props} cornerRadius={cr} outerRadius={60} />;
            }}
          >
            {segments.map((seg, i) => (
              <Cell key={i} fill={seg.color} />
            ))}
          </Pie>
        </PieChart>
        <div style={{ ...donutCenterStyle, pointerEvents: "none" }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 700, color: "var(--text2)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {fmt(total)}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, letterSpacing: 0.3 }}>MAD</span>
        </div>
      </div>
      <div
        onClick={e => e.stopPropagation()}
        style={{ flex: 1, display: "grid", gap: 9, alignContent: "center" as const }}
      >
        {segments.map(({ cat, spent, color }, i) => (
          <div
            key={cat.id ?? i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--text2)", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
              {cat.name}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {fmt(spent)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CurveView({ expenses, insightsMonth, totalPlanned, totalSpent }: {
  expenses: Transaction[];
  insightsMonth: string;
  totalPlanned: number;
  totalSpent: number;
}) {
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const isCurrentMonth  = insightsMonth === currentMonthStr;
  const [y, m] = insightsMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const todayDay    = isCurrentMonth ? new Date().getDate() : daysInMonth;

  // Build cumulative daily totals
  const dayTotals = new Array(daysInMonth + 1).fill(0);
  for (const t of expenses) {
    if (!t.date) continue;
    const day = parseInt(t.date.split("-")[2], 10);
    if (day >= 1 && day <= daysInMonth) dayTotals[day] += t.amount;
  }

  // Recharts data: one entry per day (0 = start of month)
  let running = 0;
  const data = Array.from({ length: todayDay + 1 }, (_, d) => {
    if (d > 0) running += dayTotals[d];
    return {
      day: d,
      spent: running,
      budget: totalPlanned > 0 ? Math.round((totalPlanned / daysInMonth) * d) : undefined,
    };
  });

  const xTicks = [1, Math.round(daysInMonth / 2), daysInMonth].filter(t => t <= todayDay);

  return (
    <div>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sbAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--danger)" stopOpacity={0.22} />
              <stop offset="95%" stopColor="var(--danger)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 4"
            stroke="var(--border)"
            vertical={false}
            strokeOpacity={0.7}
          />

          <XAxis
            dataKey="day"
            ticks={xTicks}
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            width={38}
          />

          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border2)",
              borderRadius: 10,
              fontSize: 12,
              color: "var(--text2)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            formatter={(value, name) => [
              `${fmt(Number(value))} MAD`,
              name === "spent" ? "Spent" : "Budget pace",
            ]}
            labelFormatter={(day) => `Day ${day}`}
            cursor={{ stroke: "var(--border2)", strokeWidth: 1 }}
          />

          {/* Spending area */}
          <Area
            type="monotone"
            dataKey="spent"
            stroke="var(--danger)"
            strokeWidth={2}
            fill="url(#sbAreaGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "var(--danger)", strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 12, height: 2, background: "var(--danger)", borderRadius: 999, display: "inline-block" }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Spent · {fmt(totalSpent)} MAD</span>
        </div>
        {totalPlanned > 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmt(totalSpent)} of {fmt(totalPlanned)} MAD planned</span>}
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

const summaryLabelStyle: CSSProperties = {
  width: "fit-content",
  minHeight: 28,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 9px",
  borderRadius: 8,
  background: "var(--summary-accent-dim)",
  color: "var(--summary-accent-ink)",
  fontSize: 14,
  lineHeight: 1,
  fontWeight: 700,
};

const inlineMetricStyle = (tone: "neutral" | "accent" | "positive" | "warning" | "danger"): CSSProperties => {
  const color = tone === "danger" ? "var(--danger)"
    : tone === "warning" ? "var(--warning)"
    : tone === "positive" || tone === "accent" ? "var(--accent-foreground)"
    : "var(--text2)";
  const background = tone === "danger" ? "color-mix(in srgb, var(--danger) 10%, transparent)"
    : tone === "warning" ? "color-mix(in srgb, var(--warning) 12%, transparent)"
    : tone === "positive" || tone === "accent" ? "color-mix(in srgb, var(--accent) 16%, transparent)"
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

const filterButtonStyle = (selected: boolean): CSSProperties => ({
  minHeight: 36,
  padding: "0 12px",
  flexShrink: 0,
  borderRadius: 999,
  border: selected ? "1px solid transparent" : "1px solid color-mix(in srgb, var(--border) 44%, transparent)",
  background: selected ? "var(--text)" : "var(--surface)",
  color: selected ? "var(--bg)" : "var(--text2)",
  fontSize: 12,
  fontWeight: 700,
});


/* Card */
const cardStyle: CSSProperties = {
  background: "var(--surface)",
  border: "none",
  borderRadius: "var(--radius-card)",
  boxShadow: "var(--elevation-card)",
  padding: 18,
  display: "grid",
  gap: 14,
};

const cardHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10,
};

const cardTitleStyle: CSSProperties = {
  fontSize: 14, fontWeight: 700, color: "var(--text2)", lineHeight: 1,
};

const cardSubtitleStyle: CSSProperties = {
  fontSize: 12, color: "var(--muted)", marginTop: 3, letterSpacing: 0.1,
};

/* Burn Rate */
const bigNumStyle = (isOver: boolean): CSSProperties => ({
  fontFamily: "var(--font-body)",
  fontSize: 36, fontWeight: 700, lineHeight: 1,
  letterSpacing: "-0.03em",
  color: isOver ? "var(--danger)" : "var(--text2)",
  fontVariantNumeric: "tabular-nums",
});

const bigNumUnitStyle: CSSProperties = {
  fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-body)",
};

const burnRailStyle: CSSProperties = {
  height: 6, borderRadius: 999, background: "var(--surface2)", overflow: "hidden",
};

const burnFillStyle: CSSProperties = {
  width: "100%", height: "100%", borderRadius: 999,
  transformOrigin: "left center",
  transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)",
};

const burnLegendItemStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 5,
  fontSize: 12, color: "var(--muted)", fontWeight: 500,
};

const burnDotStyle: CSSProperties = {
  width: 8, height: 8, borderRadius: 2, display: "inline-block", flexShrink: 0,
};

const copySentenceStyle: CSSProperties = {
  fontSize: 12, color: "var(--muted)", lineHeight: 1.5,
};

const emptyBodyStyle: CSSProperties = {
  fontSize: 13, color: "var(--muted)", padding: "4px 0",
};


/* Donut */
const donutCenterStyle: CSSProperties = {
  position: "absolute", inset: 0,
  display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  pointerEvents: "none",
};

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
