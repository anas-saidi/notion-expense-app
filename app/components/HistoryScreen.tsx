"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { BudgetScope, Category, Transaction } from "./app-types";
import { CategoryIcon } from "./ui/CategoryIcon";
import { ChipTabs } from "./ui/ChipTabs";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { SearchIcon, ArrowLeftIcon, ChevronRightIcon } from "./ui/icons";
import { fmt, fmtDate } from "./app-utils";

type Props = {
  transactions: Transaction[];
  categories: Category[];
  budgetScope: BudgetScope;
  historyMonth: string;
  onHistoryMonthChange: (m: string) => void;
  onClickTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
};

type DateGroup = "Today" | "Yesterday" | "This week" | "Earlier" | "Older";
const GROUP_ORDER: DateGroup[] = ["Today", "Yesterday", "This week", "Earlier", "Older"];

function getDateGroup(dateStr: string): DateGroup {
  const now = new Date();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const txDay = new Date(`${dateStr}T00:00:00`);
  const txDayNorm = new Date(txDay.getFullYear(), txDay.getMonth(), txDay.getDate());
  const diffDays = Math.round((nowDay.getTime() - txDayNorm.getTime()) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 6) return "This week";
  if (diffDays <= 30) return "Earlier";
  return "Older";
}

export function HistoryScreen({
  transactions,
  categories,
  historyMonth,
  onHistoryMonthChange,
  onClickTransaction,
  onDeleteTransaction,
}: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => { setSearch(""); setTypeFilter("all"); }, [historyMonth]);

  // Month navigation
  const currentMonth = new Date().toISOString().slice(0, 7);
  const canGoNext = historyMonth < currentMonth;

  const shiftMonth = (delta: number) => {
    const [y, m] = historyMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (delta > 0 && next > currentMonth) return;
    onHistoryMonthChange(next);
  };

  const monthLabel = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(historyMonth)) return historyMonth;
    const [y, m] = historyMonth.split("-").map(Number);
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  }, [historyMonth]);

  // Spotlight stats
  const stats = useMemo(() => {
    const income   = transactions.filter(t => t.type === "Income").reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => !t.type || t.type === "Expense").reduce((s, t) => s + t.amount, 0);
    return { income, expenses, net: income - expenses };
  }, [transactions]);

  // Top 4 categories by expense
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type && t.type !== "Expense") continue;
      if (!t.category) continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([catId, spent]) => {
        const cat = categories.find(c => c.id === catId) ?? null;
        const planned = cat?.planned ?? 0;
        const pct = planned > 0 ? Math.min(100, Math.round((spent / planned) * 100)) : 0;
        const isOver = planned > 0 && spent > planned;
        return { cat, spent, planned, pct, isOver };
      })
      .filter(({ cat }) => !!cat);
  }, [transactions, categories]);

  // Chip counts
  const typeCounts = useMemo(() => ({
    expense:  transactions.filter(t => !t.type || t.type === "Expense").length,
    income:   transactions.filter(t => t.type === "Income").length,
    transfer: transactions.filter(t => t.type === "Transfer").length,
  }), [transactions]);

  // Filtered list (type chip + search)
  const filtered = useMemo(() => {
    let list = transactions;
    if (typeFilter === "expense")  list = list.filter(t => !t.type || t.type === "Expense");
    if (typeFilter === "income")   list = list.filter(t => t.type === "Income");
    if (typeFilter === "transfer") list = list.filter(t => t.type === "Transfer");
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(t => t.name.toLowerCase().includes(q));
    return list;
  }, [transactions, typeFilter, search]);

  // Date groups with subtotals
  const groups = useMemo(() => {
    const map = new Map<DateGroup, Transaction[]>();
    for (const t of filtered) {
      const g = t.date ? getDateGroup(t.date) : "Older";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(t);
    }
    return GROUP_ORDER.filter(g => map.has(g)).map(g => {
      const items = map.get(g)!;
      const subtotal = items.filter(t => !t.type || t.type === "Expense").reduce((s, t) => s + t.amount, 0);
      return { label: g, items, subtotal };
    });
  }, [filtered]);

  const groupStartIndices = useMemo(() => {
    const result: Partial<Record<DateGroup, number>> = {};
    let idx = 0;
    for (const g of groups) { result[g.label] = idx; idx += g.items.length; }
    return result;
  }, [groups]);

  return (
    <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" className="categories-main" style={wrapStyle}>

      {/* Header bar: month nav + search side-by-side on desktop */}
      <div className="history-header-bar">
        <div className="history-month-nav" style={monthNavStyle}>
          <button type="button" onClick={() => shiftMonth(-1)} style={monthNavBtnStyle} aria-label="Previous month">
            <ArrowLeftIcon size={14} />
          </button>
          <span style={monthLabelStyle}>{monthLabel}</span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            style={{ ...monthNavBtnStyle, opacity: canGoNext ? 1 : 0.25 }}
            disabled={!canGoNext}
            aria-label="Next month"
          >
            <ChevronRightIcon size={14} />
          </button>
        </div>

        <label className="history-search" style={searchWrapStyle}>
          <SearchIcon size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search activity…"
            style={searchInputStyle}
            aria-label="Search transactions"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} style={searchClearStyle} aria-label="Clear search">✕</button>
          )}
        </label>
      </div>

      {/* Type filter chips */}
      <ChipTabs
        ariaLabel="Filter by transaction type"
        activeKey={typeFilter}
        onChange={setTypeFilter}
        items={[
          { key: "all",      label: "All" },
          { key: "expense",  label: "Expenses",  count: typeCounts.expense },
          { key: "income",   label: "Income",    count: typeCounts.income },
          { key: "transfer", label: "Transfers", count: typeCounts.transfer },
        ]}
      />

      {/* Stats panels: spotlight + top categories — side by side on desktop */}
      {typeFilter === "all" && (transactions.length > 0 || (!search && categoryBreakdown.length > 0)) && (
        <div className="history-panels-row">
          {transactions.length > 0 && (
            <div style={spotlightStyle}>
              <div style={spotlightStatStyle}>
                <span style={spotlightLabelStyle}>Income</span>
                <span style={{ ...spotlightValueStyle, color: stats.income > 0 ? "var(--accent-ink)" : "var(--muted)" }}>
                  +{fmt(stats.income)}
                </span>
                <span style={spotlightCurrencyStyle}>MAD</span>
              </div>
              <div style={spotlightDividerStyle} />
              <div style={spotlightStatStyle}>
                <span style={spotlightLabelStyle}>Expenses</span>
                <span style={spotlightValueStyle}>−{fmt(stats.expenses)}</span>
                <span style={spotlightCurrencyStyle}>MAD</span>
              </div>
              <div style={spotlightDividerStyle} />
              <div style={spotlightStatStyle}>
                <span style={spotlightLabelStyle}>Net</span>
                <span style={{ ...spotlightValueStyle, color: stats.net >= 0 ? "var(--accent-ink)" : "var(--danger)" }}>
                  {stats.net >= 0 ? "+" : "−"}{fmt(Math.abs(stats.net))}
                </span>
                <span style={spotlightCurrencyStyle}>MAD</span>
              </div>
            </div>
          )}
          {!search && categoryBreakdown.length > 0 && (
            <section style={{ minWidth: 0 }}>
              <div style={sectionHeaderStyle}>
                <span style={sectionLabelStyle}>Top categories</span>
              </div>
              <div className="home-scroll-rail" style={breakdownRailStyle}>
                {categoryBreakdown.map(({ cat, spent, planned, pct, isOver }) => (
                  <div key={cat!.id} style={breakdownCardStyle}>
                    <CategoryIcon icon={cat!.icon} size={22} style={{ flexShrink: 0 }} />
                    <span style={breakdownNameStyle}>{cat!.name}</span>
                    <div style={breakdownBarTrackStyle}>
                      <div style={{ ...breakdownBarFillStyle, width: `${pct}%`, background: isOver ? "var(--spend-over)" : "color-mix(in srgb, var(--accent) 65%, var(--bar-fill))" }} />
                    </div>
                    <span style={{ ...breakdownAmtStyle, color: isOver ? "var(--spend-over)" : "var(--text2)" }}>{fmt(spent)}</span>
                    <span style={breakdownCurrencyStyle}>{planned > 0 ? `of ${fmt(planned)} MAD` : "MAD"}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Transaction groups */}
      {groups.length > 0 && (
        <div style={{ display: "grid", gap: 20 }}>
          {groups.map(({ label, items, subtotal }) => {
            const startIdx = groupStartIndices[label] ?? 0;
            return (
              <section key={label}>
                <div style={groupHeaderStyle}>
                  <span style={groupLabelStyle}>{label}</span>
                  {subtotal > 0 && <span style={groupSubtotalStyle}>{fmt(subtotal)} MAD</span>}
                </div>
                <div className="tx-group-list" style={{ display: "grid", gap: 6 }}>
                  {items.map((txn, i) => {
                    const cat      = categories.find(c => c.id === txn.category);
                    const fromCat  = categories.find(c => c.id === txn.fromCategoryId);
                    const toCat    = categories.find(c => c.id === txn.toCategoryId);
                    const isIncome   = txn.type === "Income";
                    const isTransfer = txn.type === "Transfer";
                    const prefix = isIncome ? "+" : isTransfer ? "↔" : "−";
                    const amtColor = isIncome ? "var(--accent-ink)" : isTransfer ? "var(--muted)" : "var(--text2)";
                    return (
                      <SwipeToDelete key={txn.id} onDelete={() => onDeleteTransaction(txn.id)}>
                        <div
                          onClick={() => onClickTransaction(txn)}
                          className="tx-row"
                          style={{ "--stagger": `${(startIdx + i) * 22}ms` } as CSSProperties}
                        >
                          {isIncome || isTransfer ? (
                            <span style={txTypeIconStyle(isIncome)}>
                              {isIncome ? "💰" : "↔"}
                            </span>
                          ) : (
                            <CategoryIcon icon={cat?.icon ?? null} size={22} style={{ flexShrink: 0 }} />
                          )}
                          <div style={txMiddleStyle}>
                            {isTransfer && (fromCat || toCat) ? (
                              <span style={txNameStyle}>
                                {fromCat ? fromCat.name : "—"}
                                <span style={txTransferArrowStyle}> → </span>
                                {toCat ? toCat.name : "—"}
                              </span>
                            ) : (
                              <span style={txNameStyle}>{txn.name}</span>
                            )}
                            {!isTransfer && cat && (
                              <span style={txCategoryStyle}>{cat.name}</span>
                            )}
                          </div>
                          <div style={txRightStyle}>
                            <span style={{ ...txAmountStyle, color: amtColor }}>
                              {prefix}{fmt(txn.amount)} MAD
                            </span>
                            <span style={txDateStyle}>{fmtDate(txn.date)}</span>
                          </div>
                        </div>
                      </SwipeToDelete>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Search empty */}
      {search && filtered.length === 0 && (
        <div style={emptyStyle}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)" }}>No results for "{search}"</p>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Try a different name</p>
        </div>
      )}

      {/* Month empty */}
      {!search && transactions.length === 0 && (
        <div style={emptyStyle}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)" }}>Nothing in {monthLabel}</p>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>No activity recorded for this month</p>
        </div>
      )}

    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  paddingBottom: 80,
  minWidth: 0,
};

/* Month nav */

const monthNavStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 2px",
};

const monthNavBtnStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "opacity 0.15s ease",
};

const monthLabelStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "var(--text2)",
  letterSpacing: "-0.01em",
};

/* Search */

const searchWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minHeight: 42,
  padding: "0 12px",
  borderRadius: 12,
  background: "var(--surface)",
  border: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
};

const searchInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "transparent",
  border: "none",
  padding: 0,
  fontSize: 14,
  color: "var(--text2)",
  outline: "none",
};

const searchClearStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  fontSize: 11,
  cursor: "pointer",
  padding: "2px 4px",
  flexShrink: 0,
};

/* Spotlight */

const spotlightStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  background: "var(--surface)",
  borderRadius: 14,
  padding: "14px 0",
  overflow: "hidden",
};

const spotlightStatStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: "0 8px",
};

const spotlightDividerStyle: CSSProperties = {
  width: 1,
  background: "var(--border)",
  flexShrink: 0,
  margin: "4px 0",
};

const spotlightLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const spotlightValueStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 18,
  fontWeight: 500,
  lineHeight: 1,
  color: "var(--text2)",
};

const spotlightCurrencyStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 400,
  color: "var(--muted)",
  letterSpacing: 0.3,
};

/* Section header */

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "var(--muted)",
};

/* Category breakdown — horizontal card rail */

const breakdownRailStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  padding: "2px 4px 8px",
};

