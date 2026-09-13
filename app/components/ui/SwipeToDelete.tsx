"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { RotateCcw, Trash2 } from "lucide-react";

type Props = {
  onDelete: () => boolean | Promise<boolean>;
  children: ReactNode;
  deleteLabel?: string;
  /** Px to drag before the delete commits. Default 80. */
  threshold?: number;
  variant?: "delete" | "restore";
  /** Removes row rounding when used inside a continuous activity feed. */
  flat?: boolean;
};

export function SwipeToDelete({ onDelete, children, threshold = 80, deleteLabel = "Delete item", variant = "delete", flat = false }: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const outerRef  = useRef<HTMLDivElement>(null);
  const startX    = useRef(0);
  const startY    = useRef(0);
  const direction = useRef<"h" | "v" | null>(null);
  const committed = useRef(false);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    setDragging(false);
    setOffset(-window.innerWidth); // slide content off-screen left

    timerRef.current = setTimeout(async () => {
      const succeeded = await onDelete();
      if (!succeeded) {
        committed.current = false;
        setOffset(0);
      }
    }, 220);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (committed.current) return;
    startX.current    = e.touches[0].clientX;
    startY.current    = e.touches[0].clientY;
    direction.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (committed.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!direction.current) {
      if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) {
        direction.current = "h";
        setDragging(true);
      } else if (Math.abs(dy) > 7) {
        direction.current = "v";
      }
      return;
    }

    if (direction.current === "h" && dx < 0) {
      setOffset(Math.max(-220, dx));
    }
  };

  const onTouchEnd = () => {
    if (committed.current) return;
    direction.current = null;
    if (offset < -threshold) {
      commit();
    } else {
      setDragging(false);
      setOffset(0);
    }
  };

  const revealPx = Math.max(0, -offset);
  const progress = Math.min(1, revealPx / threshold);
  const isPast   = progress >= 1;
  const actionColor = variant === "restore" ? "var(--accent)" : "var(--danger)";

  return (
    <div ref={outerRef}>
      {/* Inner wrapper clips the horizontal swipe */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: flat ? 0 : 14 }}>
        {/* Danger layer revealed behind the content */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: progress === 0
              ? "transparent"
              : isPast
                ? actionColor
                : `color-mix(in srgb, ${actionColor} ${Math.round(65 * progress)}%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingInlineEnd: 20,
            transition: dragging ? "none" : "background 0.2s ease",
          }}
        >
          <button
            type="button"
            aria-label={deleteLabel}
            className="swipe-delete-action"
            onFocus={() => setOffset(-72)}
            onBlur={() => { if (!committed.current) setOffset(0); }}
            onClick={commit}
            style={{ opacity: Math.max(progress, 0.01) }}
          >
            {variant === "restore" ? <RotateCcw size={17} aria-hidden="true" /> : <Trash2 size={17} aria-hidden="true" />}
          </button>
        </div>

        {/* Swipeable surface */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            touchAction: "pan-y",
            transform: `translateX(${offset}px)`,
            transition: dragging ? "none" : "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: dragging ? "transform" : "auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
