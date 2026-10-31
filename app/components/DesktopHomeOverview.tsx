import type { Category, MonthlySummary } from "./app-types";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SkeletonRows } from "./ui/Skeleton";
import { ChevronRightIcon } from "./ui/icons";
import { fmt } from "./app-utils";

type Props = { summary: MonthlySummary; available: number; month: string; loading: boolean; error: boolean; onOpenPlan: () => void };

/** Desktop groups the existing monthly facts beside cash, without treating
 * assignments minus spending as a spendable account balance. */
export function DesktopMonthBudget({ summary, available, month, loading, error, onOpenPlan }: Props) {
  const label = new Date(`${month}-01T12:00:00`).toLocaleDateString("en", { month: "long" });
  const assigned = summary.totalAssigned;
  const spent = summary.totalSpent;
  const over = Math.max(0, Math.round((spent - assigned) * 100) / 100);
  const ratio = assigned > 0 ? Math.min(100, Math.max(0, spent / assigned * 100)) : 0;
  return <section className="desktop-month-budget" aria-label={`${label} budget`}>
    <div className="desktop-panel-heading"><h2>{label} budget</h2><button type="button" onClick={onOpenPlan} aria-label="Open monthly planning">Plan<ChevronRightIcon size={16} /></button></div>
    {loading ? <SkeletonRows label="Loading monthly budget" count={3} /> : error ? <p className="desktop-empty">Monthly budget unavailable. Refresh to try again.</p> : <>
      <div className="desktop-budget-spent"><span>Spent this month</span><strong><Money value={spent} /></strong></div>
      <div className="desktop-budget-track" role="meter" aria-label="Monthly spending against assignments" aria-valuemin={0} aria-valuemax={Math.max(assigned, 1)} aria-valuenow={Math.min(spent, Math.max(assigned, 1))} aria-valuetext={`${fmt(spent)} MAD spent against ${fmt(assigned)} MAD assigned`}><span data-over={over > 0 || undefined} style={{ width: `${ratio}%` }} /></div>
      <dl className="desktop-budget-facts"><div><dt>Assigned</dt><dd><Money value={assigned} /></dd></div><div><dt>Available in categories</dt><dd><Money value={available} /></dd></div>{over > 0 && <div className="desktop-budget-over"><dt>Above monthly assignments</dt><dd><Money value={over} /></dd></div>}</dl>
    </>}
  </section>;
}

export function DesktopTopSpending({ summary, categories, loading, error }: { summary: MonthlySummary; categories: Category[]; loading: boolean; error: boolean }) {
  const entries = summary.spentByCategory.filter(e => e.total > 0).sort((a, b) => b.total - a.total).slice(0, 4);
  const maximum = entries[0]?.total ?? 1;
  return <section className="desktop-top-spending" aria-label="Top spending categories">
    <div className="desktop-panel-heading"><h2>Top spending</h2></div>
    {loading ? <SkeletonRows label="Loading spending categories" count={3} /> : error ? <p className="desktop-empty">Spending unavailable</p> : !entries.length ? <p className="desktop-empty">No spending recorded this month.</p> : <ol className="desktop-spending-list">{entries.map(entry => {
      const category = categories.find(c => c.id === entry.categoryId);
      return <li key={entry.categoryId}><div className="desktop-spending-label"><CategoryIcon icon={category?.icon ?? null} size={20} /><span>{category?.name ?? "Archived category"}</span></div><strong><Money value={entry.total} /></strong><span className="desktop-spending-track" aria-hidden="true"><span style={{ width: `${entry.total / maximum * 100}%` }} /></span></li>;
    })}</ol>}
  </section>;
}
