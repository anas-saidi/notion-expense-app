// Adapted from bloub (MIT) — see BLOUB_LICENSE.txt.
import { TAU, lerp, r2 } from "./math";

/**
 * Every silhouette is a radial profile r(theta) sampled at the SAME angles, so
 * any two shapes have points in one-to-one correspondence and a morph is just a
 * linear interpolation of radii. No path-morphing library needed.
 */
export const PROFILE_SAMPLES = 64;

export interface Point { x: number; y: number }

const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * TAU);
const COS = ANGLES.map(Math.cos);
const SIN = ANGLES.map(Math.sin);

export const circleProfile = (radius = 1): number[] => new Array(PROFILE_SAMPLES).fill(radius);

export function blendRadii(a: number[], b: number[], t: number, out: number[] = new Array(PROFILE_SAMPLES)): number[] {
  for (let i = 0; i < PROFILE_SAMPLES; i++) out[i] = lerp(a[i] ?? 1, b[i] ?? 1, t);
  return out;
}

/** Profile → screen points. `scale` is the rest radius in viewBox units. */
export function toPoints(
  radii: number[],
  scale: number,
  pose: { cx?: number; cy?: number; sx?: number; sy?: number } = {},
): Point[] {
  const { cx = 0, cy = 0, sx = 1, sy = 1 } = pose;
  const out: Point[] = [];
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const r = radii[i] ?? 1;
    out.push({ x: (r * COS[i] * sx + cx) * scale, y: (r * SIN[i] * sy + cy) * scale });
  }
  return out;
}

/** Closed polyline → Catmull-Rom cubics; 64 points are smooth at any display size. */
export function closedPath(pts: Point[], tension = 1 / 6): string {
  const n = pts.length;
  if (n < 3) return "";
  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d += `C${r2(p1.x + (p2.x - p0.x) * tension)} ${r2(p1.y + (p2.y - p0.y) * tension)} ${r2(p2.x - (p3.x - p1.x) * tension)} ${r2(p2.y - (p3.y - p1.y) * tension)} ${r2(p2.x)} ${r2(p2.y)}`;
  }
  return `${d}Z`;
}

/** Open polyline → smooth Catmull-Rom curve (ends clamped), e.g. a liquid surface. */
export function openPath(pts: Point[], tension = 1 / 6): string {
  if (pts.length < 2) return "";
  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${r2(p1.x + (p2.x - p0.x) * tension)} ${r2(p1.y + (p2.y - p0.y) * tension)} ${r2(p2.x - (p3.x - p1.x) * tension)} ${r2(p2.y - (p3.y - p1.y) * tension)} ${r2(p2.x)} ${r2(p2.y)}`;
  }
  return d;
}

/**
 * Radial profile of a UNION of discs: r(theta) is the farthest ray/circle
 * intersection. Exact while the origin lies inside the union — this is what
 * lets two lobes merge into one body with no path booleans.
 */
export function unionOfCirclesProfile(circles: Array<{ x: number; y: number; r: number }>): number[] {
  const out = new Array<number>(PROFILE_SAMPLES).fill(0);
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const dx = COS[i];
    const dy = SIN[i];
    let best = 0;
    for (const c of circles) {
      const b = dx * c.x + dy * c.y;
      const disc = b * b - (c.x * c.x + c.y * c.y - c.r * c.r);
      if (disc < 0) continue;
      const t = b + Math.sqrt(disc);
      if (t > best) best = t;
    }
    out[i] = best;
  }
  return out;
}

/**
 * Superellipse |x|^n + |y|^n = 1, scaled: n = 2 is a circle, n ≈ 4 a squircle
 * (a rounded square with continuous curvature, like an app icon).
 */
export function superellipseProfile(n: number, scale = 1, sx = 1, sy = 1): number[] {
  return ANGLES.map((_, i) => scale * (Math.abs(COS[i] / sx) ** n + Math.abs(SIN[i] / sy) ** n) ** (-1 / n));
}

/** Radius in any direction, interpolated between the two neighbouring samples. */
export function radiusAtAngle(radii: number[], angle: number): number {
  const n = radii.length;
  const t = ((((angle / TAU) % 1) + 1) % 1) * n;
  const i = Math.floor(t);
  return lerp(radii[i % n] ?? 1, radii[(i + 1) % n] ?? 1, t - i);
}

/** Closed polygon → radial profile, by ray casting from the origin. Computed once, never per frame. */
export function profileFromPolygon(poly: Point[]): number[] {
  const radii = new Array<number>(PROFILE_SAMPLES).fill(0);
  const n = poly.length;
  for (let k = 0; k < PROFILE_SAMPLES; k++) {
    const dx = COS[k];
    const dy = SIN[k];
    let best = 0;
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = (a.x * ey - a.y * ex) / den;
      const u = (a.x * dy - a.y * dx) / den;
      if (t > best && u >= 0 && u <= 1) best = t;
    }
    radii[k] = best;
  }
  return radii;
}

/** Capsule centred on the origin; with w ≈ h it reads as a soft oval eye. */
export function capsulePath(w: number, h: number): string {
  const hw = Math.max(w, 0.01) / 2;
  const hh = Math.max(h, 0.01) / 2;
  const r = Math.min(hw, hh);
  return (
    `M${r2(-hw)} ${r2(-hh + r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw + r)} ${r2(-hh)}` +
    `L${r2(hw - r)} ${r2(-hh)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw)} ${r2(-hh + r)}` +
    `L${r2(hw)} ${r2(hh - r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw - r)} ${r2(hh)}` +
    `L${r2(-hw + r)} ${r2(hh)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw)} ${r2(hh - r)}Z`
  );
}
