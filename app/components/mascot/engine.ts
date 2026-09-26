import { blinkScale, eyePoses, liveliness } from "./face";
import { TAU, clamp, easeOutCubic, easeOutQuint, lerp, mixHex, r2 } from "./math";
import {
  EXPRESSIONS, HEART_FACES, HEART_RADII, MASCOT_COLORS, SOLO_FACES,
  blendExpression, duoBody, jarShape, type Expression, type FaceSlot, type JarShape, type MascotScope, type Mood, type Outline, type SalmaShape,
} from "./poses";
import { blendRadii, capsulePath, closedPath, openPath, radiusAtAngle, toPoints } from "./shape";
import { ARRIVE_DURATION, COIN_CAPACITY, DUST_DURATION, coinLook, coinSlots, type CoinLook, type CoinOwner, type CoinShape, type CoinSlot } from "./coins";
import { CoinSim, type CoinPhysics } from "./coinSim";
import { MatterCoinSim, type JarItem } from "./coinSimMatter";
import { PoolSim } from "./poolSim";

/** Coin physics: off (fixed pile), our light disc sim, or matter-js rigid bodies. */
export type PhysicsMode = boolean | "custom" | "matter";

/** Rest radius in viewBox units; the viewBox is ±VIEWBOX_HALF. */
export const SCALE = 100;
export const VIEWBOX_HALF = 150;

export interface MascotTarget {
  scope: MascotScope;
  /** 0 = funded, 1 = far from funded. Joint only. */
  gap: number;
  mood: Mood;
  /** Joint and fully funded: settle into the heart. */
  celebrate?: boolean;
  /**
   * Liquid level 0–1. When set, the body becomes a jar: a pale shell with the
   * level shown as liquid, and joint uses one round body instead of two lobes.
   */
  fill?: number;
  /**
   * Coin jar: each owner's share of a full jar (0–1), bottom-up in arrival order.
   * Personal passes one owner; joint passes both, so the pile shows who put in what.
   */
  coins?: Partial<Record<CoinOwner, number>>;
  /** Silhouette: one shape for everyone, or a shape per partner (default orb). */
  outline?: Outline;
  /** Salma's silhouette in the "partner" outline (being chosen in the lab). */
  salmaShape?: SalmaShape;
  /** Extra sideways look, degrees (e.g. partners glancing towards the joint pool). */
  lookYaw?: number;
  /**
   * Spending jar: each spend drops its category emoji in, sized by amount.
   * Replaces coins when set; items are matched by id, so new ones drop in and
   * removed ones crumble. Always uses matter-js physics.
   */
  items?: JarItem[];
}

export type ReactionKind = "cheer" | "dip" | "wince";

interface Pose {
  radii: number[];
  faces: [FaceSlot, FaceSlot];
  colors: [string, string];
  expr: Expression;
  /** -1 = no liquid. */
  fill: number;
}

export interface EyeFrame { d: string; transform: string }
export interface MascotFrame {
  body: string;
  colors: [string, string];
  eyes: EyeFrame[];
  /** Liquid surface path (already spans past the body; clip it to `body`). */
  liquid?: string;
  /** The liquid's top edge alone, for a soft meniscus highlight. */
  surface?: string;
  /** Coins, in viewBox units; clip them to `body`. */
  coins?: CoinFrame[];
  /** Soft pale label behind the eyes, so the face reads over a full jar. */
  faceWindow?: { x: number; y: number; rx: number; ry: number };
  /** The jar's box and corner roundness, for a glass lens that matches its outline. */
  jar?: { half: number; corner: number };
  /** A liquid jar's displayed level (0 empty – 1 full), mid-ease included. */
  level?: number;
}

export interface CoinFrame {
  x: number; y: number; rot: number; owner: CoinOwner; opacity: number;
  aspect: number; scale: number; z: number;
  /** 0 = whole; 0–1 = crumbling to dust (the renderer draws specks). */
  dust: number;
  /** 0 → 1 while a new coin arrives (beads spiral in and grow); 1 once in. */
  arrive: number;
  /** Spending item: the emoji to draw and its radius in body units. */
  glyph?: string;
  itemRadius?: number;
}

