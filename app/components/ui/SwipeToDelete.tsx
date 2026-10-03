"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { RotateCcw, Snowflake, Trash2 } from "lucide-react";

type Props = {
  onDelete?: () => boolean | Promise<boolean>;
  /** Reveal contextual actions; swiping never executes them. */
  actions?: { label: string; icon?: ReactNode; onSelect: () => void }[];
  children: ReactNode;
  deleteLabel?: string;
  /** Px to drag before the delete commits. Default 80. */
  threshold?: number;
  variant?: "delete" | "restore" | "freeze";
  disabled?: boolean;
  /** Removes row rounding when used inside a continuous activity feed. */
  flat?: boolean;
  surface?: string;
};

export function SwipeToDelete({ onDelete, children, threshold = 80, deleteLabel = "Delete item", variant = "delete", flat = false, disabled = false, actions, surface }: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const outerRef  = useRef<HTMLDivElement>(null);
  const startX    = useRef(0);
  const startY    = useRef(0);
  const touchActive = useRef(false);
  const pointer = useRef<{ id: number; x: number; y: number; offset: number; moved: boolean } | null>(null);
  const latestOffset = useRef(0);
  const suppressClick = useRef(false);
  const FREEZE_REVEAL = 110;
  const moveFreeze = (value: number) => {
    latestOffset.current = value;
    setOffset(value);
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (variant !== "freeze" || disabled || committed.current || e.button !== 0) return;
    suppressClick.current = false;
    if ((e.target as HTMLElement).closest("input, button")) return;
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, offset: latestOffset.current, moved: false };
    direction.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = pointer.current;
    if (!active || active.id !== e.pointerId || disabled) return;
    const dx = e.clientX - active.x;
    const dy = e.clientY - active.y;
    if (!direction.current && Math.max(Math.abs(dx), Math.abs(dy)) > 7) {
      direction.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (direction.current !== "h") return;
    active.moved = true;
    setDragging(true);
    moveFreeze(Math.max(-FREEZE_REVEAL, Math.min(0, active.offset + dx)));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = pointer.current;
    if (!active || active.id !== e.pointerId) return;
    pointer.current = null;
    setDragging(false);
    suppressClick.current = active.moved;
    // Freeze is revealed, never executed by the swipe itself.
    moveFreeze(latestOffset.current < -FREEZE_REVEAL / 2 ? -FREEZE_REVEAL : 0);
    direction.current = null;
  };
  const onPointerCancel = () => {
    const active = pointer.current;
    pointer.current = null;
    direction.current = null;
    setDragging(false);
    moveFreeze(active?.offset ?? 0);
  };
  const direction = useRef<"h" | "v" | null>(null);
  const committed = useRef(false);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const commit = () => {
    if (committed.current || disabled) return;
    committed.current = true;
    setDragging(false);
    setOffset(-window.innerWidth); // slide content off-screen left

    timerRef.current = setTimeout(async () => {
      try {
        if (await onDelete?.()) return;
      } catch { /* A failed action restores the row for retry. */ }
      committed.current = false;
      if (variant === "freeze") moveFreeze(0); else setOffset(0);
    }, 220);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchActive.current = false;
    if (committed.current || disabled) return;
    if (variant === "freeze" && (e.target as HTMLElement).closest("input, button")) return;
    touchActive.current = true;
    startX.current    = e.touches[0].clientX;
    startY.current    = e.touches[0].clientY;
    direction.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchActive.current || committed.current || disabled) return;
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
    if (!touchActive.current) return;
    touchActive.current = false;
    if (committed.current || disabled) return;
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
  const actionColor = variant === "freeze" ? "color-mix(in srgb, var(--info) 14%, var(--surface))" : variant === "restore" ? "var(--success)" : "var(--danger)";

  if (actions?.length) return <SwipeActions actions={actions} disabled={disabled} surface={surface}>{children}</SwipeActions>;

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
            disabled={disabled}
            className="swipe-delete-action"
            onFocus={() => variant === "freeze" ? moveFreeze(-FREEZE_REVEAL) : setOffset(-72)}
            onBlur={() => { if (!committed.current) { if (variant === "freeze") moveFreeze(0); else setOffset(0); } }}
            onClick={commit}
            style={{ opacity: Math.max(progress, 0.01), ...(variant === "freeze" ? { color: "var(--text)", width: "auto", minWidth: 80, gap: 8 } : {}) }}
          >
            {variant === "freeze" ? <><Snowflake size={17} aria-hidden="true" />Freeze</> : variant === "restore" ? <RotateCcw size={17} aria-hidden="true" /> : <Trash2 size={17} aria-hidden="true" />}
          </button>
        </div>

        {/* Swipeable surface */}
        <div
          onPointerDown={variant === "freeze" ? onPointerDown : undefined}
          onPointerMove={variant === "freeze" ? onPointerMove : undefined}
          onPointerUp={variant === "freeze" ? onPointerUp : undefined}
          onPointerCancel={variant === "freeze" ? onPointerCancel : undefined}
          onClickCapture={variant === "freeze" ? (e) => {
            if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; }
            else if (latestOffset.current < 0) { moveFreeze(0); e.preventDefault(); e.stopPropagation(); }
          } : undefined}
          onTouchStart={variant === "freeze" ? undefined : onTouchStart}
          onTouchMove={variant === "freeze" ? undefined : onTouchMove}
          onTouchEnd={variant === "freeze" ? undefined : onTouchEnd}
          onTouchCancel={() => { touchActive.current = false; direction.current = null; setDragging(false); if (!committed.current) setOffset(0); }}
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

