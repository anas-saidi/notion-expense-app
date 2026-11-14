// Mechanics adapted from bloub (MIT) — see BLOUB_LICENSE.txt. Constants are our own.
import { clamp, createRng, lerp, loopNoise } from "./math";

/**
 * Eyes are painted on a sphere, not laid flat: each eye takes the sphere's
 * tangent frame for the current head orientation and is projected
 * orthographically. Foreshortening and tilt near the edge fall out for free,
 * which is what gives the blob volume.
 */

type Vec3 = [number, number, number];

export interface HeadGaze {
  /** degrees, positive = looks right */
  yaw: number;
  /** degrees, positive = looks up */
  pitch: number;
  /** degrees, head tilt */
  roll: number;
}

export interface EyePose {
  x: number;
  y: number;
  /** 2×2 tangent matrix, SVG matrix(a,b,c,d,…) order */
  a: number;
  b: number;
  c: number;
  d: number;
}

const deg = (d: number) => (d * Math.PI) / 180;

function spin(u: Vec3, v: Vec3, angle: number): [Vec3, Vec3] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
    [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s],
  ];
}

/** Head frame, then both eyes. Screen frame: x right, y down, z towards the viewer. */
export function eyePoses(gaze: HeadGaze, scale: number, split: number): [EyePose, EyePose] {
  let f: Vec3 = [0, 0, 1];
  let right: Vec3 = [1, 0, 0];
  let down: Vec3 = [0, 1, 0];
  [f, right] = spin(f, right, deg(gaze.yaw));
  [down, f] = spin(down, f, deg(gaze.pitch));
  [right, down] = spin(right, down, deg(gaze.roll));

  const build = (side: number): EyePose => {
    const [ef, er] = spin(f, right, deg(split * side));
    return { x: ef[0] * scale, y: ef[1] * scale, a: er[0], b: er[1], c: down[0], d: down[1] };
  };
  return [build(-1), build(1)];
}

export interface Liveliness {
  dYaw: number;
  dPitch: number;
  dRoll: number;
  /** 1 = open, 0 = closed */
  lid: number;
  breath: number;
}

const BLINK_RNG = createRng(0xb10b);
/** Pre-drawn blink schedule: deterministic and stateless. */
const BLINKS: number[] = (() => {
  const out: number[] = [];
  let t = 1.2;
  while (t < 3600) {
    out.push(t);
    t += 2.2 + BLINK_RNG() * 3;
    if (BLINK_RNG() < 0.15) {
      out.push(t);
      t += 0.26;
    }
  }
  return out;
})();
const BLINK_DUR = 0.2;

function blinkLid(t: number): number {
  // Binary search keeps this cheap for long sessions.
  let lo = 0;
  let hi = BLINKS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (BLINKS[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  const k = (t - BLINKS[lo]) / BLINK_DUR;
  if (k < 0 || k > 1) return 1;
  return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55;
}

/** Life at rest — slow gaze drift, blinks, a faint breath. A pure function of time. */
export function liveliness(t: number, calm = false): Liveliness {
  if (calm) return { dYaw: 0, dPitch: 0, dRoll: 0, lid: 1, breath: 1 };
  return {
    dYaw: loopNoise(t, 11.3, 0.4) * 6 + loopNoise(t, 3.7, 2.1) * 1.8,
    dPitch: loopNoise(t, 9.1, 1.3) * 4.5 + loopNoise(t, 4.3, 0.7) * 1.4,
    dRoll: loopNoise(t, 13.7, 3.2) * 2.5,
    lid: blinkLid(t),
    breath: 1 + Math.sin((t / 3.6) * Math.PI * 2) * 0.012,
  };
}

/** A blink is a vertical squash in screen space around the eye centre. */
export const blinkScale = (lid: number) => 0.08 + 0.92 * clamp(lid);

/**
 * Bloub's eye range on top of a mood: every few seconds the eyes do one small thing, then settle back.
 * The capsule stays the only shape; a moment only scales it, rounds it or turns the head.
 * - glance: a quick look to one side (or up), held, then back
 * - widen: both eyes open bigger for a beat (noticing)
 * - squint: eyes narrow and flatten (content)
 * - dot: eyes become round dots (attentive), like Bloub's notification face
 */
export type EyeMomentKind = "glance" | "widen" | "squint" | "dot";
export interface EyeMoment {
  dYaw: number;
  dPitch: number;
  /** Width and height multipliers. */
  ws: number;
  hs: number;
  /** 0 = the mood's capsule, 1 = a round dot. */
  round: number;
}
export const NO_EYE_MOMENT: EyeMoment = { dYaw: 0, dPitch: 0, ws: 1, hs: 1, round: 0 };

const MOMENT_RNG = createRng(0xe7e5);
type ScheduledMoment = { t: number; kind: EyeMomentKind; dur: number; yaw: number; pitch: number };
/** Pre-drawn like the blinks: deterministic, and each jar reads it at its own phase. */
const MOMENTS: ScheduledMoment[] = (() => {
  const kinds: EyeMomentKind[] = ["glance", "glance", "widen", "squint", "dot", "glance"];
  const out: ScheduledMoment[] = [];
  let t = 2.6;
  while (t < 3600) {
    const kind = kinds[Math.floor(MOMENT_RNG() * kinds.length)];
    const side = MOMENT_RNG() < 0.5 ? -1 : 1;
    out.push({ t, kind, dur: kind === "glance" ? 0.9 + MOMENT_RNG() * 0.6 : 0.8 + MOMENT_RNG() * 0.5, yaw: side * (10 + MOMENT_RNG() * 8), pitch: (MOMENT_RNG() - 0.3) * 14 });
    t += 3.5 + MOMENT_RNG() * 4;
  }
  return out;
})();

/** In fast (110 ms), hold, out softer (220 ms): a look is quick, the return is lazy. */
function momentEnvelope(k: number, dur: number): number {
  const s = k * dur;
  if (s < 0 || s > dur) return 0;
  if (s < 0.11) return 1 - (1 - s / 0.11) ** 3;
  const out = dur - s;
  return out < 0.22 ? (out / 0.22) ** 2 * (3 - 2 * (out / 0.22)) : 1;
}

export function eyeMoment(t: number, calm = false): EyeMoment {
  if (calm) return NO_EYE_MOMENT;
  let lo = 0, hi = MOMENTS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (MOMENTS[mid].t <= t) lo = mid; else hi = mid - 1;
  }
  const m = MOMENTS[lo];
  const e = momentEnvelope((t - m.t) / m.dur, m.dur);
  if (e <= 0) return NO_EYE_MOMENT;
  switch (m.kind) {
    case "glance": return { dYaw: m.yaw * e, dPitch: m.pitch * e, ws: 1, hs: 1, round: 0 };
    case "widen": return { dYaw: 0, dPitch: -3 * e, ws: 1 + 0.18 * e, hs: 1 + 0.22 * e, round: 0 };
    case "squint": return { dYaw: 0, dPitch: 2 * e, ws: 1 + 0.12 * e, hs: 1 - 0.5 * e, round: 0 };
    case "dot": return { dYaw: m.yaw * 0.4 * e, dPitch: 0, ws: 1, hs: 1, round: e };
  }
}

/** A capsule eye after a moment: scaled, and pulled towards a round dot slightly wider than the capsule. */
export function shapeEye(w: number, h: number, m: EyeMoment): { w: number; h: number } {
  const dot = Math.max(w, Math.min(h, w * 1.3));
  return { w: lerp(w * m.ws, dot, m.round), h: lerp(h * m.hs, dot, m.round) };
}
