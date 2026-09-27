import type { CategoryJarState } from "./mascot/CategoryJar";

/**
 * One metaphor across the app: a jar holds the money that's in it. Budget jars drain
 * as you spend (that's the plan working, not a warning); savings jars fill as you
 * save. The level says how much is there; the colour says how you're doing, which
 * means comparing what's left with how much of the month is left.
 */

/** A budget can only be "spending fast" once less than this share is left… */
export const LOW_FROM = 0.2;
/** …and it's at least this far behind the calendar (so lumpy bills don't trip it). */
export const PACE_MARGIN = 0.1;

/** How far through `month` ("YYYY-MM") `now` is, 0–1: 1 for past months, 0 for future ones. */
export function monthProgress(month: string, now = new Date()): number {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1).getTime();
  const end = new Date(y, m, 1).getTime();
  return Math.max(0, Math.min(1, (now.getTime() - start) / (end - start)));
}

export type Pace = "good" | "low" | "over";

/**
 * How a pot of money is doing against the calendar. `left` is the share still left
 * (below zero when overspent); `progress` is how far through the month we are.
 */
export function pace(left: number, progress: number): Pace {
  if (left < 0) return "over";
  return left < LOW_FROM && left < 1 - progress - PACE_MARGIN ? "low" : "good";
}

export type BudgetStatus = {
  /** What the jar shows. */
  state: CategoryJarState;
  /** Share of the category's money still left, 0–1 (the jar's liquid). */
  level: number;
  /** Draining faster than the month: little left and behind the calendar. */
  low: boolean;
  /** The one number the row shows. */
  amount: number;
};

/**
 * How a budget category is doing, one rule for every place that shows it:
 * over = below zero · empty = spent to exactly zero (used as planned, not a warning) ·
 * unfunded = never had money · low = spending faster than the month · otherwise good.
 *
 * This month: `available` is the live figure (carry-over included) and the level
 * is Available over (spent + Available). A past month has no live Available, so it
 * uses what was left of that month's plan.
 */
export function budgetStatus({ available, spent, planned, past = false, progress = past ? 1 : 0 }: {
  available: number | null;
  spent: number;
  planned: number;
  past?: boolean;
  /** How far through the month we are (see monthProgress). */
  progress?: number;
}): BudgetStatus {
  const left = past ? planned - spent : available ?? 0;
  const round = (n: number) => Math.round(n);
  if (round(left) < 0) return { state: "over", level: 0, low: false, amount: left };
  if (round(left) === 0) {
    const state = round(spent) > 0 ? "empty" : "unfunded";
    return { state, level: 0, low: false, amount: 0 };
  }
  const level = left / Math.max(1, left + Math.max(0, spent));
  return { state: "normal", level, low: pace(level, progress) === "low", amount: left };
}

/** Rows that need attention first: overspent, then low, then ones with money, then empty and unfunded. */
export function budgetStatusRank(status: BudgetStatus): number {
  if (status.state === "over") return 0;
  if (status.low) return 1;
  if (status.state === "normal") return 2;
  return status.state === "empty" ? 3 : 4;
}
