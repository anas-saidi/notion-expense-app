import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { BudgetScope, Category, MonthlySummary, PendingItem, Transaction } from "./app-types";
import { WalletCardSwitcher } from "./WalletCardSwitcher";
import { CategoryIcon } from "./ui/CategoryIcon";
import { ChevronRightIcon } from "./ui/icons";
import { BUDGET_SCOPE_LABELS, fmt, fmtDate, shiftDate, today, categoryMatchesScope } from "./app-utils";

type HomeScreenProps = {
  categories: Category[];
  selectedCategoryId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectCategory: (category: Category) => void;
  onOpenCategoryDetails: (category: Category) => void;
  onOpenAdd: () => void;
  onOpenPlan: () => void;
  onOpenRebalance: () => void;
  onOpenBudgetTab?: () => void;
  onFundCategory?: (category: Category) => void;
  onOpenHistory?: () => void;
  onClickTransaction?: (txn: Transaction) => void;
  monthlySummary: MonthlySummary;
  walletSummaries?: Partial<Record<BudgetScope, MonthlySummary>>;
  leftToSpendByScope: Record<BudgetScope, number>;
  balanceByScope?: Record<BudgetScope, number>;
  readyToAssignByScope: Record<BudgetScope, number>;
  budgetScope: BudgetScope;
  onBudgetScopeChange: (scope: BudgetScope) => void;
  homeMonth: string;
  onHomeMonthChange: (month: string) => void;
  plannedScopes?: Record<"joint" | "anas" | "salma", boolean>;
  transactions?: Transaction[];
  pendingItems?: PendingItem[];
};


