import type { CSSProperties, ReactNode } from "react";

/** Centres a standalone light in its box. Not a control: a light only reacts to taps that do something (PartnerTap). */
export function MascotFrame({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: "grid", placeItems: "center", minWidth: 44, minHeight: 44, margin: "0 auto", flexShrink: 0, ...style }}>{children}</div>;
}
