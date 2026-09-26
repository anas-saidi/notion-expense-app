"use client";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { MascotEngine, SCALE, VIEWBOX_HALF, type CoinFrame, type MascotFrame, type MascotTarget, type PhysicsMode } from "./engine";
import { BEAD_SCALE, COIN_R, dustSpecks, type CoinOwner } from "./coins";
import { mixHex, TAU } from "./math";
import { EYE_INK } from "./poses";
import type { ReactionToken } from "./mood";

type MascotProps = {
  target: MascotTarget;
  reaction?: ReactionToken | null;
  /** Rendered size in px. */
  size?: number;
  /** Force a still mascot (also applied automatically under Reduce Motion). */
  calm?: boolean;
  /** Coins tumble with real physics instead of settling into fixed spots. */
  physics?: PhysicsMode;
  /** Bump `id` to shake the jar. */
  shake?: { id: number; strength?: number } | null;
  /** Gravity tilt in radians (e.g. from the phone's orientation). */
  tilt?: number;
  /** Jar material: "fake" adds a gentle SVG glass depth; off by default. */
  glass?: "off" | "fake";
  /** Pool liquid colour. */
  liquidTone?: LiquidTone;
  /**
   * For a pool of money (a plan): as it runs low its colour turns to soft red.
   * Off for jars where empty isn't a warning (e.g. a partner's contribution).
   */
  warnWhenLow?: boolean;
  /** How a coin is drawn: round beads (default), flat matte metal, or the 🪙 emoji. */
  coinStyle?: CoinStyle;
  style?: CSSProperties;
};

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
};

/**
 * The pool's liquid (plus a slightly deeper bottom and a soft meniscus).
 * "partner" uses the Shape body's colours — blue for Anas, pink for Salma, the
 * blend for joint. Lime is the app's accent softened; smoke the quietest;
 * honey a muted warm amber.
 */
export type LiquidTone = "partner" | "lime" | "smoke" | "honey";
const LIQUID_TONES: Record<Exclude<LiquidTone, "partner">, string> = { lime: "#bfe3a3", smoke: "#c8cdd2", honey: "#e3cd9d" };

/** Below this size coins turn into noise, so the jar shows the same level as liquid. */
const MIN_COIN_SIZE = 64;
/**
 * Decorative household mascot. The shape carries meaning (one blob = personal,
 * a jar that fills as money comes in), so it is hidden from assistive tech: the
 * same facts are always stated in text nearby.
 */
