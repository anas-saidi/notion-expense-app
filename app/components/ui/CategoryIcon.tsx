import React from "react";

/**
 * CategoryIcon renders a category/account icon (emoji or fallback) in a visually consistent way.
 * Use this for all category/account icon displays to ensure alignment with the design system.
 */
export function CategoryIcon({ icon, size = 22, style = {} }: { icon?: string | null; size?: number; style?: React.CSSProperties }) {
  return (
    <span
      aria-label="Category icon"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size,
        width: size,
        height: size,
        lineHeight: 1,
        borderRadius: "50%",
        background: "var(--icon-bg, transparent)",
        color: "var(--icon-fg, inherit)",
        ...style,
      }}
    >
      {icon || "#"}
    </span>
  );
}