interface CoinRec {
  owner: CoinOwner;
  look: CoinLook;
  slot: number;
  /** Where the current move starts (body units) and when. */
  from: { x: number; y: number };
  t0: number;
  /** When set, the coin is flying out. */
  leave?: number;
  /** Arrived from outside (not seeded or re-slotted): plays the arrival animation. */
  fresh?: boolean;
}

const OWNERS: CoinOwner[] = ["anas", "salma"];

/**
 * Coins per owner. Any contribution above zero shows at least one coin, so a
 * small transfer is never invisible; the total never exceeds the jar.
 */
export function coinCounts(coins: MascotTarget["coins"], capacity = COIN_CAPACITY): Record<CoinOwner, number> {
  const out: Record<CoinOwner, number> = { anas: 0, salma: 0 };
  let budget = capacity;
  for (const owner of OWNERS) {
    const share = clamp(coins?.[owner] ?? 0);
    const n = share > 0 ? Math.max(1, Math.round(share * capacity)) : 0;
    out[owner] = Math.min(budget, n);
    budget -= out[owner];
  }
  return out;
}

const DROP = 0.6;
const LEAVE = DUST_DURATION;
const SPAWN_Y = -1.35;

const MORPH = 0.5;
const REACTIONS: Record<ReactionKind, { dur: number; mood: Mood }> = {
  cheer: { dur: 0.9, mood: "excited" },
  dip: { dur: 0.7, mood: "worried" },
  wince: { dur: 1.0, mood: "wince" },
};

export function poseFor(target: MascotTarget): Pose {
  const expr = EXPRESSIONS[target.mood];
  const fill = target.fill === undefined ? -1 : clamp(target.fill);
  const jar = jarShape(target.outline, target.scope, target.salmaShape);
  if (target.scope !== "joint") {
    const c = MASCOT_COLORS[target.scope];
    return { radii: jar.radii, faces: SOLO_FACES, colors: [c, c], expr, fill };
  }
  const colors: [string, string] = [MASCOT_COLORS.anas, MASCOT_COLORS.salma];
  // Any jar (liquid, coins or spending items) is one body, joint included: the
  // two-lobe "Shape" body is only for the plain, contents-free mascot.
  if (fill >= 0 || target.coins || target.items) return { radii: jar.radii, faces: SOLO_FACES, colors, expr, fill };
  if (target.celebrate) return { radii: HEART_RADII, faces: HEART_FACES, colors, expr, fill };
  const duo = duoBody(clamp(target.gap));
  return { radii: duo.radii, faces: duo.faces, colors, expr, fill };
}

const lerpFace = (a: FaceSlot, b: FaceSlot, t: number): FaceSlot => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t), yaw: lerp(a.yaw, b.yaw, t),
});

function blendPose(a: Pose, b: Pose, t: number): Pose {
  return {
    radii: blendRadii(a.radii, b.radii, t),
    faces: [lerpFace(a.faces[0], b.faces[0], t), lerpFace(a.faces[1], b.faces[1], t)],
    colors: [mixHex(a.colors[0], b.colors[0], t), mixHex(a.colors[1], b.colors[1], t)],
    expr: blendExpression(a.expr, b.expr, t),
    fill: a.fill < 0 || b.fill < 0 ? b.fill : lerp(a.fill, b.fill, t),
  };
}

/** Body offset and expression weight of a reaction at local progress k ∈ [0, 1]. */
function reactionAt(kind: ReactionKind, k: number) {
  const bump = Math.sin(Math.PI * k);
  // Expression arrives fast and fades out slowly.
  const weight = k < 0.18 ? k / 0.18 : 1 - (k - 0.18) / 0.82;
  if (kind === "cheer") {
    const wobble = Math.sin(2 * Math.PI * k) * Math.exp(-3 * k);
    return { sx: 1 + 0.1 * wobble, sy: 1 - 0.12 * wobble, cy: -0.1 * bump * (1 - k), weight, slosh: 1 - k };
  }
  if (kind === "dip") return { sx: 1 + 0.02 * bump, sy: 1 - 0.05 * bump, cy: 0.05 * bump, weight, slosh: 0.6 * (1 - k) };
  return { sx: 1 + 0.07 * bump, sy: 1 - 0.1 * bump, cy: 0.06 * bump, weight, slosh: 0.9 * (1 - k) };
}

