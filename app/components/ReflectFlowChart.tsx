"use client";

import type { CSSProperties } from "react";
import { Area, ComposedChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "motion/react";
import { fmt } from "./app-utils";
import type { FlowPoint } from "./reflect-utils";

type Props = { points: FlowPoint[]; height: number };

const SPENT = "color-mix(in srgb, var(--danger) 75%, var(--surface))";
const MONEY_IN = "var(--action-income)";

/**
 * Spending against money in, both running totals over the period. It stands in
 * for the jar when the jar is tapped, so it has no tooltip (a tap goes back to the
 * jar); the legend states where each line ends instead.
 */
export function ReflectFlowChart({ points, height }: Props) {
  const animate = !useReducedMotion();
  const last = points[points.length - 1] ?? { spent: 0, moneyIn: 0 };
  // A handful of evenly spaced labels: the first, the last, and a few between.
  const step = Math.max(1, Math.ceil(points.length / 5));
  // The last label replaces a spaced one that would sit right beside it.
  const lastIndex = points.length - 1;
  const ticks = points.filter((_, i) => i === lastIndex || (i % step === 0 && lastIndex - i >= step / 2)).map(p => p.key);
  const labelOf = new Map(points.map(p => [p.key, p.label]));

  return (
    <div style={{ width: "100%", height, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={legendStyle}>
        <span style={legendItemStyle}><span style={{ ...dotStyle, background: SPENT }} />Spent {fmt(Math.round(last.spent))}</span>
        <span style={legendItemStyle}><span style={{ ...dotStyle, background: MONEY_IN }} />Money in {fmt(Math.round(last.moneyIn))}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="reflectSpentFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SPENT} stopOpacity={0.18} />
                <stop offset="95%" stopColor={SPENT} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="key" ticks={ticks} tickFormatter={key => labelOf.get(key) ?? ""} tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} width={34} tickFormatter={v => Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
            <Area type="monotone" dataKey="moneyIn" stroke={MONEY_IN} strokeWidth={2} strokeDasharray="4 4" fill="none" dot={false} activeDot={false} isAnimationActive={animate} />
            <Area type="monotone" dataKey="spent" stroke={SPENT} strokeWidth={2} fill="url(#reflectSpentFill)" dot={false} activeDot={false} isAnimationActive={animate} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const legendStyle: CSSProperties = { display: "flex", justifyContent: "center", gap: 16, fontSize: 12, color: "var(--muted)" };
const legendItemStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" };
const dotStyle: CSSProperties = { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 };
