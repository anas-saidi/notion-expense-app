"use client";

import { useEffect, useRef, useState } from "react";
import type { BudgetScope } from "../app-types";
import { BUDGET_SCOPE_LABELS } from "../app-utils";
import { LightMascot } from "../grain/LightMascot";
import { PALETTES } from "../grain/palettes";
import { useAppHaptics } from "./useAppHaptics";

/* ─── App-wide budget scope picker ─────────────────────────────── */

const PICKER_MASCOT_SIZE = 30;
/** How long to hold the gap between the faces before the two lights meet (they drift together meanwhile). */
const JOIN_HOLD_MS = 500;
type Partner = Exclude<BudgetScope, "joint">;

/**
 * Two faces, no container. Whoever the screen is about is lit at full size: one partner,
 * or both of them for Couple; the other face is dimmed and smaller. Couple has no face of its own because it isn't a
 * third person, it's the two of you.
 *
 * Joining happens in the middle, parting on a face:
 * - Hold the gap between the faces and the two lights drift towards it, meeting after JOIN_HOLD_MS:
 *   that switches to Couple. A quick tap on the gap switches at once and plays a short pull.
 * - Tap a face for just that person: the lights drift apart a little. Tapping the face already
 *   selected does nothing.
 * Assistive technology still gets three tabs (you, Couple, your partner) with arrow-key movement.
 * Reduce Motion keeps the gestures and drops the drift.
 */
export function GlobalBudgetScopePicker({
  value,
  onChange,
  personalScope,
  label = "App-wide budget scope",
}: {
  label?: string;
  /**
   * What needs acting on now, by scope. Not shown for now: the light direction drops the red dot on the faces
   * (design.md, Light). Kept so callers and a future signal can use it.
   */
  attention?: Partial<Record<BudgetScope, string>>;
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

  // Hold to join: the faces drift towards the gap while it's held, and meet after JOIN_HOLD_MS.
  const [pulling, setPulling] = useState(false);
  const holdTimer = useRef<number | null>(null);
  // When a hold last joined: the click that ends it, and the change it causes, are already handled.
  const heldJoinAt = useRef(-Infinity);
  const justHeld = () => performance.now() - heldJoinAt.current < 700;
  const stopHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setPulling(false);
  };
  useEffect(() => () => { if (holdTimer.current !== null) window.clearTimeout(holdTimer.current); }, []);
  const startHold = () => {
    if (value === "joint") return;
    setPulling(true);
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      heldJoinAt.current = performance.now();
      setPulling(false);
      select("joint");
    }, JOIN_HOLD_MS);
  };

  // A short pull when Couple is reached without the hold (a tap or the keyboard), a small drift
  // apart when it's left. The parity restarts the CSS animation on every change.
  const [moment, setMoment] = useState<string | undefined>(undefined);
  const previous = useRef(value);
  useEffect(() => {
    const was = previous.current;
    previous.current = value;
    if (was === value) return;
    const flip = (kind: string) => setMoment(current => `${kind}-${current?.endsWith("-a") ? "b" : "a"}`);
    if (value === "joint") {
      if (!justHeld()) flip("join");
    } else if (was === "joint") flip("part");
  }, [value]);
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
      data-side={scope === personalScope ? "start" : "end"}
      onClick={() => select(scope)}
    >
      <span className="couple-picker-art" aria-hidden="true">
        {/* Each face is its partner's light in small (design.md, Light): soft edge, a full core so it reads at 30px, drawn only on change. */}
        <LightMascot scope={scope} target={{ scope, gap: 0, mood: "happy", outline: "partner", fill: 1 }} level={1} size={PICKER_MASCOT_SIZE} spentPct={null}
          edge="soft" levelMode="core" rest="still" tone={PALETTES.partner[scope]} />
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
      data-pulling={pulling || undefined}
      data-moment={moment}
      onKeyDown={event => {
        const index = event.key === "ArrowRight" ? (selected + 1) % 3 : event.key === "ArrowLeft" ? (selected + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
        if (index < 0) return;
        event.preventDefault();
        select(scopes[index]);
        picker.current?.querySelector<HTMLButtonElement>(`[data-scope="${scopes[index]}"]`)?.focus();
      }}
    >
      {face(personalScope)}
      <button
        {...tab("joint")}
        className="couple-picker-join"
        onPointerDown={event => { if (event.button === 0) startHold(); }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={event => event.preventDefault()}
        // A tap (or Enter/Space) joins at once; a completed hold already joined.
        onClick={() => { stopHold(); if (!justHeld()) select("joint"); }}
      />
      {face(partner)}
      <span className="couple-picker-label" aria-hidden="true">{BUDGET_SCOPE_LABELS[value]}</span>
    </div>
  );
}
