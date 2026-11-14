import type { CSSProperties } from "react";
import type { BudgetScope, Category, MonthlySummary } from "./app-types";
import { monthProgress } from "./category-status";
import { CardHeader, CardHeaderAction } from "./ui/CardHeader";
import { Money } from "./Money";
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
  const withinAssigned = Math.min(Math.max(spent, 0), Math.max(assigned, 0));
  const comparisonTotal = Math.max(assigned, withinAssigned + over, 0);
  const assignedWidth = comparisonTotal > 0 ? withinAssigned / comparisonTotal * 100 : 0;
  const overWidth = comparisonTotal > 0 ? over / comparisonTotal * 100 : 0;
  const left = Math.max(0, assigned - spent);
  // Where spending would be today if it ran evenly through the month: a tick on the bar.
  const isCurrent = month === new Date().toISOString().slice(0, 7);
  const pacePct = isCurrent && comparisonTotal > 0 ? Math.min(100, monthProgress(month) * Math.max(assigned, 0) / comparisonTotal * 100) : null;
  const top = summary.spentByCategory.filter(entry => entry.total > 0).sort((a, b) => b.total - a.total).slice(0, 3);
  const topMax = top[0]?.total ?? 1;
  // One solid colour per wallet (bars never use a gradient): --select-color follows html[data-scope], ink for Joint.
  const fill = { "--budget-fill": "var(--select-color)" } as CSSProperties;
  return <section className="desktop-month-budget" aria-label={`${label} spending`} style={fill}>
    <CardHeader className="desktop-panel-heading" title={`${label} spending`} action={loading || error ? undefined : assigned > 0 && onOpenReceipt ? <button type="button" className="card-header-action" onClick={onOpenReceipt} aria-label={`View ${label}'s plan receipt`} title={`${label} plan`}><ReceiptIcon size={20} aria-hidden="true" /></button> : showPlanAction ? <CardHeaderAction disabled={!!summary.contributionError} title={summary.contributionError ? "Planning needs confirmed contributions" : undefined} onClick={onOpenPlan} aria-label="Open monthly planning">Plan</CardHeaderAction> : undefined} />
    {/* An unplanned month with no spending has nothing to measure: one EmptyState line instead of a big 0, "0 assigned" and an empty bar. */}
    {loading ? <SkeletonRows label="Loading monthly budget" count={3} /> : error ? <Banner tone="danger" role="alert" compact>Monthly budget unavailable. Refresh to try again.</Banner> : assigned <= 0 && spent <= 0 ? <EmptyState align="start">No plan or spending this month.</EmptyState> : <>
      <div className="desktop-budget-spent" data-over={over > 0 || undefined}>
        <strong><Money value={spent} subtleDecimals /></strong>
        <span>spent of <Money value={assigned} /> assigned{over > 0 ? null : <>, <b><Money value={left} /></b> left</>}</span>
      </div>
      <div className="desktop-budget-comparison">
        <div className="desktop-budget-comparison-track" role="img" aria-label={`${fmt(spent)} MAD spent against ${fmt(assigned)} MAD assigned${over > 0 ? `; ${fmt(over)} MAD above assigned` : ""}`}>
          <span className="desktop-budget-within" style={{ width: `${assignedWidth}%` }} />
          {over > 0 && <span className="desktop-budget-excess" style={{ width: `${overWidth}%` }} />}
          {pacePct != null && <span className="desktop-budget-pace" style={{ left: `${pacePct}%` }} aria-hidden="true" />}
        </div>
        {pacePct != null && <span className="desktop-budget-pace-label">The line marks an even pace for today</span>}
        {/* The sentence above already states the assigned total; only spending above it needs a mark on the bar. */}
        {over > 0 && <dl className="desktop-budget-comparison-labels">
          <div className="desktop-budget-over"><dt className="sr-only">Above assigned</dt><dd style={{ justifyContent: "flex-end" }}><span>+<Money value={over} subtleDecimals /> above assigned</span></dd></div>
        </dl>}
      </div>
      {/* Where it went: the three biggest categories, so the card says more than one number. */}
      {top.length > 0 && <div className="desktop-budget-where">
        <h3 className="desktop-budget-where-title">Most spent</h3>
        <ol className="desktop-budget-where-list">{top.map(entry => {
          const category = categories.find(c => c.id === entry.categoryId);
          return <li key={entry.categoryId}>
            <span className="desktop-budget-where-name"><CategoryIcon icon={category?.icon ?? null} categoryName={category?.name} size={18} />{category?.name ?? "Archived category"}</span>
            <strong><Money value={entry.total} /></strong>
            <span className="desktop-budget-where-track" aria-hidden="true"><span style={{ width: `${entry.total / topMax * 100}%` }} /></span>
          </li>;
        })}</ol>
      </div>}
    </>}
  </section>;
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
