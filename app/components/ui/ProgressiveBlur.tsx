"use client";

import type { CSSProperties } from "react";

type ProgressiveBlurProps = {
  /** Edge the blur is strongest at. */
  position?: "top" | "bottom";
  /** Total height (px): the solid zone plus the fade below it. */
  height?: number;
  /** Zone (px) at the edge held at full blur + full tint — e.g. what sits behind a floating bar. */
  solidHeight?: number;
  /** Blur radius (px) of the strongest layer; each layer further out halves it. */
  maxBlur?: number;
  /** Number of stacked blur layers — more layers, smoother ramp. */
  layers?: number;
  /** Colour wash over the blur; eased out across the fade so there's no visible edge. */
  tint?: string;
  visible?: boolean;
  reduceMotion?: boolean;
  style?: CSSProperties;
};

// Ease-out alpha ramp for the tint — a linear gradient reads as a band where it ends.
const TINT_RAMP = [1, 0.92, 0.74, 0.52, 0.3, 0.13, 0.04, 0];

/**
 * A real progressive blur: several stacked backdrop-filter layers, each masked to
 * its own overlapping band, so the blur radius itself ramps down across the fade
 * (a single blurred layer with a gradient mask only fades the opacity of one blur).
 *
 * Layers are siblings, never nested, and the wrapper only clips + translates —
 * opacity/filter/mask on an ancestor would become the "backdrop root" and the
 * layers would blur nothing.
 */
export function ProgressiveBlur({
  position = "top",
  height = 48,
  solidHeight = 0,
  maxBlur = 8,
  layers = 5,
  tint,
  visible = true,
  reduceMotion = false,
  style,
}: ProgressiveBlurProps) {
  // Gradients run from the far (faint) end towards the edge.
  const toward = position === "top" ? "to top" : "to bottom";
  const fadePct = ((height - solidHeight) / height) * 100;
  const step = fadePct / (layers + 1);
  const solidPct = (solidHeight / height) * 100;

  const tintStops = tint
    ? [
        ...(solidHeight > 0 ? [`${tint} 0%`] : []),
        ...TINT_RAMP.map((a, i) => {
          const at = solidPct + (i / (TINT_RAMP.length - 1)) * (100 - solidPct);
          return `color-mix(in srgb, ${tint} ${Math.round(a * 100)}%, transparent) ${at.toFixed(1)}%`;
        }),
      ].join(", ")
    : null;

  return (
    <div
      aria-hidden="true"
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
          // The strongest layer stays solid all the way to the edge, covering the solid zone.
          const mask = i === layers - 1
            ? `linear-gradient(${toward}, transparent ${start}%, #000 ${start + step}%)`
            : `linear-gradient(${toward}, transparent ${start}%, #000 ${start + step}%, #000 ${start + 2 * step}%, transparent ${start + 3 * step}%)`;
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
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(${position === "top" ? "to bottom" : "to top"}, ${tintStops})`,
            }}
          />
        )}
      </div>
    </div>
  );
}
