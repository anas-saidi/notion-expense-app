"use client";

import { useMemo, type CSSProperties } from "react";
import { fmt } from "../app-utils";

function practicalStep(span: number) {
  if (span <= 0) return 1;
  const target = span / 24;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const candidates = [1, 2, 2.5, 5, 10].map((value) => value * magnitude);
  return Math.max(1, Math.round(candidates.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best)));
}

export function SteppedAmountSlider({ min, max, value, onChange, label }: { min: number; max: number; value: number; onChange: (value: number) => void; label: string }) {
  const stops = useMemo(() => {
    const span = Math.max(0, max - min);
    if (span === 0) return [min];
    const step = practicalStep(span);
    const values = Array.from({ length: Math.floor(span / step) + 1 }, (_, index) => min + (index * step));
    if (values[values.length - 1] !== max) values.push(max);
    return values;
  }, [max, min]);
  const active = stops.reduce((best, stop, index) => Math.abs(stop - value) < Math.abs(stops[best] - value) ? index : best, 0);
  return <div className="planning-step-control" style={wrapStyle}>
    <div style={ticksStyle} aria-hidden="true">{stops.map((stop, index) => <span key={`${stop}-${index}`} style={tickStyle(index === active, index < active)} />)}</div>
    <input className="planning-dial-range" type="range" min={0} max={Math.max(0, stops.length - 1)} step={1} value={active} onChange={(event) => onChange(stops[Number(event.target.value)] ?? min)} aria-label={label} aria-valuetext={`${fmt(value)} MAD`} style={rangeStyle} />
  </div>;
}

const wrapStyle: CSSProperties = { position: "relative", display: "grid", padding: "2px 0", touchAction: "none" };
const ticksStyle: CSSProperties = { height: 38, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px" };
const tickStyle = (active: boolean, passed: boolean): CSSProperties => ({ width: active ? 4 : 3, height: 34, borderRadius: 999, background: active ? "var(--accent)" : passed ? "color-mix(in srgb, var(--accent) 48%, var(--text2))" : "var(--surface2)", transform: `scaleY(${active ? 1 : .65})`, transformOrigin: "center", transition: "transform 150ms var(--ease-standard), background-color 150ms ease" });
const rangeStyle: CSSProperties = { position: "absolute", inset: "0 0 auto", width: "100%", height: 44, margin: 0, opacity: 0, cursor: "ew-resize", touchAction: "none" };
