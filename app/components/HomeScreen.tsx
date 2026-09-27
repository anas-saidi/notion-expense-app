import { useMemo, type CSSProperties } from "react";
import type { BudgetScope, Category, MonthlySummary, PendingItem, Transaction } from "./app-types";
import { WalletCardSwitcher, type ContribStatus } from "./WalletCardSwitcher";
import { CategoryIcon } from "./ui/CategoryIcon";
import { BanknoteIcon, ChevronRightIcon, TransferIcon } from "./ui/icons";
import { TransactionRow } from "./ui/TransactionRow";
import { Banner } from "./ui/Banner";
import { BUDGET_SCOPE_LABELS, fmt, fmtDate, shiftDate, today, categoryMatchesScope } from "./app-utils";
import { isSavingsCategory } from "./wallet-utils";

type HomeScreenProps = {
  categories: Category[];
  onOpenPlan: () => void;
  onOpenHistory?: () => void;
  onClickTransaction?: (txn: Transaction) => void;
  contribStatus?: ContribStatus | null;
  monthlySummary: MonthlySummary;
  categoryAvailableByScope: Record<BudgetScope, number>;
  balanceByScope?: Record<BudgetScope, number>;
  readyToAssignByScope: Record<BudgetScope, number>;
  budgetScope: BudgetScope;
  homeMonth: string;
  onHomeMonthChange: (month: string) => void;
  plannedScopes?: Record<"joint" | "anas" | "salma", boolean>;
  transactions?: Transaction[];
  pendingItems?: PendingItem[];
  jointUnassigned?: number;
  /** Assign unassigned money (opens Rebalance, the same place Budget's banner goes). */
  onOpenAssign?: () => void;
};


