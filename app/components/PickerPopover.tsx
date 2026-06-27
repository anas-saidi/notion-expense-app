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

// Below this width, always pin to bottom of visual viewport (above keyboard on mobile)
const MOBILE_BREAKPOINT = 600;

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
  // Placement direction is locked on first open so the popover doesn't jump
  // while the list re-renders (filtering changes popover height).
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
      // Use visualViewport for accurate dimensions when virtual keyboard is open
      const vv = window.visualViewport;
      const viewportHeight = vv?.height ?? window.innerHeight;
      const viewportWidth = window.innerWidth;
      const gutter = 8;

      // ── Mobile: pin to the bottom of the visual viewport ──────────────────
      // On mobile the virtual keyboard shrinks the visual viewport. Anchoring a
      // popover to a chip while the keyboard is open is unreliable across iOS/
      // Android PWA. Instead we follow the native pattern: float the picker as
      // a full-width panel just above the keyboard (bottom: gutter).
      if (viewportWidth < MOBILE_BREAKPOINT) {
        setPositionStyle({
          position: "fixed",
          left: gutter,
          right: gutter,
          bottom: gutter,
          visibility: "visible",
        });
        return;
      }

      // ── Desktop: anchor to the chip ────────────────────────────────────────
      let left = align === "right"
        ? anchorRect.right - popoverRect.width
        : anchorRect.left;
      left = Math.min(Math.max(gutter, left), viewportWidth - popoverRect.width - gutter);

      // Lock direction once so filtering the list doesn't flip it mid-session
      if (lockedPlacementRef.current === null) {
        const preferredTop =
          placement === "bottom"
            ? anchorRect.bottom + 10
            : anchorRect.top - popoverRect.height - 10;
        const fits =
          preferredTop >= gutter && preferredTop + popoverRect.height <= viewportHeight - gutter;
        lockedPlacementRef.current = fits
          ? placement
          : placement === "bottom" ? "top" : "bottom";
      }

      const resolvedPlacement = lockedPlacementRef.current;
      let top =
        resolvedPlacement === "bottom"
          ? anchorRect.bottom + 10
          : anchorRect.top - popoverRect.height - 10;
      top = Math.min(Math.max(gutter, top), viewportHeight - popoverRect.height - gutter);

      setPositionStyle({ position: "fixed", left, top, visibility: "visible" });
    };

    const scheduleUpdate = () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updatePosition);
    };

    updatePosition();

    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(popoverRef.current);
    ro.observe(anchorRef.current);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    // visualViewport fires when the virtual keyboard opens/closes on mobile
    const vv = window.visualViewport;
    vv?.addEventListener("resize", scheduleUpdate);
    vv?.addEventListener("scroll", scheduleUpdate);

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      ro.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      vv?.removeEventListener("resize", scheduleUpdate);
      vv?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [align, anchorRef, open, placement]);

  if (!open || !mounted) return null;

  // On mobile (bottom-pinned), `right` is set so `width` must be "auto"
  const isMobilePinned = "right" in positionStyle;

  return createPortal(
    <div
      ref={popoverRef}
      data-picker-popover="true"
      style={{
        ...positionStyle,
        width: isMobilePinned ? "auto" : width,
        maxWidth: "min(calc(100vw - 16px), calc(100dvw - 16px))",
        // On mobile give a sensible max-height so the picker doesn't cover the whole screen
        maxHeight: isMobilePinned ? "min(380px, 52dvh)" : undefined,
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
