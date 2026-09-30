"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useAppHaptics } from "../ui/useAppHaptics";

type MascotSpillProps = {
  /** The jar (a Mascot or MascotHero). */
  children: ReactNode;
  /** The details the jar holds, e.g. "91% spent · 212 MAD over". */
  details: ReactNode;
  /** The same details as plain text, for the button's accessible name. */
  label: string;
  /** Rendered jar size in px; tucks the details up to the jar's visible bottom. */
  size: number;
  /** Set on one jar per screen: its details show once by themselves, the first time ever. */
  hintKey?: string;
  /** Open the contextual numbers on entry, e.g. next-month contribution capacity. */
  initiallyOpen?: boolean;
  /**
   * Where the details come out: from under the jar (default), or out of one of
   * its sides, e.g. the empty side of a jar that has a neighbour on the other.
   */
  side?: "below" | "left" | "right";
  /** Told whenever the details open or close (tap or first-time hint). */
  onOpenChange?: (open: boolean) => void;
  style?: CSSProperties;
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/**
 * Progressive disclosure for a mascot: the jar alone gives the at-a-glance
 * read; tapping it gives the jar a soft squish and the exact numbers surface
 * from behind it as a plain line of text (sliding down, fading in and coming
 * into focus). They stay until the jar is tapped again.
 *
 * The jar is a real button with haptic feedback on touch devices: keyboard operable, announces whether the details
 * are shown, and always carries them in its accessible name. Under Reduce
 * Motion the details simply fade.
 */
export function MascotSpill({ children, details, label, size, hintKey, initiallyOpen = false, side = "below", onOpenChange, style }: MascotSpillProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  useEffect(() => { onOpenChangeRef.current?.(open); }, [open]);
  const [jar, animate] = useAnimate<HTMLButtonElement>();
  const reduce = useReducedMotion();
  const { haptic } = useAppHaptics();

  const toggle = () => {
    // A light tap as the jar squishes open; a softer tick as it closes.
    haptic(open ? "selection" : "light");
    setOpen(o => !o);
    // A soft squish on every tap, settling back without bounce.
    if (!reduce) animate(jar.current, { scaleX: [1, 1.04, 1], scaleY: [1, 0.95, 1] }, { duration: 0.38, ease: EASE_OUT });
  };

  // First time ever: show the details once by themselves, so people learn the jar holds more.
  useEffect(() => {
    if (!hintKey) return;
    try {
      if (window.localStorage.getItem(hintKey)) return;
    } catch {
      return;
    }
    // Marked as seen only once it has actually opened, so a quick remount doesn't use it up.
    const id = window.setTimeout(() => {
      setOpen(true);
      try { window.localStorage.setItem(hintKey, "1"); } catch { /* storage blocked: may show again */ }
    }, 900);
    return () => window.clearTimeout(id);
  }, [hintKey]);

  // The jar's visible bottom sits this far above its box (the jar is about two thirds of the box).
  const jarGap = Math.round(size * 0.16);
  // ...and its visible sides this far in from the box's.
  const sideGap = Math.round(size / 6);
  const beside = side !== "below";
  // Beside the jar the text slides out from behind it, towards the empty side.
  const away = side === "left" ? 1 : -1;

  return (
    // One track exactly the jar's width: a details line wider than the jar overflows it
    // instead of widening the column and shifting the jar.
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: `${size}px`, justifyItems: "center", ...style }}>
      <button
        ref={jar}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`${label}. ${open ? "Hide" : "Show"} details.`}
        style={jarButtonStyle}
      >
        {children}
      </button>

      <AnimatePresence initial={false}>
        {open && beside && (
          <motion.span
            key="details-beside"
            // Vertically centred on the jar, a small gap off its visible side; revealed from
            // the jar outwards (clip), drifting out from behind it and coming into focus.
            style={{
              ...detailsStyle,
              ...besideStyle,
              // Anchored by the jar-side edge: text on the left hangs off `right: 100%`.
              [side === "left" ? "right" : "left"]: `calc(100% - ${sideGap - 8}px)`,
              textAlign: side === "left" ? "right" : "left",
              justifyContent: side === "left" ? "flex-end" : "flex-start",
            }}
            initial={reduce ? { opacity: 0, y: "-50%" } : { opacity: 0, y: "-50%", x: away * 12, filter: "blur(6px)", clipPath: side === "left" ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" }}
            animate={reduce ? { opacity: 1, y: "-50%" } : { opacity: 1, y: "-50%", x: 0, filter: "blur(0px)", clipPath: "inset(0 0% 0 0%)", transition: { duration: 0.38, ease: EASE_OUT } }}
            exit={reduce ? { opacity: 0, y: "-50%" } : { opacity: 0, y: "-50%", x: away * 8, filter: "blur(4px)", transition: { duration: 0.2, ease: [0.64, 0, 0.78, 0] } }}
          >
            {details}
          </motion.span>
        )}
        {open && !beside && (
          <motion.div
            key="details"
            // Tucked up to the jar's bottom edge, so the text surfaces from behind it; sized
            // to its text (not the jar's column), centred under the jar.
            style={{ overflow: "hidden", marginTop: -jarGap, width: "max-content" }}
            initial={{ height: 0 }}
            animate={{ height: "auto", transition: { duration: reduce ? 0.15 : 0.32, ease: EASE_OUT } }}
            exit={{ height: 0, transition: { duration: reduce ? 0.12 : 0.24, ease: [0.64, 0, 0.78, 0] } }}
          >
            <motion.span
              style={detailsStyle}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(6px)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.36, ease: EASE_OUT } }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.2, ease: [0.64, 0, 0.78, 0] } }}
            >
              {details}
            </motion.span>
          </motion.div>
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

/** Just the detail line, as it looked before it was tucked away. */
const detailsStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
  // A little air under the jar so the line doesn't read as stuck to it.
  paddingTop: 8,
  whiteSpace: "nowrap",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
};

/** Beside the jar: out of the layout, wrapping onto a second line rather than running off-screen. */
const besideStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  width: "max-content",
  maxWidth: 124,
  whiteSpace: "normal",
  flexWrap: "wrap",
  columnGap: 4,
  lineHeight: 1.25,
  paddingTop: 0,
  pointerEvents: "none",
};
