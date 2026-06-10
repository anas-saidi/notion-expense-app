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
  // Placement is locked on first open and not re-evaluated while the popover
  // is open. Without this, filtering the list changes the popover height,
  // the fit-check flips the direction, and the popover jumps away from anchor.
  const lockedPlacementRef = useRef<"top" | "bottom" | null>(null);
  const [positionStyle, setPositionStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      lockedPlacementRef.current = null;
      return;
    }
    if (!anchorRef?.current || !popoverRef.current) return;

    let frameId: number | null = null;
    const updatePosition = () => {
      if (!anchorRef.current || !popoverRef.current) return;

      const anchorRect = anchorRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gutter = 12;

      let left = align === "right" ? anchorRect.right - popoverRect.width : anchorRect.left;
      left = Math.min(Math.max(gutter, left), viewportWidth - popoverRect.width - gutter);

      // Lock placement direction on first call. Subsequent calls (triggered by
      // the popover resizing as the list filters) reuse the locked direction so
      // the popover never jumps away from the anchor mid-interaction.
      if (lockedPlacementRef.current === null) {
        const preferredTop =
          placement === "bottom"
            ? anchorRect.bottom + 10
            : anchorRect.top - popoverRect.height - 10;
        const preferredFits =
          preferredTop >= gutter && preferredTop + popoverRect.height <= viewportHeight - gutter;
        lockedPlacementRef.current = preferredFits
          ? placement
          : placement === "bottom" ? "top" : "bottom";
      }

      const resolvedPlacement = lockedPlacementRef.current;
      let top =
        resolvedPlacement === "bottom"
          ? anchorRect.bottom + 10
          : anchorRect.top - popoverRect.height - 10;
      top = Math.min(Math.max(gutter, top), viewportHeight - popoverRect.height - gutter);

      setPositionStyle({
        position: "fixed",
        left,
        top,
        visibility: "visible",
      });
    };
    const scheduleUpdate = () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updatePosition);
    };

    updatePosition();
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(popoverRef.current);
    resizeObserver.observe(anchorRef.current);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
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
        boxShadow: "0 0 0 1px color-mix(in srgb, var(--ink-strong) 8%, transparent)",
        boxSizing: "border-box",
        zIndex,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
