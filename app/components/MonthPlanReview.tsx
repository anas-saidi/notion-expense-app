"use client";

import { useEffect, useRef } from "react";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";

type PlanChange = { id: string; name: string; icon: string | null; owner: string; before: number; after: number };

/** Review shares the planner's category rows and control styles. Paper belongs only to the saved receipt. */
export function MonthPlanReview({ items, onEdit }: { items: PlanChange[]; onEdit: () => void }) {
  const showOwners = new Set(items.map(item => item.owner)).size > 1;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: false }); }, []);
  return <>
    <div className="plan-desktop-heading">
      <h2 ref={heading} tabIndex={-1}>Review changes</h2>
      <button type="button" className="plan-copy plan-review-edit" onClick={onEdit}>Edit plan</button>
    </div>
    <div className="plan-table plan-review-table" role="table" aria-label="Monthly plan changes">
      <div className="plan-table-head plan-review-head" role="row">
        <span role="columnheader">Category</span><span role="columnheader">Saved</span><span role="columnheader">New plan</span>
      </div>
      {items.map(item => <div className="plan-table-row plan-review-row" role="row" key={item.id}>
        <div className="plan-category" role="cell">
          <CategoryIcon icon={item.icon} categoryName={item.name} size={32} />
          <span className="plan-category-name"><span>{item.name}</span>{showOwners && <small>{item.owner}</small>}</span>
        </div>
        <span role="cell" className="plan-review-before"><Money value={item.before} /></span>
        <span role="cell" className="plan-review-after"><Money value={item.after} /></span>
      </div>)}
    </div>
  </>;
}
