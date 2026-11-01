import { Money } from "./Money";
import type { BudgetScope } from "./app-types";
import type { PlanAmounts } from "./month-plan-capacity";

export function PlanPartnerRemaining({ left, scope }: { left: PlanAmounts; scope: BudgetScope }) {
  return <section className="plan-partner-remaining" aria-label="Remaining to assign by partner">
    <h3>Remaining to assign</h3>
    <dl>{(["anas", "salma"] as const).filter(partner => scope === "joint" || partner !== scope).map(partner => <div key={partner}>
      <dt>{partner === "anas" ? "Anas" : "Salma"}</dt>
      <dd data-short={left[partner] < -0.005 || undefined}>{left[partner] < -0.005 ? <><Money value={Math.abs(left[partner])} /> <span className="plan-remaining-short">short</span></> : <Money value={Math.max(0, left[partner])} />}</dd>
    </div>)}</dl>
  </section>;
}