export function HomeScreen({
  categories,
  onOpenPlan,
  onOpenHistory,
  onClickTransaction,
  contribStatus,
  monthlySummary,
  categoryAvailableByScope,
  balanceByScope,
  readyToAssignByScope,
  budgetScope,
  homeMonth,
  onHomeMonthChange,
  plannedScopes,
  transactions,
  pendingItems,
  jointUnassigned,
  onOpenAssign,
}: HomeScreenProps) {

  const isCurrentMonth = homeMonth === new Date().toISOString().slice(0, 7);

  const visibleCategories = useMemo(
    () => categories.filter(cat => categoryMatchesScope(cat, budgetScope)),
    [categories, budgetScope]
  );

  const overspentInCategories = useMemo(
    () => isCurrentMonth
      ? visibleCategories.filter((cat) => !isSavingsCategory(cat)).reduce((sum, cat) => sum + Math.max(0, -(cat.available ?? 0)), 0)
      : 0,
    [visibleCategories, isCurrentMonth],
  );

  const upcomingBills = useMemo(() => {
    if (!pendingItems?.length) return [];
    const todayStr = today();
    const limit = shiftDate(todayStr, 7);
    return pendingItems
      .filter(p => p.date && p.date >= todayStr && p.date <= limit)
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }, [pendingItems]);

  const recentTxns = useMemo(() => (transactions ?? [])
    .filter(t => !(t.type === "Transfer" && !t.fromAccountId && !t.toAccountId))
    .slice(0, 5), [transactions]);
  // 5: one heading per day instead of repeating the date on every row
  const recentDays = useMemo(() => {
    const groups: { label: string; txns: Transaction[] }[] = [];
    const todayStr = today();
    const yesterdayStr = shiftDate(todayStr, -1);
    for (const txn of recentTxns) {
      const label = !txn.date ? "Undated" : txn.date === todayStr ? "Today" : txn.date === yesterdayStr ? "Yesterday" : fmtDate(txn.date);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.txns.push(txn);
      else groups.push({ label, txns: [txn] });
    }
    return groups;
  }, [recentTxns]);

  const readyToAssign = readyToAssignByScope[budgetScope] ?? 0;
  const showJointUnassignedPrompt = isCurrentMonth && budgetScope === "joint" && (jointUnassigned ?? 0) > 0;

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
  const showPlanningPrompt = showMonthEndAlert && readyToAssign > 0;
  const planningTiming = daysUntilMonthEnd <= 0
    ? "Last day of the month"
    : `${daysUntilMonthEnd} day${daysUntilMonthEnd === 1 ? "" : "s"} left`;

  return (
    <div id="panel-home" role="tabpanel" aria-labelledby="tab-home">

      {/* Zone 1: Hero */}
      <div style={walletSwitcherWrapStyle}>
        <WalletCardSwitcher
          value={budgetScope}
          monthlySummary={monthlySummary}
          categoryAvailableByScope={categoryAvailableByScope}
          balanceByScope={balanceByScope}
          contribStatus={contribStatus}
          categories={categories}
          overspent={overspentInCategories}
        />
      </div>

      {/* Zone 2: Ready to assign */}
      {showPlanningPrompt && (
        <Banner
          tone="accent"
          style={{ marginBottom: 16 }}
          title={`Plan ${planningNextMonthLabel}`}
          action={(
            <span style={assignRightStyle}>
              <span style={assignAmountStyle}>{fmt(readyToAssign)}</span>
              <button type="button" onClick={onOpenPlan} style={bannerActionButtonStyle}>Plan →</button>
            </span>
          )}
        >
          {planningTiming} · {BUDGET_SCOPE_LABELS[budgetScope]} budget
        </Banner>
      )}

      {/* Zone 2a: Joint account has unassigned money */}
      {showJointUnassignedPrompt && (
        <Banner
          tone="accent"
          style={{ marginBottom: 16 }}
          title={`${fmt(Math.round(jointUnassigned ?? 0))} unassigned`}
          action={<button type="button" onClick={onOpenAssign} style={bannerActionButtonStyle}>Assign</button>}
        />
      )}

      {/* Zone 2.5a: Month-end planning alert */}
      {showMonthEndAlert && !showPlanningPrompt && (
        <Banner
          tone="accent"
          style={{ marginBottom: 16 }}
          title={plannedCount > 0 ? `${planningNextMonthLabel} · ${plannedCount}/3 budgets` : `Plan ${planningNextMonthLabel}`}
          action={<button type="button" onClick={onOpenPlan} style={bannerActionButtonStyle}>{plannedCount > 0 ? "Resume →" : "Plan →"}</button>}
        >
          {planningTiming}
        </Banner>
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
                    <span style={billAmountStyle}>{fmt(bill.amount)}</span>
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

        {/* Zone 6: Recent transactions */}
        {recentTxns.length > 0 && (
          <section aria-label="Recent transactions">
            <div className="home-section-hdr home-recent-header" style={sectionHeaderStyle}>
              <span className="section-label" style={sectionLabelStyle}>Recent</span>
              {onOpenHistory && (
                <button className="home-recent-action" type="button" onClick={onOpenHistory} style={seeAllBtnStyle} aria-label="View all transactions">
                  All activity <ChevronRightIcon size={12} style={{ verticalAlign: "middle" }} />
                </button>
              )}
            </div>
            {recentDays.map((day) => (
            <div key={day.label} role="group" aria-label={day.label} style={recentDayStyle}>
            <span style={recentDayLabelStyle}>{day.label}</span>
            <div className="home-txn-list" style={recentListStyle}>
              {day.txns.map((txn) => {
                const cat      = categories.find(c => c.id === txn.category);
                const fromCat  = categories.find(c => c.id === txn.fromCategoryId);
                const toCat    = categories.find(c => c.id === txn.toCategoryId);
                const isIncome   = txn.type === "Income";
                const isTransfer = txn.type === "Transfer";
                const amountPrefix = isIncome ? "+" : isTransfer ? "↔" : "−";
                const amountTone = isIncome ? "income" : isTransfer ? "transfer" : "expense";
                return (
                  <TransactionRow
                    key={txn.id}
                    className="home-txn-row"
                    title={isTransfer && (fromCat || toCat) ? `${fromCat?.name ?? "—"} → ${toCat?.name ?? "—"}` : txn.name}
                    subtitle={!isTransfer ? cat?.name : undefined}
                    amount={txn.amount}
                    tone={amountTone}
                    prefix={amountPrefix}
                    icon={isIncome ? <BanknoteIcon size={13} /> : isTransfer ? <TransferIcon size={12} /> : <CategoryIcon icon={cat?.icon ?? null} size={22} />}
                    onClick={onClickTransaction ? () => onClickTransaction(txn) : undefined}
                  />
                );
              })}
            </div>
            </div>
            ))}
          </section>
        )}

      </div>
    </div>
  );
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
  fontSize: 12,
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
  fontSize: 12,
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

/* Ready to assign row */

const assignRightStyle: CSSProperties = {
  flexShrink: 0,
  display: "grid",
  justifyItems: "end",
  gap: 3,
};

const assignAmountStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text)",
};

const bannerActionButtonStyle: CSSProperties = {
  minHeight: 44,
  margin: "-10px -8px -10px 0",
  padding: "0 8px",
  border: "none",
  borderRadius: 10,
  background: "transparent",
  color: "var(--text2)",
  fontSize: 12,
  fontWeight: 650,
  cursor: "pointer",
};

/* Upcoming bills strip */

const upcomingWrapStyle: CSSProperties = {
  marginBottom: 16,
};

const billChipStyle = (isImminent: boolean): CSSProperties => ({
  flex: "0 0 100px",
  borderRadius: 12,
  background: isImminent ? "color-mix(in srgb, var(--warning) 7%, var(--surface))" : "var(--surface)",
  border: `1px solid ${isImminent ? "color-mix(in srgb, var(--warning) 28%, var(--border))" : "var(--border)"}`,
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 4,
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
  fontSize: 12,
  fontWeight: 400,
  color: "var(--muted)",
  lineHeight: 1,
};

/* Recent transactions */

const recentDayStyle: CSSProperties = { display: "grid", gap: 4, marginBottom: 12 };

const recentDayLabelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--muted)" };

const recentListStyle: CSSProperties = {
  display: "grid",
  gap: 0,
};
