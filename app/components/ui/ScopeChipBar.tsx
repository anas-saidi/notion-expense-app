"use client";

import { useState, type CSSProperties } from "react";
import type { BudgetScope } from "../app-types";

/* ─── Scope color tokens (single source of truth) ─────────────── */

export const SCOPE_BG: Record<string, string> = {
  joint:   "var(--accent)",
  anas:    "var(--partner-husband)",
  salma:   "var(--partner-wife)",
  husband: "var(--partner-husband)",
  wife:    "var(--partner-wife)",
  all:     "var(--ink-strong)",
  savings: "var(--warning)",
};

export const SCOPE_INK: Record<string, string> = {
  joint:   "var(--accent-ink)",
  anas:    "#ffffff",
  salma:   "#ffffff",
  husband: "#ffffff",
  wife:    "#ffffff",
  all:     "var(--bg)",
  savings: "var(--accent-ink)",
};

export const SCOPE_COLOR: Record<string, string> = {
  joint:   "var(--accent)",
  anas:    "var(--partner-husband)",
  salma:   "var(--partner-wife)",
  husband: "var(--partner-husband)",
  wife:    "var(--partner-wife)",
  all:     "var(--text2)",
  savings: "var(--warning)",
};

/* ─── Default budget scope chips ──────────────────────────────── */

export const BUDGET_SCOPE_CHIPS: ScopeChipItem[] = [
  { key: "joint", emoji: "👫", label: "Joint" },
  { key: "anas",  emoji: "👨", label: "Anas" },
  { key: "salma", emoji: "👩", label: "Salma" },
];

/* ─── Types ───────────────────────────────────────────────────── */

export type ScopeChipItem = {
  key: string;
  emoji: string;
  label: string;
};

type ScopeChipBarProps = {
  chips: ScopeChipItem[];
  value: string;
  onChange: (key: string) => void;
  /** ARIA label for the chip bar container */
  ariaLabel?: string;
};

/* ─── Bar component ───────────────────────────────────────────── */

export function ScopeChipBar({ chips, value, onChange, ariaLabel = "Scope" }: ScopeChipBarProps) {
  return (
    <div style={railStyle} role="tablist" aria-label={ariaLabel}>
      {chips.map(chip => (
        <ScopeChip
          key={chip.key}
          chip={chip}
          active={chip.key === value}
          onClick={() => onChange(chip.key)}
        />
      ))}
    </div>
  );
}

/* ─── Convenience wrapper for BudgetScope ─────────────────────── */

export function BudgetScopeBar({
  value,
  onChange,
  ariaLabel,
}: {
  value: BudgetScope;
  onChange: (scope: BudgetScope) => void;
  ariaLabel?: string;
}) {
  return (
    <ScopeChipBar
      chips={BUDGET_SCOPE_CHIPS}
      value={value}
      onChange={k => onChange(k as BudgetScope)}
      ariaLabel={ariaLabel}
    />
  );
}

/* ─── Single chip ─────────────────────────────────────────────── */

function ScopeChip({
  chip,
  active,
  onClick,
}: {
  chip: ScopeChipItem;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={active ? `${chip.label}, selected` : `Filter by ${chip.label}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={active ? {
        height: 38,
        borderRadius: 12,
        border: "none",
        background: SCOPE_BG[chip.key] ?? "var(--ink-strong)",
        color: SCOPE_INK[chip.key] ?? "var(--bg)",
        padding: "0 14px 0 10px",
        gap: 7,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        transform: pressed ? "scale(0.95)" : "translateY(-1px)",
        transition: "transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)",
        animation: "categorySelectIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
        flexShrink: 0,
      } : {
        width: 38,
        height: 38,
        borderRadius: 12,
        border: "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
        background: "transparent",
        color: SCOPE_COLOR[chip.key] ?? "var(--text2)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.9 : hovered ? 0.75 : 0.45,
        transform: pressed ? "scale(0.93)" : hovered ? "translateY(-1px)" : "none",
        transition: "opacity 0.18s ease, transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{chip.emoji}</span>
      {active && (
        <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>
          {chip.label}
        </span>
      )}
    </button>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const railStyle: CSSProperties = {
  display: "flex",
  gap: 8,
};
