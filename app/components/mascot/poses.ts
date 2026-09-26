import { lerp } from "./math";
import { circleProfile, profileFromPolygon, superellipseProfile, unionOfCirclesProfile } from "./shape";
import type { HeadGaze } from "./face";

export type MascotScope = "joint" | "anas" | "salma";
export type Mood = "idle" | "happy" | "excited" | "worried" | "sad" | "curious" | "sleepy" | "wince";

/** Partner identity colours — keep in sync with --partner-husband / --partner-wife. */
export const MASCOT_COLORS = { anas: "#6aa6e6", salma: "#e86c95" } as const;
export const EYE_INK = "#0e0f0c";

/** One face per lobe. `s` is the face-sphere radius, in body units; `yaw` biases its gaze. */
export interface FaceSlot { x: number; y: number; s: number; yaw: number }

export interface EyeCfg { w: number; h: number; tilt: number; open: number }
export interface Expression { gaze: HeadGaze; split: number; eyes: [EyeCfg, EyeCfg] }

const eye = (w: number, h: number, tilt = 0, open = 1): EyeCfg => ({ w, h, tilt, open });
/** Same eye twice, tilts mirrored. */
const pair = (w: number, h: number, tilt = 0, open = 1): [EyeCfg, EyeCfg] => [eye(w, h, tilt, open), eye(w, h, -tilt, open)];

/**
 * Expressions are bloub's customiser presets (MIT, see BLOUB_LICENSE.txt): two
 * capsule eyes whose size, spacing, tilt and head direction carry the mood.
 * bloub's own values, not its x.ai-measured rest pose (`neutre`), which is left
 * out. Mapping to our moods:
 *   idle → attentif · happy → heureux · excited → excite · worried → timide
 *   sad → triste · curious → curieux · sleepy → somnolent · wince → blase
 * Widths/heights are fractions of the face radius; tilt in degrees.
 */
export const EXPRESSIONS: Record<Mood, Expression> = {
  idle:    { gaze: { yaw: 4, pitch: 5, roll: -4 },     split: 16,   eyes: pair(0.21, 0.44) },
  happy:   { gaze: { yaw: 5, pitch: 9, roll: 0 },      split: 17,   eyes: pair(0.27, 0.17, 14) },
  excited: { gaze: { yaw: 6, pitch: -14, roll: 0 },    split: 19.5, eyes: pair(0.4, 0.56, -10) },
  worried: { gaze: { yaw: -19, pitch: -14, roll: -7 }, split: 14,   eyes: pair(0.17, 0.3) },
  sad:     { gaze: { yaw: 3, pitch: -13, roll: 0 },    split: 16,   eyes: pair(0.22, 0.4, -28) },
  curious: { gaze: { yaw: 16, pitch: -9, roll: -15 },  split: 16.5, eyes: [eye(0.24, 0.46, -8), eye(0.2, 0.38, -8)] },
  sleepy:  { gaze: { yaw: 6, pitch: -9, roll: -3 },    split: 16,   eyes: pair(0.2, 0.42, 0, 0.42) },
  wince:   { gaze: { yaw: -22, pitch: 2, roll: 0 },    split: 16,   eyes: pair(0.3, 0.12) },
};

const lerpEye = (a: EyeCfg, b: EyeCfg, t: number): EyeCfg => ({
  w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t), tilt: lerp(a.tilt, b.tilt, t), open: lerp(a.open, b.open, t),
});

export function blendExpression(a: Expression, b: Expression, t: number): Expression {
  return {
    gaze: { yaw: lerp(a.gaze.yaw, b.gaze.yaw, t), pitch: lerp(a.gaze.pitch, b.gaze.pitch, t), roll: lerp(a.gaze.roll, b.gaze.roll, t) },
    split: lerp(a.split, b.split, t),
    eyes: [lerpEye(a.eyes[0], b.eyes[0], t), lerpEye(a.eyes[1], b.eyes[1], t)],
  };
}

/* ── Bodies ─────────────────────────────────────────────────────── */

/**
 * Outlines. "partner" gives each person their own silhouette so scopes differ
 * by shape, not only colour (colour alone fails for colour-blind users):
 * Anas is a soft squircle, Salma one of a few rounded organic shapes (being
 * chosen in the lab), and joint sits exactly between them.
 */
export type Outline = "orb" | "squircle" | "partner";

export interface JarShape {
  key: string;
  radii: number[];
  /** Half extent along the axes, in body units (the jar's box is 2 × half). */
  half: number;
  /** Corner radius as a fraction of the box width, for the glass lens. */
  corner: number;
}

/**
 * A soft body resting on a surface, not a rigid container: a little fuller at
 * the bottom and narrower at the top (radii grow towards theta = 90°, i.e. down).
 */
const sag = (radii: number[], amount = 0.035) =>
  radii.map((r, i) => r * (1 + amount * Math.sin((i / radii.length) * Math.PI * 2)));

const ORB: JarShape = { key: "orb", radii: sag(circleProfile(1)), half: 1, corner: 0.5 };
// Softer superellipses than a true squircle, so corners read as rounded flesh, not
// machined edges; scaled down because they reach further than the orb at the corners.
const SQUIRCLE: JarShape = { key: "squircle", radii: sag(superellipseProfile(3.2, 0.93)), half: 0.93, corner: 0.36 };
/**
 * A soft pebble (think river stone or mochi): wider than tall, domed, with a
 * slightly lopsided swell so it never reads as a drawn circle. No corners, so
 * it stays clearly different from the squircle.
 */
