import type { CSSProperties } from "react";
import type { BudgetScope, Category, MonthlySummary } from "./app-types";
import { CardHeader, CardHeaderAction } from "./ui/CardHeader";
import { Currency, Money, ratioCurrencyStyle } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SkeletonRows } from "./ui/Skeleton";
import { Banner } from "./ui/Banner";
import { EmptyState } from "./ui/EmptyState";
import { fmt } from "./app-utils";
import { ReceiptIcon } from "./ui/icons";

type Props = { summary: MonthlySummary; month: string; loading: boolean; error: boolean; showPlanAction?: boolean; onOpenPlan: () => void; onOpenReceipt?: () => void; scope?: BudgetScope; categories?: Category[] };


/** Desktop groups the existing monthly facts beside cash, without treating
 * assignments minus spending as a spendable account balance. */
export function DesktopMonthBudget({ summary, month, loading, error, showPlanAction = true, onOpenPlan, onOpenReceipt, categories = [] }: Props) {
  const label = new Date(`${month}-01T12:00:00`).toLocaleDateString("en", { month: "long" });
  const assigned = summary.totalAssigned;
  const spent = summary.totalSpent;
  const over = Math.max(0, Math.round((spent - assigned) * 100) / 100);
  const left = Math.max(0, assigned - spent);
  const isCurrent = month === new Date().toISOString().slice(0, 7);
  // Days left in the month, today included.
  const daysLeft = (() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1; })();
  // Five rows fill the column beside the gauge, so the card has no empty band at its card-matched height.
  const top = summary.spentByCategory.filter(entry => entry.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
  // One solid colour per wallet (bars never use a gradient): --select-color follows html[data-scope], ink for Joint.
  const fill = { "--budget-fill": "var(--select-color)" } as CSSProperties;
  return <section className="desktop-month-budget" aria-label={`${label} spending`} style={fill}>
    <CardHeader className="desktop-panel-heading" title={`${label} spending`} action={loading || error ? undefined : assigned > 0 && onOpenReceipt ? <button type="button" className="card-header-action" onClick={onOpenReceipt} aria-label={`View ${label}'s plan receipt`} title={`${label} plan`}><ReceiptIcon size={20} aria-hidden="true" /></button> : showPlanAction ? <CardHeaderAction disabled={!!summary.contributionError} title={summary.contributionError ? "Planning needs confirmed contributions" : undefined} onClick={onOpenPlan} aria-label="Open monthly planning">Plan</CardHeaderAction> : undefined} />
    {/* An unplanned month with no spending has nothing to measure: one EmptyState line instead of a big 0, "0 assigned" and an empty bar. */}
    {loading ? <SkeletonRows label="Loading monthly budget" count={3} /> : error ? <Banner tone="danger" role="alert" compact>Monthly budget unavailable. Refresh to try again.</Banner> : assigned <= 0 && spent <= 0 ? <EmptyState align="start">No plan or spending this month.</EmptyState> : <>
      <div className="desktop-spend-side">
        <SpendGauge spent={spent} assigned={assigned} over={over} left={left} caption={isCurrent ? "left this month" : `left in ${label}`} />
        {/* This month only: how long the money left has to last, and what that allows a day. */}
        {isCurrent && over <= 0 && <dl className="desktop-spend-facts">
          <div><dt>Days left</dt><dd>{daysLeft}</dd></div>
          <div><dt>Per day</dt><dd><Money value={Math.floor(left / daysLeft)} currency /></dd></div>
        </dl>}
      </div>
      {/* Where it went: the five biggest categories, so the card says more than one number. */}
      {top.length > 0 && <div className="desktop-budget-where">
        <h3 className="desktop-budget-where-title">Most spent</h3>
        <ol className="desktop-budget-where-list">{top.map(entry => {
          const category = categories.find(c => c.id === entry.categoryId);
          const share = spent > 0 ? Math.round(entry.total / spent * 100) : 0;
          return <li key={entry.categoryId}>
            <span className="desktop-budget-where-icon" aria-hidden="true"><CategoryIcon icon={category?.icon ?? null} categoryName={category?.name} size={24} /></span>
            <span className="desktop-budget-where-text">
              <span className="desktop-budget-where-name">{category?.name ?? "Archived category"}</span>
              <span className="desktop-budget-where-share">{share}%<span className="desktop-budget-where-share-rest"> of spending</span></span>
            </span>
            <strong><Money value={entry.total} currency /></strong>
          </li>;
        })}</ol>
      </div>}
    </>}
  </section>;
}

