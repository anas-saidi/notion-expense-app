"use client";

import { useMemo, type CSSProperties } from "react";
import { pileMonth } from "./month-pile";

export type PileCategory = { id: string; amount: number; icon: string };

type Props = {
  /** The month's top categories; each emoji's area follows its spend. */
  categories: PileCategory[];
  /** Share of the box the pile covers, 0–1. */
  fill: number;
  size?: number;
  style?: CSSProperties;
};

const S = 50;
/** Emoji glyphs sit a little inside their em box; this keeps neighbours visually touching. */
const GLYPH = 1.95;

/** A month's biggest categories as emojis piled up on an invisible floor. Static, no container. */
export function MonthPile({ categories, fill, size = 96, style }: Props) {
  const pile = useMemo(() => pileMonth(categories.map(({ id, amount }) => ({ id, amount })), { size: S, fill }), [categories, fill]);
  const icon = new Map(categories.map((c) => [c.id, c.icon]));
  return (
    <svg viewBox={`${-S} ${-S} ${S * 2} ${S * 2}`} width={size} height={size} aria-hidden="true" style={{ display: "block", overflow: "visible", ...style }}>
      {pile.map((p) => (
        <text key={p.id} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={p.r * GLYPH}>{icon.get(p.id)}</text>
      ))}
    </svg>
  );
}
