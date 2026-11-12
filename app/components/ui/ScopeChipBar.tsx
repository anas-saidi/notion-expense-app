"use client";

import { useRef } from "react";
import type { BudgetScope } from "../app-types";
import { BUDGET_SCOPE_LABELS } from "../app-utils";
import { Mascot } from "../mascot/Mascot";
import { useAppHaptics } from "./useAppHaptics";
import { LiquidSurface } from "./LiquidGlass";

/* ─── App-wide budget scope picker ─────────────────────────────── */

const PICKER_MASCOT_SIZE = 30;
type Partner = Exclude<BudgetScope, "joint">;

/**
 * Two faces, one pill. The pill wraps whoever the screen is about: one partner,
 * or both of them for Couple. Couple has no face of its own because it isn't a
 * third person, it's the two of you.
 *
 * Tap a face for just that person; tap the person already selected, or the
 * gap between the faces, to widen back to Couple. Assistive technology still
 * gets three tabs (you, Couple, your partner) with arrow-key movement.
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
  personalScope: Partner;
}) {
  const { haptic } = useAppHaptics();
  const picker = useRef<HTMLDivElement>(null);
  const partner: Partner = personalScope === "anas" ? "salma" : "anas";
  // The signed-in person on the left, Couple between, the partner on the right.
  const scopes: BudgetScope[] = [personalScope, "joint", partner];
  const selected = scopes.indexOf(value);
  const select = (scope: BudgetScope) => {
    if (scope === value) return;
    haptic("selection");
    onChange(scope);
  };
  const included = (scope: Partner) => value === scope || value === "joint";
  const tab = (scope: BudgetScope) => ({
    role: "tab" as const,
    type: "button" as const,
    "aria-selected": value === scope,
    tabIndex: value === scope ? 0 : -1,
    "aria-label": BUDGET_SCOPE_LABELS[scope],
    title: BUDGET_SCOPE_LABELS[scope],
    "data-scope": scope,
  });
  const face = (scope: Partner) => (
    <button
      key={scope}
      {...tab(scope)}
      className="couple-picker-person"
      data-included={included(scope) || undefined}
      onClick={() => select(value === scope ? "joint" : scope)}
    >
      <span className="couple-picker-art" aria-hidden="true">
        <Mascot target={{ scope, gap: 0, mood: "happy", outline: "partner" }} size={PICKER_MASCOT_SIZE} calm />
      </span>
    </button>
  );
  return (
    <div
      ref={picker}
      className="couple-picker"
      role="tablist"
      aria-label={label}
      data-selected={value === "joint" ? "both" : value === personalScope ? "start" : "end"}
      onKeyDown={event => {
        const index = event.key === "ArrowRight" ? (selected + 1) % 3 : event.key === "ArrowLeft" ? (selected + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
        if (index < 0) return;
        event.preventDefault();
        select(scopes[index]);
        picker.current?.querySelector<HTMLButtonElement>(`[data-scope="${scopes[index]}"]`)?.focus();
      }}
    >
      <LiquidSurface className="couple-picker-pill" aria-hidden="true" />
      {face(personalScope)}
      <button {...tab("joint")} className="couple-picker-join" onClick={() => select("joint")} />
      {face(partner)}
      <span className="couple-picker-label" aria-hidden="true">{BUDGET_SCOPE_LABELS[value]}</span>
    </div>
  );
}
