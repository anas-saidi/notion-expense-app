"use client";
import type { CSSProperties } from "react";
import type { BudgetScope } from "../app-types";
import { Mascot } from "./Mascot";
import type { JarItem } from "./coinSimMatter";
import type { MascotTarget } from "./engine";
import { deriveTarget, useBalanceReaction } from "./mood";
import { useReducedMotion } from "motion/react";
import { useRememberedJar } from "./memory";

/**
 * Hero size: the jar (about two thirds of this box) carries the same visual
 * weight as the screen's main number, so the two read as one hero, not as a
 * number with a sticker.
 */
export const MASCOT_HERO_SIZE = 175;

type Common = {
  scope: BudgetScope;
  /** Spent ÷ planned this month, in %, for the face; null without a plan. */
  spentPct: number | null;
  /** Unassigned money in the scope: the face gets curious about it. */
  unassigned?: number;
  /** Extra sideways look in degrees (negative = left), e.g. towards whoever owes the most. */
  lookYaw?: number;
  /** Box size in px; defaults to MASCOT_HERO_SIZE. */
  size?: number;
  style?: CSSProperties;
};

export type MascotHeroProps =
  /** Pool: the liquid level is a share (0–1), e.g. what's left of the month's plan. */
  | (Common & { variant: "pool"; level: number; balance?: number | null; available?: number; items?: JarItem[] })
  /** Split: one category emoji per category, sized by share of the budget. */
  | (Common & { variant: "split"; items: JarItem[] });

/**
 * The mascot as a screen's hero, centred with and sized like the main number.
 * Two variants so far: "pool" (how much is left) and "split" (where it goes).
 * The shape always follows the scope; the mascot is decorative, so the same
 * facts are stated in text next to it.
 */
export function MascotHero(props: MascotHeroProps) {
  // Each scope's jar has its own memory of what it last showed, so it starts fresh.
  return <HeroJar key={props.scope} {...props} />;
}

/**
 * Opening a screen doesn't replay an entrance: the jar starts as it was last
 * seen on this device and animates only what changed since (new emojis drop
 * in, removed ones fade, the pool eases from its old level). The very first
 * time, the emoji jar fills once as a welcome. Reduce Motion always starts settled.
 */
function HeroJar(props: MascotHeroProps) {
  const { scope, spentPct, unassigned = 0, lookYaw, size = MASCOT_HERO_SIZE, style } = props;
  const pool = props.variant === "pool";
  const animate = !useReducedMotion();
  const level = pool ? Math.round(Math.max(0, Math.min(1, props.level)) * 1000) / 1000 : 0;
  const shownLevel = useRememberedJar(pool ? `pool:${scope}` : null, "level", level, animate);
  const shownItems = useRememberedJar(pool ? null : `split-v2:${scope}`, "items", pool ? EMPTY : props.items, animate);
  // A pool always carries a (usually empty) pile, so showing what's in it never rebuilds the jar.
  const poolItems = pool ? props.items ?? EMPTY : EMPTY;
  // Balance changes only matter for the pool; a stable null keeps the hook quiet otherwise.
  const reaction = useBalanceReaction(pool ? props.balance ?? null : null, scope, pool ? props.available ?? 0 : 0);
  const base = { ...deriveTarget({ scope, fundingGap: 0, spentPct, unassigned, loading: false }), lookYaw };
  const target: MascotTarget = pool
    ? { ...base, outline: "partner", fill: shownLevel, items: poolItems }
    : { ...base, outline: "partner", items: shownItems };
  return <Mascot target={target} warnWhenLow={pool} reaction={pool ? reaction : null} size={size} style={{ margin: "0 auto", ...style }} />;
}

const EMPTY: JarItem[] = [];
