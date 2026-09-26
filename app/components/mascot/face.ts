// Mechanics adapted from bloub (MIT) — see BLOUB_LICENSE.txt. Constants are our own.
import { clamp, createRng, loopNoise } from "./math";

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
