"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

type PickerPopoverProps = {
  title?: string;
  onClose?: () => void;
  open: boolean;
  children: ReactNode;
  width?: string;
  align?: "left" | "right";
  placement?: "top" | "bottom";
  zIndex?: number;
  anchorRef?: RefObject<HTMLElement | null>;
  showHeader?: boolean;
};


export function PickerPopover({
  open,
  title = "Choose an option",
  onClose,
  children,
  width = "min(296px, calc(100vw - 56px))",
  align = "left",
  placement = "bottom",
  zIndex = 80,
  anchorRef,
  showHeader = false,
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
      const viewportWidth = vv?.width ?? window.innerWidth;
      const viewportTop = vv?.offsetTop ?? 0;
      const viewportLeft = vv?.offsetLeft ?? 0;
      const gutter = 16;
      const availableHeight = Math.max(160, viewportHeight - gutter * 2);
      const visiblePopoverHeight = Math.min(popoverRect.height, availableHeight);

      // Keep the menu beside its trigger on phones and desktop.
      let left = align === "right"
        ? anchorRect.right - popoverRect.width
        : anchorRect.left;
      const minLeft = viewportLeft + gutter;
      const maxLeft = viewportLeft + viewportWidth - popoverRect.width - gutter;
      left = Math.min(Math.max(minLeft, left), Math.max(minLeft, maxLeft));

      // Lock direction once so filtering the list doesn't flip it mid-session
      if (lockedPlacementRef.current === null) {
        const preferredTop =
          placement === "bottom"
            ? anchorRect.bottom + 10
            : anchorRect.top - visiblePopoverHeight - 10;
        const fits =
          preferredTop >= viewportTop + gutter &&
          preferredTop + visiblePopoverHeight <= viewportTop + viewportHeight - gutter;
        lockedPlacementRef.current = fits
          ? placement
          : placement === "bottom" ? "top" : "bottom";
      }

      const resolvedPlacement = lockedPlacementRef.current;
      let top =
        resolvedPlacement === "bottom"
          ? anchorRect.bottom + 10
          : anchorRect.top - visiblePopoverHeight - 10;
      const minTop = viewportTop + gutter;
      const maxTop = viewportTop + viewportHeight - visiblePopoverHeight - gutter;
      top = Math.min(Math.max(minTop, top), Math.max(minTop, maxTop));

      setPositionStyle({
        position: "fixed",
        left,
        top,
        maxHeight: availableHeight,
        visibility: "visible",
      });
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

  useEffect(() => {
    if (!open || !onClose) return;
    const closeOutside = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node) && !anchorRef?.current?.contains(event.target as Node)) onClose();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const items = Array.from(popoverRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? []);
        const first = items[0], last = items[items.length - 1];
        if (first && (!popoverRef.current?.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      }
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); anchorRef?.current?.querySelector<HTMLElement>("button")?.focus(); }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", keyboard, true);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", keyboard, true); };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  // On mobile (bottom-pinned), `right` is set so `width` must be "auto"
  const isMobilePinned = "right" in positionStyle;

  return createPortal(
    <div
      ref={popoverRef}
      data-picker-popover="true"
      role="dialog"
      aria-label={title}
      style={{
        ...positionStyle,
        width: isMobilePinned ? "auto" : width,
        maxWidth: "min(calc(100vw - 16px), calc(100dvw - 16px))",
        // positionStyle owns max-height so iOS keyboard changes use the visual viewport.
        background: "color-mix(in srgb, var(--surface) 97%, var(--surface))",
        border: "1px solid color-mix(in srgb, var(--border2) 64%, transparent)",
        borderRadius: "var(--radius-card)",
        overflow: "hidden",
        boxShadow: "var(--elevation-float)",
        boxSizing: "border-box",
        zIndex,
      }}
    >
      {showHeader && <div className="picker-heading"><strong>{title}</strong>{onClose && <button type="button" aria-label={`Close ${title}`} onClick={onClose}>×</button>}</div>}
      <div className="picker-body">{children}</div>
    </div>,
    document.body
  );
}
