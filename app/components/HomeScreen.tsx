import { CardHeader, CardHeaderAction } from "./ui/CardHeader";
import { SkeletonRows } from "./ui/Skeleton";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import type { Account, BudgetScope, Category, MonthlySummary, PendingItem, Transaction } from "./app-types";
import { WalletCardSwitcher, type ContribStatus } from "./WalletCardSwitcher";
import { CategoryIcon } from "./ui/CategoryIcon";
import { BanknoteIcon, ChevronRightIcon, TransferIcon } from "./ui/icons";
import { TransactionRow } from "./ui/TransactionRow";
import { Fact, Summary, joinClauses } from "./ui/Summary";
import { accountIconSource } from "../../lib/category-icons";
import { BUDGET_SCOPE_LABELS, fmt, fmtDate, shiftDate, today, categoryMatchesScope } from "./app-utils";
import { isSavingsCategory } from "./wallet-utils";
import { runningLowCategories } from "./category-runway";
import { DesktopMonthBudget, DesktopTopSpending } from "./DesktopHomeOverview";

type HomeScreenProps = {
  contributions?: ReactNode;
  billsSection?: ReactNode;
  balanceChecks?: ReactNode;
  /** Balance checks waiting for review; they lead the summary sentence. */
  balanceReviews?: { key: string; account: Account; counted: number }[];
  onReviewBalance?: (account: Account) => void;
  /** A savings account holding less than its categories promise (personal views only). */
  savingsGap?: { account: Account; gap: number; source?: Account; onFix: () => void };
  /** Each partner's share still to put into Joined this month (opens the plan, where advances are applied). */
  contributionLeft?: { partner: "anas" | "salma"; left: number }[];
  categories: Category[];
  monthlyLoading?: boolean;
  monthlyError?: boolean;
  secondaryLoading?: boolean;
  planningReady?: boolean;
  planningMonth?: string;
  onOpenPlan: () => void;
  onOpenReceipt?: () => void;
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
  planningRemaining?: Record<BudgetScope, number>;
  plannedScopes?: Record<"joint" | "anas" | "salma", boolean>;
  transactions?: Transaction[];
  budgetTransactions?: Transaction[];
  pendingItems?: PendingItem[];
  jointUnassigned?: number;
  /** Assign unassigned money (opens Rebalance, the same place Budget's banner goes). */
  onOpenAssign?: () => void;
};


