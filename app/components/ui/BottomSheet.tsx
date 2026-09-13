"use client";

import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";

const DESKTOP_BREAKPOINT = 600;
const MOBILE_SHEET_TOP = "calc(var(--safe-top) + 76px)";

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
  /** Mobile modal presented above another sheet; preserves a small visible edge of the parent layer. */
  layered?: boolean;
};

export function BottomSheet({
  open,
  onClose,
  children,
  label,
  labelledBy,
  panelRef,
  maxWidth = "520px",
  zIndex = 70,
  showHandle = true,
  panelStyle,
  contentStyle,
  backdropStrength = 0.16,
  align = "bottom",
  desktopFullscreen = false,
  detent = "default",
  layered = false,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const localPanelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const reduceMotion = useReducedMotion();
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef?.current ?? localPanelRef.current;
    if (!panel) return;

    const selector = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(element => !element.hidden);
    const frame = requestAnimationFrame(() => (focusable()[0] ?? panel).focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open, panelRef, mounted]);

  if (!mounted) return null;

  const sheet = (
    <>
      {/* Backdrop */}
      <motion.div
        key="sheet-backdrop"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: isDesktop ? Math.max(backdropStrength, 0.25) : backdropStrength }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.22 }}
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
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
        initial={reduceMotion ? false : isDesktop ? { opacity: 0, scale: 0.97 } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.97 } : { y: "100%" }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : isDesktop
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
                  borderRadius: "var(--radius-sheet)",
                  zIndex,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }
            : {
                position: "fixed",
                top: detent === "content" ? "auto" : layered ? "calc(var(--safe-top) + 88px)" : MOBILE_SHEET_TOP,
                bottom: 0,
                left: "50%",
                x: "-50%",
                width: `min(${maxWidth}, 90vw)`,
                height: "auto",
                maxHeight: `calc(100dvh - ${MOBILE_SHEET_TOP})`,
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
          ref={panelRef ?? localPanelRef}
          role={isDesktop ? "dialog" : "region"}
          aria-modal={isDesktop ? "true" : undefined}
          aria-label={label}
          aria-labelledby={labelledBy}
          tabIndex={-1}
          style={{
            flex: detent === "content" ? "0 1 auto" : 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: isDesktop
              ? "0 20px 56px rgba(20, 24, 22, 0.16)"
              : "0 -8px 28px rgba(20, 24, 22, 0.10)",
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
              flex: detent === "content" ? "0 1 auto" : 1,
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
