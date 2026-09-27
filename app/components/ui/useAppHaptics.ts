"use client";

import { useCallback, useEffect, useRef } from "react";
import { WebHaptics } from "web-haptics";
export type AppHaptic = "selection" | "light" | "rigid" | "success" | "warning" | "error";

/**
 * iOS Safari has no vibration API. Its one haptic a web page can cause is the tick
 * of a native switch (`<input type="checkbox" switch>`, iOS 18+) being toggled, and
 * only inside a real tap: call it synchronously from a click/pointerup handler,
 * never after an await or during a drag. A fresh switch per tick, clicked through its
 * label and removed, is the most reliable form.
 */
function iosSwitchTick() {
  const label = document.createElement("label");
  label.ariaHidden = "true";
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}

/** A success or error reads as two ticks; everything else is one. */
const IOS_TICKS: Record<AppHaptic, number> = { selection: 1, light: 1, rigid: 1, success: 2, warning: 2, error: 2 };

/** Progressive haptic feedback for supported touch devices. */
export function useAppHaptics() {
  const hapticsRef = useRef<WebHaptics | null>(null);
  const isSupported = WebHaptics.isSupported;

  useEffect(() => {
    const haptics = new WebHaptics();
    hapticsRef.current = haptics;

    return () => {
      haptics.destroy();
      hapticsRef.current = null;
    };
  }, []);

  const haptic = useCallback((preset: AppHaptic) => {
    if (typeof navigator === "undefined" || navigator.maxTouchPoints < 1) return;
    if (WebHaptics.isSupported) {
      void hapticsRef.current?.trigger(preset);
      return;
    }
    // iOS: the first tick must happen now, inside the tap; a second follows shortly.
    iosSwitchTick();
    if (IOS_TICKS[preset] > 1) setTimeout(iosSwitchTick, 90);
  }, []);

  return { haptic, isSupported };
}