export function Mascot({ target: requested, reaction, size = 96, calm, physics, shake, tilt = 0, glass = "off", coinStyle = "beads", liquidTone = "partner", warnWhenLow = false, style }: MascotProps) {
  const target = useMemo<MascotTarget>(() => {
    if (!requested.coins || size >= MIN_COIN_SIZE) return requested;
    const level = (requested.coins.anas ?? 0) + (requested.coins.salma ?? 0);
    return { ...requested, coins: undefined, fill: Math.min(1, level) };
  }, [requested, size]);
  const reducedMotion = usePrefersReducedMotion();
  const still = Boolean(calm || reducedMotion);
  const ids = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const clock = useRef<number | null>(null);
  const now = () => {
    if (clock.current === null) clock.current = performance.now();
    return (performance.now() - clock.current) / 1000;
  };

  // A new engine only when the still/animated mode flips; targets are pushed into it.
  const coinShape = coinStyle === "beads" ? "bead" : "coin";
  const engine = useMemo(() => new MascotEngine(target, { calm: still, physics, coinShape }), [still, physics, coinShape]); // eslint-disable-line react-hooks/exhaustive-deps
  const [frame, setFrame] = useState<MascotFrame>(() => engine.sample(0));

  const targetKey = `${target.scope}|${target.gap.toFixed(3)}|${target.mood}|${target.celebrate ? 1 : 0}|${target.fill?.toFixed(3) ?? "-"}|${target.coins ? `${(target.coins.anas ?? 0).toFixed(3)},${(target.coins.salma ?? 0).toFixed(3)}` : "-"}|${target.outline ?? "orb"}|${target.salmaShape ?? "egg"}|${target.lookYaw ?? 0}|${target.items ? target.items.map(i => `${i.id}@${i.radius.toFixed(2)}`).join(",") : "-"}`;
  useEffect(() => {
    engine.setTarget(target, now());
    // Redraw once even when not animating (still, off-screen or a background tab),
    // so a new scope or new data never leaves a stale frame on screen.
    setFrame(engine.sample(now()));
  }, [engine, targetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reaction) engine.react(reaction.kind, now());
  }, [engine, reaction?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (shake) engine.shake(shake.strength);
  }, [engine, shake?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { engine.setTilt(tilt); }, [engine, tilt]);

  // Animate only while visible on screen and the tab is in front.
  useEffect(() => {
    if (still) return;
    let raf = 0;
    let onScreen = true;
    const tick = () => {
      setFrame(engine.sample(now()));
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      if (onScreen && document.visibilityState === "visible") raf = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); });
    if (rootRef.current) observer.observe(rootRef.current);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [engine, still]);

  const v = VIEWBOX_HALF;
  const viewBox = `${-v} ${-v} ${v * 2} ${v * 2}`;
  const isJar = Boolean(frame.coins || frame.liquid);
  const material = isJar ? glass : "off";
  const layerStyle: CSSProperties = { position: "absolute", inset: 0, overflow: "visible" };
  // A jar is clear: its empty part shows the page through it, so anything drawn
  // "in the glass" (eyes, the label behind them, bead outlines) follows the theme.
  // Eyes under the waterline sit on the pale liquid, so they take the dark ink in any theme.
  const submerged = requested.fill !== undefined && requested.fill >= EYES_SUBMERGED;
  const eyeFill = isJar && !submerged ? "var(--text)" : EYE_INK;
  const jointPool = frame.colors[0] !== frame.colors[1];
  // A low pool turns soft red over its last fifth (from about 80% of the plan spent),
  // lightened like the partner colours; fully red when empty.
  const dry = warnWhenLow && frame.level !== undefined ? Math.max(0, Math.min(1, (LOW_FROM - frame.level) / LOW_FROM)) : 0;
  const tone = (hex: string, soften: number) => mixHex(mixHex(hex, "#ffffff", soften), mixHex(DANGER_HEX, "#ffffff", SOFTEN), dry);
  // A jar of category emojis has no waterline to show its shape, and pale emojis
  // (plates, receipts) vanish on the page: it gets a faint wash and sticker outlines.
  const hasItems = Boolean(frame.coins?.some(c => c.glyph));
  // A fully clear jar reads as an empty outline once the pool runs low, so its glass
  // carries a faint wash of the scope's colours: still a body when there's nothing in it.
  // Lighter in a pool than behind emojis, so the liquid stays clearly the fill.
  const wash = requested.fill !== undefined ? 0.14 : hasItems ? 0.24 : isJar && !frame.coins ? 0.14 : 0; // a pool, even at zero

  // Body layer: the Shape body's fill. A jar's glass is clear, so it draws nothing here.
  const shellLayer = isJar ? null : (
    <svg viewBox={viewBox} width={size} height={size} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`${ids}-fill`} gradientUnits="userSpaceOnUse" x1={-80} y1={0} x2={80} y2={0}>
          <stop offset="0" stopColor={frame.colors[0]} />
          <stop offset="1" stopColor={frame.colors[1]} />
        </linearGradient>
      </defs>
      <path d={frame.body} fill={`url(#${ids}-fill)`} />
    </svg>
  );

  // Contents layer: coins or liquid, clipped to the jar.
  const contents = isJar ? (
    <svg viewBox={viewBox} width={size} height={size} style={{ display: "block", overflow: "visible" }}>
      <defs>
        {/* Soft, never saturated: a personal pool is its partner's colour lightened;
            a joint pool lightens both further and puts their real mix in the middle. */}
        <linearGradient id={`${ids}-partner`} gradientUnits="userSpaceOnUse" x1={-80} y1={0} x2={80} y2={0}>
          <stop offset="0" stopColor={tone(frame.colors[0], jointPool ? SOFTEN_JOINT : SOFTEN)} />
          {jointPool && <stop offset="0.5" stopColor={tone(mixHex(frame.colors[0], frame.colors[1], 0.5), SOFTEN_JOINT + 0.05)} />}
          <stop offset="1" stopColor={tone(frame.colors[1], jointPool ? SOFTEN_JOINT : SOFTEN)} />
        </linearGradient>
        {/* Depth: slightly deeper towards the bottom. */}
        <linearGradient id={`${ids}-depth`} gradientUnits="userSpaceOnUse" x1={0} y1={-60} x2={0} y2={100}>
          <stop offset="0" stopColor="#0e0f0c" stopOpacity={0} />
          <stop offset="1" stopColor="#0e0f0c" stopOpacity={0.1} />
        </linearGradient>
        <clipPath id={`${ids}-clip`}><path d={frame.body} /></clipPath>
        <filter id={`${ids}-rim`} filterUnits="userSpaceOnUse" x={-v} y={-v} width={v * 2} height={v * 2}>
          <feGaussianBlur stdDeviation={7} />
        </filter>
        {hasItems && (
          /* A thin light outline around each emoji, so overlapping ones stay apart on a light
             page. Its own token: none in dark mode, where a page-coloured edge reads as a black border. */
          <filter id={`${ids}-sticker`} x="-20%" y="-20%" width="140%" height="140%">
            <feMorphology in="SourceAlpha" operator="dilate" radius={2.2} result="grown" />
            <feFlood style={{ floodColor: "var(--mascot-sticker, #ffffff)" }} />
            <feComposite in2="grown" operator="in" result="outline" />
            <feMerge><feMergeNode in="outline" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        )}
      </defs>
      {/* Fake glass magnifies the contents slightly, like looking through a curved jar. */}
      <g clipPath={`url(#${ids}-clip)`}>
        <g transform={material === "fake" ? "scale(1.03)" : undefined}>
          {frame.liquid && (
            <>
              <path d={frame.liquid} fill={liquidTone === "partner" ? `url(#${ids}-partner)` : LIQUID_TONES[liquidTone]} />
              <path d={frame.liquid} fill={`url(#${ids}-depth)`} />
              {frame.surface && <path d={frame.surface} fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.4} />}
            </>
          )}
          {/* The scope's colours, faint: enough to give the jar a body behind its contents. */}
          {wash > 0 && <path d={frame.body} fill={`url(#${ids}-partner)`} opacity={wash} />}
          {/* Glass thickness: the wash deepens softly towards the edge (a blurred stroke,
              clipped inside), so the silhouette reads without an outline. */}
          {wash > 0 && <path d={frame.body} fill="none" stroke={`url(#${ids}-partner)`} strokeWidth={26} opacity={0.32} filter={`url(#${ids}-rim)`} />}
          {frame.coins && [...frame.coins].sort((a, b) => a.z - b.z).map((coin, i) => (
            <Coin key={i} {...coin} coinStyle={coinStyle} outlineColor="var(--bg)" glyphFilter={hasItems ? `url(#${ids}-sticker)` : undefined} />
          ))}
        </g>
      </g>
    </svg>
  ) : null;

  // Front layer: face and highlights, always crisp on top.
  const front = (
    <svg viewBox={viewBox} width={size} height={size} style={layerStyle}>
      <defs>
        <radialGradient id={`${ids}-shine`} gradientUnits="userSpaceOnUse" cx={-35} cy={-55} r={110}>
          <stop offset="0" stopColor="#fff" stopOpacity={0.35} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        {/* Eyes clip against the outline, so a glance towards the edge tucks them in. */}
        <clipPath id={`${ids}-fclip`}><path d={frame.body} /></clipPath>
        {/* The label behind the eyes is the page colour, so the face reads over coins in any theme. */}
        <radialGradient id={`${ids}-label`}>
          <stop offset="0.55" style={{ stopColor: "var(--bg)", stopOpacity: 0.94 }} />
          <stop offset="1" style={{ stopColor: "var(--bg)", stopOpacity: 0 }} />
        </radialGradient>
        {material === "fake" && (
          /* Fake glass: thickness darkens the body gently towards its edge. */
          <radialGradient id={`${ids}-inner`} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={100}>
            <stop offset="0.78" stopColor="#0e0f0c" stopOpacity={0} />
            <stop offset="1" stopColor="#0e0f0c" stopOpacity={0.12} />
          </radialGradient>
        )}
      </defs>
      <g clipPath={`url(#${ids}-fclip)`}>
        {isJar && frame.faceWindow && (
          <ellipse cx={frame.faceWindow.x} cy={frame.faceWindow.y} rx={frame.faceWindow.rx} ry={frame.faceWindow.ry} fill={`url(#${ids}-label)`} />
        )}
        {material === "fake" && <path d={frame.body} fill={`url(#${ids}-inner)`} />}
      </g>
      {!isJar && <path d={frame.body} fill={`url(#${ids}-shine)`} />}
      {/* Jar edge: a soft, slightly blurred border in the app's border token, so it suits light and dark. */}
      {isJar && (
        <>
          <defs>
            <filter id={`${ids}-edge`} filterUnits="userSpaceOnUse" x={-v} y={-v} width={v * 2} height={v * 2}>
              <feGaussianBlur stdDeviation={0.6} />
            </filter>
          </defs>
          {/* Its own token: soft in light mode, a touch stronger in dark so the clear jar stays visible.
              It stays neutral as a pool runs low: the level and the wash already say it. */}
          <path
            d={frame.body}
            fill="none"
            style={{ stroke: "var(--mascot-edge, var(--border))" }}
            strokeWidth={1.8}
            filter={`url(#${ids}-edge)`}
          />
        </>
      )}
      <g clipPath={`url(#${ids}-fclip)`} style={{ fill: eyeFill }}>
        {frame.eyes.map((eye, i) => <path key={i} d={eye.d} transform={eye.transform} />)}
      </g>
    </svg>
  );

  // Contact shadow: a faint blurred oval on the ground under the jar, grounding it
  // without a drop shadow on the body itself.
  const ground = (
    <svg viewBox={viewBox} width={size} height={size} style={layerStyle}>
      <defs>
        <filter id={`${ids}-ground`} filterUnits="userSpaceOnUse" x={-v} y={-v} width={v * 2} height={v * 2}>
          <feGaussianBlur stdDeviation={6} />
        </filter>
      </defs>
      <ellipse cx={0} cy={104} rx={64} ry={10} style={{ fill: "var(--mascot-shadow, rgba(14, 15, 12, 0.1))" }} filter={`url(#${ids}-ground)`} />
    </svg>
  );

  return (
    <div ref={rootRef} aria-hidden="true" style={{ position: "relative", width: size, height: size, flexShrink: 0, ...style }}>
      {ground}
      {shellLayer}
      {contents && <div style={layerStyle}>{contents}</div>}
      {front}
    </div>
  );
}

