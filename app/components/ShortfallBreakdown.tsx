"use client";
import type { ShortfallPart } from "./app-utils";
import { fmt } from "./app-utils";
import { ScreenChip } from "./ui/ScreenChip";

/** The working behind "X short" in one quiet line, then what fixes it. */
export function ShortfallBreakdown({ id, parts, fixes }: {
  id: string;
  parts: ShortfallPart[];
  fixes: { label: string; onClick: () => void }[];
}) {
  return (
    <div id={id} className="shortfall-breakdown" role="region" aria-label="Why short">
      <p className="shortfall-line">{parts.map((part, i) => <span key={part.label}>{i > 0 && (part.sign < 0 ? " − " : " + ")}{part.label.replace(/ (hold|has|is overdrawn by)$/, "")} {fmt(Math.round(part.amount))}</span>)}</p>
      {fixes.length > 0 && <div className="shortfall-fixes">{fixes.map(fix => (
        <ScreenChip key={fix.label} mode="action" onClick={fix.onClick}>{fix.label}</ScreenChip>
      ))}</div>}
    </div>
  );
}
