"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";

/**
 * The app's narrative summary (design.md, "Summary sentence"): connecting words stay muted and
 * each fact is in full ink with a small inline icon. The tappable fact is the problem to resolve ("516 off"), not its name.
 */
export function Summary({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p className="summary" style={style}>{children}</p>;
}

/** `tone` colours a number or state only: danger = already wrong, warning = needs attention soon, success = good news. */
export function Fact({ icon, onClick, label, tone, children }: { icon?: ReactNode; onClick?: () => void; label?: string; tone?: "danger" | "warning" | "success"; children: ReactNode }) {
  const body = <>{icon && <span className="summary-fact-icon" aria-hidden="true">{icon}</span>}{children}</>;
  return onClick
    ? <button type="button" className="summary-fact" data-action data-tone={tone} onClick={onClick} aria-label={label}>{body}</button>
    : <strong className="summary-fact" data-tone={tone}>{body}</strong>;
}

/** "a", "a and b", "a, b and c" */
export function joinClauses(clauses: ReactNode[]): ReactNode {
  return clauses.map((clause, index) => <Fragment key={index}>
    {index === 0 ? "" : index === clauses.length - 1 ? " and " : ", "}{clause}
  </Fragment>);
}
