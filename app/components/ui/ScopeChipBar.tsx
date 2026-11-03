"use client";

import { useRef } from "react";
import type { BudgetScope } from "../app-types";
import { Mascot } from "../mascot/Mascot";
import { useAppHaptics } from "./useAppHaptics";

/* ─── App-wide budget scope picker ─────────────────────────────── */

const GLOBAL_SCOPE_NAMES: Record<BudgetScope, string> = { joint: "Joint", anas: "Anas", salma: "Salma" };
const PICKER_MASCOT_SIZE = 30;

/**
 * Joint and both partners, each shown as its own mascot, so the mode reads the same
 * way as the jars on screen, with visible names on desktop.
 * On phones, selection rotates that mascot to the front of a compact stack.
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
  const picker = useRef<HTMLDivElement>(null);
  // Joint in the middle, between the two partners; the signed-in person on the left.
  const scopes: BudgetScope[] = [personalScope, "joint", personalScope === "anas" ? "salma" : "anas"];
  const selected = scopes.indexOf(value);
  const select = (scope: BudgetScope) => { haptic("selection"); onChange(scope); };
  return (
    <div ref={picker} className="global-scope-picker" role="tablist" aria-label={label}
      onKeyDown={event => {
        const index = event.key === "ArrowRight" ? (selected + 1) % 3 : event.key === "ArrowLeft" ? (selected + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
        if (index < 0) return;
        event.preventDefault(); select(scopes[index]);
        picker.current?.querySelector<HTMLButtonElement>(`[data-scope="${scopes[index]}"]`)?.focus();
      }}>
      {scopes.map((scope, index) => {
        const active = scope === value;
        const slot = (index - selected + 3) % 3;
        return (
          <button
            key={scope}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            title={GLOBAL_SCOPE_NAMES[scope]}
            aria-label={GLOBAL_SCOPE_NAMES[scope]}
            className="global-scope-option"
            data-scope={scope}
            data-position={slot === 0 ? "front" : slot === 1 ? "back-right" : "back-left"}
            onClick={() => select(scope)}
          >
            <span className="global-scope-art" aria-hidden="true">
            <Mascot
              target={{ scope, gap: 0, mood: "happy", outline: "partner", celebrate: scope === "joint" }}
              size={PICKER_MASCOT_SIZE}
              calm
              style={{ flexShrink: 0, margin: "-4px -3px" }}
            />
            </span>
            <span className="global-scope-label">{GLOBAL_SCOPE_NAMES[scope]}</span>
          </button>
        );
      })}
    </div>
  );
}
