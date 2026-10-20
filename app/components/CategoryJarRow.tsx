"use client";

import type { CSSProperties } from "react";
import type { BudgetScope, Category } from "./app-types";
import { fmt } from "./app-utils";
import { runwayLabel } from "./category-runway";
import type { BudgetStatus } from "./category-status";
import { CategoryJar } from "./mascot/CategoryJar";

/**
 * One category on the Budget tab: its jar (what's left, in the status palette),
 * the name, one quiet line only when it says something, and the one number.
 * Rows sit flat on a shared section surface; tapping opens the category.
 * On desktop the row becomes a table row: Budgeted and Spent columns appear (CSS).
 */
export function BudgetJarRow({ cat, scope, status, runwayDays, planned, spent, onOpen }: {
  cat: Category;
  scope: BudgetScope;
  status: BudgetStatus;
  runwayDays?: number;
  planned: number;
  spent: number;
  onOpen: () => void;
}) {
  const { state, low, amount, level } = status;
  const line = state === "over" ? { text: "Overspent", color: "var(--status-over)", strong: true }
    : low ? { text: runwayDays == null ? "Running low" : runwayLabel(runwayDays), color: "var(--status-low)", strong: false }
    : state === "normal" && Math.round(spent) > 0 ? { text: `${fmt(Math.round(spent))} spent`, color: "var(--muted)", strong: false, spentOnly: true }
    : null;
  const amountColor = state === "over" ? "var(--status-over)" : low ? "var(--status-low)" : state === "normal" ? "var(--text2)" : "var(--muted)";
  return (
    <button type="button" onClick={onOpen} className="budget-row" style={rowStyle} aria-label={`${cat.name}, ${fmt(Math.round(amount))} MAD${line ? `, ${line.text}` : state === "empty" ? ", all spent" : state === "unfunded" ? ", not funded" : ""}`}>
      <CategoryJar scope={scope} level={level} state={state} low={low} icon={cat.icon} />
      <span style={textStyle}>
        <span style={nameStyle}>{cat.name}</span>
        {/* "X spent" repeats the desktop Spent column, so it hides there. */}
        {line && <span className={"spentOnly" in line ? "budget-row-spent-line" : undefined} style={{ ...lineStyle, color: line.color, fontWeight: line.strong ? 600 : 500 }}>{line.text}</span>}
      </span>
      <TableCols planned={planned} spent={spent} />
      <span style={{ ...amountStyle, color: amountColor }}>{Math.round(amount) < 0 ? "−" : ""}{fmt(Math.abs(Math.round(amount)))}</span>
    </button>
  );
}

/** A savings category: its jar fills up towards the goal instead of emptying. */
export function SavingsJarRow({ cat, scope, available, planned, spent, onOpen }: {
  cat: Category;
  scope: BudgetScope;
  available: number;
  planned: number;
  spent: number;
  onOpen: () => void;
}) {
  const saved = Math.max(0, available);
  const goal = Math.max(0, cat.goal ?? 0);
  const reached = goal > 0 && saved >= goal;
  const pct = goal > 0 ? Math.min(1, saved / goal) : 0;
  const when = goalLabel(cat.goalDate);
  const line = goal > 0
    ? reached ? "Goal reached" : `${Math.floor(pct * 100)}% of ${fmt(Math.round(goal))}${when ? ` ${when}` : ""}`
    : Math.round(planned) > 0 ? `+${fmt(Math.round(planned))} this month`
    : Math.round(spent) > 0 ? `${fmt(Math.round(spent))} used`
    : null;
  // Without a goal the jar just shows there's money in it: a still, soft level.
  const level = goal > 0 ? pct : saved > 0 ? 0.5 : 0;
  return (
    <button type="button" onClick={onOpen} className="budget-row" style={rowStyle} aria-label={`${cat.name}, savings, ${fmt(Math.round(saved))} MAD${line ? `, ${line}` : ""}`}>
      <CategoryJar scope={scope} level={level} state={saved > 0 ? "normal" : "unfunded"} kind="savings" icon={cat.icon} />
      <span style={textStyle}>
        <span style={nameStyle}>{cat.name}</span>
        {line && <span style={{ ...lineStyle, color: reached ? "var(--status-good)" : "var(--muted)", fontWeight: reached ? 600 : 500 }}>{line}</span>}
      </span>
      <TableCols planned={planned} spent={spent} />
      <span style={{ ...amountStyle, color: "var(--text2)" }}>{fmt(Math.round(saved))}</span>
    </button>
  );
}

/** Desktop-only Budgeted / Spent cells; hidden on mobile by `.budget-col`. */
function TableCols({ planned, spent }: { planned: number; spent: number }) {
  return (
    <>
      <span className="budget-col" aria-hidden="true">{fmt(Math.round(planned))}</span>
      <span className="budget-col" aria-hidden="true">{fmt(Math.round(spent))}</span>
    </>
  );
}

/** "by Dec 2026" for a future goal date, "due Dec 2025" once it has passed. */
function goalLabel(date: string | null | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}/.test(date)) return null;
  const [year, month] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
  return date.slice(0, 7) < new Date().toISOString().slice(0, 7) ? `due ${label}` : `by ${label}`;
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minHeight: 76,
  padding: "8px 14px 8px 10px",
  border: "none",
  background: "transparent",
  width: "100%",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  color: "inherit",
  textAlign: "left",
};
const textStyle: CSSProperties = { display: "grid", gap: 2, flex: 1, minWidth: 0 };
const nameStyle: CSSProperties = { fontSize: 15, fontWeight: 700, color: "var(--text)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" };
const lineStyle: CSSProperties = { fontSize: 12, fontVariantNumeric: "tabular-nums" };
const amountStyle: CSSProperties = { fontSize: 17, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums", flexShrink: 0 };