/**
 * The mascot engine. `sample(t)` is a pure function of time given the current
 * transitions: pausing, resuming or re-reading a date yields the same frame.
 * A target change landing mid-morph blends from the on-screen composite, so
 * chained changes stay continuous.
 *
 * The one exception is `physics: true`: coins are then a stepped simulation,
 * and each `sample(t)` advances it to `t`, so call it with increasing times.
 */
export class MascotEngine {
  private from: Pose;
  private to: Pose;
  private t0 = -Infinity;
  private reaction: { kind: ReactionKind; t0: number } | null = null;

  private coins: CoinRec[] = [];
  private coinsCreated = 0;
  /** Level-2 physics; null when calm or when physics is off. */
  private sim: CoinPhysics | null = null;
  private simT: number | null = null;
  private hasCoins = false;
  /** The pool surface (liquid body); null when still or when not a liquid jar. */
  private pool: PoolSim | null = null;
  private poolT: number | null = null;
  private jar: JarShape;
  private slots: CoinSlot[];
  /** Which jar is on screen; a change means a different pile, not a money event. */
  private jarId: string;

  constructor(target: MascotTarget, private readonly opts: { calm?: boolean; physics?: PhysicsMode; coinShape?: CoinShape; lifePhase?: number } = {}) {
    this.from = this.to = poseFor(target);
    this.hasCoins = Boolean(target.coins || target.items);
    this.jar = jarShape(target.outline, target.scope, target.salmaShape);
    this.slots = coinSlots(this.jar);
    this.jarId = `${target.scope}|${this.jar.key}`;
    this.itemMode = Boolean(target.items);
    this.lookYaw = target.lookYaw ?? 0;
    this.sim = this.makeSim();
    if (target.fill !== undefined && !opts.calm) this.pool = new PoolSim(clamp(target.fill));
    this.reseed(target);
  }

  private itemMode = false;
  private lookYaw = 0;

  /** Items are round, sized bodies that only the matter-js sim handles; coins use the chosen physics. */
  private makeSim(): CoinPhysics | null {
    if (this.itemMode) return new MatterCoinSim();
    if (!this.opts.physics || this.opts.calm) return null;
    return this.opts.physics === "matter" ? new MatterCoinSim(this.opts.coinShape) : new CoinSim();
  }

  /** Lay the target's pile down at rest in the current jar, with no drops or dust. */
  private reseed(target: MascotTarget) {
    if (target.items && this.sim instanceof MatterCoinSim) {
      this.sim.setOutline(this.jar.radii);
      this.sim.seedItems(target.items, this.slots);
      return;
    }
    const want = coinCounts(target.coins, this.slots.length);
    const owners = OWNERS.flatMap(o => Array<CoinOwner>(want[o]).fill(o));
    if (this.sim) {
      this.sim.setOutline(this.jar.radii);
      this.sim.seed(owners, this.slots);
      return;
    }
    this.coins = owners.map((owner, slot) => ({
      owner, slot, look: coinLook(this.coinsCreated++), from: { ...this.slots[slot] }, t0: -Infinity,
    }));
  }

  /** Shake the jar (a phone shake, or a tap). */
  shake(strength = 1) {
    this.sim?.kick((Math.random() < 0.5 ? -1 : 1) * 2.4 * strength, -2.2 * strength);
  }

  /** Tilt gravity, radians from straight down. */
  setTilt(radians: number) {
    if (this.sim) this.sim.tilt = clamp(radians, -1.2, 1.2);
    if (this.pool) this.pool.tilt = clamp(radians, -0.8, 0.8);
  }

