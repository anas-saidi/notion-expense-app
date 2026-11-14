"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { BudgetScope } from "../app-types";
import { MascotHero } from "../mascot/MascotHero";
import "./empty-state.css";

/**
 * The app's one empty state (design.md, Shared components, Empty and loading states): the data has loaded
 * and there is nothing to show. Never while loading (use the Skeleton family) and never for a failed read
 * (use a danger Banner with Retry).
 *
 *   <EmptyState>No bills due.</EmptyState>
 *   <EmptyState variant="screen" title="No spending yet" mascot
 *     action={<Button variant="quiet" size="compact" onClick={add}>Add expense</Button>}>
 *     Choose another period or add an expense.
 *   </EmptyState>
 *
 * `compact` (default): one quiet line inside a card, list, picker or sheet section.
 * `screen`: replaces a whole view's content: optional title, one line, one action, and optionally the
 * scope's mascot asleep above it (only where the screen shows no other mascot).
 */
export function EmptyState({
  variant = "compact",
  align = "center",
  title,
  children,
  action,
  mascot = false,
  scope,
  announce = false,
  minHeight,
  className,
  style,
}: {
  variant?: "compact" | "screen";
  /** "start" for left-aligned content such as desktop dashboard cards. */
  align?: "center" | "start";
  /** Screen only: a short heading that names what is missing ("No spending yet"). */
  title?: ReactNode;
  /** The factual line: "No {thing} {where or when}." or, after a search or filter, what did not match. */
  children?: ReactNode;
  /** At most one next step: a compact Button, quiet (Add expense, Reset filters) or secondary when it is the only way forward. */
  action?: ReactNode;
  /** Screen only: the scope's mascot with the sleep signal, for whole-screen empties that show no other mascot. */
  mascot?: boolean;
  /** Mascot shape; defaults to the app-wide scope on `html[data-scope]`. */
  scope?: BudgetScope;
  /** role="status": set when the empty state appears in response to typing or filtering, so it is announced. */
  announce?: boolean;
  /** Keep the loaded content's footprint so the swap from a skeleton does not shift the layout. */
  minHeight?: number | string;
  className?: string;
  /** Layout only (margin, grid placement). */
  style?: CSSProperties;
}) {
  const showMascot = variant === "screen" && mascot;
  return (
    <div
      className={["ui-empty", className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-align={align}
      role={announce ? "status" : undefined}
      style={minHeight != null ? { minHeight, ...style } : style}
    >
      {showMascot && <SleepingMascot scope={scope} />}
      {variant === "screen" && title && <h2 className="ui-empty-title">{title}</h2>}
      {children && <p className="ui-empty-text">{children}</p>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  );
}

const EMPTY_MASCOT_SIZE = 72;

function SleepingMascot({ scope }: { scope?: BudgetScope }) {
  // The scope is read after mount, so server and client render the same first frame.
  const [shape, setShape] = useState<BudgetScope | null>(scope ?? null);
  useEffect(() => {
    if (scope) { setShape(scope); return; }
    const value = document.documentElement.dataset.scope;
    setShape(value === "anas" || value === "salma" ? value : "joint");
  }, [scope]);
  return (
    <div className="ui-empty-mascot" aria-hidden="true" style={{ width: EMPTY_MASCOT_SIZE, height: EMPTY_MASCOT_SIZE }}>
      {shape && <MascotHero look="light" variant="pool" scope={shape} level={0} spentPct={null} remember={false} size={EMPTY_MASCOT_SIZE} signal={{ kind: "sleep" }} />}
    </div>
  );
}