/** The same flat swipe surface, with explicit taps for non-destructive shortcuts. */
function SwipeActions({ actions, disabled, children, surface }: Pick<Props, "actions" | "disabled" | "children" | "surface">) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; offset: number; horizontal: boolean; vertical: boolean } | null>(null);
  const latest = useRef(0);
  const suppressClick = useRef(false);
  const reducedMotion = useReducedMotion();
  const actionSize = 44;
  const actionGap = 8;
  const rowGap = 16;
  const width = (actions?.length ?? 0) * actionSize + Math.max(0, (actions?.length ?? 0) - 1) * actionGap + rowGap;
  const move = (value: number) => { latest.current = value; setOffset(value); };
  useEffect(() => {
    if (!offset) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) move(0); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [offset]);
  useEffect(() => { if (disabled) move(0); }, [disabled]);
  return <div ref={root} style={{ position: "relative", overflow: "hidden" }} onKeyDown={event => { if (event.key === "Escape") move(0); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) move(0); }}>
    <div style={{ position: "absolute", inset: "0 0 0 auto", width, display: "flex", alignItems: "center", gap: actionGap, paddingInlineStart: rowGap, boxSizing: "border-box" }}>
      {actions?.map((action, index) => <button key={action.label} type="button" disabled={disabled} aria-label={action.label} title={action.label} onFocus={() => move(-width)} onClick={() => { move(0); action.onSelect(); }} style={{ width: actionSize, height: actionSize, flexShrink: 0, padding: 0, border: 0, borderRadius: "var(--radius-control)", background: index === 0 ? "var(--accent)" : "var(--surface2)", color: index === 0 ? "var(--accent-ink)" : "var(--text2)", font: "inherit", fontSize: 12, fontWeight: 650, display: "grid", alignContent: "center", justifyItems: "center", gap: 4, cursor: "pointer" }}>{action.icon ?? action.label}</button>)}
    </div>
    <div style={{ position: "relative", background: surface ?? "var(--bg)", width: `calc(100% - ${-offset}px)`, touchAction: "pan-y", transition: dragging || reducedMotion ? "none" : "width 0.2s cubic-bezier(0.22, 1, 0.36, 1)" }}
      onPointerDown={event => {
        if (disabled || event.button !== 0) return;
        suppressClick.current = false;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: latest.current, horizontal: false, vertical: false };
      }}
      onPointerMove={event => {
        const active = gesture.current;
        if (!active || event.pointerId !== active.id || active.vertical) return;
        const dx = event.clientX - active.x, dy = event.clientY - active.y;
        if (!active.horizontal && Math.max(Math.abs(dx), Math.abs(dy)) > 7) {
          if (Math.abs(dy) >= Math.abs(dx)) { active.vertical = true; return; }
          active.horizontal = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }
        if (active.horizontal) { event.preventDefault(); move(Math.max(-width, Math.min(0, active.offset + dx))); }
      }}
      onPointerUp={() => {
        const active = gesture.current; gesture.current = null; setDragging(false);
        if (active?.horizontal) { suppressClick.current = true; move(latest.current < -width / 3 ? -width : 0); }
      }}
      onPointerCancel={() => { gesture.current = null; setDragging(false); move(0); }}
      onClickCapture={event => {
        if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
        else if (latest.current < 0) { event.preventDefault(); event.stopPropagation(); move(0); }
      }}>
      {children}
    </div>
  </div>;
}
