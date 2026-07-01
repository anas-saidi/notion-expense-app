"use client";

import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";

const DESKTOP_BREAKPOINT = 600;

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label?: string;
  labelledBy?: string;
  panelRef?: RefObject<HTMLDivElement>;
  maxWidth?: string;
  maxHeight?: string;
  zIndex?: number;
  showHandle?: boolean;
  panelStyle?: CSSProperties;
  contentStyle?: CSSProperties;
  backdropStrength?: number;
  /** Height ratios (0–1). E.g. [0, 0.62, 1] — initialSnap index sets opening height. */
  snapPoints?: number[];
  /** Index into snapPoints that sets the opening height. */
  initialSnap?: number;
  /** "default" = fixed height from snapPoints; "content" = auto-height (consumer sets height via panelStyle). */
  detent?: "default" | "content";
  /** "bottom" = slides up from bottom edge; "center" = centered wider layout. */
  align?: "bottom" | "center";
  /** Desktop only: fill the full viewport (width 100vw, height 100dvh, no border-radius). */
  desktopFullscreen?: boolean;
};

export function BottomSheet({
  open,
  onClose,
  children,
  label,
  labelledBy,
  panelRef,
  maxWidth = "520px",
  maxHeight,
  zIndex = 70,
  showHandle = true,
  panelStyle,
  contentStyle,
  backdropStrength = 0.16,
  snapPoints,
  initialSnap = 1,
  detent = "default",
  align = "bottom",
  desktopFullscreen = false,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Height for the outer animation wrapper (only for "default" detent with snap points).
  // For "content" detent, the consumer sets height via panelStyle.
  const wrapperHeight = (() => {
    if (detent !== "default") return undefined;
    if (snapPoints && snapPoints[initialSnap] !== undefined) {
      return `${snapPoints[initialSnap] * 100}dvh`;
    }
    return maxHeight ?? "calc(100dvh - 20px)";
  })();

  const wrapperMaxHeight =
    detent === "content" ? (maxHeight ?? "calc(100dvh - 20px)") : undefined;

  if (!mounted) return null;

  const sheet = (
    <>
      {/* Backdrop */}
      <motion.div
        key="sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: isDesktop ? Math.max(backdropStrength, 0.25) : backdropStrength }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "black",
          zIndex: zIndex - 1,
        }}
      />

      {/*
       * Outer motion.div — owns position:fixed + the slide animation.
       * Kept separate from panelStyle so the consumer's `position:"relative"`
       * (or any other positional style) never clobbers our fixed layout.
       *
       * Desktop (≥ 600px): centered modal with fade+scale animation, no drag.
       * Mobile (< 600px): bottom sheet with slide-up animation and drag-to-close.
       */}
      <motion.div
        key="sheet-panel"
        initial={isDesktop ? { opacity: 0, scale: 0.97 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.97 } : { y: "100%" }}
        transition={
          isDesktop
            ? { type: "spring", stiffness: 400, damping: 32 }
            : { type: "spring", stiffness: 380, damping: 38 }
        }
        {...(!isDesktop && {
          drag: "y" as const,
          dragConstraints: { top: 0 },
          dragElastic: { top: 0.05, bottom: 0.4 },
          dragMomentum: false,
          onDragEnd: (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
            if (info.offset.y > 80 || info.velocity.y > 450) {
              onClose();
            }
          },
        })}
        style={
          isDesktop
            ? desktopFullscreen
              ? {
                  position: "fixed",
                  inset: 0,
                  width: "100vw",
                  height: "100dvh",
                  borderRadius: 0,
                  zIndex,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }
              : {
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  x: "-50%",
                  y: "-50%",
                  width: `min(${maxWidth}, calc(100vw - 48px))`,
                  height: "auto",
                  maxHeight: "calc(100dvh - 80px)",
                  borderRadius: 20,
                  zIndex,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }
            : {
                position: "fixed",
                bottom: 0,
                left: "50%",
                x: "-50%",
                width: `min(${maxWidth}, 100vw)`,
                height: wrapperHeight,
                maxHeight: wrapperMaxHeight,
                zIndex,
                display: "flex",
                flexDirection: "column",
              }
        }
      >
        {/*
         * Inner div — receives panelStyle from the consumer.
         * position:"relative" from sheetStyle is safe here (parent is fixed).
         */}
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          aria-labelledby={labelledBy}
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            ...panelStyle,
            ...(desktopFullscreen && isDesktop ? { borderRadius: 0 } : {}),
          }}
        >
          {showHandle && !isDesktop && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "10px 0 6px",
                flexShrink: 0,
                cursor: "grab",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.15)",
                }}
              />
            </div>
          )}

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              ...contentStyle,
            }}
          >
            {children}
          </div>
        </div>
      </motion.div>
    </>
  );

  return createPortal(
    <AnimatePresence>{open && sheet}</AnimatePresence>,
    document.body
  );
}