const breakdownCardStyle: CSSProperties = {
  flex: "0 0 120px",
  borderRadius: 16,
  background: "var(--surface)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "10px 10px 12px",
  gap: 5,
};

const breakdownNameStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--muted)",
  lineHeight: 1.2,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  maxWidth: "100%",
  textAlign: "center",
};

const breakdownBarTrackStyle: CSSProperties = {
  width: "100%",
  height: 3,
  borderRadius: 999,
  background: "var(--surface2)",
  overflow: "hidden",
};

const breakdownBarFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "color-mix(in srgb, var(--accent) 65%, var(--bar-fill))",
  transition: "width 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
};

const breakdownAmtStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 15,
  fontWeight: 500,
  color: "var(--text2)",
  lineHeight: 1,
};

const breakdownCurrencyStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 400,
  color: "var(--muted)",
  lineHeight: 1,
};

/* Group headers */

const groupHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
  paddingLeft: 2,
};

const groupLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const groupSubtotalStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "var(--muted)",
};

/* Transaction rows — mirrors HomeScreen recentRow */

const txTypeIconStyle = (isIncome: boolean): CSSProperties => ({
  flexShrink: 0,
  width: 22,
  height: 22,
  borderRadius: 8,
  background: isIncome
    ? "color-mix(in srgb, var(--accent) 15%, transparent)"
    : "color-mix(in srgb, var(--muted) 15%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: isIncome ? 13 : 11,
  lineHeight: 1,
  color: isIncome ? "var(--accent-ink)" : "var(--muted)",
});

const txMiddleStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

const txNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text2)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const txCategoryStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  color: "var(--muted)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const txTransferArrowStyle: CSSProperties = {
  color: "var(--muted)",
};

const txRightStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
  flexShrink: 0,
};

const txAmountStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  fontWeight: 500,
  lineHeight: 1,
  color: "var(--text2)",
};

const txDateStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 400,
  color: "var(--muted)",
  lineHeight: 1,
  padding: "3px 7px",
};

/* Empty states */

const emptyStyle: CSSProperties = {
  padding: "40px 16px",
  textAlign: "center",
  animation: "fadeUp 0.3s ease both",
};