  setTarget(target: MascotTarget, t: number) {
    this.from = this.composite(t);
    this.to = poseFor(target);
    this.t0 = this.opts.calm ? -Infinity : t;
    this.hasCoins = Boolean(target.coins || target.items);
    this.lookYaw = target.lookYaw ?? 0;
    if (target.fill === undefined || this.opts.calm) { this.pool = null; this.poolT = null; }
    else if (!this.pool) this.pool = new PoolSim(clamp(target.fill));
    else this.pool.setLevel(clamp(target.fill), t);
    if (Boolean(target.items) !== this.itemMode) {
      // Coins ↔ spending items: a different kind of pile, so start a fresh one.
      this.itemMode = Boolean(target.items);
      this.sim = this.makeSim();
      this.coins = [];
      this.jarId = "";
    }
    const jar = jarShape(target.outline, target.scope, target.salmaShape);
    const jarId = `${target.scope}|${jar.key}`;
    if (jarId !== this.jarId) {
      // Another scope or outline: the pile re-forms quietly while the body morphs.
      this.jar = jar;
      this.slots = coinSlots(jar);
      this.jarId = jarId;
      this.reseed(target);
      return;
    }
    if (target.items && this.sim instanceof MatterCoinSim) {
      // Still (Reduce Motion): no drops, the new pile is simply there.
      if (this.opts.calm) this.sim.seedItems(target.items, this.slots);
      else this.syncItems(target.items);
    }
    else if (this.sim) this.syncSim(target);
    else this.syncCoins(target, this.opts.calm ? -Infinity : t);
  }

  /** New spends drop in (staggered, oldest first); removed ones crumble. */
  private syncItems(items: JarItem[]) {
    const sim = this.sim as MatterCoinSim;
    const have = new Set(sim.itemIds());
    const want = new Set(items.map(i => i.id));
    // Leaving emojis are sucked out through the top; new ones drop straight in, quickly;
    // staying ones whose share changed grow or shrink in place.
    sim.removeItems([...have].filter(id => !want.has(id)));
    for (const item of items) {
      if (!have.has(item.id)) continue;
      const r = sim.itemRadius(item.id);
      if (r !== undefined && Math.abs(r - item.radius) > 0.005) sim.resizeItem(item.id, item.radius);
      if (sim.itemGlyph(item.id) !== item.glyph) sim.updateGlyph(item.id, item.glyph);
    }
    let delay = -0.06;
    for (const item of items) if (!have.has(item.id)) sim.addItem(item, Math.min((delay += 0.06), 0.6));
  }

  private syncSim(target: MascotTarget) {
    const sim = this.sim!;
    const want = coinCounts(target.coins, this.slots.length);
    let delay = 0;
    for (const owner of OWNERS) {
      for (let n = sim.count(owner); n > want[owner]; n--) sim.remove(owner, Math.min((delay += 0.05), 0.6));
    }
    delay = 0;
    for (const owner of OWNERS) {
      for (let n = sim.count(owner); n < want[owner]; n++) sim.add(owner, Math.min((delay += 0.07), 1.2));
    }
  }

