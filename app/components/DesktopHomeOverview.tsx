import type { Category, MonthlySummary } from "./app-types";
import { CardHeader, CardHeaderAction } from "./ui/CardHeader";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SkeletonRows } from "./ui/Skeleton";
import { fmt } from "./app-utils";
import { ReceiptIcon } from "./ui/icons";

type Props = { summary: MonthlySummary; month: string; loading: boolean; error: boolean; showPlanAction?: boolean; onOpenPlan: () => void; onOpenReceipt?: () => void };

/** Desktop groups the existing monthly facts beside cash, without treating
 * assignments minus spending as a spendable account balance. */
export function DesktopMonthBudget({ summary, month, loading, error, showPlanAction = true, onOpenPlan, onOpenReceipt }: Props) {
  const label = new Date(`${month}-01T12:00:00`).toLocaleDateString("en", { month: "long" });
  const assigned = summary.totalAssigned;
  const spent = summary.totalSpent;
  const over = Math.max(0, Math.round((spent - assigned) * 100) / 100);
  const withinAssigned = Math.min(Math.max(spent, 0), Math.max(assigned, 0));
  const comparisonTotal = Math.max(assigned, withinAssigned + over, 0);
  const assignedWidth = comparisonTotal > 0 ? withinAssigned / comparisonTotal * 100 : 0;
  const overWidth = comparisonTotal > 0 ? over / comparisonTotal * 100 : 0;
  return <section className="desktop-month-budget" aria-label={`${label} spending`}>
    <CardHeader className="desktop-panel-heading" title={`${label} spending`} action={loading || error ? undefined : assigned > 0 && onOpenReceipt ? <button type="button" className="card-header-action" onClick={onOpenReceipt} aria-label={`View ${label}'s plan receipt`} title={`${label} plan`}><ReceiptIcon size={18} aria-hidden="true" /></button> : showPlanAction ? <CardHeaderAction disabled={!!summary.contributionError} title={summary.contributionError ? "Planning needs confirmed contributions" : undefined} onClick={onOpenPlan} aria-label="Open monthly planning">Plan</CardHeaderAction> : undefined} />
    {/* An unplanned month with no spending has nothing to measure: one quiet line instead of a big 0, "0 assigned" and an empty bar. */}
    {loading ? <SkeletonRows label="Loading monthly budget" count={3} /> : error ? <p className="desktop-empty">Monthly budget unavailable. Refresh to try again.</p> : assigned <= 0 && spent <= 0 ? <p className="desktop-empty">Nothing planned or spent yet.</p> : <>
      <div className="desktop-budget-spent" data-over={over > 0 || undefined}><strong><Money value={spent} subtleDecimals /></strong></div>
      <div className="desktop-budget-comparison">
        <div className="desktop-budget-comparison-track" role="img" aria-label={`${fmt(spent)} MAD spent against ${fmt(assigned)} MAD assigned${over > 0 ? `; ${fmt(over)} MAD above assigned` : ""}`}>
          <span className="desktop-budget-within" style={{ width: `${assignedWidth}%` }} />
          {over > 0 && <span className="desktop-budget-excess" style={{ width: `${overWidth}%` }} />}
        </div>
        <dl className="desktop-budget-comparison-labels" style={over > 0 ? { gridTemplateColumns: `${Math.min(72, Math.max(35, assignedWidth))}fr ${100 - Math.min(72, Math.max(35, assignedWidth))}fr` } : undefined}>
          <div><dt className="sr-only">Assigned</dt><dd><Money value={assigned} subtleDecimals /><span className="desktop-budget-assigned-label" aria-hidden="true">assigned</span></dd></div>
          {over > 0 && <div className="desktop-budget-over"><dt className="sr-only">Above assigned</dt><dd><span>+<Money value={over} subtleDecimals /></span></dd></div>}
        </dl>
      </div>
    </>}
  </section>;
}

export function DesktopTopSpending({ summary, categories, loading, error }: { summary: MonthlySummary; categories: Category[]; loading: boolean; error: boolean }) {
  const entries = summary.spentByCategory.filter(e => e.total > 0).sort((a, b) => b.total - a.total).slice(0, 4);
  const maximum = entries[0]?.total ?? 1;
  return <section className="desktop-top-spending" aria-label="Top spending categories">
    <CardHeader className="desktop-panel-heading" title="Top spending" />
    {loading ? <SkeletonRows label="Loading spending categories" count={3} /> : error ? <p className="desktop-empty">Spending unavailable</p> : !entries.length ? <p className="desktop-empty">No spending recorded this month.</p> : <ol className="desktop-spending-list">{entries.map(entry => {
      const category = categories.find(c => c.id === entry.categoryId);
      return <li key={entry.categoryId}><div className="desktop-spending-label"><CategoryIcon icon={category?.icon ?? null} categoryName={category?.name} size={20} /><span>{category?.name ?? "Archived category"}</span></div><strong><Money value={entry.total} /></strong><span className="desktop-spending-track" aria-hidden="true"><span style={{ width: `${entry.total / maximum * 100}%` }} /></span></li>;
    })}</ol>}
  </section>;
}
