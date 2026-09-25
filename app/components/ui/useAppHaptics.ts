"use client";

import { useCallback, useEffect, useRef } from "react";
import { WebHaptics } from "web-haptics";
export type AppHaptic = "selection" | "light" | "rigid" | "success" | "warning" | "error";

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
    // isSupported detects navigator.vibrate only; trigger also provides the iOS fallback.
    if (typeof navigator === "undefined" || navigator.maxTouchPoints < 1) return;
    void hapticsRef.current?.trigger(preset);
  }, []);

  return { haptic, isSupported };
}
