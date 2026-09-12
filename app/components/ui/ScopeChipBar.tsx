"use client";

import { type CSSProperties } from "react";
import { UsersRound } from "lucide-react";
import type { BudgetScope } from "../app-types";
import { ManIcon, WomanIcon } from "./icons";

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
  anas:    "var(--partner-husband-ink)",
  salma:   "var(--partner-wife-ink)",
  husband: "var(--partner-husband-ink)",
  wife:    "var(--partner-wife-ink)",
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
  { key: "joint", label: "Joint" },
  { key: "anas",  label: "Husband" },
  { key: "salma", label: "Wife" },
];

/* ─── Types ───────────────────────────────────────────────────── */

export type ScopeChipItem = {
  key: string;
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

/* ─── App-wide budget scope picker ─────────────────────────────── */

export function GlobalBudgetScopePicker({
  value,
  onChange,
  personalScope,
}: {
  value: BudgetScope;
  onChange: (scope: BudgetScope) => void;
  personalScope: Exclude<BudgetScope, "joint">;
}) {
  const chips: ScopeChipItem[] = [
    { key: "joint", label: "Joint" },
    { key: "personal", label: "Personal" },
  ];
  return (
    <div className="global-scope-picker" role="tablist" aria-label="App-wide budget scope">
      {chips.map(chip => {
        const active = chip.key === "joint" ? value === "joint" : value !== "joint";
        const ScopeIcon = chip.key === "joint" ? UsersRound : personalScope === "anas" ? ManIcon : WomanIcon;
        return (
          <button
            key={chip.key}
            type="button"
            role="tab"
            aria-selected={active}
            className="global-scope-option"
            onClick={() => onChange(chip.key === "joint" ? "joint" : personalScope)}
          >
            <ScopeIcon className="global-scope-icon" size={13} strokeWidth={2.2} aria-hidden="true" />
            <span>{chip.label}</span>
          </button>
        );
      })}
    </div>
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
  const ScopeIcon = chip.key === "joint" ? UsersRound : chip.key === "anas" || chip.key === "husband" ? ManIcon : WomanIcon;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={active ? `${chip.label}, selected` : `Filter by ${chip.label}`}
      onClick={onClick}
      style={active ? {
        minHeight: 44,
        borderRadius: 999,
        border: "none",
        background: SCOPE_BG[chip.key] ?? "var(--ink-strong)",
        color: SCOPE_INK[chip.key] ?? "var(--bg)",
        padding: "0 14px 0 10px",
        gap: 7,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
      } : {
        minHeight: 44,
        borderRadius: 999,
        border: "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
        background: "var(--surface)",
        color: SCOPE_COLOR[chip.key] ?? "var(--text2)",
        padding: "0 14px 0 10px",
        gap: 7,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <ScopeIcon size={17} strokeWidth={2.1} aria-hidden="true" />
      <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>{chip.label}</span>
    </button>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const railStyle: CSSProperties = {
  display: "flex",
  gap: 8,
};
