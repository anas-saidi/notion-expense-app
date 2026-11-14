import { pace } from "./category-status";

/**
 * The light is the mood of the hero number (design.md, Light): bright when the number is where it
 * should be by today, dim when it needs you, coral (warn "over") when something is wrong.
 * `level` is 0 to 1 for the light's strength; `warn` tints it (honey "low", coral "over").
 * Null means there is nothing to judge (no plan): the light rests at a neutral strength.
 */
export type LightMood = { level: number; warn: "low" | "over" | null };

/** Steady light: a number exactly where it should be. Bright is above this, dim below. */
export const STEADY = 0.7;
const FLOOR = 0.15;
const clamp = (value: number) => Math.max(FLOOR, Math.min(1, value));

/**
 * Home, personal: Left to spend against the calendar. `left` is what the spending categories still
 * hold (carry-over included), `spent` is this month's spending, `progress` how far through the month.
 * On pace is steady; more left than the days ahead need is brighter; spending faster is dimmer.
 */
export function spendingMood(left: number, spent: number, progress: number): LightMood | null {
  const base = left + Math.max(0, spent);
  if (base <= 0 && left >= 0) return null;
  if (left < 0) return { level: FLOOR, warn: "over" };
  const share = left / base;
  const expected = Math.max(0.05, 1 - progress);
  const status = pace(share, progress);
  return { level: clamp(STEADY * (share / expected)), warn: status === "good" ? null : status };
}

/** Couple: one partner's contribution this month, paid against what they agreed. */
export function contributionMood(paid: number, plan: number): LightMood {
  if (plan <= 0) return { level: 1, warn: null };
  return { level: clamp(paid / plan), warn: null };
}

/**
 * Budget: To assign. Everything placed is bright; money waiting to be assigned dims the light in
 * proportion; over-assigned (below zero) is coral.
 */
export function planningMood(assigned: number, toAssign: number): LightMood | null {
  if (toAssign < -0.5) return { level: FLOOR, warn: "over" };
  const waiting = Math.max(0, toAssign);
  const base = Math.max(0, assigned) + waiting;
  if (base <= 0) return null;
  return { level: waiting < 0.5 ? 1 : clamp(Math.max(0, assigned) / base), warn: null };
}

/**
 * Reflect: did the period keep to its plan. Within plan everywhere is bright; categories that went
 * over only dim it, by how much they went over (no tint: the summary names them); a total over the plan is coral.
 */
export function planKeptMood(planned: number, spent: number, overInCategories: number): LightMood | null {
  if (planned <= 0) return null;
  if (spent > planned + 0.5) return { level: FLOOR, warn: "over" };
  if (overInCategories < 0.5) return { level: 1, warn: null };
  return { level: clamp(STEADY * (1 - overInCategories / planned)), warn: null };
}
