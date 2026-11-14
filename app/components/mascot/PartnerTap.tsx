"use client";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useAppHaptics } from "../ui/useAppHaptics";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.64, 0, 0.78, 0] as const;

/**
 * One partner's jar in the Couple pair as its own button. Tapped, the jar
 * squishes like any other; the caller decides what it does (Home opens that
 * partner's contributions). Given `details`, the figure rises out from behind
 * the jar's head instead, one jar open at a time.
 */
export function PartnerTap({ open, onToggle, label, details, size, pending = false, children }: {
  open: boolean;
  onToggle: () => void;
  /** Plain-text figure for the button's accessible name. */
  label: string;
  /** Optional figure shown above the jar; leave out when the figure drops into the jar instead. */
  details?: ReactNode;
  /** The jar's box size in px. */
  size: number;
  /** Its figure is still loading: the jar shows but doesn't open yet. */
  pending?: boolean;
  children: ReactNode;
}) {
  const [jar, animate] = useAnimate<HTMLButtonElement>();
  const reduce = useReducedMotion();
  const { haptic } = useAppHaptics();
  const toggle = () => {
    if (pending) return;
    haptic(open ? "selection" : "light");
    onToggle();
    if (!reduce) animate(jar.current, { scaleX: [1, 1.04, 1], scaleY: [1, 0.95, 1] }, { duration: 0.28, ease: EASE_OUT });
  };
  return (
    <div style={{ position: "relative" }}>
      <button ref={jar} type="button" onClick={toggle} aria-expanded={pending || details == null ? undefined : open} aria-disabled={pending || undefined} aria-label={pending || details == null ? label : `${label}. ${open ? "Hide" : "Show"} details.`} style={jarButtonStyle}>
        {children}
      </button>
      <AnimatePresence initial={false}>
        {open && details != null && (
          <motion.span
            key="figure"
            aria-hidden="true"
            // Just above the jar's visible top (about a sixth of its box down), centred on it.
            style={{ ...figureStyle, bottom: Math.round(size * 0.86) }}
            initial={reduce ? { opacity: 0, x: "-50%" } : { opacity: 0, x: "-50%", y: 14, scale: 0.92, filter: "blur(6px)" }}
            animate={reduce ? { opacity: 1, x: "-50%" } : { opacity: 1, x: "-50%", y: 0, scale: 1, filter: "blur(0px)", transition: { duration: 0.34, ease: EASE_OUT } }}
            exit={reduce ? { opacity: 0, x: "-50%" } : { opacity: 0, x: "-50%", y: 8, scale: 0.96, filter: "blur(4px)", transition: { duration: 0.18, ease: EASE_IN } }}
          >
            {details}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

const jarButtonStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  padding: 0,
  border: "none",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  borderRadius: 24,
  transformOrigin: "50% 85%",
};

const figureStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
  whiteSpace: "nowrap",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
  pointerEvents: "none",
  transformOrigin: "50% 100%",
};