export function HomeScreen({
  contributions,
  billsSection,
  balanceChecks,
  balanceReviews = [],
  onReviewBalance,
  savingsGap,
  contributionLeft = [],
  categories,
  monthlyLoading = false,
  monthlyError = false,
  secondaryLoading = false,
  planningReady = true,
  planningMonth,
  onOpenPlan,
  onOpenReceipt,
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
  planningRemaining,
  transactions,
  budgetTransactions,
  pendingItems,
  jointUnassigned,
  onOpenAssign,
}: HomeScreenProps) {

  const isCurrentMonth = homeMonth === today().slice(0, 7);

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

  const overspentCategories = useMemo(
    () => isCurrentMonth ? visibleCategories.filter((cat) => !isSavingsCategory(cat) && (cat.available ?? 0) < -0.005) : [],
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

  const runningLow = useMemo(() => isCurrentMonth && !monthlyLoading && !monthlyError
    ? runningLowCategories(visibleCategories, budgetTransactions ?? [], today())
    : [], [isCurrentMonth, monthlyLoading, monthlyError, visibleCategories, budgetTransactions]);
  const firstLow = runningLow[0];

  const readyToAssign = readyToAssignByScope[budgetScope] ?? 0;
  // Same figure Budget calls unassigned. Waits for the month: until advances load, Joint's money owed back to
  // partners isn't subtracted yet, and a personal wallet's Joint due isn't kept back.
  const unassigned = budgetScope === "joint" ? jointUnassigned ?? 0 : readyToAssign;
  const showUnassignedPrompt = !monthlyLoading && !monthlySummary.contributionError && !firstLow && isCurrentMonth && Math.round(unassigned) > 0;

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

  const planningCurrentMonth = planningMonth === today().slice(0, 7);
  const planningLabel = planningMonth
    ? new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(`${planningMonth}-01T12:00:00`))
    : planningNextMonthLabel;
  const allScopesPlanned = plannedScopes
    ? Object.values(plannedScopes).every(Boolean)
    : false;
  const plannedCount = plannedScopes
    ? Object.values(plannedScopes).filter(Boolean).length
    : 0;
  const showMonthEndAlert = !firstLow && !secondaryLoading && !monthlyLoading && !monthlyError && planningReady && isCurrentMonth && (planningCurrentMonth || daysUntilMonthEnd <= 2) && !allScopesPlanned;
  const showPlanningPrompt = showMonthEndAlert && readyToAssign > 0;

  // ponytail: first three facts in priority order; Budget still lists every running-low category.
  const summaryClauses = [
    savingsGap && <span key="savings-gap"><Fact icon={<CategoryIcon icon={accountIconSource(savingsGap.account.type)} size={20} />}>{savingsGap.account.label}</Fact> is <Fact tone="danger" onClick={savingsGap.onFix} label={savingsGap.source ? `Move money from ${savingsGap.source.label} to ${savingsGap.account.label}` : `Review ${savingsGap.account.label}`}>{fmt(savingsGap.gap)} short</Fact></span>,
    ...balanceReviews.map(({ key, account, counted }) => {
      const off = account.balance == null ? null : Math.abs(counted - account.balance);
      const review = onReviewBalance && (() => onReviewBalance(account));
      const reviewLabel = `Review balance check for ${account.label}`;
      return <span key={key}><Fact icon={<CategoryIcon icon={accountIconSource(account.type)} size={20} />}>{account.label}</Fact>{off == null ? <> has a <Fact tone="warning" onClick={review} label={reviewLabel}>count to review</Fact></> : off < 0.01 ? <> <Fact tone="success" onClick={review} label={reviewLabel}>matches</Fact> your count</> : <> is <Fact tone="warning" onClick={review} label={reviewLabel}>{fmt(Math.max(1, Math.round(off)))} off</Fact> your count</>}</span>;
    }),
    ...contributionLeft.map(({ partner, left }) => <span key={`left-${partner}`}><Fact>{partner === "anas" ? "Anas" : "Salma"}</Fact> has <Fact onClick={onOpenPlan} label={`Open the plan: ${partner === "anas" ? "Anas" : "Salma"} has ${fmt(left)} MAD left to put in`}>{fmt(left)}</Fact> left to put in</span>),
    // Below zero is money already wrong, so it comes before what's about to run out. Opens Rebalance to cover it.
    overspentCategories.length > 0 && (overspentCategories.length === 1
      ? <span key="overspent"><Fact icon={<CategoryIcon icon={overspentCategories[0].icon} categoryName={overspentCategories[0].name} size={20} />}>{overspentCategories[0].name}</Fact> is <Fact tone="danger" onClick={onOpenAssign} label={`Rebalance to cover ${overspentCategories[0].name}`}>{fmt(Math.ceil(-(overspentCategories[0].available ?? 0) - 0.005))} overspent</Fact></span>
      : <span key="overspent"><Fact>{overspentCategories.length} categories</Fact> are <Fact tone="danger" onClick={onOpenAssign} label="Rebalance to cover overspent categories">{fmt(Math.ceil(overspentInCategories - 0.005))} overspent</Fact></span>),
    firstLow && (runningLow.length === 1
      ? <span key="low"><Fact icon={<CategoryIcon icon={firstLow.category.icon} categoryName={firstLow.category.name} size={20} />}>{firstLow.category.name}</Fact> <Fact tone={firstLow.daysCovered < 1 ? "danger" : "warning"} onClick={onOpenAssign} label={`Rebalance ${firstLow.category.name}`}>runs out {firstLow.daysCovered < 1 ? "today" : `in about ${Math.round(firstLow.daysCovered)} days`}</Fact></span>
      : <span key="low"><Fact>{runningLow.length} categories</Fact> are <Fact tone="warning" onClick={onOpenAssign} label="Rebalance running low categories">running low</Fact></span>),
    showPlanningPrompt && <span key="plan"><Fact onClick={onOpenPlan} label={`Plan ${planningLabel}`}>{fmt(Math.round(planningRemaining?.[budgetScope] ?? readyToAssign))}</Fact> is waiting to be planned for <Fact>{planningLabel}</Fact></span>,
    showUnassignedPrompt && !showMonthEndAlert && <span key="unassigned"><Fact onClick={onOpenAssign} label="Assign unassigned money">{fmt(Math.round(unassigned))}</Fact> is <Fact>unassigned</Fact></span>,
    showMonthEndAlert && !showPlanningPrompt && <span key="month-end">{plannedCount > 0
      ? <><Fact onClick={onOpenPlan} label={`Resume planning ${planningLabel}`}>{plannedCount} of 3 budgets</Fact> are ready for <Fact>{planningLabel}</Fact></>
      : <><Fact>{planningLabel}</Fact> <Fact onClick={onOpenPlan} label={`Plan ${planningLabel}`}>isn&rsquo;t planned</Fact> yet</>}</span>,
  ].filter(Boolean).slice(0, 3);

  return (
    <div id="panel-home" role="tabpanel" aria-labelledby="tab-home">

      {/* Zone 1: Hero */}
      <div className="home-overview-grid">
      <div className="home-balance-panel">
      <div style={walletSwitcherWrapStyle}>
        <WalletCardSwitcher
          value={budgetScope}
          monthlyLoading={monthlyLoading}
          monthlyError={monthlyError}
          monthlySummary={monthlySummary}
          categoryAvailableByScope={categoryAvailableByScope}
          balanceByScope={balanceByScope}
          contribStatus={contribStatus}
          categories={categories}
          overspent={overspentInCategories}
          balanceDetail={contributions}
        />
      </div>


      <div className="home-balance-notices">
        {summaryClauses.length > 0 && <Summary style={{ marginBottom: 12 }}>{joinClauses(summaryClauses)}.</Summary>}
        {balanceChecks}
      </div>
      </div>
      <div className="home-budget-context">
      <DesktopMonthBudget summary={monthlySummary} month={homeMonth} loading={monthlyLoading} error={monthlyError} showPlanAction={!showPlanningPrompt && !showMonthEndAlert} onOpenPlan={onOpenPlan} onOpenReceipt={onOpenReceipt} />
      {(showPlanningPrompt || showMonthEndAlert) && <button className="desktop-planning-action" type="button" disabled={!!monthlySummary.contributionError} onClick={onOpenPlan}>{plannedCount > 0 ? "Resume" : "Plan"} {planningLabel}<ChevronRightIcon size={16} aria-hidden="true" /></button>}
      </div>
      </div>
      <div className="home-desktop-panels">
      <div className="home-bills-panel">
      {billsSection}

      {/* Zone 2.5: Upcoming bills strip */}
      {upcomingBills.length > 0 && (
        <section aria-label="Upcoming bills" style={upcomingWrapStyle}>
          <div style={sectionHeaderStyle}>
            <span className="section-label" style={sectionLabelStyle}>Due in the next 7 days</span>
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

      </div>
      <div className="home-content" style={contentStyle}>

        {/* Zone 6: Recent transactions */}
        <section aria-label="Recent activity">
            <CardHeader className="home-section-hdr home-recent-header" title="Recent activity" titleClassName="section-label" titleStyle={sectionLabelStyle} style={sectionHeaderStyle}
              action={onOpenHistory ? <CardHeaderAction className="home-recent-action" onClick={onOpenHistory} style={seeAllBtnStyle} aria-label="View all transactions">All activity</CardHeaderAction> : undefined} />
            {secondaryLoading && recentTxns.length === 0 ? <SkeletonRows label="Loading recent activity" count={4} /> : recentTxns.length === 0 ? <p className="desktop-empty">No recent activity.</p> : recentDays.map((day) => (
            <div key={day.label} role="group" aria-label={day.label} style={recentDayStyle}>
            <span style={recentDayLabelStyle}>{day.label}</span>
            <div className="home-txn-list row-list" style={recentListStyle}>
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
                    icon={isIncome ? <BanknoteIcon size={13} /> : isTransfer ? <TransferIcon size={12} /> : <CategoryIcon icon={cat?.icon ?? null} categoryName={cat?.name} size={22} />}
                    onClick={onClickTransaction ? () => onClickTransaction(txn) : undefined}
                  />
                );
              })}
            </div>
            </div>
            ))}
          </section>

      </div>
      <DesktopTopSpending summary={monthlySummary} categories={categories} loading={monthlyLoading} error={monthlyError} />
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