const PEBBLE_RADII = sag(superellipseProfile(2.25, 1, 1.08, 0.9), 0.05).map((r, i, all) => {
  const theta = (i / all.length) * Math.PI * 2;
  return r * (1 + 0.025 * Math.sin(theta + 0.6) + 0.012 * Math.sin(3 * theta + 1.2));
});
const PEBBLE: JarShape = { key: "pebble", radii: PEBBLE_RADII, half: 1.08, corner: 0.5 };

const at = (all: number[], i: number) => (i / all.length) * Math.PI * 2; // theta; 90° is straight down
/** Egg: upright and a little narrow, fuller at the bottom. */
const EGG: JarShape = {
  key: "egg",
  radii: superellipseProfile(2.1, 1, 0.9, 1.04).map((r, i, all) => r * (1 + 0.07 * Math.sin(at(all, i)))),
  half: 0.95, corner: 0.5,
};
/** Drop: a soft droplet whose top rises into a gently rounded tip. */
const DROP: JarShape = {
  key: "drop",
  radii: sag(circleProfile(0.95), 0.04).map((r, i, all) => r * (1 + 0.2 * Math.max(0, -Math.sin(at(all, i))) ** 3)),
  half: 0.97, corner: 0.5,
};
/** Bean: wide and soft, with a shallow dip in the top. */
const BEAN: JarShape = {
  key: "bean",
  radii: sag(superellipseProfile(2.2, 1, 1.1, 0.9), 0.04).map((r, i, all) => {
    const fromTop = at(all, i) - Math.PI * 1.5; // distance from straight up
    return r * (1 - 0.1 * Math.exp(-(fromTop ** 2) / 0.12));
  }),
  half: 1.1, corner: 0.5,
};

export type SalmaShape = "egg" | "drop" | "bean" | "pebble";
const SALMA_SHAPES: Record<SalmaShape, JarShape> = { egg: EGG, drop: DROP, bean: BEAN, pebble: PEBBLE };

// Joint is the literal midpoint of the two partners' outlines.
const betweenCache = new Map<SalmaShape, JarShape>();
function between(salma: SalmaShape): JarShape {
  let shape = betweenCache.get(salma);
  if (!shape) {
    const s = SALMA_SHAPES[salma];
    shape = { key: `between-${salma}`, radii: SQUIRCLE.radii.map((r, i) => (r + s.radii[i]) / 2), half: (SQUIRCLE.half + s.half) / 2, corner: 0.44 };
    betweenCache.set(salma, shape);
  }
  return shape;
}

export function jarShape(outline: Outline = "orb", scope: MascotScope, salma: SalmaShape = "egg"): JarShape {
  if (outline === "orb") return ORB;
  if (outline === "squircle") return SQUIRCLE;
  return scope === "anas" ? SQUIRCLE : scope === "salma" ? SALMA_SHAPES[salma] : between(salma);
}

/** Personal: one round blob, one face. Both face slots coincide so it reads as a single face. */
export const SOLO_RADII = circleProfile(1);
export const SOLO_FACES: [FaceSlot, FaceSlot] = [{ x: 0, y: 0, s: 1, yaw: 0 }, { x: 0, y: 0, s: 1, yaw: 0 }];

/**
 * Joint: two discs merged into one body. `gap` 0 = fully merged (funded),
 * 1 = pulled apart with a narrow waist (contribution outstanding).
 * The origin stays inside both discs (d < r), so the union profile is exact.
 */
export function duoBody(gap: number): { radii: number[]; faces: [FaceSlot, FaceSlot] } {
  const d = lerp(0.36, 0.6, gap);
  const r = lerp(0.78, 0.66, gap);
  return {
    radii: unionOfCirclesProfile([{ x: -d, y: 0, r }, { x: d, y: 0, r }]),
    // Each face sits on its lobe and glances towards its partner; a floor on the
    // spacing keeps the two faces distinct even when the lobes are nearly merged.
    faces: [{ x: -lerp(0.5, 0.66, gap), y: 0, s: r, yaw: 6 }, { x: lerp(0.5, 0.66, gap), y: 0, s: r, yaw: -6 }],
  };
}

/** Fully funded joint: the lobes settle into a heart, one face on each top lobe. */
export const HEART_RADII = (() => {
  const pts = [];
  for (let i = 0; i < 180; i++) {
    const t = (i / 180) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    // Normalise to ~radius 1 and centre vertically so the origin is inside and every ray hits once.
    pts.push({ x: (x / 17) * 1.12, y: (y / 17 - 0.15) * 1.12 });
  }
  // The cusps (top dip, bottom tip) make spikes once splined; a few smoothing
  // passes round them into a soft, plush heart.
  let radii = profileFromPolygon(pts);
  for (let pass = 0; pass < 4; pass++) {
    radii = radii.map((r, i) => (radii[(i - 1 + radii.length) % radii.length] + 2 * r + radii[(i + 1) % radii.length]) / 4);
  }
  return radii;
})();
export const HEART_FACES: [FaceSlot, FaceSlot] = [{ x: -0.42, y: -0.22, s: 0.52, yaw: 8 }, { x: 0.42, y: -0.22, s: 0.52, yaw: -8 }];
