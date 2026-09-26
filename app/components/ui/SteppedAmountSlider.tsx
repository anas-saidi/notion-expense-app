"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { fmt } from "../app-utils";
import { useAppHaptics } from "./useAppHaptics";

function practicalStep(span: number) {
  if (span <= 0) return 1;
  const target = span / 24;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const candidates = [1, 2, 2.5, 5, 10].map((value) => value * magnitude);
  return Math.max(1, Math.round(candidates.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best)));
}

/** Share of the range, from the low end, over which the ticks warm from green to red. */
const WARN_ZONE = 0.25;

/**
 * Tick colour while sliding: the accent, warming through warning to danger over the
 * last stretch before the low end (the category running out of money).
 */
function toneFor(fraction: number): string {
  const heat = Math.min(1, Math.max(0, (WARN_ZONE - fraction) / WARN_ZONE));
  if (heat <= 0) return "var(--accent)";
  if (heat < 0.5) return `color-mix(in srgb, var(--warning) ${Math.round(heat * 200)}%, var(--accent))`;
  return `color-mix(in srgb, var(--danger) ${Math.round((heat - 0.5) * 200)}%, var(--warning))`;
}

export function SteppedAmountSlider({ min, max, value, onChange, label }: { min: number; max: number; value: number; onChange: (value: number) => void; label: string }) {
  const { haptic } = useAppHaptics();
  const [sliding, setSliding] = useState(false);
  const lastIndex = useRef<number | null>(null);
  const stops = useMemo(() => {
    const span = Math.max(0, max - min);
    if (span === 0) return [min];
    const step = practicalStep(span);
    const values = Array.from({ length: Math.floor(span / step) + 1 }, (_, index) => min + (index * step));
    if (values[values.length - 1] !== max) values.push(max);
    return values;
  }, [max, min]);
  const active = stops.reduce((best, stop, index) => Math.abs(stop - value) < Math.abs(stops[best] - value) ? index : best, 0);
  const lastStop = stops.length - 1;
  // Only tint while the finger is down, so a category resting at zero doesn't sit there red.
  const tone = sliding && lastStop > 0 ? toneFor(active / lastStop) : "var(--accent)";

  const select = (index: number) => {
    if (index !== lastIndex.current) {
      // A firmer tap at either end, a light tick for every stop in between.
      haptic(index === 0 || index === lastStop ? "rigid" : "selection");
      lastIndex.current = index;
    }
    onChange(stops[index] ?? min);
  };

  return <div className="planning-step-control" style={wrapStyle}>
    <div style={ticksStyle} aria-hidden="true">{stops.map((stop, index) => <span key={`${stop}-${index}`} style={tickStyle(index === active, index < active, tone)} />)}</div>
    <input
      className="planning-dial-range"
      type="range"
      min={0}
      max={Math.max(0, lastStop)}
      step={1}
      value={active}
      onPointerDown={() => { lastIndex.current = active; setSliding(true); }}
      onPointerUp={() => setSliding(false)}
      onPointerCancel={() => setSliding(false)}
      onBlur={() => setSliding(false)}
      onChange={(event) => select(Number(event.target.value))}
      aria-label={label}
      aria-valuetext={`${fmt(value)} MAD`}
      style={rangeStyle}
    />
  </div>;
}

const wrapStyle: CSSProperties = { position: "relative", display: "grid", padding: "2px 0", touchAction: "none" };
const ticksStyle: CSSProperties = { height: 38, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" };
const tickStyle = (active: boolean, passed: boolean, tone: string): CSSProperties => ({ width: active ? 4 : 3, height: 34, borderRadius: 999, background: active ? tone : passed ? `color-mix(in srgb, ${tone} 48%, var(--text2))` : "var(--surface2)", transform: `scaleY(${active ? 1 : .65})`, transformOrigin: "center", transition: "transform 150ms var(--ease-standard), background-color 150ms ease" });
const rangeStyle: CSSProperties = { position: "absolute", inset: "0 0 auto", width: "100%", height: 44, margin: 0, opacity: 0, cursor: "ew-resize", touchAction: "none" };
