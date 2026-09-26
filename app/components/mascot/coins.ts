import { createRng } from "./math";
import { circleProfile, radiusAtAngle } from "./shape";

export type CoinOwner = "anas" | "salma";

/** Coin radius and glass thickness, in body units (rest radius = 1). */
export const COIN_R = 0.09;
/** Coins lie flat in the pile and are seen from slightly above: height ÷ width. */
export const COIN_ASPECT = 0.75;
const GLASS = 0.06;

export interface CoinSlot { x: number; y: number }

/**
 * How one coin sits in the pile. Real coins poured into a jar land at every
 * angle — mostly flat or tilted, a few nearly on edge — and overlap in no
 * particular order. Uniform flat ovals drawn row by row read as roof tiles.
 */
export interface CoinLook {
  /** Apparent height ÷ width: ~0.9 lying flat, ~0.25 standing on edge. */
  aspect: number;
  scale: number;
  /** Rotation in the picture plane, degrees. */
  rot: number;
  /** Draw order: overlaps follow this, not the row. */
  z: number;
}

/** Deterministic look for the n-th coin created, so a coin keeps its look as it moves. */
export function coinLook(n: number): CoinLook {
  const rng = createRng(0x9e37 + n * 7919);
  const aspect = rng() < 0.14 ? 0.22 + rng() * 0.16 : 0.5 + rng() * 0.42;
  return { aspect, scale: 0.9 + rng() * 0.2, rot: (rng() - 0.5) * 150, z: rng() };
}

/**
 * Resting spots inside a jar outline, bottom row first and centre-out within a
 * row, so a partial pile looks like it settled naturally. Rows are hex-packed
 * and slightly jittered (deterministically) so it reads as a heap, not a grid.
 * Computed once per outline and cached; the renderer only looks slots up.
 */
const slotCache = new Map<string, CoinSlot[]>();

export function coinSlots(jar: { key: string; radii: number[] }): CoinSlot[] {
  const cached = slotCache.get(jar.key);
  if (cached) return cached;
  const rng = createRng(0xc0145);
  const margin = GLASS + COIN_R;
  const inside = (x: number, y: number) => Math.hypot(x, y) <= radiusAtAngle(jar.radii, Math.atan2(y, x)) - margin;
  // Outlines are left/right symmetric: find a row's half-width by bisection.
  const halfWidth = (y: number) => {
    if (!inside(0, y)) return -1;
    let lo = 0, hi = 2;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (inside(mid, y)) lo = mid; else hi = mid; }
    return lo;
  };
  // Spacing is tighter than the drawn coin in both directions, so neighbours
  // overlap a little and the pile reads as one mass instead of a grid with gaps.
  const rowStep = COIN_R * COIN_ASPECT * 1.8;
  const colStep = COIN_R * 1.75;
  const bottom = radiusAtAngle(jar.radii, Math.PI / 2) - margin;
  const top = -(radiusAtAngle(jar.radii, -Math.PI / 2) - margin);
  const slots: CoinSlot[] = [];
  let row = 0;
  for (let y = bottom; y > top; y -= rowStep, row++) {
    const half = halfWidth(y);
    if (half < 0) continue;
    const offset = row % 2 ? colStep / 2 : 0;
    const xs: number[] = [];
    for (let x = -half + ((half * 2) % colStep) / 2 + offset; x <= half + 1e-6; x += colStep) xs.push(x);
    xs.sort((a, b) => Math.abs(a) - Math.abs(b));
    for (const x of xs) slots.push({ x: x + (rng() - 0.5) * 0.05, y: y + (rng() - 0.5) * 0.04 });
  }
  slotCache.set(jar.key, slots);
  return slots;
}

/** The round jar's spots — the default outline. */
export const COIN_SLOTS = coinSlots({ key: "orb", radii: circleProfile(1) });
export const COIN_CAPACITY = COIN_SLOTS.length;

/** How long a spent coin takes to crumble to dust, seconds. */
export const DUST_DURATION = 0.7;

export interface DustSpeck {
  /** Start, as a fraction of the coin's radii (inside the ellipse). */
  ox: number; oy: number;
  /** Drift, in body units (mostly upward, fanning out). */
  dx: number; dy: number;
  /** Fraction of the dissolve before this speck lets go. */
  delay: number;
  /** Radius, viewBox units. */
  r: number;
  /** Paints with the coin's face (0) or edge (1) colour. */
  tone: 0 | 1;
}

/**
 * A spent coin crumbles into a few matte specks that drift up and fade — a
 * soft dissolve rather than a flying, spinning exit. Deterministic per coin.
 */
export function dustSpecks(look: CoinLook, count = 10): DustSpeck[] {
  const rng = createRng(Math.floor(look.z * 1e6) + 17);
  return Array.from({ length: count }, () => {
    const radius = Math.sqrt(rng());
    const theta = rng() * Math.PI * 2;
    const ox = radius * Math.cos(theta);
    const oy = radius * Math.sin(theta);
    const angle = -Math.PI / 2 + (rng() - 0.5) * 2.2;
    const dist = 0.18 + rng() * 0.27;
    return {
      ox, oy,
      dx: Math.cos(angle) * dist + ox * 0.06,
      dy: Math.sin(angle) * dist,
      delay: rng() * 0.3,
      r: 1.1 + rng() * 1.3,
      tone: rng() < 0.6 ? 0 : 1,
    };
  });
}

/** Coin shape in the pile: detailed ovals, or plain round beads (bloub's flat-dot language). */
export type CoinShape = "coin" | "bead";
/** Bead radius relative to a coin's: round beads fill more area than flat ovals. */
export const BEAD_SCALE = 0.85;
/** How long a new bead takes to spiral in and grow to full size, seconds. */
export const ARRIVE_DURATION = 0.7;

