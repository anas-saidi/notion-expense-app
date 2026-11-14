"use client";

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import type { BudgetScope } from "../app-types";
import type { Tone } from "./palettes";
import "./grain-glow.css";

export type GlowDirection = "halo" | "tray" | "sky" | "room";
export type GlowEdge = "soft" | "wavy";

/** Couple: each partner's light sits under their own jar (MascotHero's pair: 170px jars overlapping 40%, centres about 102px apart). */
const PAIR_OFFSET = 51;

/**
 * A decorative light behind the hero mascot, in the jar's own liquid colour:
 * Anas blue, Salma pink, Couple both side by side (never one blended lavender).
 * Strength follows the liquid level, so a fuller jar glows more. Dev study only.
 */
export function GrainGlow({ direction, scope, level, edge = "soft", tones, lights = true, contained = false }: { direction: GlowDirection; scope: BudgetScope; level: number; edge?: GlowEdge; tones?: { anas: Tone; salma: Tone }; /** False when the hero shows no jar (a chart): the room keeps only its wash and grain. */ lights?: boolean; /** Inside its own surface (the Rebalance workspace): no lift behind the app header, no scroll sink, no sheet edge. */ contained?: boolean }) {
  const blue = "var(--partner-husband)";
  const pink = "var(--partner-wife)";
  const couple = scope === "joint";
  // With chosen tones, the room is the pale halo and the light near the jar is the deep core.
  const first = scope === "salma" ? tones?.salma : tones?.anas;
  const second = couple ? tones?.salma : first;
  const style = {
    "--glow-a": first ? first.halo : couple ? blue : scope === "anas" ? blue : pink,
    "--glow-b": second ? second.halo : couple ? pink : scope === "anas" ? blue : pink,
    ...(first && second ? { "--glow-core-a": first.core, "--glow-core-b": second.core } : null),
    "--glow-x-a": couple ? `calc(50% - ${PAIR_OFFSET}px)` : "50%",
    "--glow-x-b": couple ? `calc(50% + ${PAIR_OFFSET}px)` : "50%",
    // An empty jar still glows a little; full is the reference's 100%.
    "--glow-strength": (0.35 + 0.65 * Math.max(0, Math.min(1, level))).toFixed(3),
  } as CSSProperties;
  const glow = useRef<HTMLDivElement>(null);
  useRoomUnderHeader(direction === "room" && !contained, glow);
  return <>
    {edge === "wavy" && <WavyFilter />}
    <div ref={glow} className="grain-glow" data-direction={direction} data-edge={edge} data-pair={couple || undefined} data-lights={lights ? undefined : "off"} data-contained={contained || undefined} style={style} aria-hidden="true" />
    {/* Phones: the top edge of the content sheet, rising over the bottom of the room (design.md, Light). */}
    {direction === "room" && !contained && <div className="room-sheet-edge" aria-hidden="true" />}
  </>;
}

/**
 * The room reaches up behind the app header: publishes the header's height as --room-lift and
 * marks the page (data-room-at-top) while the scroll area is at the top, so the header can be
 * transparent there and solid once content scrolls under it. Cleans both up on unmount.
 */
/** Rooms mounted at once (tab panels can stay mounted); the page marks are removed only when the last one goes. */
let roomsMounted = 0;

function useRoomUnderHeader(active: boolean, glow: RefObject<HTMLDivElement>) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>(".app-header");
    const scroller = header?.closest<HTMLElement>(".app-content") ?? null;
    if (!header || !scroller) return;
    // Scrolling does almost nothing: it only flips the at-top flag when it actually changes. Writing a
    // style on every frame (the old hero sink, or the header height on the root) made the browser
    // recompute the whole hero, mascot filters included, and scrolling lagged.
    let frame = 0;
    let atTop: boolean | null = null;
    const syncTop = () => {
      frame = 0;
      const next = scroller.scrollTop <= 2;
      if (next === atTop) return;
      atTop = next;
      if (next) root.dataset.roomAtTop = ""; else delete root.dataset.roomAtTop;
    };
    const syncLift = () => { root.style.setProperty("--room-lift", `${header.offsetHeight}px`); };
    const sync = () => { syncLift(); syncTop(); };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(syncTop); };
    const resize = new ResizeObserver(syncLift);
    resize.observe(header);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    roomsMounted += 1;
    sync();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      roomsMounted -= 1;
      if (roomsMounted === 0) {
        delete root.dataset.roomAtTop;
        root.style.removeProperty("--room-lift");
      }
    };
  }, [active]);
}

/**
 * The wavy edge: low-frequency noise pushes the light's outline in and out
 * (about 15px each way, in broad bumps), then a 2.5px blur keeps the bumps soft. Static, so the
 * browser rasterises it once per change, not per frame.
 */
function WavyFilter() {
  return <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
    <filter id="grain-glow-wavy" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="1" seed="4" result="wobble" />
      <feDisplacementMap in="SourceGraphic" in2="wobble" scale="30" xChannelSelector="R" yChannelSelector="G" result="bent" />
      <feGaussianBlur in="bent" stdDeviation="2.5" />
    </filter>
  </svg>;
}
