"use client";

import { useEffect, useRef } from "react";
import { Money } from "./Money";
import { BUDGET_SCOPE_LABELS } from "./app-utils";
import type { BudgetScope } from "./app-types";
import type { PlanReceipt } from "./month-plan-receipt";
import { Banner } from "./ui/Banner";
import "./month-plan-receipt.css";

export function MonthPlanReceipt({ receipt, onDone, onReview }: { receipt: PlanReceipt; onDone: () => void; onReview: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);
  const [year, month] = receipt.month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  const showOwners = Object.values(receipt.wallets).filter(amount => amount > 0).length > 1;
  const top = receipt.items.slice(0, 4);
  const remaining = receipt.items.slice(4);
  return <section className="plan-receipt-confirmation">
    <header className="plan-receipt-heading">
      <h2 ref={title} tabIndex={-1}>Plan saved</h2>
    </header>
    <div className="plan-receipt-printer">
      <div className="plan-receipt-slot" aria-hidden="true" />
      <div className="plan-receipt-feed">
        <article className="plan-receipt-paper" aria-label={`${label} saved plan`}>
          <header><p>Monthly plan</p><h3>{label}</h3></header>
          <dl className="plan-receipt-lines">
            {top.map(item => <div key={item.id}><dt>{item.name}{showOwners && <small>{BUDGET_SCOPE_LABELS[item.scope]}</small>}</dt><dd><Money value={item.amount} /></dd></div>)}
            {remaining.length > 0 && <div><dt>{remaining.length} other {remaining.length === 1 ? "category" : "categories"}</dt><dd><Money value={remaining.reduce((sum, item) => sum + item.amount, 0)} /></dd></div>}
          </dl>
          <div className="plan-receipt-total"><span>Total planned</span><strong><Money value={receipt.total} currency /></strong></div>
          <dl className="plan-receipt-lines plan-receipt-wallets">
            {(["joint", "anas", "salma"] as BudgetScope[]).filter(scope => receipt.wallets[scope] > 0).map(scope => <div key={scope}><dt>{BUDGET_SCOPE_LABELS[scope]}</dt><dd><Money value={receipt.wallets[scope]} /></dd></div>)}
          </dl>
          {receipt.contributions && <section className="plan-receipt-contributions" aria-label="Agreed contributions">
            <h4>Agreed contributions</h4>
            <dl className="plan-receipt-lines">
              {(["anas", "salma"] as const).map(partner => <div key={partner}><dt>{BUDGET_SCOPE_LABELS[partner]}</dt><dd><Money value={receipt.contributions![partner]} /></dd></div>)}
            </dl>
          </section>}
          <footer>One month, together.</footer>
        </article>
      </div>
    </div>
    {receipt.warning && <Banner role="alert" tone="warning" compact>{receipt.warning}</Banner>}
    <div className="plan-receipt-actions">
      <button type="button" className="plan-primary" onClick={onDone}>Done</button>
      <button type="button" className="plan-receipt-review" onClick={onReview}>{receipt.warning ? "Set monthly contributions" : "Back to plan"}</button>
    </div>
  </section>;
}
