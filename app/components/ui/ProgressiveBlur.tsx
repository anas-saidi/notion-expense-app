"use client";

import { forwardRef, useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";

type ProgressiveBlurProps = {
  /** Edge the blur is strongest at. */
  position?: "top" | "bottom";
  /** Total height (px or any CSS length). Whatever isn't `fade` is held at full blur + tint. */
  height?: number | string;
  /** Length (px) of the ramp at the far end, where blur and tint ease out to nothing. */
  fade?: number;
  /** Blur radius (px) of the strongest layer; each layer further out halves it. */
  maxBlur?: number;
  /** Number of stacked blur layers — more layers, smoother ramp. */
  layers?: number;
  /** Colour wash over the blur; solid in the held zone, eased out across the fade. */
  tint?: string;
  visible?: boolean;
  reduceMotion?: boolean;
  className?: string;
  style?: CSSProperties;
};

// Ease-out alpha ramp for the tint, from the held zone outwards — a linear
// gradient reads as a band where it ends.
const TINT_RAMP = [1, 0.92, 0.74, 0.52, 0.3, 0.13, 0.04, 0];

/**
 * The app's one edge treatment wherever content scrolls under a bar: several
 * stacked backdrop-filter layers, each masked to its own overlapping band, so the
 * blur radius itself ramps down (a single blurred layer with a gradient mask only
 * fades the opacity of one blur). Stops are in px from the far edge, so the ramp
 * stays the same length however tall the held zone is.
 *
 * Layers are siblings, never nested, and the wrapper only clips + translates —
 * opacity/filter/mask on an ancestor would become the "backdrop root" and the
 * layers would blur nothing.
 */
export function ProgressiveBlur({
  position = "top",
  height = 48,
  fade = typeof height === "number" ? height : 48,
  maxBlur = 8,
  layers = 5,
  tint,
  visible = true,
  reduceMotion = false,
  className,
  style,
}: ProgressiveBlurProps) {
  // Every gradient runs from the far (faint) end towards the edge.
  const toward = position === "top" ? "to top" : "to bottom";
  const step = fade / (layers + 1);
  const px = (n: number) => `${n.toFixed(1)}px`;

  const tintStops = tint
    ? TINT_RAMP.map((a, i) => ({ a, at: fade * (1 - i / (TINT_RAMP.length - 1)) }))
        .reverse()
        .map(({ a, at }) => `color-mix(in srgb, ${tint} ${Math.round(a * 100)}%, transparent) ${px(at)}`)
        .join(", ")
    : null;

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        [position]: 0,
        height,
        overflow: "hidden",
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 1,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: visible ? "translateY(0)" : `translateY(${position === "top" ? -100 : 100}%)`,
          transition: reduceMotion ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {Array.from({ length: layers }, (_, i) => {
          // i = 0 is the faintest layer (reaches furthest from the edge); the last is the strongest.
          const blur = maxBlur / 2 ** (layers - 1 - i);
          const start = i * step;
          // The strongest layer stays solid all the way to the edge, covering the held zone.
          const mask = i === layers - 1
            ? `linear-gradient(${toward}, transparent ${px(start)}, #000 ${px(start + step)})`
            : `linear-gradient(${toward}, transparent ${px(start)}, #000 ${px(start + step)}, #000 ${px(start + 2 * step)}, transparent ${px(start + 3 * step)})`;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                backdropFilter: `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                maskImage: mask,
                WebkitMaskImage: mask,
              }}
            />
          );
        })}
        {tintStops && (
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${toward}, ${tintStops})` }} />
        )}
      </div>
    </div>
  );
}

/** Whether a scroller has content hidden past its top / bottom edge. */
export function useScrollEdges(el: HTMLElement | null) {
  const [edges, setEdges] = useState({ above: false, below: false });
  const measure = useCallback(() => {
    if (!el) return;
    const above = el.scrollTop > 1;
    const below = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((prev) => (prev.above === above && prev.below === below ? prev : { above, below }));
  }, [el]);

  useEffect(() => {
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // Content growing/shrinking (sections toggling, data loading) changes the bottom edge.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach((child) => ro.observe(child));
    const mo = new MutationObserver(() => {
      Array.from(el.children).forEach((child) => ro.observe(child));
      measure();
    });
    mo.observe(el, { childList: true });
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
      mo.disconnect();
    };
  }, [el, measure]);

  return edges;
}

const EDGE_FADE = 28;

/**
 * A sheet's scroll list whose edges soften under the sheet's header / footer
 * instead of clipping — each edge only while there's content hidden past it.
 * `style` goes to the scroller; the wrapper takes its place in the flex column.
 */
export const BlurScrollArea = forwardRef<HTMLDivElement, {
  children: ReactNode;
  style?: CSSProperties;
  /** The sheet surface the edges melt into. */
  tint?: string;
  edges?: { top?: boolean; bottom?: boolean };
  reduceMotion?: boolean;
}>(function BlurScrollArea({ children, style, tint = "var(--surface)", edges = { top: true, bottom: true }, reduceMotion }, ref) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const { above, below } = useScrollEdges(el);
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    setEl(node);
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  return (
    <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {edges.top && <ProgressiveBlur position="top" height={EDGE_FADE} maxBlur={4} tint={tint} visible={above} reduceMotion={reduceMotion} />}
      {/* Its own stacking context keeps row z-indices below the edge layers. */}
      <div ref={setRefs} style={{ position: "relative", zIndex: 0, ...style, flex: "1 1 auto", minHeight: 0 }}>
        {children}
      </div>
      {edges.bottom && <ProgressiveBlur position="bottom" height={EDGE_FADE} maxBlur={4} tint={tint} visible={below} reduceMotion={reduceMotion} />}
    </div>
  );
});
