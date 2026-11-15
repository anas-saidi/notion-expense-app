"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { BudgetScope } from "../app-types";
import { MascotEngine, VIEWBOX_HALF, type MascotFrame, type MascotTarget } from "../mascot/engine";
import { deriveTarget, type ReactionToken } from "../mascot/mood";
import { mixHex } from "../mascot/math";
import type { Tone } from "./palettes";

/**
 * Study (dev only): the jar drawn as light instead of glass, after the "lit room"
 * reference. Same engine, outline, level and eyes as the real mascot; only the
 * rendering changes:
 *
 *   aura    the outline grown ~12%, bent by low-frequency noise and blurred: the
 *           wavy, soft border. Replaces the glass rim and the ground shadow.
 *   body    the outline itself as a faint, softly blurred light.
 *   level   the liquid becomes a bright, heavily blurred glow rising from the
 *           bottom: a fuller jar is lit higher (the reference's "intensity").
 *   grain   speckles of the deeper partner colour, masked to the light (no blend
 *           mode: overlay has nothing to blend with inside the SVG and turned the edge grey).
 *   eyes    the theme text colour at every level.
 *
 * Colours are partner colours at partial opacity, so the same light works on the
 * white and the near-black page.
 */
export type LevelMode = "height" | "brightness" | "core";
export type RestMode = "live" | "still";

/** Brightness fade, shared with the room (--glow-strength in grain-glow.css). */
const EASE = "700ms cubic-bezier(0.33, 0, 0.2, 1)";
const FADE = `opacity ${EASE}`;

/** How long a change keeps drawing in still mode: the engine's 420ms morph plus settling. */
const SETTLE_MS = 900;

/** Status tints the jar uses for a pool spending faster than the month (honey) or overspent (coral). */
const WARN_HEX = { low: "#e9b949", over: "#e8776c" } as const;