/** How far the partner colours are lightened towards white in the liquid (and wash). */
const SOFTEN = 0.35;
/** A warning pool starts turning red below this level, and the red it turns (the --danger hue). */
const LOW_FROM = 0.2;
const DANGER_HEX = "#d03238";
/** Above this level the liquid covers the eyes. */
const EYES_SUBMERGED = 0.55;
const SOFTEN_JOINT = 0.55;

const COIN_RX = COIN_R * SCALE;

/**
 * Flat, matte metals: shading gradients, glints and thick edges read as game
 * currency, so a coin is just a solid face, a thin edge and one faint ring.
 * Cool silver (Anas) and champagne silver (Salma) are deliberately close.
 */
const COIN_METAL: Record<CoinOwner, { face: string; edge: string; ring: string }> = {
  // Same lightness, only the temperature differs: the joint pile shows who put what
  // in if you look, without reading as two colours.
  anas: { face: "#ccd1d6", edge: "#a4abb2", ring: "#8f969d" },
  salma: { face: "#d6cfc5", edge: "#b0a79b", ring: "#9b9286" },
};

export type CoinStyle = "beads" | "metal" | "emoji";

/**
 * Beads: bloub's flat-dot language. Three close stone tones per person (Anas a
 * touch cooler, Salma a touch warmer), picked per bead, so the pile has texture
 * without shading, glints or saturated colour.
 */
