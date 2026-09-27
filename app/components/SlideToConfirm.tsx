"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useReducedMotion } from "motion/react";
import { CheckIcon, ChevronRightIcon } from "./ui/icons";
import { useAppHaptics } from "./ui/useAppHaptics";

/** How far (share of the track) the thumb must travel to confirm. */
const CONFIRM_AT = 0.9;
const THUMB = 52;
const PAD = 4;

type Props = {
  /** What the slide does, e.g. "Slide to save October plan". Also the accessible name. */
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  /** Shown in place of the label while working, e.g. "Saving…". */
  busyLabel?: string;
  busy?: boolean;
};

/**
 * Slide to confirm, for big actions that shouldn't happen on a stray tap (saving a
 * month's plan). Drag the thumb to the end and let go; short of the end it springs
 * back. A tap just nudges the thumb to show it slides. Keyboard and assistive tech
 * confirm with Enter or Space, since dragging isn't available to them.
 *
 * Haptics: a tick when you grab the thumb and a success on confirm. Both happen on
 * pointerdown/pointerup, which iOS counts as a tap; it gives no haptics mid-drag.
 */
export function SlideToConfirm({ label, onConfirm, disabled = false, busyLabel, busy = false }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; pointerId: number; moved: boolean } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [nudge, setNudge] = useState(false);
  const { haptic } = useAppHaptics();
  const reduceMotion = useReducedMotion();
  const inactive = disabled || busy;

  // Back to the start once the work is done (or the slider is re-enabled).
  useEffect(() => { if (!busy) setOffset(0); }, [busy]);

  const maxOffset = () => Math.max(0, (trackRef.current?.clientWidth ?? 0) - THUMB - PAD * 2);
  const progress = () => { const max = maxOffset(); return max > 0 ? offset / max : 0; };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (inactive || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX - offset, pointerId: e.pointerId, moved: false };
    setDragging(true);
    haptic("selection");
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return;
    const next = Math.min(maxOffset(), Math.max(0, e.clientX - drag.current.startX));
    if (Math.abs(next - offset) > 2) drag.current.moved = true;
    setOffset(next);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return;
    const moved = drag.current.moved;
    drag.current = null;
    setDragging(false);
    if (progress() >= CONFIRM_AT) {
      setOffset(maxOffset());
      haptic("success");
      onConfirm();
      return;
    }
    setOffset(0);
    if (!moved && !reduceMotion) {
      setNudge(true);
      window.setTimeout(() => setNudge(false), 420);
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (inactive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOffset(maxOffset());
      onConfirm();
    }
  };

  const p = progress();
  const done = busy || (offset > 0 && offset >= maxOffset() && !dragging);

  return (
    <div
      ref={trackRef}
      role="button"
      tabIndex={inactive ? -1 : 0}
      aria-label={busy && busyLabel ? busyLabel : label}
      aria-disabled={inactive}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className="slide-to-confirm"
      style={{ ...trackStyle, opacity: disabled && !busy ? 0.5 : 1, cursor: inactive ? "default" : "grab" }}
    >
      {/* Fill trails the thumb, in the wallet's colour. */}
      <span aria-hidden="true" style={{ ...fillStyle, transform: `translateX(calc(-100% + ${offset + THUMB + PAD * 2}px))`, transition: dragging || reduceMotion ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)" }} />
      <span aria-hidden="true" style={{ ...labelStyle, opacity: busy ? 1 : Math.max(0, 1 - p * 1.6) }}>
        {busy && busyLabel ? busyLabel : label}
      </span>
      <span
        aria-hidden="true"
        style={{
          ...thumbStyle,
          transform: `translateX(${offset + (nudge ? 14 : 0)}px)`,
          transition: dragging || reduceMotion ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {done ? <CheckIcon size={20} strokeWidth={2.4} /> : <ChevronRightIcon size={22} strokeWidth={2.4} />}
      </span>
    </div>
  );
}

const trackStyle: CSSProperties = {
  position: "relative",
  height: THUMB + PAD * 2,
  borderRadius: 999,
  background: "var(--surface2)",
  overflow: "hidden",
  userSelect: "none",
  WebkitUserSelect: "none",
  touchAction: "none",
  flex: 1,
  minWidth: 0,
};

// Full-width pill slid in from the left (transform only, no layout per frame).
const fillStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: 999,
  background: "var(--select-wash)",
};

const labelStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: `0 ${THUMB / 2 + 12}px 0 ${THUMB + 16}px`,
  fontSize: 15,
  fontWeight: 700,
  color: "var(--text2)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  pointerEvents: "none",
  transition: "opacity 0.15s ease",
};

const thumbStyle: CSSProperties = {
  position: "absolute",
  top: PAD,
  left: PAD,
  width: THUMB,
  height: THUMB,
  borderRadius: 999,
  background: "var(--accent)",
  color: "var(--accent-ink)",
  display: "grid",
  placeItems: "center",
  boxShadow: "var(--elevation-card)",
  pointerEvents: "none",
};