export function LightMascot({ scope, level, size, spentPct, edge = "wavy", levelMode = "height", rest = "live", tone, target: given, reaction, warn = null, style }: {
  scope: BudgetScope; level: number; size: number; spentPct: number | null; edge?: "wavy" | "soft";
  /** The hero's own engine target (mood, gaze, press against a partner); derived from scope and spending when omitted. */
  target?: MascotTarget;
  /** A reaction to play (wink, cheer, dip); in still mode it draws only while it plays. */
  reaction?: ReactionToken | null;
  /** Pool pace, as on the jar: the heart warms to honey when spending runs ahead, coral when overspent. */
  warn?: "low" | "over" | null;
  /** The user's colour as a core and halo tone; defaults to the engine's partner colour. */
  tone?: Tone;
  /**
   * height: a bright glow rises to the level. brightness: the whole light dims or brightens with it.
   * core: both, centred: a core of deep light sits in the middle and grows with the level while the whole light brightens.
   */
  levelMode?: LevelMode;
  /** live: idle blinks, glances and wobble. still: draws only while something changes (a new level, scope or reaction). */
  rest?: RestMode;
  style?: CSSProperties;
}) {
  const ids = useId().replace(/:/g, "");
  // The hero rebuilds its target object every render; key it by content so still mode only redraws on real changes.
  const givenKey = given ? JSON.stringify({ ...given, items: given.items?.map(item => `${item.id}@${item.radius.toFixed(2)}${item.glyph}`) }) : "";
  const target = useMemo<MascotTarget>(() => {
    // A pool's level comes from `level` (the remembered, eased value); a split jar has no level.
    // Spending emojis are left out of the light look for now (no items in the engine).
    if (given) return given.fill === undefined ? { ...given, items: undefined } : { ...given, items: undefined, fill: Math.max(0, Math.min(1, level)) };
    const derived = deriveTarget({ scope, fundingGap: 0, spentPct, unassigned: 0, loading: false });
    return { ...derived, outline: "partner", fill: Math.max(0, Math.min(1, level)) };
  }, [givenKey, scope, level, spentPct]); // eslint-disable-line react-hooks/exhaustive-deps
  const engine = useMemo(() => new MascotEngine(target, { calm: false, lifePhase: 0.3 }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const clock = useRef<number | null>(null);
  const now = () => { if (clock.current === null) clock.current = performance.now(); return (performance.now() - clock.current) / 1000; };
  const [frame, setFrame] = useState<MascotFrame>(() => engine.sample(0));
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    engine.setTarget(target, now());
    // Still: no frame-by-frame drawing at all. The shape and eyes go straight to their settled pose
    // (each drawn frame re-ran the light's SVG filters and dropped frames on phones); only the level
    // fades, in CSS. Live mode (the dev lab) keeps the morph.
    setFrame(engine.sample(rest === "still" ? now() + SETTLE_MS / 1000 + 2 : now()));
  }, [engine, target, rest]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Reactions (wink, cheer, dip) only play in live mode; in still mode they'd need a drawing loop.
    if (!reaction || rest === "still") return;
    engine.react(reaction.kind, now());
  }, [engine, reaction?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (rest !== "live" || reduced) return;
    let raf = 0;
    const tick = () => { setFrame(engine.sample(now())); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, rest]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = VIEWBOX_HALF;
  // With a chosen tone the body is the pale halo and the heart is the deep core; otherwise the partner colour for both.
  const [a, b] = tone ? [tone.halo, tone.halo] : frame.colors;
  const base = tone ? tone.core : mixHex(a, "#000000", 0.2);
  const deep = warn ? mixHex(base, WARN_HEX[warn], warn === "over" ? 0.85 : 0.7) : base;
  const wavy = edge === "wavy";
  // Brightness mode: the level sets how strongly the whole body glows. It fades with CSS
  // (FADE, the same curve as the room behind it), not frame by frame, so it stays smooth in still mode too.
  const shown = Math.max(0, Math.min(1, level));
  const bright = levelMode === "brightness";
  // A split jar (no level, only items) shows its light without a heart.
  const split = target.fill === undefined;
  // A split jar has no level, so no heart, except when something is wrong (coral): a small core, as a pool
  // shows it (tinting the whole body muddied the partner colour). Milder states only dim the light.
  const core = levelMode === "core" && (!split || warn === "over");
  // Height mode keeps the body dim (0.6) so the rising glow is what you read; core mode brightens more gently.
  // A split jar's brightness is its mood (`level`): 1 keeps the old steady 0.85.
  const k = split ? 0.3 + 0.55 * shown : bright ? 0.2 + 0.8 * shown : core ? 0.45 + 0.55 * shown : 0.6;
  // Core mode: the heart's size, a share of the body (a small ember when empty, most of the body when full).
  const coreScale = split ? 0.5 : 0.28 + 0.72 * shown;
  // A chosen tone is pale by design (its halo), so it is drawn denser to read like the reference.
  const density = tone ? 1.7 : 1;
  // Eyes never change with the level: the page's text colour (ink in light, near-white in dark)
  // reads on both a dim and a bright light, where white vanished on a pale jar.
  const eyeFill = "var(--text)";
  // GPU drawing: every soft layer is its own small SVG blurred with a CSS filter, which phones run on the
  // GPU (Safari draws SVG <filter> blurs on the CPU, and redrew them on every screen change). Layers are
  // drawn on a box PAD larger on each side, so a blur never meets the layer's edge.
  const unit = size / (v * 2);
  const blur = (deviation: number) => `blur(${(deviation * unit).toFixed(2)}px)`;
  const box = v * (1 + 2 * PAD);
  const grainTile = useGrainTile(mixHex(a, "#000000", 0.28));
  const auraScale = wavy ? 1.12 : 1.2;
  return <div aria-hidden="true" style={{ position: "relative", width: size, height: size, flexShrink: 0, ...style }}>
    {/* Shared paint: gradients, clip and the grain pattern, referenced by the layers below. */}
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${ids}-hue`} gradientUnits="userSpaceOnUse" x1={-80} y1={0} x2={80} y2={0}>
          <stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} />
        </linearGradient>
        {/* The glow's heart: a deeper, saturated tone low in the middle, fading to the plain colour (the reference's orange core). */}
        <radialGradient id={`${ids}-core`} gradientUnits="userSpaceOnUse" cx={0} cy={62} r={95}>
          <stop offset="0" stopColor={deep} stopOpacity={0.85} />
          <stop offset="0.55" stopColor={tone ? deep : mixHex(a, "#000000", 0.1)} stopOpacity={0.35} />
          <stop offset="1" stopColor={a} stopOpacity={0} />
        </radialGradient>
        {/* Core mode: the heart, deep in the middle, melting into the halo. */}
        {/* The deep tone pulled 15% toward the halo: still saturated, a touch less loud. */}
        <radialGradient id={`${ids}-heart`}>
          <stop offset="0" stopColor={mixHex(deep, a, 0.15)} stopOpacity={1} />
          <stop offset="0.55" stopColor={mixHex(deep, a, 0.15)} stopOpacity={0.85} />
          <stop offset="0.78" stopColor={a} stopOpacity={0.45} />
          <stop offset="1" stopColor={a} stopOpacity={0} />
        </radialGradient>
        {/* The wavy edge (dev lab only) still bends with SVG noise; the blur itself is CSS. */}
        {wavy && <filter id={`${ids}-bend`} filterUnits="userSpaceOnUse" x={-box} y={-box} width={box * 2} height={box * 2}>
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="1" seed="4" result="wobble" />
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>}
        <clipPath id={`${ids}-clip`}><path d={frame.body} /></clipPath>
        {GRAIN_RINGS.map(ring => <clipPath key={ring} id={`${ids}-lit-${ring}`}><path d={frame.body} transform={`scale(${ring})`} /></clipPath>)}
        {/* Grain: a static tile of speckles in the light's own deeper colour (never grey), drawn once per colour. */}
        {grainTile && <pattern id={`${ids}-grain`} patternUnits="userSpaceOnUse" width={GRAIN_TILE} height={GRAIN_TILE}>
          <image href={grainTile} width={GRAIN_TILE} height={GRAIN_TILE} />
        </pattern>}
      </defs>
    </svg>

    {/* Aura: the soft border. */}
    <BlurLayer box={box} size={size} filter={blur(wavy ? 3.5 : 18)} style={{ opacity: Math.min(1, 0.4 * k * density), transition: FADE }}>
      <path d={frame.body} transform={`scale(${auraScale})`} fill={`url(#${ids}-hue)`} filter={wavy ? `url(#${ids}-bend)` : undefined} />
    </BlurLayer>
    {/* Body: the outline itself, a little brighter, softly edged. */}
    <BlurLayer box={box} size={size} filter={blur(wavy ? 3 : 8)} style={{ opacity: Math.min(1, 0.5 * k * density), transition: FADE }}>
      <path d={frame.body} fill={`url(#${ids}-hue)`} />
    </BlurLayer>
    {/* Level: the liquid as a bright glow, clipped to the body then blurred so it never shows a hard waterline. */}
    {bright && !split && <BlurLayer box={box} size={size} filter={blur(10)} style={{ opacity: shown, transition: FADE }}>
      <g clipPath={`url(#${ids}-clip)`}>
        <path d={frame.body} fill={`url(#${ids}-hue)`} opacity={0.6} />
        <path d={frame.body} fill={`url(#${ids}-core)`} />
      </g>
    </BlurLayer>}
    {core && <BlurLayer box={box} size={size} filter={blur(10)}>
      <g clipPath={`url(#${ids}-clip)`}>
        <ellipse cx={0} cy={22} rx={108} ry={98} fill={`url(#${ids}-heart)`}
          style={{ transform: `scale(${coreScale})`, transformBox: "fill-box", transformOrigin: "50% 50%", opacity: 0.7 + 0.3 * shown, transition: `transform ${EASE}, opacity ${EASE}` }} />
      </g>
    </BlurLayer>}
    {levelMode === "height" && !split && frame.liquid && <BlurLayer box={box} size={size} filter={blur(10)}>
      <g clipPath={`url(#${ids}-clip)`}>
        <path d={frame.liquid} fill={`url(#${ids}-hue)`} opacity={0.95} />
        <path d={frame.liquid} fill={`url(#${ids}-core)`} />
      </g>
    </BlurLayer>}

    <svg viewBox={`${-v} ${-v} ${v * 2} ${v * 2}`} width={size} height={size} style={{ position: "relative", display: "block", overflow: "visible" }} aria-hidden="true" focusable="false">
      {/* Grain over the light only: nested rings stack, so the speckles thin out toward the soft edge. */}
      {grainTile && <g style={{ opacity: 0.35 * k, transition: FADE }}>
        {GRAIN_RINGS.map((ring, i) => <rect key={ring} x={-v} y={-v} width={v * 2} height={v * 2} fill={`url(#${ids}-grain)`} clipPath={`url(#${ids}-lit-${ring})`} opacity={GRAIN_WEIGHTS[i]} />)}
      </g>}
      {/* Eyes: one colour at every level (theme text colour). */}
      <g style={{ fill: eyeFill }}>{frame.eyes.map((eye, i) => <path key={i} d={eye.d} transform={eye.transform} />)}</g>
    </svg>
  </div>;
}

/** One soft layer: its own SVG, blurred by a CSS filter (GPU), on a box PAD larger than the mascot. */
function BlurLayer({ box, size, filter, style, children }: { box: number; size: number; filter: string; style?: CSSProperties; children: ReactNode }) {
  const span = size * (1 + 2 * PAD);
  return <svg viewBox={`${-box} ${-box} ${box * 2} ${box * 2}`} aria-hidden="true" focusable="false"
    style={{ position: "absolute", left: -PAD * size, top: -PAD * size, width: span, height: span, overflow: "visible", pointerEvents: "none", filter, ...style }}>{children}</svg>;
}

/** Margin each blurred layer gets beyond the mascot's box, as a share of its size. */
const PAD = 0.25;
/** Grain tile size, in viewBox units (one speckle is about one unit). */
const GRAIN_TILE = 128;
/** The light's extent in steps: grain is densest in the body and fades over the aura. */
const GRAIN_RINGS = [0.96, 1.06, 1.14, 1.2];
/** Share of the grain each ring adds; the outer rings add little, so the speckles fade out like the old blurred mask. */
const GRAIN_WEIGHTS = [0.5, 0.25, 0.15, 0.1];

const grainTiles = new Map<string, string>();
/**
 * A tile of speckles in one colour, drawn once on a canvas and cached for the session (the old
 * SVG turbulence noise was regenerated on every mount). Null until the client draws it.
 */
function useGrainTile(color: string) {
  const [tile, setTile] = useState<string | null>(() => grainTiles.get(color) ?? null);
  useEffect(() => {
    const cached = grainTiles.get(color);
    if (cached) { setTile(cached); return; }
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = GRAIN_TILE;
    const context = canvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(GRAIN_TILE, GRAIN_TILE);
    const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
    // Same curve as the old colour matrix (alpha = 3.2 × noise − 1.55): about half the pixels speckle, a few fully.
    let seed = 2;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = r; image.data[i + 1] = g; image.data[i + 2] = b;
      image.data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, 3.2 * random() - 1.55)));
    }
    context.putImageData(image, 0, 0);
    const url = canvas.toDataURL("image/png");
    grainTiles.set(color, url);
    setTile(url);
  }, [color]);
  return tile;
}

/** Couple: both lights side by side, overlapping like the real pair, Anas left and Salma right. */
export function LightPair({ level, levels, size, spentPct, edge, levelMode, rest, tones }: { level: number; levels?: { anas: number; salma: number }; size: number; spentPct: number | null; edge?: "wavy" | "soft"; levelMode?: LevelMode; rest?: RestMode; tones?: { anas: Tone; salma: Tone } }) {
  const jar = Math.round(size * 0.68);
  const overlap = -Math.round(jar * 0.3 / 2);
  return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: size }}>
    <LightMascot scope="anas" level={levels?.anas ?? level} size={jar} spentPct={spentPct} edge={edge} levelMode={levelMode} rest={rest} tone={tones?.anas} style={{ marginRight: overlap, transform: "rotate(8deg)", transformOrigin: "50% 92%" }} />
    <LightMascot scope="salma" level={levels?.salma ?? level} size={jar} spentPct={spentPct} edge={edge} levelMode={levelMode} rest={rest} tone={tones?.salma} style={{ marginLeft: overlap, transform: "rotate(-8deg)", transformOrigin: "50% 92%" }} />
  </div>;
}

