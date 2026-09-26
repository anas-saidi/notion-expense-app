"use client";

import { type CSSProperties } from "react";
import { UsersRound } from "lucide-react";
import type { BudgetScope } from "../app-types";
import { ManIcon, WomanIcon } from "./icons";
import { Mascot } from "../mascot/Mascot";
import { useAppHaptics } from "./useAppHaptics";

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
  const { haptic } = useAppHaptics();
  return (
    <div style={railStyle} role="tablist" aria-label={ariaLabel}>
      {chips.map(chip => (
        <ScopeChip
          key={chip.key}
          chip={chip}
          active={chip.key === value}
          onClick={() => {
            if (chip.key !== value) haptic("selection");
            onChange(chip.key);
          }}
        />
      ))}
    </div>
  );
}

/* ─── App-wide budget scope picker ─────────────────────────────── */

const GLOBAL_SCOPE_NAMES: Record<BudgetScope, string> = { joint: "Joint", anas: "Anas", salma: "Salma" };
const PICKER_MASCOT_SIZE = 30;

/**
 * Joint and both partners, each shown as its own mascot, so the mode reads the same
 * way as the jars on screen; no text, the selected one is tinted in its colour.
 * Joint sits between the two partners.
 */
export function GlobalBudgetScopePicker({
  value,
  onChange,
  personalScope,
}: {
  value: BudgetScope;
  onChange: (scope: BudgetScope) => void;
  personalScope: Exclude<BudgetScope, "joint">;
}) {
  const { haptic } = useAppHaptics();
  // Joint in the middle, between the two partners; the signed-in person on the left.
  const scopes: BudgetScope[] = [personalScope, "joint", personalScope === "anas" ? "salma" : "anas"];
  return (
    <div className="global-scope-picker" role="tablist" aria-label="App-wide budget scope">
      {scopes.map(scope => {
        const active = scope === value;
        return (
          <button
            key={scope}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={GLOBAL_SCOPE_NAMES[scope]}
            className="global-scope-option"
            data-scope={scope}
            onClick={() => {
              if (!active) haptic("selection");
              onChange(scope);
            }}
          >
            {/* Only the selected jar is alive (blinks); the others rest still. Joint is the heart. */}
            <Mascot
              target={{ scope, gap: 0, mood: active ? "happy" : "idle", outline: "partner", celebrate: scope === "joint" }}
              size={PICKER_MASCOT_SIZE}
              calm={!active}
              style={{ flexShrink: 0, margin: "-4px -3px" }}
            />
            <span className="global-scope-label">{GLOBAL_SCOPE_NAMES[scope]}</span>
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
