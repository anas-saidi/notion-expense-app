"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

type Props = {
  onDelete: () => void;
  children: ReactNode;
  /** Px to drag before the delete commits. Default 80. */
  threshold?: number;
};

export function SwipeToDelete({ onDelete, children, threshold = 80 }: Props) {
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

    // Height collapse after the slide-out
    const el = outerRef.current;
    if (el) {
      const h = el.scrollHeight;
      el.style.overflow = "hidden";
      el.style.height   = `${h}px`;
      el.offsetHeight;  // force reflow
      el.style.transition = "height 0.22s cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.height = "0";
    }

    timerRef.current = setTimeout(onDelete, 340);
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

  return (
    <div ref={outerRef}>
      {/* Inner wrapper clips the horizontal swipe */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 14 }}>
        {/* Danger layer revealed behind the content */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: isPast
              ? "var(--danger)"
              : `color-mix(in srgb, var(--danger) ${Math.round(65 * progress)}%, var(--surface))`,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingInlineEnd: 20,
            transition: dragging ? "none" : "background 0.2s ease",
          }}
        >
          <Trash2
            size={17}
            style={{
              color: "white",
              opacity: progress,
              transform: `scale(${0.72 + 0.38 * progress})`,
              transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s",
            }}
          />
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