const BEAD_TONES: Record<CoinOwner, [string, string, string]> = {
  anas: ["#c4c9cf", "#b4bac1", "#d2d6db"],
  salma: ["#cdc7be", "#bdb6ac", "#d9d3cb"],
};
const beadTone = (owner: CoinOwner, z: number) => BEAD_TONES[owner][Math.floor(z * 3) % 3];

/**
 * A bead. New ones arrive like bloub's particles: small, spiralling inward
 * around their landing spot while they grow to full size.
 */
function Bead({ x, y, owner, z, scale, arrive, outlineColor }: CoinFrame & { outlineColor: string }) {
  const r = COIN_RX * BEAD_SCALE * scale;
  let bx = x, by = y, size = 1, alpha = 1;
  if (arrive < 1) {
    const e = 1 - (1 - arrive) ** 3;
    const theta = z * TAU + 5 * (1 - e);
    const reach = 0.35 * SCALE * (1 - e) ** 1.2;
    bx += Math.cos(theta) * reach;
    by += Math.sin(theta) * reach;
    size = 0.3 + 0.7 * e;
    alpha = Math.min(1, arrive * 3);
  }
  // A hairline in the glass colour keeps overlapping beads distinct without shading.
  return <circle cx={bx} cy={by} r={r * size} fill={beadTone(owner, z)} stroke={outlineColor} strokeWidth={0.9} opacity={alpha} />;
}