  /**
   * Diff the pile against the target counts. Removed coins fly out from the top
   * of each owner's stack; the rest re-settle into the freed spots; new coins
   * drop in on top, staggered. All of it is recorded as (from, t0) moves, so
   * sampling stays a pure function of time.
   */
  private syncCoins(target: MascotTarget, t: number) {
    const want = coinCounts(target.coins, this.slots.length);

    // Forget coins that have finished leaving (never done inside sample()).
    this.coins = this.coins.filter(c => c.leave === undefined || t - c.leave < LEAVE);
    const staying = this.coins.filter(c => c.leave === undefined).sort((a, b) => a.slot - b.slot);
    let stagger = 0;
    for (const owner of ["anas", "salma"] as CoinOwner[]) {
      const mine = staying.filter(c => c.owner === owner);
      for (const coin of mine.slice(want[owner]).reverse()) {
        coin.from = this.coinPos(coin, t);
        coin.leave = t + Math.min(stagger++ * 0.05, 0.6);
      }
    }

    const kept = staying.filter(c => c.leave === undefined);
    kept.forEach((coin, i) => {
      if (coin.slot === i) return;
      coin.from = this.coinPos(coin, t);
      coin.slot = i;
      coin.t0 = t;
      coin.fresh = false; // sliding into a freed spot isn't an arrival
    });

    const have: Record<CoinOwner, number> = { anas: 0, salma: 0 };
    kept.forEach(c => have[c.owner]++);
    let next = kept.length;
    stagger = 0;
    for (const owner of ["anas", "salma"] as CoinOwner[]) {
      for (let k = have[owner]; k < want[owner]; k++) {
        const slot = next++;
        this.coins.push({
          owner, slot, look: coinLook(this.coinsCreated++),
          from: { x: this.slots[slot].x * 0.6, y: SPAWN_Y },
          t0: t + Math.min(stagger++ * 0.07, 1.2),
          fresh: true,
        });
      }
    }
  }

  /**
   * Soft-body life: the outline drifts about 1% at rest (two slow, out-of-phase
   * lobes, like jelly breathing) and jiggles harder for a moment after a
   * reaction. Visual only — physics walls keep the static outline.
   */
  private wobble(radii: number[], t: number, calmJiggle = false): number[] {
    // The jiggle is its own layer that starts and ends at zero, so a reaction
    // never makes the resting wobble jump phase.
    let jiggle = 0, elapsed = 0;
    const r = this.reaction;
    if (r) {
      elapsed = t - r.t0;
      const k = elapsed / REACTIONS[r.kind].dur;
      if (k >= 0 && k < 1 && !calmJiggle) jiggle = 0.035 * Math.min(1, k * 8) * (1 - k) ** 2;
    }
    return radii.map((radius, i) => {
      const theta = (i / radii.length) * TAU;
      const rest = 0.6 * Math.sin(2 * theta + 1.3 * t) + 0.4 * Math.sin(3 * theta - 0.9 * t + 1);
      return radius * (1 + 0.011 * rest + jiggle * Math.sin(4 * theta + 14 * elapsed));
    });
  }

  /** Coin position in body units at time t (before body squish/offset). */
  private coinPos(coin: CoinRec, t: number): { x: number; y: number } {
    const slot = this.slots[coin.slot];
    // A spent coin crumbles where it lies; the specks do the moving.
    if (coin.leave !== undefined) return coin.from;
    const k = clamp((t - coin.t0) / DROP);
    // Lands and settles without bouncing: calm enough to sit next to real balances.
    return { x: lerp(coin.from.x, slot.x, easeOutCubic(k)), y: lerp(coin.from.y, slot.y, easeOutQuint(k)) };
  }

  react(kind: ReactionKind, t: number) {
    if (this.opts.calm) return;
    // Face and body react; the pile stays put. Nudging it made resting coins hop
    // while new ones were still falling, which read as a burst. Coins only move
    // for real coin events (drops, dust) or a deliberate shake.
    this.reaction = { kind, t0: t };
  }

  private composite(t: number): Pose {
    const k = clamp((t - this.t0) / MORPH);
    return k >= 1 ? this.to : blendPose(this.from, this.to, easeOutQuint(k));
  }

