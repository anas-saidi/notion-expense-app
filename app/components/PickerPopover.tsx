"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

type PickerPopoverProps = {
  open: boolean;
  children: ReactNode;
  width?: string;
  align?: "left" | "right";
  placement?: "top" | "bottom";
  zIndex?: number;
  anchorRef?: RefObject<HTMLElement | null>;
};

export function PickerPopover({
  open,
  children,
  width = "min(296px, calc(100vw - 56px))",
  align = "left",
  placement = "bottom",
  zIndex = 80,
  anchorRef,
}: PickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [positionStyle, setPositionStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current || !popoverRef.current) {
      return;
    }

    const updatePosition = () => {
      if (!anchorRef.current || !popoverRef.current) return;

      const anchorRect = anchorRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gutter = 12;

      let left = align === "right" ? anchorRect.right - popoverRect.width : anchorRect.left;
      left = Math.min(Math.max(gutter, left), viewportWidth - popoverRect.width - gutter);

      const preferredTop =
        placement === "bottom"
          ? anchorRect.bottom + 10
          : anchorRect.top - popoverRect.height - 10;
      const fallbackTop =
        placement === "bottom"
          ? anchorRect.top - popoverRect.height - 10
          : anchorRect.bottom + 10;

      const preferredFits =
        preferredTop >= gutter && preferredTop + popoverRect.height <= viewportHeight - gutter;
      let top = preferredFits ? preferredTop : fallbackTop;
      top = Math.min(Math.max(gutter, top), viewportHeight - popoverRect.height - gutter);

      setPositionStyle({
        position: "fixed",
        left,
        top,
        visibility: "visible",
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, anchorRef, open, placement]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={popoverRef}
      data-picker-popover="true"
      style={{
        ...positionStyle,
        width,
        maxWidth: "min(calc(100vw - 24px), calc(100dvw - 24px))",
        background: "color-mix(in srgb, var(--surface) 97%, white)",
        border: "1px solid color-mix(in srgb, var(--border2) 64%, transparent)",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 12px 22px rgba(47,36,25,0.10)",
        boxSizing: "border-box",
        zIndex,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