/** The gauge's sweep: an arc of 220° opening at the bottom, as a fuel gauge reads. */
const GAUGE = { cx: 120, cy: 130, r: 92, from: 200, to: -20 };
const gaugePoint = (radius: number, degrees: number) => {
  const rad = degrees * Math.PI / 180;
  return `${(GAUGE.cx + radius * Math.cos(rad)).toFixed(2)} ${(GAUGE.cy - radius * Math.sin(rad)).toFixed(2)}`;
};
const gaugeArc = (radius: number) => `M ${gaugePoint(radius, GAUGE.from)} A ${radius} ${radius} 0 1 1 ${gaugePoint(radius, GAUGE.to)}`;

/**
 * The month as a gauge: the filled arc is what's left of what was assigned, so it drains as the month is spent.
 * The big number says what's left; the ends name spent (left) and assigned (right). Overspent fills the arc in
 * the danger colour and the number becomes what went above assigned. One solid colour, never a gradient.
 */
function SpendGauge({ spent, assigned, over, left, caption }: { spent: number; assigned: number; over: number; left: number; caption: string }) {
  const leftPct = over > 0 ? 100 : assigned > 0 ? Math.max(0, Math.min(100, left / assigned * 100)) : 0;
  const spentPct = assigned > 0 ? Math.round(Math.max(0, spent) / assigned * 100) : 0;
  return <div className="desktop-spend-gauge" data-over={over > 0 || undefined}>
    <p className="sr-only">{over > 0 ? `${fmt(over)} MAD above ${fmt(assigned)} MAD assigned; ${fmt(spent)} MAD spent.` : `${fmt(left)} MAD ${caption}: ${fmt(spent)} MAD spent of ${fmt(assigned)} MAD assigned, ${spentPct}%.`}</p>
    {/* Same title row as Most spent, so both columns start on one line; the arc then lines up with the first row. */}
    <h3 className="desktop-budget-where-title" aria-hidden="true">{spentPct}% spent</h3>
    {/* Cropped to the arc's top edge (stroke included), so nothing pads the space above it. */}
    <svg viewBox="0 29 240 147" aria-hidden="true" focusable="false">
      <path className="desktop-spend-gauge-track" d={gaugeArc(GAUGE.r)} pathLength={100} />
      {leftPct > 0 && <path className="desktop-spend-gauge-fill" d={gaugeArc(GAUGE.r)} pathLength={100} strokeDasharray={`${leftPct} 100`} />}
    </svg>
    <div className="desktop-spend-gauge-center" aria-hidden="true">
      <strong>{over > 0 ? <>−<Money value={over} currency /></> : <Money value={left} currency />}</strong>
      <span>{over > 0 ? "above assigned" : caption}</span>
    </div>
    <div className="desktop-spend-gauge-ends" aria-hidden="true">
      <span>{fmt(Math.round(spent))}</span>
      <span>{fmt(Math.round(assigned))}<Currency style={ratioCurrencyStyle} /></span>
    </div>
  </div>;
}

export function DesktopTopSpending({ summary, categories, loading, error }: { summary: MonthlySummary; categories: Category[]; loading: boolean; error: boolean }) {
  const entries = summary.spentByCategory.filter(e => e.total > 0).sort((a, b) => b.total - a.total).slice(0, 4);
  const maximum = entries[0]?.total ?? 1;
  return <section className="desktop-top-spending" aria-label="Top spending categories">
    <CardHeader className="desktop-panel-heading" title="Top spending" />
    {loading ? <SkeletonRows label="Loading spending categories" count={3} /> : error ? <Banner tone="danger" role="alert" compact>Spending unavailable.</Banner> : !entries.length ? <EmptyState align="start">No spending this month.</EmptyState> : <ol className="desktop-spending-list">{entries.map(entry => {
      const category = categories.find(c => c.id === entry.categoryId);
      return <li key={entry.categoryId}><div className="desktop-spending-label"><CategoryIcon icon={category?.icon ?? null} categoryName={category?.name} size={20} /><span>{category?.name ?? "Archived category"}</span></div><strong><Money value={entry.total} /></strong><span className="desktop-spending-track" aria-hidden="true"><span style={{ width: `${entry.total / maximum * 100}%` }} /></span></li>;
    })}</ol>}
  </section>;
}