  sample(t: number): MascotFrame {
    const pose = this.composite(t);
    // Each jar lives on its own phase, so several on screen never blink or drift in unison.
    const lifeT = t + (this.opts.lifePhase ?? 0);
    const live = liveliness(lifeT, this.opts.calm);

    let sx = 1, sy = live.breath, cy = 0;
    // Waves settle after a morph or a reaction.
    let slosh = this.opts.calm ? 0 : 1 - clamp((t - this.t0) / (MORPH * 3));
    let expr = pose.expr;
    /** How strongly a reaction's expression is showing right now (0–1). */
    let reactionWeight = 0;
    const r = this.reaction;
    if (r) {
      const def = REACTIONS[r.kind];
      const k = (t - r.t0) / def.dur;
      if (k >= 0 && k < 1) {
        const o = reactionAt(r.kind, k);
        // A pool jar stays still while its level eases: squash and hop on top of a
        // moving waterline read as two motions fighting. Only the face reacts.
        if (pose.fill < 0) {
          sx *= o.sx;
          sy *= o.sy;
          cy += o.cy;
        }
        slosh = Math.max(slosh, o.slosh);
        reactionWeight = clamp(o.weight);
        expr = blendExpression(expr, EXPRESSIONS[def.mood], reactionWeight);
      }
    }

    const pts = toPoints(this.opts.calm ? pose.radii : this.wobble(pose.radii, t, pose.fill >= 0), SCALE, { sx, sy, cy });
    const body = closedPath(pts);
    let liquid: string | undefined;
    let surface: string | undefined;
    /** Where the eyes watch: the waterline (y) and which side it's sloshing to. */
    let watch: { y: number; slope: number } | null = null;
    if (pose.fill >= 0 && this.pool) {
      // Anchor the waterline to the jar's fixed outline, not its breathing wobble,
      // so the level never jitters.
      const top = -radiusAtAngle(pose.radii, -Math.PI / 2) * SCALE;
      const bottom = radiusAtAngle(pose.radii, Math.PI / 2) * SCALE;
      const levelY = lerp(bottom + 2, top - 2, this.pool.levelAt(t));
      watch = { y: levelY, slope: this.pool.slope };
      if (this.poolT !== null && t > this.poolT) this.pool.step(t - this.poolT);
      this.poolT = t;
      surface = openPath(this.pool.surface(levelY, t));
      liquid = `${surface}L${VIEWBOX_HALF} ${VIEWBOX_HALF}L${-VIEWBOX_HALF} ${VIEWBOX_HALF}Z`;
    } else if (pose.fill >= 0) {
      let top = Infinity, bottom = -Infinity;
      for (const p of pts) { top = Math.min(top, p.y); bottom = Math.max(bottom, p.y); }
      // Level 0 sits just below the body, level 1 just above, so both extremes read as empty/full.
      const level = lerp(bottom + 2, top - 2, pose.fill);
      const amp = this.opts.calm ? 0 : 2.2 + slosh * 9;
      let d = "";
      for (let x = -VIEWBOX_HALF; x <= VIEWBOX_HALF; x += 10) {
        const y = level + amp * Math.sin(x / 26 + t * 2.1) + amp * 0.5 * Math.sin(x / 13 - t * 3.3);
        d += `${d ? "L" : "M"}${x} ${r2(y)}`;
      }
      liquid = `${d}L${VIEWBOX_HALF} ${VIEWBOX_HALF}L${-VIEWBOX_HALF} ${VIEWBOX_HALF}Z`;
    }
    const eyes: EyeFrame[] = [];
    let eyeSumX = 0, eyeSumY = 0, eyeMinX = Infinity, eyeMaxX = -Infinity, faceRadius = SCALE;
    // Personal: both slots coincide, so draw one face.
    const faces = pose.faces[0].x === pose.faces[1].x && pose.faces[0].y === pose.faces[1].y ? [pose.faces[0]] : pose.faces;
    faces.forEach((face, i) => {
      // The second face blinks a beat later, like two people.
      const lid = i === 0 ? live.lid : liveliness(lifeT - 0.08, this.opts.calm).lid;
      const faceR = face.s * SCALE;
      faceRadius = faceR;
      const fx = face.x * SCALE * sx;
      const fy = (face.y * sy + cy) * SCALE;
      // In a pool the eyes watch the waterline: down at it when it's below the face
      // (more the further it is), a little up when it's above, and towards the side
      // it sloshes to. Idle drift and blinks stay on top, so it never looks fixed.
      // Watching only steers the head, never the eye shapes, so expressions stay intact.
      // It eases off while a reaction plays so the reaction's own look reads, and the
      // combined angle is capped so the eyes never flatten against the face's edge.
      const watching = watch ? 1 - 0.7 * reactionWeight : 0;
      const lookPitch = watch ? clamp(((fy - watch.y) / SCALE) * 38, -22, 12) * watching : 0;
      const lookYaw = watch ? clamp(-watch.slope * 40, -14, 14) * watching : 0;
      const gaze = {
        yaw: clamp(expr.gaze.yaw + face.yaw + live.dYaw + lookYaw + this.lookYaw, -32, 32),
        pitch: clamp(expr.gaze.pitch + live.dPitch + lookPitch, -28, 22),
        roll: expr.gaze.roll + live.dRoll,
      };
      eyePoses(gaze, faceR, expr.split).forEach((ep, e) => {
        const cfg = expr.eyes[e];
        const blink = blinkScale(lid * cfg.open);
        const ex = fx + ep.x, ey = fy + ep.y;
        eyeSumX += ex; eyeSumY += ey; eyeMinX = Math.min(eyeMinX, ex); eyeMaxX = Math.max(eyeMaxX, ex);
        eyes.push({
          d: capsulePath(cfg.w * faceR, cfg.h * faceR),
          transform:
            `translate(${r2(fx + ep.x)} ${r2(fy + ep.y)}) scale(1 ${r2(blink)}) ` +
            `matrix(${r2(ep.a)} ${r2(ep.b)} ${r2(ep.c)} ${r2(ep.d)} 0 0) rotate(${r2(cfg.tilt)})`,
        });
      });
    });

    // Idle breathing belongs to the shell, not the settled contents.
    const contentsSy = sy / live.breath;
    let coins: CoinFrame[] | undefined;
    if (this.sim) {
      if (this.simT !== null && t > this.simT) this.sim.step(t - this.simT);
      this.simT = t;
      const sim = this.sim;
      coins = sim.coins.map(coin => {
        const v = sim.view(coin);
        return {
          x: r2(v.x * SCALE * sx), y: r2((v.y * contentsSy + cy) * SCALE), rot: r2(v.rot), owner: coin.owner, opacity: r2(v.opacity),
          aspect: r2(v.aspect ?? coin.look.aspect), scale: coin.look.scale, z: coin.look.z, dust: r2(v.dust),
          glyph: coin.item?.glyph, itemRadius: coin.item?.radius, arrive: r2(v.arrive ?? 1),
        };
      });
    } else if (this.coins.length) {
      coins = this.coins.map((coin, i) => {
        const p = this.coinPos(coin, t);
        const leaving = coin.leave !== undefined ? clamp((t - coin.leave) / LEAVE) : 0;
        // Settled coins rattle a little when the jar reacts.
        const rattle = slosh * 0.012 * Math.sin(t * 22 + i * 1.7);
        return {
          x: r2(p.x * SCALE * sx),
          y: r2(((p.y + rattle) * contentsSy + cy) * SCALE),
          rot: r2(coin.look.rot),
          owner: coin.owner,
          opacity: r2(1 - leaving),
          aspect: coin.look.aspect, scale: coin.look.scale, z: coin.look.z,
          dust: r2(leaving),
          arrive: coin.fresh ? r2(clamp((t - coin.t0) / ARRIVE_DURATION)) : 1,
        };
      });
    }

    const faceWindow = this.hasCoins && (coins?.length ?? 0) > 0 && eyes.length
      ? {
          x: r2(eyeSumX / eyes.length),
          y: r2(eyeSumY / eyes.length),
          rx: r2((eyeMaxX - eyeMinX) / 2 + faceRadius * 0.34),
          ry: r2(faceRadius * 0.3),
        }
      : undefined;

    return {
      body, colors: pose.colors, eyes, liquid, surface, faceWindow,
      level: pose.fill >= 0 ? r2(this.pool ? this.pool.levelAt(t) : pose.fill) : undefined,
      coins: this.hasCoins ? coins ?? [] : undefined,
      jar: this.hasCoins || pose.fill >= 0 ? { half: this.jar.half, corner: this.jar.corner } : undefined,
    };
  }
}
