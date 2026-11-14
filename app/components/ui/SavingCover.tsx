"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BudgetScope } from "../app-types";
import { MascotHero } from "../mascot/MascotHero";
import "./saving-cover.css";

/**
 * The one saving pattern (design.md, Shared components): every write blocks the surface it was made from.
 *
 *   const save = useBlockingSave();
 *   await save.run(() => postExpense(body));      // saving is true until the promise settles; errors rethrow
 *   <BottomSheet onClose={guardClose(save.saving, onClose)}> ... <SavingCover saving={save.saving} /> </BottomSheet>
 *
 * No per-button spinners and no partial disabling: the cover makes the whole sheet or view inert,
 * shows Bloub thinking (three dots; a quiet dot under Reduce Motion) and says "Saving".
 */

export function useBlockingSave() {
  const [saving, setSaving] = useState(false);
  const inFlight = useRef<Promise<unknown> | null>(null);
  const run = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    // A second tap while a write runs joins the running write instead of sending another.
    if (inFlight.current) return inFlight.current as Promise<T>;
    setSaving(true);
    const pending = (async () => {
      try {
        return await fn();
      } finally {
        inFlight.current = null;
        setSaving(false);
      }
    })();
    inFlight.current = pending;
    return pending;
  }, []);
  return { saving, run };
}

/**
 * Wrap a surface's close handler so backdrop taps, drag dismissal, Escape and the close button
 * do nothing while a write runs. BottomSheet stays untouched: pass the guarded handler as its onClose.
 */
export function guardClose<A extends unknown[]>(saving: boolean, onClose: (...args: A) => void): (...args: A) => void {
  return (...args: A) => {
    if (!saving) onClose(...args);
  };
}

function currentScope(): BudgetScope {
  if (typeof document === "undefined") return "joint";
  const scope = document.documentElement.dataset.scope;
  return scope === "anas" || scope === "salma" ? scope : "joint";
}

/**
 * Render as the last child of the sheet or view being saved from.
 * fill="surface" (default): covers the nearest positioned ancestor; inside a BottomSheet that is the sheet
 * frame. Everything else in the sheet (`.bottom-sheet-panel`, or the nearest `[data-saving-surface]`) goes inert.
 * fill="screen": a fixed cover over the whole app (portalled to body); everything else on the page goes inert.
 */
export function SavingCover({ saving, label = "Saving", fill = "surface", scope }: {
  saving: boolean;
  /** Visible status text. "Saving" for every write; "Deleting" only when the write removes a record. */
  label?: string;
  fill?: "surface" | "screen";
  /** Whose jar to show; defaults to the app-wide wallet mode. */
  scope?: BudgetScope;
}) {
  const coverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    const cover = coverRef.current;
    if (!saving || !cover) return;
    const root: HTMLElement = fill === "screen"
      ? document.body
      : cover.closest<HTMLElement>("[data-saving-surface], .bottom-sheet-panel") ?? cover.parentElement ?? document.body;

    // Make every branch beside the path from the cover up to the root inert; the cover itself stays live.
    const changed: { element: HTMLElement; wasInert: boolean }[] = [];
    let node: HTMLElement = cover;
    while (node !== root && node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling === node || !(sibling instanceof HTMLElement)) continue;
        changed.push({ element: sibling, wasInert: sibling.inert });
        sibling.inert = true;
      }
      node = node.parentElement;
    }

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cover.focus({ preventScroll: true });

    // Native listeners so nothing beneath (sheet drag, Escape handlers, row gestures) sees the input.
    const swallow = (event: Event) => event.stopPropagation();
    const swallowKey = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape" || event.key === "Tab") event.preventDefault();
    };
    const pointerEvents = ["pointerdown", "pointerup", "mousedown", "touchstart", "click", "wheel"] as const;
    pointerEvents.forEach((type) => cover.addEventListener(type, swallow));
    cover.addEventListener("keydown", swallowKey);

    return () => {
      pointerEvents.forEach((type) => cover.removeEventListener(type, swallow));
      cover.removeEventListener("keydown", swallowKey);
      for (const { element, wasInert } of changed) element.inert = wasInert;
      if (previous?.isConnected && !previous.closest("[inert]")) previous.focus({ preventScroll: true });
    };
  }, [saving, fill]);

  if (!saving) return null;
  const cover = (
    <div ref={coverRef} className="saving-cover" data-fill={fill} tabIndex={-1} aria-busy="true">
      <div className="saving-cover-veil" aria-hidden="true" />
      <div className="saving-cover-content">
        <div aria-hidden="true">
          <MascotHero look="light" variant="pool" scope={scope ?? currentScope()} level={0.6} spentPct={null} remember={false} size={112} signal={{ kind: "thinking" }} />
        </div>
        <p className="saving-cover-label" role="status" style={{ margin: 0 }}>{label}</p>
      </div>
    </div>
  );
  return fill === "screen" ? (mounted ? createPortal(cover, document.body) : null) : cover;
}
