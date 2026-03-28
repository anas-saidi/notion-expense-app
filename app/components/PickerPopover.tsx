import { type CSSProperties, type ReactNode } from "react";

type PickerPopoverProps = {
  open: boolean;
  children: ReactNode;
  width?: string;
  align?: "left" | "right";
  placement?: "top" | "bottom";
  zIndex?: number;
};

export function PickerPopover({
  open,
  children,
  width = "min(320px, calc(100vw - 72px))",
  align = "left",
  placement = "bottom",
  zIndex = 80,
}: PickerPopoverProps) {
  if (!open) return null;

  const positionStyle: CSSProperties =
    placement === "bottom"
      ? { top: "calc(100% + 10px)" }
      : { bottom: "calc(100% + 10px)" };

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyle,
        [align]: 0,
        width,
        maxWidth: "min(calc(100vw - 32px), calc(100dvw - 32px))",
        background: "color-mix(in srgb, var(--surface) 97%, white)",
        border: "1px solid color-mix(in srgb, var(--border2) 64%, transparent)",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 14px 26px rgba(47,36,25,0.10)",
        boxSizing: "border-box",
        zIndex,
      }}
    >
      {children}
    </div>
  );
}
