"use client";
import type { CSSProperties, ReactNode } from "react";
import type { BudgetScope } from "../app-types";
import { Mascot } from "./Mascot";
import type { JarItem } from "./coinSimMatter";
import type { MascotTarget } from "./engine";
import type { Mood } from "./poses";
import { deriveTarget, useBalanceReaction } from "./mood";
import { useReducedMotion } from "motion/react";
import { useRememberedJar } from "./memory";

/**
 * Hero size: the jar (about two thirds of this box) carries the same visual
 * weight as the screen's main number, so the two read as one hero, not as a
 * number with a sticker.
 */
export { SCREEN_HERO_MASCOT_SIZE as MASCOT_HERO_SIZE } from "../ui/hero-tokens";
import { SCREEN_HERO_MASCOT_SIZE as MASCOT_HERO_SIZE } from "../ui/hero-tokens";

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
  /** Set the face directly (e.g. while planning); otherwise it follows spending. */
  mood?: Mood;
  /**
   * Remember what the jar last showed on this device, so the next visit only
   * animates changes. On by default; off for flows that open on fresh data.
   */
  remember?: boolean;
  style?: CSSProperties;
  /**
   * Couple only: wrap each partner's jar, e.g. to make it its own button. Gets the
   * partner and the jar's box size; the wrapper sits upright around the tilted jar.
   */
  wrapJar?: (scope: "anas" | "salma", jar: ReactNode, size: number) => ReactNode;
  /** Couple only: what drops into each partner's jar, instead of dealing `items` between them. */
  pairItems?: Partial<Record<"anas" | "salma", JarItem[]>>;
  /** Couple only: whose jar sits in front of the other (defaults to Salma's). */
  front?: "anas" | "salma";
};

export type MascotHeroProps =
  /** Pool: the liquid level is a share (0–1), e.g. what's left of the month's plan. */
  | (Common & {
      variant: "pool"; level: number; balance?: number | null; available?: number; items?: JarItem[];
      /** Couple only: each partner's own level (e.g. share of their agreed contribution paid), instead of one shared level. */
      levels?: { anas: number; salma: number };
      /** How the plan is doing against the month (category-status `pace`); none for allocation pools. */
      warn?: "low" | "over" | null;
    })
  /** Split: one category emoji per category, sized by share of the budget. */
  | (Common & { variant: "split"; items: JarItem[] });

/**
 * The mascot as a screen's hero, centred with and sized like the main number.
 * Two variants so far: "pool" (how much is left) and "split" (where it goes).
 * The shape always follows the scope; the mascot is decorative, so the same
 * facts are stated in text next to it.
 */
export function MascotHero(props: MascotHeroProps) {
  if (props.scope !== "joint") return <HeroJar {...props} />;
  return <CouplePair {...props} />;
}

/** How big each partner's jar is in the Couple hero, relative to a single hero. */
const PAIR_SCALE = 0.68;
/** How far the two jars press into each other, as a share of one jar's size. */
const PAIR_OVERLAP = 0.34;
/** The cuddle: both tilt in by the same angle, so their tops and waterlines mirror at one height. */
const PAIR_TILT = { anas: 8, salma: -8 } as const;

/**
 * Couple is not a third character: it's both partners side by side, each in
 * their own colour, cuddled up with all four eyes in view. A pool either shares one
 * waterline (what's left of the couple's plan) or, given `levels`, fills each partner
 * by their own figure, such as how much of their agreed contribution is in. Category art is
 * dealt to the two jars in turn so tapping still shows where the money went.
 */
function CouplePair(props: MascotHeroProps) {
  const size = props.size ?? MASCOT_HERO_SIZE;
  const jar = Math.round(size * PAIR_SCALE);
  const items = props.items ?? (props.variant === "split" ? EMPTY : undefined);
  const deal = (side: 0 | 1) => items?.filter((_, index) => index % 2 === side);
  const yaw = props.lookYaw ?? 0;
  const shared = { ...props, size: jar, memoryKey: props.variant === "pool" && props.levels ? "couple-contribution" : "couple" };
  const levelFor = (scope: "anas" | "salma") => props.variant === "pool" && props.levels ? { level: props.levels[scope] } : {};
  // Tilt from the bottom so the bodies meet at the shoulders, not the faces, and
  // turn each gaze a little outward so neither pair of eyes slips under the other jar.
  // The overlap and stacking live on an upright wrapper; only the jar itself tilts.
  const slot = (scope: "anas" | "salma"): CSSProperties => ({
    position: "relative",
    zIndex: scope === (props.front ?? "salma") ? 1 : 0,
    ...(scope === "anas" ? { marginRight: -Math.round(jar * PAIR_OVERLAP / 2) } : { marginLeft: -Math.round(jar * PAIR_OVERLAP / 2) }),
  });
  const lean = (scope: "anas" | "salma"): CSSProperties => ({
    margin: 0,
    transform: `rotate(${PAIR_TILT[scope]}deg)`,
    transformOrigin: "50% 92%",
    transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
  });
  const partner = (scope: "anas" | "salma", side: 0 | 1, look: number) => {
    const own = props.pairItems ? props.pairItems[scope] ?? EMPTY : deal(side) as JarItem[];
    const body = <HeroJar {...shared} {...levelFor(scope)} scope={scope} lookYaw={yaw + look} items={own} style={lean(scope)} />;
    return <div key={scope} style={slot(scope)}>{props.wrapJar ? props.wrapJar(scope, body, jar) : body}</div>;
  };
  return <div className="mascot-pair" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: size, ...props.style }}>
    {partner("anas", 0, -8)}
    {partner("salma", 1, 8)}
  </div>;
}

/**
 * Opening a screen doesn't replay an entrance: the jar starts as it was last
 * seen on this device and animates only what changed since (new emojis drop
 * in, removed ones fade, the pool eases from its old level). The very first
 * time, the emoji jar fills once as a welcome. Reduce Motion always starts settled.
 */
function HeroJar(props: MascotHeroProps & { memoryKey?: string }) {
  const { memoryKey, scope, spentPct, unassigned = 0, lookYaw, size = MASCOT_HERO_SIZE, mood, remember = true, style } = props;
  const pool = props.variant === "pool";
  const animate = !useReducedMotion();
  const level = pool ? Math.round(Math.max(0, Math.min(1, props.level)) * 1000) / 1000 : 0;
  const shownLevel = useRememberedJar(pool && remember ? `pool:${memoryKey ? `${memoryKey}-` : ""}${scope}` : null, "level", level, animate);
  const shownItems = useRememberedJar(!pool && remember ? `split-v2:${memoryKey ? `${memoryKey}-` : ""}${scope}` : null, "items", pool ? EMPTY : props.items, animate);
  // A pool always carries a (usually empty) pile, so showing what's in it never rebuilds the jar.
  const poolItems = pool ? props.items ?? EMPTY : EMPTY;
  // Balance changes only matter for the pool; a stable null keeps the hook quiet otherwise.
  const reaction = useBalanceReaction(pool ? props.balance ?? null : null, scope, pool ? props.available ?? 0 : 0);
  const derived = deriveTarget({ scope, fundingGap: 0, spentPct, unassigned, loading: false });
  const base = { ...derived, mood: mood ?? derived.mood, lookYaw };
  const target: MascotTarget = pool
    ? { ...base, outline: "partner", fill: shownLevel, items: poolItems }
    : { ...base, outline: "partner", items: shownItems };
  return <Mascot target={target} warn={pool ? props.warn ?? null : null} reaction={pool ? reaction : null} size={size} style={{ margin: "0 auto", ...style }} />;
}

const EMPTY: JarItem[] = [];
