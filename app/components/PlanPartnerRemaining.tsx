import { Money } from "./Money";
import type { BudgetScope } from "./app-types";
import { BUDGET_SCOPE_LABELS } from "./app-utils";
import type { PlanAmounts } from "./month-plan-capacity";

/** Couple view only: each partner's own view already leads with their Unassigned, and the other partner's isn't theirs to plan. */
export function PlanPartnerRemaining({ left, scope }: { left: PlanAmounts; scope: BudgetScope }) {
  if (scope !== "joint") return null;
  return <section className="plan-partner-remaining" aria-label="Unassigned by partner">
    <h3>Unassigned</h3>
    <dl>{(["anas", "salma"] as const).map(partner => <div key={partner}>
      <dt>{BUDGET_SCOPE_LABELS[partner]}</dt>
      <dd data-short={left[partner] < -0.005 || undefined}>{left[partner] < -0.005 ? <><Money value={Math.abs(left[partner])} /> <span className="plan-remaining-short">short</span></> : <Money value={Math.max(0, left[partner])} />}</dd>
    </div>)}</dl>
  </section>;
}
