"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { BudgetScope } from "../app-types";
import { Mascot } from "./Mascot";
import type { JarItem } from "./coinSimMatter";
import type { MascotTarget } from "./engine";
import type { Mood } from "./poses";
import { deriveTarget, useBalanceReaction } from "./mood";
import { useReducedMotion } from "motion/react";
import { useRememberedJar } from "./memory";
import { MascotSignal, type OnceKind, type SignalKind } from "./MascotSignal";
import { LightMascot } from "../grain/LightMascot";
import { PALETTES } from "../grain/palettes";
import { HeartTip } from "../grain/HeartTip";
import type { ReactionToken } from "./mood";

/** A signal on a jar (see MascotSignal): what it shows, its colour, what it means, and the alert's tap. */
export type JarSignal = { kind: SignalKind; tone?: "danger" | "neutral"; label?: string; caption?: boolean; onTap?: () => void };

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
  /**
   * The level isn't known yet (its data is still loading): the jar shows at
   * the level it last showed on this device, and moves to the real one once
   * `pending` clears. `level` is only the fallback for a first visit.
   */
  pending?: boolean;
  /**
   * Light look, split jar: how bright the light is and its tint, when the screen's number has a mood
   * (Reflect: did the period keep to its plan). A pool's light comes from its level and `warn` instead.
   */
  glow?: { level: number; warn: "low" | "over" | null } | null;
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
  /** A signal on the jar, or on the whole pair in Couple (e.g. thinking). */
  signal?: JarSignal | null;
  /** Couple only: a signal on one partner's jar (e.g. a dot on whoever has money due). */
  pairSignals?: Partial<Record<"anas" | "salma", JarSignal | null>>;
  /** A one-off to play (burst, comet); a new id plays it again. */
  once?: { kind: OnceKind; id: number } | null;
  /** Wink once when this changes (e.g. after a save); 0 or undefined does nothing. */
  winkId?: number;
  /**
   * "jar" (default): the glass jar with liquid. "light": the jar drawn as a soft light in the partner's
   * colour; a pool's level is a saturated core that grows and brightens, a split jar shows its items
   * in the light (design.md, Light).
   */
  look?: "jar" | "light";
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
  // Always wrapped, so a signal coming or going never remounts the jar (and restarts its physics).
  return <Signalled signal={props.signal} once={props.once}>
    {props.scope !== "joint" ? <HeroJar {...props} /> : <CouplePair {...props} />}
  </Signalled>;
}

function Signalled({ signal, once, dotAt, children }: { signal?: JarSignal | null; once?: { kind: OnceKind; id: number } | null; dotAt?: Pick<CSSProperties, "top" | "left" | "right">; children: ReactNode }) {
  return <MascotSignal signal={signal?.kind ?? null} dotAt={dotAt} tone={signal?.tone} label={signal?.label} caption={signal?.caption} onAlertTap={signal?.onTap} once={once}>{children}</MascotSignal>;
}

/** How big each partner's jar is in the Couple hero, relative to a single hero. */
const PAIR_SCALE = 0.68;
/** How far the two jars press into each other, as a share of one jar's size. */
const PAIR_OVERLAP = 0.4;
/** In the pair, each partner's dot sits on their outer shoulder (the inner one is under the other jar), on the body. */
const PAIR_DOT = { anas: { top: "24%", left: "24%" }, salma: { top: "24%", right: "30%" } } as const;
/** The cuddle: both tilt in by the same angle, so their tops and waterlines mirror at one height. */
const PAIR_TILT = { anas: 8, salma: -8 } as const;
/**
 * Where the two bodies meet: the vertical line halfway between the jars' centres, seen from inside each
 * leaning jar (it tilts about 50% 92% of its box). Jar units: the box is 300 wide, centred on 0.
 */
