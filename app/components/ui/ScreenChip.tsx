"use client";

import type { CSSProperties, ReactNode } from "react";

export function ScreenChip({
  selected,
  onClick,
  children,
  badge,
  badgeTone = "neutral",
  mode = "filter",
  ariaLabel,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  badge?: ReactNode;
  badgeTone?: "neutral" | "metric";
  mode?: "filter" | "tab";
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role={mode === "tab" ? "tab" : undefined}
      aria-selected={mode === "tab" ? selected : undefined}
      aria-pressed={mode === "filter" ? selected : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      style={chipStyle(selected)}
    >
      <span>{children}</span>
      {badge !== undefined && <span aria-hidden="true" style={badgeStyle(selected, badgeTone)}>{badge}</span>}
    </button>
  );
}

const chipStyle = (selected: boolean): CSSProperties => ({
  minHeight: 36,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "0 12px",
  borderRadius: 999,
  border: selected ? "1px solid transparent" : "1px solid color-mix(in srgb, var(--border) 44%, transparent)",
  background: selected ? "var(--text)" : "var(--surface)",
  color: selected ? "var(--bg)" : "var(--text2)",
  fontFamily: "var(--font-body)",
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 700,
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
    ? "color-mix(in srgb, var(--accent) 22%, var(--surface))"
    : selected ? "color-mix(in srgb, var(--bg) 18%, transparent)" : "var(--surface2)",
  color: tone === "metric" && !selected ? "var(--accent-ink)" : "inherit",
  fontSize: 11,
  fontWeight: 650,
  fontVariantNumeric: "tabular-nums",
});
