"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Account, BudgetScope, Category, Transaction } from "./app-types";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { categoryMatchesScope, getCategoryScope, transactionMatchesScope, monthBounds, fmt, fmtDate } from "./app-utils";
import { ArrowLeftIcon, ChevronRightIcon } from "./ui/icons";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, PieChart, Pie, Cell, Sector } from "recharts";
import type { PieSectorShapeProps } from "recharts";

/* ─── Types ──────────────────────────────────────────────────────── */

type Props = {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  budgetScope: BudgetScope;
  onBudgetScopeChange: (s: BudgetScope) => void;
  insightsMonth: string;
  onInsightsMonthChange: (m: string) => void;
  transactionsLoading?: boolean;
  onClickTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
};

/* ─── Constants ──────────────────────────────────────────────────── */

const SCOPES: BudgetScope[] = ["joint", "anas", "salma"];
const SCOPE_LABEL: Record<BudgetScope, string> = { joint: "Couple", anas: "Anas", salma: "Salma" };
const SCOPE_EMOJI: Record<BudgetScope, string> = { joint: "👫", anas: "👨", salma: "👩" };
const SCOPE_BG: Record<BudgetScope, string> = {
  joint: "var(--accent)",
  anas:  "var(--partner-husband)",
  salma: "var(--partner-wife)",
};
const SCOPE_INK: Record<BudgetScope, string> = {
  joint: "var(--accent-ink)",
  anas:  "#ffffff",
  salma: "#ffffff",
};

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
  onBudgetScopeChange,
  insightsMonth,
  onInsightsMonthChange,
  onClickTransaction,
  onDeleteTransaction,
  transactionsLoading = false,
}: Props) {

  /* Month nav */
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const canGoNext = insightsMonth < currentMonthStr;

  const shiftMonth = (delta: number) => {
    const [y, m] = insightsMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (delta > 0 && next > currentMonthStr) return;
    onInsightsMonthChange(next);
  };

  const monthLabel = useMemo(() => {
    const [y, m] = insightsMonth.split("-").map(Number);
    return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  }, [insightsMonth]);

  /* Historical planned — fetched from monthly-summary per viewed month */
  type SummaryEntry = { categoryId: string; total: number; accountId?: string | null };
  const [assignedByCategory, setAssignedByCategory] = useState<SummaryEntry[] | null>(null);
  const [prevMonthTransactions, setPrevMonthTransactions] = useState<Transaction[] | null>(null);

  const prevMonth = useMemo(() => {
    const [y, m] = insightsMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [insightsMonth]);

  useEffect(() => {
    setAssignedByCategory(null);
    setPrevMonthTransactions(null);
    const { start: prevStart, end: prevEnd } = monthBounds(`${prevMonth}-01`);
    Promise.all([
      fetch(`/api/monthly-summary?month=${insightsMonth}`).then(r => r.json()),
      fetch(`/api/transactions?start=${prevStart}&end=${prevEnd}`).then(r => r.json()),
    ]).then(([curr, prevTx]) => {
      setAssignedByCategory(curr.summary?.assignedByCategory ?? null);
      setPrevMonthTransactions(prevTx.transactions ?? null);
    }).catch(() => {});
  }, [insightsMonth, prevMonth]);

  /* Shared derivations */
  const expenses = useMemo(
    () => transactions.filter(t => t.category && (!t.type || t.type === "Expense")),
    [transactions],
  );

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
      .filter(t => t.category && (!t.type || t.type === "Expense"))
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


  /* ── 3. Together vs. Apart ─────────────────────────────────────── */
  const splitData = useMemo(() => {
    const acctLabel = (id: string | null | undefined) =>
      id ? (accounts.find(a => a.id === id)?.label ?? "").toLowerCase() : "";

    // Personal accounts
    const anasAcc  = accounts.find(a => !a.label.toLowerCase().includes("saving") && a.label.toLowerCase().includes("hubb"));
    const salmaAcc = accounts.find(a => !a.label.toLowerCase().includes("saving") && a.label.toLowerCase().includes("wife"));

    const anasContribPct  = anasAcc?.contributionPercent  ?? null;
    const salmaContribPct = salmaAcc?.contributionPercent ?? null;

    // Actual: pocket spend + transfers to joint categories
    let anasPocket = 0, salmaPocket = 0, sharedSpend = 0;
    for (const t of expenses) {
      const label = acctLabel(t.accountId);
      if (label.includes("hubb")) anasPocket += t.amount;
      else if (label.includes("wife")) salmaPocket += t.amount;
      else sharedSpend += t.amount;
    }

    // Add transfers from personal accounts into joint account
    const joinedAccId = accounts.find(a => a.label.toLowerCase().includes("joined"))?.id;
    let anasFunded = 0, salmaFunded = 0;
    for (const t of transactions) {
      if (t.type !== "Transfer") continue;
      if (!t.toAccountId || t.toAccountId !== joinedAccId) continue;
      const fromLabel = acctLabel(t.fromAccountId);
      if (fromLabel.includes("hubb"))       anasFunded  += t.amount;
      else if (fromLabel.includes("wife"))  salmaFunded += t.amount;
    }

    // Organic balance = what was in the joined account independent of this month's
    // personal contributions. Back out transfers in, add back spending out.
    // This keeps contribution targets stable as people transfer money in.
    const joinedAcc = accounts.find(a => !a.label.toLowerCase().includes("saving") && a.label.toLowerCase().includes("joined"));
    const joinedBalance = Math.max(0, joinedAcc?.balance ?? 0);
    const organicBalance = Math.max(0, joinedBalance - anasFunded - salmaFunded + sharedSpend);
    const needFromPersonal = Math.max(0, totalPlanned - organicBalance);
    const anasPlan  = anasContribPct  != null ? anasContribPct  * needFromPersonal : 0;
    const salmaPlan = salmaContribPct != null ? salmaContribPct * needFromPersonal : 0;

    const anasActual  = anasPocket + anasFunded;
    const salmaActual = salmaPocket + salmaFunded;

    // Progress % (capped at 100 for the bar)
    const anasPct  = anasPlan  > 0 ? Math.min(100, (anasActual  / anasPlan)  * 100) : null;
    const salmaPct = salmaPlan > 0 ? Math.min(100, (salmaActual / salmaPlan) * 100) : null;

    // Delta: positive = over-contributed, negative = short
    const anasDelta  = anasPlan  > 0 ? anasActual  - anasPlan  : null;
    const salmaDelta = salmaPlan > 0 ? salmaActual - salmaPlan : null;

    return {
      anasActual, salmaActual, sharedSpend,
      anasPlan, salmaPlan,
      anasPct, salmaPct,
      anasDelta, salmaDelta,
      anasContribPct, salmaContribPct,
      hasPlan: totalPlanned > 0,
    };
  }, [expenses, transactions, accounts, categories, totalPlanned]);

  /* ── 4. Spending Breakdown (donut) ────────────────────────────── */
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
    const getGroup = (dateStr: string) => {
      const d = new Date(`${dateStr}T00:00:00`);
      const diff = Math.round((nowDay - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
      if (diff <= 0) return "Today";
      if (diff === 1) return "Yesterday";
      if (diff <= 6) return "This week";
      return "Earlier";
    };
    const ORDER = ["Today", "Yesterday", "This week", "Earlier"];
    const map = new Map<string, Transaction[]>();
    for (const t of expenses) {
      const g = t.date ? getGroup(t.date) : "Earlier";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(t);
    }
    return ORDER.filter(g => map.has(g)).map(g => ({
      label: g,
      items: map.get(g)!,
      subtotal: map.get(g)!.reduce((s, t) => s + t.amount, 0),
    }));
  }, [expenses]);

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" className="categories-main" style={wrapStyle}>

      {/* ── Header row: title + controls ── */}
      <div className="insights-header-row">
        <div style={{ paddingTop: 8 }}>
          <div style={eyebrowStyle}>Analyze</div>
          <h1 style={titleStyle}>Insights</h1>
        </div>

        <div className="insights-controls">
          {/* Month nav */}
          <div className="insights-month-nav" style={monthNavStyle}>
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

          {/* Scope chips */}
          <div style={scopeRailStyle}>
            {SCOPES.map(scope => {
              const active = scope === budgetScope;
              return (
                <button
                  key={scope}
                  type="button"
                  onClick={() => onBudgetScopeChange(scope)}
                  aria-pressed={active}
                  style={active ? {
                    height: 38, borderRadius: 12, border: "none",
                    background: SCOPE_BG[scope], color: SCOPE_INK[scope],
                    padding: "0 14px 0 10px", gap: 7, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", flexShrink: 0,
                    animation: "categorySelectIn 0.2s cubic-bezier(0.22,1,0.36,1) both",
                  } : {
                    width: 38, height: 38, borderRadius: 12,
                    border: "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
                    background: "transparent", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    opacity: 0.45, flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{SCOPE_EMOJI[scope]}</span>
                  {active && (
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>
                      {SCOPE_LABEL[scope]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Insight cards grid ── */}
      <div className="insights-grid">

        {/* 1. Burn Rate */}
        <InsightCard emoji="🔥" title="Burn Rate" subtitle="Are you on pace?">
          {assignedByCategory === null || transactionsLoading
            ? <BurnRateSkeleton />
            : <BurnRateBody burnRate={burnRate} totalSpent={totalSpent} totalPlanned={totalPlanned} lastMonthTotalSpent={lastMonthTotalSpent} />
          }
        </InsightCard>

        {/* 3. Together vs. Apart (joint only) */}
        {budgetScope === "joint" && (
          <InsightCard emoji="👫" title="Together vs. Apart" subtitle="How does the money split?">
            {transactionsLoading
              ? <TogetherApartSkeleton />
              : <TogetherApartBody data={splitData} />
            }
          </InsightCard>
        )}

        {/* 4. Spending Breakdown */}
        <InsightCard emoji="🥧" title="Spending Breakdown" subtitle={`By category · ${SCOPE_LABEL[budgetScope]}`}>
          {transactionsLoading
            ? <SpendingBreakdownSkeleton />
            : <SpendingBreakdownBody
                data={donutData}
                expenses={expenses}
                insightsMonth={insightsMonth}
                totalPlanned={totalPlanned}
              />
          }
        </InsightCard>

      </div>

      {/* ── Transaction history — full width ── */}
      <div className="insights-history">
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
            <div className="section-label" style={sectionDividerLabelStyle}>History</div>
            {txGroups.map(({ label, items, subtotal }) => (
              <section key={label}>
                <div style={groupHeaderStyle}>
                  <span style={groupLabelStyle}>{label}</span>
                  {subtotal > 0 && <span style={groupSubtotalStyle}>{fmt(subtotal)} MAD</span>}
                </div>
                <div className="tx-group-list" style={{ display: "grid", gap: 6 }}>
                  {items.map(txn => {
                    const cat      = categories.find(c => c.id === txn.category);
                    const fromCat  = categories.find(c => c.id === txn.fromCategoryId);
                    const toCat    = categories.find(c => c.id === txn.toCategoryId);
                    const isIncome   = txn.type === "Income";
                    const isTransfer = txn.type === "Transfer";
                    const prefix = isIncome ? "+" : isTransfer ? "↔" : "−";
                    const amtColor = isIncome ? "var(--accent-ink)" : isTransfer ? "var(--muted)" : "var(--text2)";
                    return (
                      <SwipeToDelete key={txn.id} onDelete={() => onDeleteTransaction(txn.id)}>
                        <div onClick={() => onClickTransaction(txn)} className="tx-row">
                          {isIncome || isTransfer ? (
                            <span style={txTypeIconStyle(isIncome)}>
                              {isIncome ? "💰" : "↔"}
                            </span>
                          ) : (
                            <CategoryIcon icon={cat?.icon ?? null} size={22} style={{ flexShrink: 0 }} />
                          )}
                          <div style={txMiddleStyle}>
                            {isTransfer && (fromCat || toCat) ? (
                              <span style={txNameStyle}>{fromCat?.name ?? "—"} → {toCat?.name ?? "—"}</span>
                            ) : (
                              <span style={txNameStyle}>{txn.name}</span>
                            )}
                            {!isTransfer && cat && <span style={txCategoryStyle}>{cat.name}</span>}
                          </div>
                          <div style={txRightStyle}>
                            <span style={{ ...txAmountStyle, color: amtColor }}>{prefix}{fmt(txn.amount)} MAD</span>
                            <span style={txDateStyle}>{fmtDate(txn.date)}</span>
                          </div>
                        </div>
                      </SwipeToDelete>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {!transactionsLoading && transactions.length === 0 && (
          <div style={emptyScreenStyle}>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text2)" }}>Nothing in {monthLabel}</p>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>No activity recorded for this month.</p>
          </div>
        )}
      </div>

    </div>
  );
}

/* ─── Card wrapper ───────────────────────────────────────────────── */

function InsightCard({ emoji, title, subtitle, children }: {
  emoji: string; title: string; subtitle: string; children: ReactNode;
}) {
  return (
    <div className="insights-card" style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
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


/* ─── 3. Together vs. Apart skeleton ────────────────────────────── */

function TogetherApartSkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[1, 2].map(i => (
          <div key={i} style={{ borderRadius: 14, padding: "14px 14px 12px", background: "var(--surface2)", display: "grid", gap: 6 }}>
            <div className="skeleton" style={{ width: 40, height: 10, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 24, height: 9, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 80, height: 10, borderRadius: 4, marginTop: 2 }} />
          </div>
        ))}
      </div>
      <div className="skeleton" style={{ width: "65%", height: 12, borderRadius: 4 }} />
    </div>
  );
}

/* ─── 4. Spending Breakdown skeleton ────────────────────────────── */

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

function BurnRateBody({ burnRate, totalSpent, totalPlanned, lastMonthTotalSpent }: {
  burnRate: { spentPct: number; expectedPct: number; isAhead: boolean; isOver: boolean; gapPct: number; daysLeft: number; vsLastMonth: number | null };
  totalSpent: number;
  totalPlanned: number;
  lastMonthTotalSpent: number;
}) {
  const { spentPct, expectedPct, isAhead, isOver, gapPct, daysLeft, vsLastMonth } = burnRate;

  const fillColor = isOver ? "var(--danger)"
    : isAhead ? "var(--warning)"
    : "color-mix(in srgb, var(--accent) 65%, #d8f3c9)";

  const copy = totalPlanned === 0
    ? "No budget planned this month."
    : isOver
    ? `Over budget by ${fmt(totalSpent - totalPlanned)} MAD.`
    : isAhead
    ? `Running ${Math.round(gapPct)}% ahead of pace — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left.`
    : `${Math.round(gapPct)}% under expected pace. The budget is breathing easy.`;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Spend number + vs last month */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" as const }}>
        <span style={bigNumStyle(isOver)}>{fmt(totalSpent)}</span>
        <span style={bigNumUnitStyle}>MAD spent</span>
        {vsLastMonth !== null && lastMonthTotalSpent > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: 0.2,
            color: vsLastMonth > 0 ? "var(--warning)" : "color-mix(in srgb, var(--accent) 72%, var(--text2))",
            marginLeft: 4,
          }}>
            {vsLastMonth > 0 ? "↑" : "↓"} {Math.abs(vsLastMonth)}% vs last month
          </span>
        )}
      </div>

      {/* Bar + pace marker */}
      <div style={{ position: "relative", padding: "4px 0" }}>
        <div style={burnRailStyle}>
          <div style={{ ...burnFillStyle, width: `${spentPct}%`, background: fillColor }} />
        </div>
        {totalPlanned > 0 && (
          <div style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${expectedPct}%`, width: 2, borderRadius: 1,
            background: "var(--border2)", transform: "translateX(-50%)",
          }} />
        )}
      </div>

      {/* Legend */}
      {totalPlanned > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={burnLegendItemStyle}>
            <span style={{ ...burnDotStyle, background: fillColor }} />
            {Math.round(spentPct)}% spent
          </span>
          <span style={{ ...burnLegendItemStyle, opacity: 0.55 }}>
            <span style={{ width: 2, height: 10, borderRadius: 1, background: "var(--border2)", display: "inline-block" }} />
            Pace marker
          </span>
          <span style={{ ...burnLegendItemStyle, marginLeft: "auto" }}>
            {fmt(totalPlanned)} MAD planned
          </span>
        </div>
      )}

      <p style={copySentenceStyle}>{copy}</p>
    </div>
  );
}


/* ─── 3. Together vs. Apart body ─────────────────────────────────── */

function TogetherApartBody({ data }: {
  data: {
    anasActual: number; salmaActual: number; sharedSpend: number;
    anasPlan: number; salmaPlan: number;
    anasPct: number | null; salmaPct: number | null;
    anasDelta: number | null; salmaDelta: number | null;
    anasContribPct: number | null; salmaContribPct: number | null;
    hasPlan: boolean;
  };
}) {
  const { anasActual, salmaActual, sharedSpend, anasPlan, salmaPlan, anasPct, salmaPct, anasDelta, salmaDelta, anasContribPct, salmaContribPct, hasPlan } = data;

  const hasAnyData = anasActual > 0 || salmaActual > 0 || sharedSpend > 0;
  if (!hasAnyData && !hasPlan) return <p style={emptyBodyStyle}>No expenses recorded this month.</p>;

  const copy = !hasPlan
    ? "No contribution plan set — showing pocket spend only."
    : !hasAnyData
    ? `Planned for the month — Anas ${fmt(anasPlan)} MAD, Salma ${fmt(salmaPlan)} MAD.`
    : anasDelta !== null && salmaDelta !== null && Math.abs(anasDelta) < 50 && Math.abs(salmaDelta) < 50
    ? "Both on track with their planned contributions this month."
    : anasDelta !== null && anasDelta < -50
    ? `Anas is ${fmt(Math.abs(anasDelta))} MAD short of his ${anasContribPct != null ? Math.round(anasContribPct * 100) : "?"}% target.`
    : salmaDelta !== null && salmaDelta < -50
    ? `Salma is ${fmt(Math.abs(salmaDelta))} MAD short of her ${salmaContribPct != null ? Math.round(salmaContribPct * 100) : "?"}% target.`
    : "Contributions are on track.";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <ContribBlock
          name="Anas" actual={anasActual} plan={anasPlan} pct={anasPct}
          delta={anasDelta} color="var(--partner-husband)"
        />
        <ContribBlock
          name="Salma" actual={salmaActual} plan={salmaPlan} pct={salmaPct}
          delta={salmaDelta} color="var(--partner-wife)"
        />
      </div>

      {sharedSpend > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--muted)", opacity: 0.4, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--muted)", flex: 1 }}>Spent from shared pot</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{fmt(sharedSpend)} MAD</span>
        </div>
      )}

      <p style={copySentenceStyle}>{copy}</p>
    </div>
  );
}

function ContribBlock({ name, actual, plan, pct, delta, color }: {
  name: string; actual: number; plan: number; pct: number | null;
  delta: number | null; color: string;
}) {
  const isShort = delta !== null && delta < -50;
  const isOver  = delta !== null && delta > 50;
  const deltaColor = isShort ? "var(--danger)" : isOver ? "var(--success)" : "var(--muted)";

  return (
    <div style={{
      background: `color-mix(in srgb, ${color} 7%, var(--surface))`,
      borderRadius: 14, padding: "14px 14px 12px",
      display: "grid", gap: 4,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" as const, color }}>{name}</span>
      <span style={{ fontFamily: "var(--font-body)", fontSize: 22, fontWeight: 400, lineHeight: 1.1, color: "var(--text2)", fontVariantNumeric: "tabular-nums" }}>
        {fmt(actual)}
      </span>
      <span style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 0.2 }}>MAD</span>

      {pct !== null && (
        <div style={{ marginTop: 6, display: "grid", gap: 5 }}>
          <div style={{ height: 3, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 999,
              width: `${pct}%`,
              background: isShort ? "var(--danger)" : isOver ? "var(--success)" : color,
              transition: "width 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 9, color: "var(--muted)" }}>of {fmt(plan)} planned</span>
            {delta !== null && Math.abs(delta) > 50 && (
              <span style={{ fontSize: 9, fontWeight: 600, color: deltaColor }}>
                {isShort ? `−${fmt(Math.abs(delta))}` : `+${fmt(delta)}`}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 4. Spending Breakdown body ─────────────────────────────────── */

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

  const cycleView = () => setView(v => v === "donut" ? "curve" : "donut");

  return (
    <div
      onClick={cycleView}
      role="button"
      tabIndex={0}
      aria-label={`Switch to ${view === "donut" ? "trend" : "breakdown"} chart`}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") cycleView(); }}
      style={{ cursor: "pointer", userSelect: "none", WebkitUserSelect: "none" }}
    >
      {view === "donut"
        ? <DonutView items={items} total={total} />
        : <CurveView
            expenses={expenses}
            insightsMonth={insightsMonth}
            totalPlanned={totalPlanned}
            totalSpent={total}
          />
      }

      {/* Dot indicator — shows current view & that it's tappable */}
      <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 14 }}>
        {(["donut", "curve"] as const).map(v => (
          <span
            key={v}
            style={{
              display: "inline-block",
              height: 4,
              width: v === view ? 16 : 4,
              borderRadius: 999,
              background: v === view ? "var(--accent)" : "var(--border2)",
              transition: "width 0.22s cubic-bezier(0.22,1,0.36,1), background 0.18s ease",
            }}
          />
        ))}
      </div>
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
          <span style={{ fontSize: 9, color: "var(--muted)", marginTop: 3, letterSpacing: 0.3 }}>MAD</span>
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
            <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
              {cat.name}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
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
            tick={{ fontSize: 9, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "var(--muted)" }}
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
              fontSize: 11,
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

          {/* Budget pace line */}
          {totalPlanned > 0 && (
            <Line
              type="linear"
              dataKey="budget"
              stroke="var(--muted)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              opacity={0.35}
              strokeOpacity={0.45}
            />
          )}

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
          <span style={{ fontSize: 10, color: "var(--muted)" }}>Spent · {fmt(totalSpent)} MAD</span>
        </div>
        {totalPlanned > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width={12} height={4} style={{ flexShrink: 0 }}>
              <line x1={0} y1={2} x2={12} y2={2} stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.55} />
            </svg>
            <span style={{ fontSize: 10, color: "var(--muted)" }}>Budget · {fmt(totalPlanned)} MAD</span>
          </div>
        )}
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

const eyebrowStyle: CSSProperties = {
  fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase",
  color: "var(--muted)", fontFamily: "var(--font-body)",
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display)", fontSize: 34, lineHeight: 0.95,
  color: "var(--text)", margin: "4px 0 0",
};

const monthNavStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px",
};

const monthNavBtnStyle: CSSProperties = {
  width: 32, height: 32, borderRadius: 10, border: "none",
  background: "transparent", color: "var(--text2)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const monthLabelStyle: CSSProperties = {
  fontSize: 15, fontWeight: 600, color: "var(--text2)", letterSpacing: "-0.01em",
};

const scopeRailStyle: CSSProperties = { display: "flex", gap: 8 };

/* Card */
const cardStyle: CSSProperties = {
  background: "var(--surface)",
  borderRadius: 20,
  padding: 18,
  display: "grid",
  gap: 14,
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10,
};

const cardTitleStyle: CSSProperties = {
  fontSize: 14, fontWeight: 700, color: "var(--text2)", lineHeight: 1,
};

const cardSubtitleStyle: CSSProperties = {
  fontSize: 11, color: "var(--muted)", marginTop: 3, letterSpacing: 0.1,
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
  height: "100%", borderRadius: 999,
  transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
};

const burnLegendItemStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 5,
  fontSize: 10, color: "var(--muted)", fontWeight: 500,
};

const burnDotStyle: CSSProperties = {
  width: 8, height: 8, borderRadius: 2, display: "inline-block", flexShrink: 0,
};

const copySentenceStyle: CSSProperties = {
  fontSize: 12, color: "var(--muted)", lineHeight: 1.5, fontStyle: "italic",
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
  fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
  textTransform: "uppercase", color: "var(--muted)",
};

const groupHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  marginBottom: 8, paddingLeft: 2,
};

const groupLabelStyle: CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
  textTransform: "uppercase", color: "var(--muted)",
};

const groupSubtotalStyle: CSSProperties = {
  fontSize: 11, fontWeight: 500, color: "var(--muted)",
};

const txTypeIconStyle = (isIncome: boolean): CSSProperties => ({
  flexShrink: 0, width: 22, height: 22, borderRadius: 8,
  background: isIncome
    ? "color-mix(in srgb, var(--accent) 15%, transparent)"
    : "color-mix(in srgb, var(--muted) 15%, transparent)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: isIncome ? 13 : 11, lineHeight: 1,
  color: isIncome ? "var(--accent-ink)" : "var(--muted)",
});

const txMiddleStyle: CSSProperties = {
  flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3,
};

const txNameStyle: CSSProperties = {
  fontSize: 13, fontWeight: 500, color: "var(--text2)",
  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
};

const txCategoryStyle: CSSProperties = {
  fontSize: 11, fontWeight: 400, color: "var(--muted)",
  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
};

const txRightStyle: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0,
};

const txAmountStyle: CSSProperties = {
  fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 500, lineHeight: 1,
};

const txDateStyle: CSSProperties = {
  fontSize: 13, fontWeight: 400, color: "var(--muted)", lineHeight: 1, padding: "3px 7px",
};

const emptyScreenStyle: CSSProperties = {
  padding: "40px 16px", textAlign: "center", animation: "fadeUp 0.3s ease both",
};
