"use client";

import type { CSSProperties, ReactNode } from "react";
import { useAnimate, useReducedMotion } from "motion/react";
import { useAppHaptics } from "../ui/useAppHaptics";

/** A standalone jar can respond to a tap without opening a detail spill. */
export function MascotTap({ children, label, tabIndex, style }: { children: ReactNode; label: string; tabIndex?: number; style?: CSSProperties }) {
  const { haptic } = useAppHaptics();
  const [scope, animate] = useAnimate();
  const reduced = useReducedMotion();
  const respond = () => {
    haptic("light");
    // Stop the previous press before replaying: rapid taps never queue motion.
    if (!reduced && scope.current) {
      scope.current.getAnimations().forEach((animation: Animation) => animation.cancel());
      void animate(scope.current, { scaleX: [1, 1.035, 1], scaleY: [1, 0.96, 1] }, { duration: 0.28, ease: "easeOut" });
    }
  };
  return <button ref={scope} type="button" className="mascot-tap" aria-label={label} tabIndex={tabIndex}
    onClick={respond}
    style={{ display: "grid", placeItems: "center", padding: 0, border: 0, background: "transparent", color: "inherit", minWidth: 44, minHeight: 44, margin: "0 auto", flexShrink: 0, cursor: "pointer", ...style }}>
    {children}
  </button>;
}