export function HomeScreen({
  categories,
  selectedCategoryId,
  search,
  onSearchChange,
  onSelectCategory,
  onOpenCategoryDetails,
  onOpenAdd,
  onOpenPlan,
  onOpenRebalance,
  onOpenBudgetTab,
  onFundCategory,
  onOpenHistory,
  onClickTransaction,
  monthlySummary,
  walletSummaries,
  leftToSpendByScope,
  balanceByScope,
  readyToAssignByScope,
  budgetScope,
  onBudgetScopeChange,
  homeMonth,
  onHomeMonthChange,
  plannedScopes,
  transactions,
  pendingItems,
}: HomeScreenProps) {

  const isCurrentMonth = homeMonth === new Date().toISOString().slice(0, 7);

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

  const visibleCategories = useMemo(
    () => categories.filter(cat => categoryMatchesScope(cat, budgetScope)),
    [categories, budgetScope]
  );

  const attentionItems = useMemo(() => {
    return visibleCategories
      .map(cat => {
        const planned = plannedByCategory.get(cat.id) ?? 0;
        const spent = spentByCategory.get(cat.id) ?? 0;
        const available = isCurrentMonth ? (cat.available ?? planned - spent) : planned - spent;
        const isOver = planned > 0 && spent > planned;
        const isLow = !isOver && planned > 0 && (spent / planned) >= 0.82;
        return { cat, spent, planned, available, isOver, isLow };
      })
      .filter(({ isOver, isLow }) => isOver || isLow)
      .sort((a, b) => Number(b.isOver) - Number(a.isOver));
  }, [visibleCategories, plannedByCategory, spentByCategory, isCurrentMonth]);

  const upcomingBills = useMemo(() => {
    if (!pendingItems?.length) return [];
    const todayStr = today();
    const limit = shiftDate(todayStr, 7);
    return pendingItems
      .filter(p => p.date && p.date >= todayStr && p.date <= limit)
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }, [pendingItems]);

  const savingsGoal = useMemo(() => {
    return visibleCategories
      .filter(cat => {
        const types = cat.type.map(t => t.toLowerCase());
        return types.some(t => t.includes("saving") || t.includes("sinking") || t.includes("goal") || t.includes("fund"))
          && !types.some(t => t.includes("team") || t.includes("household"));
      })
      .filter(cat => cat.planned && cat.planned > 0)
      .sort((a, b) => (b.available ?? 0) - (a.available ?? 0))[0] ?? null;
  }, [visibleCategories]);

  const recentTxns = useMemo(() => (transactions ?? []).slice(0, 5), [transactions]);

  const readyToAssign = readyToAssignByScope[budgetScope] ?? 0;
  const showPlanningPrompt = isCurrentMonth && readyToAssign > 0;
  const monthLabel = monthShortLabel(homeMonth);

  // Month-end planning alert: show 2 days before month end until plan is locked
  const { daysUntilMonthEnd, nextMonthLabel: planningNextMonthLabel } = useMemo(() => {
    if (!isCurrentMonth) return { daysUntilMonthEnd: 99, nextMonthLabel: "" };
    const [y, m] = homeMonth.split("-").map(Number);
    const lastDay = new Date(y, m, 0); // last day of month m
    const todayDate = new Date(today());
    const diff = Math.round((lastDay.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    const nextMonth = new Date(y, m, 1);
    return {
      daysUntilMonthEnd: diff,
      nextMonthLabel: new Intl.DateTimeFormat("en", { month: "long" }).format(nextMonth),
    };
  }, [homeMonth, isCurrentMonth]);

  const allScopesPlanned = plannedScopes
    ? Object.values(plannedScopes).every(Boolean)
    : false;
  const plannedCount = plannedScopes
    ? Object.values(plannedScopes).filter(Boolean).length
    : 0;
  const showMonthEndAlert = isCurrentMonth && daysUntilMonthEnd <= 2 && !allScopesPlanned;
  const hasMonthPlan = monthlySummary.totalAssigned > 0;
  const planningPromptTitle = hasMonthPlan
    ? `${monthLabel} has money left`
    : `${monthLabel} is ready to plan`;
  const planningPromptMeta = `${BUDGET_SCOPE_LABELS[budgetScope]} monthly budget`;
  const planningPromptAction = hasMonthPlan ? "Continue" : "Plan now";

  const storageKey = `dismissed-attention-${homeMonth}-${budgetScope}`;
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setDismissedIds(saved ? new Set<string>(JSON.parse(saved)) : new Set<string>());
    } catch {
      setDismissedIds(new Set<string>());
    }
  }, [storageKey]);

  const visibleAttentionItems = useMemo(
    () => attentionItems.filter(({ cat }) => !dismissedIds.has(cat.id)),
    [attentionItems, dismissedIds]
  );
  const dismissAttention = (id: string) => {
    setDismissedIds(prev => {
      const next = new Set([...prev, id]);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  };


  return (
    <div id="panel-home" role="tabpanel" aria-labelledby="tab-home">

      {/* Zone 1: Hero */}
      <div style={walletSwitcherWrapStyle}>
        <WalletCardSwitcher
          value={budgetScope}
          onChange={onBudgetScopeChange}
          monthlySummary={monthlySummary}
          walletSummaries={walletSummaries}
          leftToSpendByScope={leftToSpendByScope}
          balanceByScope={balanceByScope}
        />
      </div>

      {/* Zone 2: Ready to assign */}
      {showPlanningPrompt && (
        <button type="button" onClick={onOpenPlan} style={assignRowStyle}>
          <span style={assignCopyStyle}>
            <span style={assignTitleStyle}>{planningPromptTitle}</span>
            <span style={assignFreeStyle}>{planningPromptMeta}</span>
            {budgetScope === "joint" && (
              <span style={assignJointHintStyle}>
                👨 {fmt(readyToAssignByScope["anas"])} + 👩 {fmt(readyToAssignByScope["salma"])} from personal accounts
              </span>
            )}
          </span>
          <span style={assignRightStyle}>
            <span style={assignAmountStyle}>{fmt(readyToAssign)} MAD</span>
            <span style={assignActionVisibleStyle}>{planningPromptAction} -&gt;</span>
          </span>
        </button>
      )}

      {/* Zone 2.5a: Month-end planning alert */}
      {showMonthEndAlert && (
        <button type="button" onClick={onOpenPlan} style={monthEndAlertStyle}>
          <span style={assignCopyStyle}>
            <span style={assignTitleStyle}>
              {plannedCount > 0 ? `${planningNextMonthLabel} · ${plannedCount}/3 scopes` : `Plan ${planningNextMonthLabel}`}
            </span>
            <span style={assignFreeStyle}>
              {daysUntilMonthEnd <= 0
                ? "Last day of the month"
                : `${daysUntilMonthEnd} day${daysUntilMonthEnd === 1 ? "" : "s"} left`}
            </span>
          </span>
          <span style={assignActionVisibleStyle}>{plannedCount > 0 ? "Continue →" : "Plan now →"}</span>
        </button>
      )}

      {/* Zone 2.5: Upcoming bills strip */}
      {upcomingBills.length > 0 && (
        <section aria-label="Upcoming bills" style={upcomingWrapStyle}>
          <div style={sectionHeaderStyle}>
            <span className="section-label" style={sectionLabelStyle}>Upcoming · next 7 days</span>
          </div>
          <div className="home-scroll-rail" style={cardsRailStyle}>
            {upcomingBills.map(bill => {
              const isImminent = bill.date === today() || bill.date === shiftDate(today(), 1);
              return (
                <div key={bill.id} style={billChipStyle(isImminent)}>
                  <span style={billNameStyle}>{bill.name}</span>
                  {bill.amount != null && (
                    <span style={billAmountStyle}>{fmt(bill.amount)} MAD</span>
                  )}
                  <span style={billDateStyle}>
                    {bill.date ? fmtDate(bill.date) : "No date"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="home-content" style={contentStyle}>

        {/* Zone 3: Attention — horizontal scroll */}
        {visibleAttentionItems.length > 0 && (
          <section aria-label="Categories needing attention" style={{ minWidth: 0 }}>
            <div className="home-section-hdr" style={sectionHeaderStyle}>
              <span className="section-label" style={sectionLabelStyle}>Needs attention</span>
              {onOpenBudgetTab && (
                <button
                  type="button"
                  onClick={onOpenBudgetTab}
                  style={seeAllBtnStyle}
                  aria-label="View all categories"
                >
                  All categories <ChevronRightIcon size={12} style={{ verticalAlign: "middle" }} />
                </button>
              )}
            </div>

            <div className="home-scroll-rail" style={cardsRailStyle}>
              {visibleAttentionItems.map(({ cat, spent, planned, available, isOver }) => (
                <div key={cat.id} className="home-attention-card" style={attentionCardStyle}>
                  <button
                    type="button"
                    onClick={() => dismissAttention(cat.id)}
                    style={dismissBtnStyle}
                    aria-label={`Dismiss ${cat.name}`}
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => { onSelectCategory(cat); onOpenCategoryDetails(cat); }}
                    style={attentionBodyStyle}
                    aria-label={`${cat.name}: ${isOver ? "over budget" : "low"}`}
                  >
                    <CategoryIcon icon={cat.icon} size={22} style={{ flexShrink: 0 }} />
                    <span style={attentionNameStyle}>{cat.name}</span>
                    <span style={attentionSubStyle}>
                      {isOver ? `+${fmt(spent - planned)}` : `${fmt(available)}`}
                    </span>
                    <span style={attentionSubStyle2}>MAD {isOver ? "over" : "left"}</span>
                  </button>
                  {onFundCategory && (
                    <button
                      type="button"
                      onClick={() => { onSelectCategory(cat); onFundCategory(cat); }}
                      style={fundBtnStyle}
                    >
                      Fund
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Zone 4: Savings goal widget */}
        {savingsGoal && (() => {
          const goalPlanned = savingsGoal.planned ?? 1;
          const goalAvailable = savingsGoal.available ?? 0;
          const goalPct = Math.min(100, Math.max(0, (goalAvailable / goalPlanned) * 100));
          const radius = 21;
          const circ = 2 * Math.PI * radius;
          const dashOffset = circ * (1 - goalPct / 100);
          return (
            <section aria-label="Savings goal">
              <div className="home-section-hdr" style={sectionHeaderStyle}>
                <span className="section-label" style={sectionLabelStyle}>Savings goal</span>
              </div>
              <div style={savingsCardStyle}>
                <div style={savingsRingWrapStyle}>
                  <svg width={52} height={52} viewBox="0 0 52 52" style={{ display: "block" }}>
                    <circle cx={26} cy={26} r={radius} fill="none" stroke="var(--surface2)" strokeWidth={5} />
                    <circle
                      cx={26} cy={26} r={radius}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth={5}
                      strokeLinecap="round"
                      strokeDasharray={circ}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 26 26)"
                      style={{ transition: "stroke-dashoffset 0.4s cubic-bezier(0.22,1,0.36,1)" }}
                    />
                  </svg>
                  <span style={ringPctStyle}>{Math.round(goalPct)}%</span>
                </div>
                <div style={savingsTextStyle}>
                  <span style={savingsNameStyle}>
                    {savingsGoal.icon && <span style={{ marginRight: 5 }}>{savingsGoal.icon}</span>}
                    {savingsGoal.name}
                  </span>
                  <span style={savingsSavedStyle}>{fmt(goalAvailable)} MAD saved</span>
                  <span style={savingsGoalLabelStyle}>goal: {fmt(goalPlanned)} MAD</span>
                </div>
              </div>
            </section>
          );
        })()}

        {/* Zone 6: Recent transactions */}
        {recentTxns.length > 0 && (
          <section aria-label="Recent transactions">
            <div className="home-section-hdr" style={sectionHeaderStyle}>
              <span className="section-label" style={sectionLabelStyle}>Recent</span>
              {onOpenHistory && (
                <button type="button" onClick={onOpenHistory} style={seeAllBtnStyle} aria-label="View all transactions">
                  All activity <ChevronRightIcon size={12} style={{ verticalAlign: "middle" }} />
                </button>
              )}
            </div>
            <div className="home-txn-list" style={recentListStyle}>
              {recentTxns.map((txn) => {
                const cat      = categories.find(c => c.id === txn.category);
                const fromCat  = categories.find(c => c.id === txn.fromCategoryId);
                const toCat    = categories.find(c => c.id === txn.toCategoryId);
                const isIncome   = txn.type === "Income";
                const isTransfer = txn.type === "Transfer";
                const amountPrefix = isIncome ? "+" : isTransfer ? "↔" : "−";
                const amountColor = isIncome
                  ? "var(--accent-ink)"
                  : isTransfer
                  ? "var(--muted)"
                  : "var(--text2)";
                return (
                  <div
                    key={txn.id}
                    className="home-txn-row tx-row"
                    style={{ cursor: onClickTransaction ? "pointer" : undefined }}
                    onClick={onClickTransaction ? () => onClickTransaction(txn) : undefined}
                  >
                    {isIncome || isTransfer ? (
                      <span style={recentTypeIconStyle(isIncome)}>{isIncome ? "💰" : "↔"}</span>
                    ) : (
                      <CategoryIcon icon={cat?.icon ?? null} size={22} style={{ flexShrink: 0 }} />
                    )}
                    <div style={recentMiddleStyle}>
                      {isTransfer && (fromCat || toCat) ? (
                        <span style={recentNameStyle}>{fromCat?.name ?? "—"} → {toCat?.name ?? "—"}</span>
                      ) : (
                        <span style={recentNameStyle}>{txn.name}</span>
                      )}
                      {!isTransfer && cat && <span style={recentCategoryStyle}>{cat.name}</span>}
                    </div>
                    <div style={recentRightStyle}>
                      <span style={{ ...recentAmountStyle, color: amountColor }}>
                        {amountPrefix}{fmt(txn.amount)} MAD
                      </span>
                      <span style={recentDateStyle}>{txn.date ? fmtDate(txn.date) : ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

function monthShortLabel(ym: string): string {
  return new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(`${ym}-01`));
}

/* ─── Styles ──────────────────────────────────────────────────── */

const walletSwitcherWrapStyle: CSSProperties = {
  paddingTop: 8,
  paddingBottom: 16,
};

const contentStyle: CSSProperties = {
  display: "grid",
  gap: 24,
  paddingBottom: 80,
  minWidth: 0,
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

const seeAllBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  padding: "4px 8px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 400,
  cursor: "pointer",
  letterSpacing: 0.3,
};

const cardsRailStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  padding: "2px 4px 8px",
};

/* Attention — horizontal scroll cards */

const attentionCardStyle: CSSProperties = {
  flex: "0 0 120px",
  borderRadius: 16,
  background: "var(--surface)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "8px 10px 10px",
  gap: 0,
  position: "relative",
};

const attentionBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 5,
  padding: "4px 4px 8px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  width: "100%",
  textAlign: "center",
};

const attentionNameStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--muted)",
  lineHeight: 1.2,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  maxWidth: "100%",
};

const attentionSubStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 15,
  fontWeight: 500,
  color: "var(--text2)",
  lineHeight: 1,
};

const attentionSubStyle2: CSSProperties = {
  fontSize: 9,
  fontWeight: 400,
  color: "var(--muted)",
  lineHeight: 1,
};

const fundBtnStyle: CSSProperties = {
  width: "100%",
  padding: "5px 0",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  fontSize: 11,
  fontWeight: 500,
  color: "var(--text2)",
  cursor: "pointer",
};

const dismissBtnStyle: CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  width: 18,
  height: 18,
  borderRadius: 99,
  border: "none",
  background: "var(--surface2)",
  fontSize: 8,
  color: "var(--muted)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};


/* Ready to assign row */

const monthEndAlertStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1.5px solid color-mix(in srgb, var(--accent) 45%, transparent)",
  background: "color-mix(in srgb, var(--accent) 14%, var(--surface))",
  cursor: "pointer",
  marginBottom: 16,
};

const assignRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
  background: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
  cursor: "pointer",
  marginBottom: 16,
};

const assignCopyStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 3,
  textAlign: "left",
};

const assignTitleStyle: CSSProperties = {
  minWidth: 0,
  fontSize: 13,
  fontWeight: 700,
  color: "var(--accent-ink)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const assignRightStyle: CSSProperties = {
  flexShrink: 0,
  display: "grid",
  justifyItems: "end",
  gap: 3,
};

const assignAmountStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--accent-ink)",
};

const assignFreeStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 400,
  color: "color-mix(in srgb, var(--accent-ink) 60%, transparent)",
  textAlign: "left",
};

const assignJointHintStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: "color-mix(in srgb, var(--accent-ink) 45%, transparent)",
  textAlign: "left",
  letterSpacing: 0.1,
};

const assignActionVisibleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "color-mix(in srgb, var(--accent-ink) 50%, transparent)",
  flexShrink: 0,
};

/* Upcoming bills strip */

const upcomingWrapStyle: CSSProperties = {
  marginBottom: 16,
};

const billChipStyle = (isImminent: boolean): CSSProperties => ({
  flex: "0 0 100px",
  borderRadius: 12,
  background: "var(--surface)",
  borderLeft: `3px solid ${isImminent ? "var(--spend-warn)" : "var(--border)"}`,
  padding: "10px 10px 10px 11px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  boxShadow: "0 1px 0 color-mix(in srgb, var(--border) 50%, transparent)",
});

const billNameStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text2)",
  lineHeight: 1.2,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const billAmountStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text2)",
  lineHeight: 1,
};

const billDateStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 400,
  color: "var(--muted)",
  lineHeight: 1,
};

/* Savings goal widget */

const savingsCardStyle: CSSProperties = {
  background: "var(--surface)",
  borderRadius: 16,
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  gap: 16,
  boxShadow: "0 1px 0 color-mix(in srgb, var(--border) 50%, transparent)",
};

const savingsRingWrapStyle: CSSProperties = {
  position: "relative",
  flexShrink: 0,
  width: 52,
  height: 52,
};

const ringPctStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-body)",
  fontSize: 10,
  fontWeight: 700,
  color: "var(--text2)",
  lineHeight: 1,
};

const savingsTextStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  minWidth: 0,
};

const savingsNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--text2)",
  lineHeight: 1.2,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const savingsSavedStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text2)",
  lineHeight: 1,
};

const savingsGoalLabelStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
  fontWeight: 400,
  color: "var(--muted)",
  lineHeight: 1,
};


/* Recent transactions */

const recentListStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const recentTypeIconStyle = (isIncome: boolean): CSSProperties => ({
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

const recentMiddleStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

const recentNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text2)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const recentCategoryStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 400,
  color: "var(--muted)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const recentRightStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
  flexShrink: 0,
};

const recentAmountStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  fontWeight: 500,
  color: "var(--text2)",
  lineHeight: 1,
};

const recentDateStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 400,
  color: "var(--muted)",
  lineHeight: 1,
  padding: "3px 7px",
};
