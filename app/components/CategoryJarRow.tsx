"use client";
import { categoryIconSource } from "../../lib/category-icons";

import { useId, type CSSProperties } from "react";
import type { BudgetScope, Category } from "./app-types";
import { fmt, fmtDate } from "./app-utils";
import { MascotSignal, useOnceSignal } from "./mascot/MascotSignal";
import { runwayLabel } from "./category-runway";
import type { BudgetStatus } from "./category-status";
import type { CategoryJarState } from "./mascot/CategoryJar";
import { CategoryIcon } from "./ui/CategoryIcon";

/**
 * One category on the Budget tab: its artwork (fading with remaining funds),
 * the name, one quiet line only when it says something, and the one number.
 * Rows sit flat on a shared section surface; tapping opens the category.
 * On desktop the row becomes a table row: Budgeted and Spent columns appear (CSS).
 */
export function BudgetJarRow({ cat, scope, status, runwayDays, planned, spent, billShort, onOpen }: {
  cat: Category;
  scope: BudgetScope;
  status: BudgetStatus;
  runwayDays?: number;
  planned: number;
  spent: number;
  /** A bill due within a week this category can't cover: a red dot on the art and its own line. */
  billShort?: { name: string; dueDate: string; short: number };
  onOpen: () => void;
}) {
  const { state, low, amount, level } = status;
  const line = billShort ? { text: `${billShort.name} due ${fmtDate(billShort.dueDate)}, ${fmt(Math.ceil(billShort.short - 0.005))} short`, color: "var(--danger)", strong: true }
    : state === "over" ? { text: "Overspent", color: "var(--status-over)", strong: true }
    : low ? { text: runwayDays == null ? "Running low" : runwayLabel(runwayDays), color: "var(--status-low)", strong: false }
    : state === "normal" && Math.round(spent) > 0 ? { text: `${fmt(Math.round(spent))} spent`, color: "var(--muted)", strong: false, spentOnly: true }
    : null;
  const amountColor = state === "over" ? "var(--status-over)" : low ? "var(--status-low)" : state === "normal" ? "var(--text2)" : "var(--muted)";
  return (
    <button type="button" onClick={onOpen} className="budget-row" style={rowStyle} aria-label={`${cat.name}, ${fmt(Math.round(amount))} MAD${line ? `, ${line.text}` : state === "empty" ? ", all spent" : state === "unfunded" ? ", not funded" : ""}`}>
      <BudgetCategoryArtwork level={level} state={state} icon={categoryIconSource(cat.icon, cat.name)} dot={!!billShort} />
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

/** Savings artwork gains clarity as the goal fills. */
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
  // A goal that missed its date gets its own line, in the colour for money that's short.
  const pastDue = goal > 0 && !reached && when?.past ? `Past due · ${when.label}` : null;
  // Reaching a goal bursts once on this device (per goal amount), the next time the row is seen.
  const burst = useOnceSignal(`goal:${cat.id}:${Math.round(goal)}`, reached, "burst");
  const line = goal > 0
    ? reached ? "Goal reached" : `${Math.floor(pct * 100)}% of ${fmt(Math.round(goal))}${when && !when.past ? ` by ${when.label}` : ""}`
    : Math.round(planned) > 0 ? `+${fmt(Math.round(planned))} this month`
    : Math.round(spent) > 0 ? `${fmt(Math.round(spent))} used`
    : null;
  // Without a goal, keep funded artwork clear.
  const level = goal > 0 ? pct : saved > 0 ? 1 : 0;
  return (
    <button type="button" onClick={onOpen} className="budget-row" style={rowStyle} aria-label={`${cat.name}, savings, ${fmt(Math.round(saved))} MAD${line ? `, ${line}` : ""}${pastDue ? `, goal past due since ${when!.label}` : ""}`}>
      <BudgetCategoryArtwork level={level} state={saved > 0 ? "normal" : "unfunded"} icon={categoryIconSource(cat.icon, cat.name)} burst={burst?.kind === "burst" ? { kind: "burst", id: burst.id } : null} />
      <span style={textStyle}>
        <span style={nameStyle}>{cat.name}</span>
        {line && <span style={{ ...lineStyle, color: reached ? "var(--status-good)" : "var(--muted)", fontWeight: reached ? 600 : 500 }}>{line}</span>}
        {pastDue && <span style={{ ...lineStyle, color: "var(--danger)", fontWeight: 600 }}>{pastDue}</span>}
      </span>
      <TableCols planned={planned} spent={spent} />
      <span style={{ ...amountStyle, color: "var(--text2)" }}>{fmt(Math.round(saved))}</span>
    </button>
  );
}

/** Large, uncontained artwork. Fading never implies the row is disabled. */
function BudgetCategoryArtwork({ icon, level, state, dot = false, burst = null }: { icon: string; level: number; state: CategoryJarState; dot?: boolean; burst?: { kind: "burst"; id: number } | null }) {
  const tintId = `budget-art-${useId().replace(/:/g, "")}`;
  const overspent = state === "over";
  const opacity = overspent ? 1 : 0.6 + 0.4 * Math.max(0, Math.min(1, level));
  return <span aria-hidden="true" style={{ position: "relative", display: "inline-flex", flexShrink: 0, width: 60, height: 60 }}>
    {overspent && <svg width="0" height="0" style={{ position: "absolute" }}><defs>
      <filter id={tintId} colorInterpolationFilters="sRGB">
        <feFlood floodColor="var(--status-over)" floodOpacity="0.3" />
        <feComposite in2="SourceGraphic" operator="in" />
        <feBlend in2="SourceGraphic" mode="normal" />
      </filter>
    </defs></svg>}
    {/* The same signal language as the jars: a dot when it needs you, a burst when a goal is reached. */}
    <MascotSignal signal={dot ? "dot" : null} tone="danger" once={burst}>
      <CategoryIcon icon={icon} size={60} style={{ opacity, filter: overspent ? `url(#${tintId})` : undefined }} />
    </MascotSignal>
  </span>;
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

/** The goal month ("Dec 2026") and whether that month has already ended. */
function goalLabel(date: string | null | undefined): { label: string; past: boolean } | null {
  if (!date || !/^\d{4}-\d{2}/.test(date)) return null;
  const [year, month] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
  return { label, past: date.slice(0, 7) < new Date().toISOString().slice(0, 7) };
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minHeight: 76,
  padding: "8px 24px 8px 10px",
  border: "none",
  background: "transparent",
  width: "100%",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  color: "inherit",
  textAlign: "left",
};
const textStyle: CSSProperties = { display: "grid", gap: 2, flex: 1, minWidth: 0 };
const nameStyle: CSSProperties = { fontSize: 15, fontWeight: 500, color: "var(--text)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" };
const lineStyle: CSSProperties = { fontSize: 12, fontVariantNumeric: "tabular-nums" };
const amountStyle: CSSProperties = { fontSize: 17, fontWeight: 600, lineHeight: 1, fontVariantNumeric: "tabular-nums", flexShrink: 0 };
