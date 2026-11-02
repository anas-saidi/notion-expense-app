"use client";

import type { BudgetScope } from "../app-types";
import { Mascot } from "../mascot/Mascot";
import { useAppHaptics } from "./useAppHaptics";

/* ─── App-wide budget scope picker ─────────────────────────────── */

const GLOBAL_SCOPE_NAMES: Record<BudgetScope, string> = { joint: "Joint", anas: "Anas", salma: "Salma" };
const PICKER_MASCOT_SIZE = 30;

/**
 * Joint and both partners, each shown as its own mascot, so the mode reads the same
 * way as the jars on screen, with visible names on desktop.
 * Joint sits between the two partners.
 */
export function GlobalBudgetScopePicker({
  value,
  onChange,
  personalScope,
  label = "App-wide budget scope",
}: {
  label?: string;
  value: BudgetScope;
  onChange: (scope: BudgetScope) => void;
  personalScope: Exclude<BudgetScope, "joint">;
}) {
  const { haptic } = useAppHaptics();
  // Joint in the middle, between the two partners; the signed-in person on the left.
  const scopes: BudgetScope[] = [personalScope, "joint", personalScope === "anas" ? "salma" : "anas"];
  return (
    <div className="global-scope-picker" role="tablist" aria-label={label}>
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
              haptic("selection");
              onChange(scope);
            }}
          >
            <Mascot
              target={{ scope, gap: 0, mood: "happy", outline: "partner", celebrate: scope === "joint" }}
              size={PICKER_MASCOT_SIZE}
              calm
              style={{ flexShrink: 0, margin: "-4px -3px" }}
            />
            <span className="global-scope-label">{GLOBAL_SCOPE_NAMES[scope]}</span>
          </button>
        );
      })}
    </div>
  );
}
