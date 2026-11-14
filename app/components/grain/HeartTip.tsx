"use client";

import { useId, type CSSProperties } from "react";
import { PALETTES } from "./palettes";
import { mixHex } from "../mascot/math";

/**
 * Couple, light look: the two leaning lights already read as the lobes of a heart.
 * This adds only the point: a soft light below them, where their lower edges meet,
 * blue on Anas's side and pink on Salma's, blurred into both bodies. The mascots
 * themselves are unchanged. Decorative and subtle: a hint of a point, never a shape of its own; as bright as the pair's level.
 */
export function HeartTip({ size, jar, overlap, level }: { size: number; jar: number; overlap: number; level: number }) {
  const ids = useId().replace(/:/g, "");
  const { anas, salma } = PALETTES.partner;
  const cx = size / 2;
  const cy = size / 2;
  // Distance from the middle to each jar's centre, and a body's radius (the outline spans about two thirds of its box).
  const reach = (jar * (1 - overlap)) / 2;
  const r = jar / 3;
  // From each jar's outer lower side, down to one point under the middle, back along their lower edges.
  const d = [
    `M ${cx - reach - r * 0.85} ${cy + r * 0.35}`,
    `Q ${cx - reach * 0.55} ${cy + r * 1.5} ${cx} ${cy + r * 1.75}`,
    `Q ${cx + reach * 0.55} ${cy + r * 1.5} ${cx + reach + r * 0.85} ${cy + r * 0.35}`,
    `Q ${cx + reach} ${cy + r * 0.95} ${cx} ${cy + r * 0.75}`,
    `Q ${cx - reach} ${cy + r * 0.95} ${cx - reach - r * 0.85} ${cy + r * 0.35}`,
    "Z",
  ].join(" ");
  const strength = 0.35 + 0.65 * Math.max(0, Math.min(1, level));
  const style: CSSProperties = { position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none", zIndex: 0, opacity: 0.4 * strength, transition: "opacity 700ms cubic-bezier(0.33, 0, 0.2, 1)" };
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={style} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${ids}-hue`} x1="0" y1="0" x2="1" y2="0">
        {/* Mostly halo, so the point reads as the lights' own glow, not a new colour. */}
        <stop offset="0.2" stopColor={mixHex(anas.halo, anas.core, 0.25)} />
        <stop offset="0.5" stopColor={mixHex(anas.halo, anas.core, 0.1)} />
        <stop offset="0.5" stopColor={mixHex(salma.halo, salma.core, 0.1)} />
        <stop offset="0.8" stopColor={mixHex(salma.halo, salma.core, 0.25)} />
      </linearGradient>
      <filter id={`${ids}-blur`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation={jar * 0.07} />
      </filter>
    </defs>
    <path d={d} fill={`url(#${ids}-hue)`} filter={`url(#${ids}-blur)`} />
  </svg>;
}
