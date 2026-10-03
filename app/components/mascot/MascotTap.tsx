"use client";

import type { CSSProperties, ReactNode } from "react";
import { useAppHaptics } from "../ui/useAppHaptics";

/** A standalone jar can respond to a tap without opening a detail spill. */
export function MascotTap({ children, label, tabIndex, style }: { children: ReactNode; label: string; tabIndex?: number; style?: CSSProperties }) {
  const { haptic } = useAppHaptics();
  return <button type="button" className="mascot-tap" aria-label={label} tabIndex={tabIndex}
    onClick={() => haptic("light")}
    style={{ display: "grid", placeItems: "center", padding: 0, border: 0, background: "transparent", color: "inherit", minWidth: 44, minHeight: 44, margin: "0 auto", flexShrink: 0, cursor: "pointer", ...style }}>
    {children}
  </button>;
}
