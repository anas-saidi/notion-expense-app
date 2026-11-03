"use client";

import type { CSSProperties, ReactNode } from "react";
import { LiquidButton } from "./LiquidGlass";

export function ScreenChip({
  selected,
  onClick,
  children,
  badge,
  badgeTone = "neutral",
  mode = "filter",
  ariaLabel,
  minHeight = 44,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  badge?: ReactNode;
  badgeTone?: "neutral" | "metric";
  mode?: "filter" | "tab";
  ariaLabel?: string;
  minHeight?: number;
}) {
  return (
    <LiquidButton
      type="button"
      className="screen-chip"
      variant="glass"
      data-selected={selected ? "" : undefined}
      role={mode === "tab" ? "tab" : undefined}
      aria-selected={mode === "tab" ? selected : undefined}
      aria-pressed={mode === "filter" ? selected : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      style={{ ...chipStyle(selected), minHeight }}
    >
      <span>{children}</span>
      {badge !== undefined && <span aria-hidden="true" style={badgeStyle(selected, badgeTone)}>{badge}</span>}
    </LiquidButton>
  );
}

const chipStyle = (selected: boolean): CSSProperties => ({
  minHeight: 44,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "0 12px",
  borderRadius: 999,
  border: 0,
  color: selected ? "var(--text)" : "var(--text2)",
  fontFamily: "var(--font-body)",
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 600,
  cursor: "pointer",
});

const badgeStyle = (selected: boolean, tone: "neutral" | "metric"): CSSProperties => ({
  minWidth: 24,
  height: 20,
  padding: "0 6px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: tone === "metric" && !selected
    ? "var(--select-wash)"
    : selected ? "var(--lg-glass)" : "var(--surface2)",
  color: tone === "metric" && !selected ? "var(--select-ink)" : "inherit",
  fontSize: 11,
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
});
