"use client";

// One integration point for Glisse; application controls keep their names,
// handlers and financial semantics. The app stylesheet owns theme tuning.
export { Button as LiquidButton, Glass as LiquidSurface, SegmentedControl as LiquidSegments, TabBar as LiquidTabBar } from "glisse";

// Callers supply geometry; shared glass tokens own material in every picker.
export function glassControlStyle(style?: import("react").CSSProperties): import("react").CSSProperties {
  const { background, backgroundColor, backgroundImage, border, borderColor, boxShadow, backdropFilter, WebkitBackdropFilter, ...geometry } = style ?? {};
  return geometry;
}
