"use client";
import type { ReactNode } from "react";
import { useAppHaptics } from "./useAppHaptics";
import "./switch.css";

/**
 * The app's one on/off control, replacing native checkboxes. A whole-row button with role="switch": the label
 * sits on the left and the track on the right, so the tap target is the full row (44px min). Use it for a
 * setting or a choice that applies to the current form ("Part payment", "Update contributions"), never for
 * picking items from a list (that's ScreenChip or a picker).
 */
export function Switch({ checked, onChange, children, hint, disabled = false, compact = false }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Visible label: a short factual phrase. */
  children: ReactNode;
  /** Optional second line under the label, muted. */
  hint?: ReactNode;
  disabled?: boolean;
  /** Tighter row for lists of switches (filters). */
  compact?: boolean;
}) {
  const { haptic } = useAppHaptics();
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      className="app-switch" data-compact={compact || undefined}
      onClick={() => { haptic("selection"); onChange(!checked); }}>
      <span className="app-switch-copy">
        <span className="app-switch-label">{children}</span>
        {hint && <span className="app-switch-hint">{hint}</span>}
      </span>
      <span className="app-switch-track" aria-hidden="true"><span className="app-switch-thumb" /></span>
    </button>
  );
}