/** The 🪙 glyph fills roughly this share of its font box. */
const EMOJI_FILL = 0.85;
/** Gold tones of the coin emoji, for its dust. */
const EMOJI_DUST = { face: "#e2b650", edge: "#b98a2f" };

function Coin(coin: CoinFrame & { coinStyle: CoinStyle; outlineColor: string; glyphFilter?: string }) {
  const { x, y, rot, owner, opacity, aspect, scale, dust, coinStyle } = coin;
  const m = COIN_METAL[owner];
  const rx = COIN_RX * scale;
  const ry = rx * aspect;
  // A tilted coin shows more of its edge; one standing on edge is mostly edge.
  const edge = 1 + (1 - aspect) * 3;
  if (coin.glyph) return <ItemGlyph {...coin} />;
  if (dust > 0) return <CoinDust {...coin} rx={coinStyle === "beads" ? rx * BEAD_SCALE : rx} ry={coinStyle === "beads" ? rx * BEAD_SCALE : ry} />;
  if (coinStyle === "beads") return <Bead {...coin} />;
  if (coinStyle === "emoji") {
    // Follows the body's position and spin; squashes a little as it tilts or tumbles,
    // but never flatter than 55% so the glyph stays recognisable.
    return (
      <g transform={`translate(${x} ${y}) rotate(${rot}) scale(1 ${Math.max(0.55, aspect)})`} opacity={opacity}>
        <text fontSize={(2 * rx) / EMOJI_FILL} textAnchor="middle" dominantBaseline="central">🪙</text>
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} opacity={opacity}>
      <ellipse cy={edge} rx={rx} ry={ry} fill={m.edge} />
      <ellipse rx={rx} ry={ry} fill={m.face} />
      {aspect > 0.45 && <ellipse rx={rx * 0.7} ry={ry * 0.7} fill="none" stroke={m.ring} strokeWidth={0.8} opacity={0.35} />}
    </g>
  );
}

/**
 * A spend in the jar: its category emoji, upright-ish, sized by the amount.
 * When undone it shrinks and fades in place rather than bursting into specks.
 */
function ItemGlyph({ x, y, rot, opacity, dust, glyph, itemRadius = COIN_R, glyphFilter }: CoinFrame & { glyphFilter?: string }) {
  const radius = itemRadius * SCALE * (1 - 0.35 * dust);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} opacity={dust > 0 ? 1 - dust : opacity}>
      <text fontSize={(2 * radius) / EMOJI_FILL} textAnchor="middle" dominantBaseline="central" filter={glyphFilter}>{glyph}</text>
    </g>
  );
}

/** The coin fades out fast while its specks let go one by one, drift up and fade. */
function CoinDust({ x, y, rot, owner, aspect, scale, z, dust, rx, ry, coinStyle }: CoinFrame & { rx: number; ry: number; coinStyle: CoinStyle }) {
  const m = coinStyle === "emoji" ? { ...EMOJI_DUST, ring: EMOJI_DUST.edge }
    : coinStyle === "beads" ? { face: beadTone(owner, z), edge: BEAD_TONES[owner][1], ring: BEAD_TONES[owner][1] }
    : COIN_METAL[owner];
  const specks = useMemo(() => dustSpecks({ aspect, scale, rot, z }), [aspect, scale, rot, z]);
  const cos = Math.cos((rot * Math.PI) / 180);
  const sin = Math.sin((rot * Math.PI) / 180);
  const faceOpacity = Math.max(0, 1 - dust / 0.3);
  return (
    <>
      {faceOpacity > 0 && (
        <g transform={`translate(${x} ${y}) rotate(${rot})`} opacity={faceOpacity}>
          <ellipse rx={rx} ry={ry} fill={m.face} />
        </g>
      )}
      {specks.map((s, i) => {
        const k = Math.min(1, Math.max(0, (dust - s.delay) / (1 - s.delay)));
        if (k <= 0 || k >= 1) return null;
        // Start inside the (rotated) coin, drift in screen space so dust always rises.
        const sx = s.ox * rx * cos - s.oy * ry * sin;
        const sy = s.ox * rx * sin + s.oy * ry * cos;
        const e = 1 - (1 - k) ** 3;
        return (
          <circle key={i} cx={x + sx + s.dx * SCALE * e} cy={y + sy + s.dy * SCALE * e} r={s.r * (1 - 0.4 * k)}
            fill={s.tone ? m.edge : m.face} opacity={(1 - k) ** 1.5} />
        );
      })}
    </>
  );
}