const PAIR_PRESS = (() => {
  const half = ((1 - PAIR_OVERLAP) * 300) / 2;
  const pivotY = 0.92 * 300 - 150;
  const wall = (tilt: number, side: 1 | -1) => {
    const a = (tilt * Math.PI) / 180;
    // A body point p lands at screen x = cos(a)·x − sin(a)·(y − pivotY); the wall is screen x = side·half.
    return { nx: side * Math.cos(a), ny: -side * Math.sin(a), c: half - side * Math.sin(a) * pivotY };
  };
  return { anas: wall(PAIR_TILT.anas, 1), salma: wall(PAIR_TILT.salma, -1) };
})();

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
    const ownSignal = props.pairSignals?.[scope];
    const plain = <HeroJar {...shared} signal={null} once={null} press={PAIR_PRESS[scope]} {...levelFor(scope)} scope={scope} lookYaw={yaw + look} items={own} style={lean(scope)} />;
    const body = props.pairSignals ? <Signalled signal={ownSignal} dotAt={PAIR_DOT[scope]}>{plain}</Signalled> : plain;
    return <div key={scope} style={slot(scope)}>{props.wrapJar ? props.wrapJar(scope, body, jar) : body}</div>;
  };
  // Light look: a soft point of light under the pair turns their two lobes into a heart (the jars are unchanged).
  // With contributions it follows the least-funded partner: the heart is full only when both are in.
  const heartLevel = props.variant !== "pool" ? 1 : props.levels ? Math.min(props.levels.anas, props.levels.salma) : props.level;
  return <div className="mascot-pair" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: size, position: "relative", ...props.style }}>
    {props.look === "light" && <HeartTip size={size} jar={jar} overlap={PAIR_OVERLAP} level={heartLevel} />}
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
function HeroJar(props: MascotHeroProps & { memoryKey?: string; press?: MascotTarget["press"] }) {
  const { memoryKey, scope, spentPct, unassigned = 0, lookYaw, size = MASCOT_HERO_SIZE, mood, remember = true, pending = false, style } = props;
  const pool = props.variant === "pool";
  const animate = !useReducedMotion();
  const level = pool ? Math.round(Math.max(0, Math.min(1, props.level)) * 1000) / 1000 : 0;
  const shownLevel = useRememberedJar(pool && remember ? `pool:${memoryKey ? `${memoryKey}-` : ""}${scope}` : null, "level", level, animate, pending);
  const shownItems = useRememberedJar(!pool && remember ? `split-v2:${memoryKey ? `${memoryKey}-` : ""}${scope}` : null, "items", pool ? EMPTY : props.items, animate);
  // A pool always carries a (usually empty) pile, so showing what's in it never rebuilds the jar.
  const poolItems = pool ? props.items ?? EMPTY : EMPTY;
  // Balance changes only matter for the pool; a stable null keeps the hook quiet otherwise.
  const balanceReaction = useBalanceReaction(pool ? props.balance ?? null : null, scope, pool ? props.available ?? 0 : 0);
  // Whichever came last plays: a balance change, or a wink the screen asked for (Reduce Motion skips the wink).
  const [reaction, setReaction] = useState<ReactionToken | null>(null);
  const seq = useRef(0);
  useEffect(() => { if (pool && balanceReaction) setReaction({ ...balanceReaction, id: ++seq.current }); }, [balanceReaction?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (props.winkId && animate) setReaction({ kind: "wink", id: ++seq.current }); }, [props.winkId]); // eslint-disable-line react-hooks/exhaustive-deps
  const derived = deriveTarget({ scope, fundingGap: 0, spentPct, unassigned, loading: false });
  const base = { ...derived, mood: mood ?? derived.mood, lookYaw, press: props.press ?? null };
  const target: MascotTarget = pool
    ? { ...base, outline: "partner", fill: shownLevel, items: poolItems }
    : { ...base, outline: "partner", items: shownItems };
  if (props.look === "light") {
    const tone = PALETTES.partner[scope === "salma" ? "salma" : "anas"];
    return <LightMascot scope={scope} target={target} level={pool ? shownLevel : props.glow?.level ?? 1} size={size} spentPct={spentPct} reaction={reaction} warn={pool ? props.warn ?? null : props.glow?.warn ?? null}
      edge="soft" levelMode="core" rest="still" tone={tone} style={{ margin: "0 auto", ...style }} />;
  }
  return <Mascot target={target} warn={pool ? props.warn ?? null : null} reaction={reaction} size={size} style={{ margin: "0 auto", ...style }} />;
}

const EMPTY: JarItem[] = [];
