"use client";

import { useId, type CSSProperties } from "react";
import type { BudgetScope } from "../app-types";
import { jarShape } from "./poses";
import { closedPath, toPoints } from "./shape";

/**
 * A category's own small jar: the mascot's outline for the wallet (the shape says
 * whose it is), without a face or physics. The liquid is what's left of the
 * category's money, coloured by the status palette (the colour says how it's
 * doing): good, low (last fifth) or over. The category's emoji sits inside.
 * Static SVG, so a list of them stays light and still.
 */
/** normal: has money · empty: spent to exactly zero · over: below zero · unfunded: never funded. */
export type CategoryJarState = "normal" | "empty" | "over" | "unfunded";

type Props = {
  scope: BudgetScope;
  /** Share of the category's money still left (or, for savings, of the goal reached), 0–1. */
  level: number;
  state?: CategoryJarState;
  /** Savings fill up towards a goal, so they're always "good", never "low". */
  kind?: "budget" | "savings";
  /** Spending faster than the month (from category-status); honey instead of sage. */
  low?: boolean;
  icon: string | null;
  size?: number;
  style?: CSSProperties;
};

const SCALE = 40;

/**
 * The emoji floats on the liquid: near the top when full, settling as money is
 * spent, resting on the bottom when empty. Its height is the level, and it's drawn
 * above the liquid, so it's never hidden.
 */
const FLOAT_DEPTH = 0.32;

export function CategoryJar({ scope, level, state = "normal", kind = "budget", low = false, icon, size = 60, style }: Props) {
  const id = useId().replace(/:/g, "");
  const shape = jarShape("partner", scope);
  const points = toPoints(shape.radii, SCALE);
  const body = closedPath(points);
  const top = Math.min(...points.map((p) => p.y));
  const bottom = Math.max(...points.map((p) => p.y));

  const empty = state !== "normal";
  const shown = empty ? 0 : Math.max(0, Math.min(1, level));
  const surface = bottom - (bottom - top) * shown;
  const liquid = kind === "budget" && low ? "var(--status-low-liquid)" : "var(--status-good-liquid)";
  // Glass: a faint tint of its liquid while there's money in it. An empty jar says why
  // it's empty by its wash, so no label is needed: red = spent it all (stronger when
  // overspent), yellow = never funded.
  const glass = state === "over" || state === "empty" ? "var(--status-over-liquid)" : state === "unfunded" ? "var(--status-low-liquid)" : liquid;
  const glassOpacity = state === "over" ? 0.75 : state === "empty" ? 0.45 : state === "unfunded" ? 0.55 : 0.18;
  const glyph = icon?.trim() || "🧾";
  const glyphSize = (bottom - top) * 0.54;
  // Baseline: floating (a little of it under the surface), clamped between resting on
  // the bottom and staying inside the rim when the jar is full.
  const resting = bottom - glyphSize * 0.16;
  const highest = top + glyphSize * 0.98;
  const baseline = Math.min(resting, Math.max(highest, surface + glyphSize * FLOAT_DEPTH));

  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0, ...style }}>
      <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <clipPath id={`${id}-clip`}><path d={body} /></clipPath>
          <filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
        </defs>
        {/* Faint contact shadow, never a drop shadow on the body. */}
        <ellipse cx={0} cy={bottom + 3} rx={SCALE * 0.62} ry={3.2} fill="var(--mascot-shadow)" filter={`url(#${id}-shadow)`} />
        <path d={body} style={{ fill: glass }} opacity={glassOpacity} />
        <g clipPath={`url(#${id}-clip)`}>
          {shown > 0 && (
            <rect x={-60} y={surface} width={120} height={bottom - surface + 4} style={{ fill: liquid }} />
          )}
          <text
            x={0}
            y={baseline}
            textAnchor="middle"
            fontSize={glyphSize}
            opacity={state === "unfunded" ? 0.6 : 1}
            style={{ filter: "drop-shadow(0 0 1px var(--mascot-sticker, transparent))" }}
          >
            {glyph}
          </text>
        </g>
        <path d={body} fill="none" stroke="var(--mascot-edge, var(--border))" strokeWidth={1.6} />
      </svg>
    </span>
  );
}
