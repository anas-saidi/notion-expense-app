"use client";

import type { CSSProperties, ReactNode } from "react";
import { LiquidButton, glassControlStyle } from "./LiquidGlass";

/**
 * The app's one chip (design.md, Shared components). Modes:
 * - filter: a toggle that narrows what the screen shows (aria-pressed).
 * - tab: one of a set of local tabs (role="tab", aria-selected); wrap the set in role="tablist".
 * - action: a pill that opens or does something (a picker trigger, a quick amount, a fix link). No selected state;
 *   pass ariaHasPopup/ariaExpanded when it opens a picker.
 * Never use a chip for passive metadata: that is a badge or plain text.
 */
export function ScreenChip({
  selected = false,
  onClick,
  children,
  badge,
  badgeTone = "neutral",
  mode = "filter",
  ariaLabel,
  minHeight = 44,
  icon,
  disabled,
  title,
  ariaHasPopup,
  ariaExpanded,
  ariaControls,
  style,
}: {
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
  badge?: ReactNode;
  badgeTone?: "neutral" | "metric";
  mode?: "filter" | "tab" | "action";
  ariaLabel?: string;
  minHeight?: number;
  /** Optional leading 16px Lucide icon; decorative. */
  icon?: ReactNode;
  disabled?: boolean;
  /** Tooltip, e.g. why the chip is disabled. */
  title?: string;
  ariaHasPopup?: "dialog" | "listbox" | "menu" | boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
  /** Layout only (margin, flex, maxWidth); material, colour and type stay the chip's. */
  style?: CSSProperties;
}) {
  const shownSelected = mode !== "action" && selected;
  return (
    <LiquidButton
      type="button"
      className="screen-chip"
      variant="glass"
      data-selected={shownSelected ? "" : undefined}
      role={mode === "tab" ? "tab" : undefined}
      aria-selected={mode === "tab" ? selected : undefined}
      aria-pressed={mode === "filter" ? selected : undefined}
      aria-label={ariaLabel}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={{
        ...chipStyle(shownSelected),
        // Action chips sit in wrapping rows (composer pickers) and may shrink with an ellipsis; filters and tabs scroll.
        ...(mode === "action" ? { flexShrink: 1, minWidth: 0, maxWidth: "100%" } : null),
        minHeight,
        ...(disabled ? { opacity: 0.45, cursor: "not-allowed" } : null),
        ...glassControlStyle(style),
      }}
    >
      {icon && <span aria-hidden="true" style={iconStyle}>{icon}</span>}
      <span style={labelStyle}>{children}</span>
      {badge !== undefined && <span aria-hidden="true" style={badgeStyle(shownSelected, badgeTone)}>{badge}</span>}
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

const iconStyle: CSSProperties = { display: "inline-flex", flexShrink: 0, marginLeft: -2 };

const labelStyle: CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const badgeStyle = (selected: boolean, tone: "neutral" | "metric"): CSSProperties => ({
  minWidth: 24,
  height: 20,
  padding: "0 4px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: tone === "metric" && !selected
    ? "var(--select-wash)"
    : selected ? "var(--lg-glass)" : "var(--surface2)",
  color: tone === "metric" && !selected ? "var(--select-ink)" : "inherit",
  fontSize: 12,
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
});
