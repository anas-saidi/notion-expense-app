"use client";

import { useCallback, useRef } from "react";
import { useWebHaptics } from "web-haptics/react";
export type AppHaptic = "selection" | "light" | "rigid" | "success" | "warning" | "error";

/** Progressive haptic feedback for supported touch devices. */
export function useAppHaptics() {
  const { trigger, isSupported } = useWebHaptics();
  const triggerRef = useRef(trigger);
  triggerRef.current = trigger;

  const haptic = useCallback((preset: AppHaptic) => {
    if (!isSupported || typeof navigator === "undefined" || navigator.maxTouchPoints < 1) return;
    void triggerRef.current(preset);
  }, [isSupported]);

  return { haptic, isSupported };
}
