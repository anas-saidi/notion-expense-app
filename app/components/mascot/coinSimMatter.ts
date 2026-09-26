import Matter from "matter-js";
import { ARRIVE_DURATION, BEAD_SCALE, COIN_R, DUST_DURATION, coinLook, type CoinLook, type CoinOwner, type CoinShape, type CoinSlot } from "./coins";
import type { CoinPhysics } from "./coinSim";
import { createRng, TAU } from "./math";
import { circleProfile, PROFILE_SAMPLES } from "./shape";

/**
 * Coin physics on matter-js: real rigid bodies, shaped like the drawn coins
 * (ovals of each coin's own tilt), so they rotate, roll and come to rest at
 * natural angles — the "piling up" feel a disc-only sim can only approximate.
 *
 * matter-js works in pixels; we use viewBox units (100 per body unit), with
 * the jar's outline turned into a ring of static wall segments.
 */

const U = 100;
const GLASS = 0.06;
const WALL_THICKNESS = 24;
const STEP_MS = 1000 / 120;
const LEAVE = DUST_DURATION;
/** Entry speed of a new coin, px per step. */
const DROP_SPEED = 2.5;
/** Emojis come in faster and nearly straight: a slow tumble read as clunky. */
const ITEM_DROP_SPEED = 6;
/** How long an emoji takes to be sucked up and out through the top (s). */
const SUCK = 0.42;
/**
 * 2D bodies can balance an oval upright like a domino, but a real coin on its
 * edge is unstable in 3D and topples. A small spin towards lying flat (stable
 * at 0° and 180°, unstable at 90°) reproduces that, unless neighbours prop it.
 */
const TOPPLE = 0.008;

interface MatterCoin {
  owner: CoinOwner;
  look: CoinLook;
  /** Null until released into the jar. */
  body: Matter.Body | null;
  releaseAt: number;
  leftAt?: number;
  /** Where the coin was when it started crumbling (it leaves the world then). */
  frozen?: { x: number; y: number; angle: number };
  /** 3D tumble phase: a moving coin flips between face (0) and edge (π/2). */
  flip: number;
  spawn: { x: number; y: number };
  /** Set for spending items: the category emoji, its id and its radius (body units). */
  item?: { id: string; glyph: string; radius: number };
  /** Radius an item is easing towards after its share changed. */
  targetRadius?: number;
}

/** A spend dropped into the jar: its category emoji, sized by amount. */
export interface JarItem { id: string; glyph: string; radius: number }

/** Emojis settle upright (stable at 0°); a flipped 🍕 would read as broken. */
const UPRIGHT = 0.01;

const COIN_BODY: Matter.IChamferableBodyDefinition = {
  // Less grip so coins can slide and turn into place instead of sticking at odd angles.
  friction: 0.35,
  frictionStatic: 0.6,
  frictionAir: 0.02,
  restitution: 0.02,
  density: 0.002,
  slop: 0.02,
};

function coinVertices(look: CoinLook): Matter.Vector[] {
  const rx = COIN_R * look.scale * U;
  const ry = Math.max(rx * look.aspect, 3);
  return Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * TAU;
    return { x: Math.cos(a) * rx, y: Math.sin(a) * ry };
  });
}

export class MatterCoinSim implements CoinPhysics {
  coins: MatterCoin[] = [];
  tilt = 0;
  private engine = Matter.Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
  private walls: Matter.Body[] = [];
  private outline = circleProfile(1);
  private clock = 0;
  private created = 0;
  private rng = createRng(0x3a77e5);
  /** Frame time not yet simulated; only whole fixed steps ever run. */
  private pending = 0;

  constructor(private readonly shape: CoinShape = "coin") {
    // Heavy coins: a brisk fall that reads as metal, not a floaty drift.
    this.engine.gravity.scale = 0.002;
    this.setOutline(this.outline);
  }

  /** Rebuild the jar walls as static segments hugging the inside of the glass. */
  setOutline(radii: number[]) {
    this.outline = radii;
    Matter.Composite.remove(this.engine.world, this.walls);
    const pts = Array.from({ length: PROFILE_SAMPLES }, (_, i) => {
      const a = (i / PROFILE_SAMPLES) * TAU;
      const r = (radii[i] - GLASS) * U;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });
    this.walls = pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const dx = q.x - p.x, dy = q.y - p.y;
      const len = Math.hypot(dx, dy);
      // Push the segment outward by half its thickness so its inner face sits on the outline.
      const nx = dy / len, ny = -dx / len;
      const out = Math.sign(nx * (p.x + q.x) + ny * (p.y + q.y)) || 1;
      return Matter.Bodies.rectangle(
        (p.x + q.x) / 2 + nx * out * WALL_THICKNESS / 2,
        (p.y + q.y) / 2 + ny * out * WALL_THICKNESS / 2,
        len + 4, WALL_THICKNESS,
        { isStatic: true, angle: Math.atan2(dy, dx), friction: 0.6 },
      );
    });
    Matter.Composite.add(this.engine.world, this.walls);
  }

  private top() { return -(this.outline[(PROFILE_SAMPLES * 3) / 4] - GLASS) * U; }

  private makeBody(coin: MatterCoin, x: number, y: number) {
    const body = coin.item
      ? Matter.Bodies.circle(x, y, coin.item.radius * U, COIN_BODY)
      : this.shape === "bead"
        ? Matter.Bodies.circle(x, y, COIN_R * BEAD_SCALE * coin.look.scale * U, COIN_BODY)
        : Matter.Bodies.fromVertices(x, y, [coinVertices(coin.look)], COIN_BODY);
    Matter.Body.setAngle(body, coin.item ? (this.rng() - 0.5) * 0.5 : (coin.look.rot * Math.PI) / 180);
    coin.body = body;
    Matter.Composite.add(this.engine.world, body);
  }

  /**
   * Start with the pile already at rest: place coins in their spots, then let
   * them settle for a moment off-screen with heavy air drag, so a scope switch
   * never shows an initial jolt.
   */
  seed(owners: CoinOwner[], slots: CoinSlot[]) {
    for (const c of this.coins) if (c.body) Matter.Composite.remove(this.engine.world, c.body);
    this.coins = owners.map((owner, i) => {
      // Seeded coins are already in the jar: no arrival animation.
      const coin: MatterCoin = { owner, look: coinLook(this.created++), body: null, releaseAt: -Infinity, spawn: { x: 0, y: 0 }, flip: 0 };
      this.makeBody(coin, slots[i].x * U, slots[i].y * U);
      return coin;
    });
    for (const c of this.coins) c.body!.frictionAir = 0.3;
    for (let i = 0; i < 180; i++) Matter.Engine.update(this.engine, STEP_MS);
    for (const c of this.coins) c.body!.frictionAir = COIN_BODY.frictionAir!;
  }

  /** Start with a month of spending already at rest (same off-screen settle as `seed`). */
  seedItems(items: JarItem[], slots: CoinSlot[]) {
    for (const c of this.coins) if (c.body) Matter.Composite.remove(this.engine.world, c.body);
    // Spread items over the jar's spots, biggest first so they sit lowest, then let them settle.
    const ordered = [...items].sort((a, b) => b.radius - a.radius);
    this.coins = ordered.map((item, i) => {
      const coin: MatterCoin = { owner: "anas", look: coinLook(this.created++), body: null, releaseAt: -Infinity, spawn: { x: 0, y: 0 }, flip: 0, item };
      const s = slots[Math.min(slots.length - 1, Math.floor((i / Math.max(1, ordered.length)) * slots.length))];
      this.makeBody(coin, s.x * U, s.y * U);
      return coin;
    });
    for (const c of this.coins) c.body!.frictionAir = 0.3;
    for (let i = 0; i < 240; i++) Matter.Engine.update(this.engine, STEP_MS);
    for (const c of this.coins) c.body!.frictionAir = COIN_BODY.frictionAir!;
  }

  addItem(item: JarItem, delay: number) {
    const spawn = { x: (this.rng() - 0.5) * 0.4 * U, y: this.top() * 0.8 };
    this.coins.push({ owner: "anas", look: coinLook(this.created++), body: null, releaseAt: this.clock + delay, spawn, flip: 0, item });
  }

  removeItem(id: string, delay = 0) {
    const coin = this.coins.find(c => c.item?.id === id && c.leftAt === undefined);
    if (coin) coin.leftAt = this.clock + delay;
  }

  /** Suck several emojis out through the top, the top-most first. */
  removeItems(ids: string[], stagger = 0.05) {
    const leaving = this.coins
      .filter(c => c.item && c.leftAt === undefined && ids.includes(c.item.id))
      .sort((a, b) => (a.body?.position.y ?? -Infinity) - (b.body?.position.y ?? -Infinity));
    leaving.forEach((c, i) => { c.leftAt = this.clock + i * stagger; });
  }

  /** Grow or shrink an emoji in place (its share changed); it eases to the new size. */
  resizeItem(id: string, radius: number) {
    const coin = this.coins.find(c => c.item?.id === id && c.leftAt === undefined);
    if (!coin?.item) return;
    if (!coin.body) { coin.item = { ...coin.item, radius }; return; }
    coin.targetRadius = radius;
  }

  /** Current radius of a staying emoji, or undefined. */
  itemRadius(id: string) {
    const coin = this.coins.find(c => c.item?.id === id && c.leftAt === undefined);
    return coin ? coin.targetRadius ?? coin.item?.radius : undefined;
  }

  itemIds() {
    return this.coins.filter(c => c.item && c.leftAt === undefined).map(c => c.item!.id);
  }

  add(owner: CoinOwner, delay: number) {
    const spawn = { x: (this.rng() - 0.5) * 0.5 * U, y: this.top() * 0.85 };
    this.coins.push({ owner, look: coinLook(this.created++), body: null, releaseAt: this.clock + delay, spawn, flip: 0 });
  }

  /** Take out the top-most coin of `owner`. */
  remove(owner: CoinOwner, delay: number) {
    const top = this.coins
      .filter(c => c.owner === owner && c.leftAt === undefined)
      .sort((a, b) => (a.body?.position.y ?? -Infinity) - (b.body?.position.y ?? -Infinity))[0];
    if (top) top.leftAt = this.clock + delay;
  }

  count(owner: CoinOwner) {
    return this.coins.filter(c => c.owner === owner && c.leftAt === undefined).length;
  }

  /** Add a velocity (body units / s), varied per coin. */
  kick(vx: number, vy: number) {
    for (const c of this.coins) {
      if (!c.body || c.leftAt !== undefined) continue;
      Matter.Sleeping.set(c.body, false);
      const jx = vx * (0.6 + this.rng() * 0.8) + (this.rng() - 0.5) * Math.abs(vy) * 0.5;
      const jy = vy * (0.6 + this.rng() * 0.8);
      Matter.Body.setVelocity(c.body, { x: c.body.velocity.x + (jx * U) / 60, y: c.body.velocity.y + (jy * U) / 60 });
      Matter.Body.setAngularVelocity(c.body, c.body.angularVelocity + (this.rng() - 0.5) * 0.2);
    }
  }

  step(dt: number) {
    this.engine.gravity.x = Math.sin(this.tilt);
    this.engine.gravity.y = Math.cos(this.tilt);
    // Fixed time step. matter-js rescales velocity by the ratio of consecutive
    // deltas, so a sliver step after a full one (what variable frame times give)
    // inflates velocities until coins tunnel through the walls.
    const h = STEP_MS / 1000;
    this.pending = Math.min(this.pending + dt, 0.05);
    while (this.pending >= h) {
      this.pending -= h;
      this.clock += h;
      for (const c of this.coins) {
        if (!c.body && c.leftAt === undefined && this.clock >= c.releaseAt) {
          this.makeBody(c, c.spawn.x, c.spawn.y);
          // Dropped in through the lid with some speed and a tumble, rather than straight down from rest.
          // Emojis come in quicker and nearly upright.
          Matter.Body.setVelocity(c.body!, c.item ? { x: (this.rng() - 0.5) * 0.6, y: ITEM_DROP_SPEED } : { x: (this.rng() - 0.5) * 1.2, y: DROP_SPEED });
          Matter.Body.setAngularVelocity(c.body!, (this.rng() - 0.5) * (c.item ? 0.04 : 0.3));
        }
        if (c.body && c.leftAt !== undefined && this.clock >= c.leftAt) {
          // Out of the world at once, so the pile settles into the gap while it crumbles.
          c.frozen = { x: c.body.position.x, y: c.body.position.y, angle: c.body.angle };
          Matter.Composite.remove(this.engine.world, c.body);
          c.body = null;
          for (const other of this.coins) if (other.body) Matter.Sleeping.set(other.body, false);
        }
      }
      for (const c of this.coins) {
        if (!c.body || !c.item || c.targetRadius === undefined) continue;
        // Ease towards the new size (~0.25 s), nudging neighbours aside as it grows.
        const next = Math.abs(c.targetRadius - c.item.radius) < 0.002 ? c.targetRadius : c.item.radius + (c.targetRadius - c.item.radius) * 0.1;
        Matter.Body.scale(c.body, next / c.item.radius, next / c.item.radius);
        Matter.Sleeping.set(c.body, false);
        c.item = { ...c.item, radius: next };
        if (next === c.targetRadius) c.targetRadius = undefined;
      }
      Matter.Engine.update(this.engine, STEP_MS);
      for (const c of this.coins) {
        const b = c.body;
        if (!b || b.isSleeping) continue;
        if (c.item) { Matter.Body.setAngularVelocity(b, b.angularVelocity - UPRIGHT * Math.sin(b.angle)); continue; }
        if (this.shape === "bead") continue; // a circle has no edge to stand on or face to flip
        Matter.Body.setAngularVelocity(b, b.angularVelocity - TOPPLE * Math.sin(2 * b.angle));
        // Tumble in 3D while moving; settle back to the resting face once still.
        const speed = Math.hypot(b.velocity.x, b.velocity.y);
        if (speed > 0.4) c.flip += speed * 0.12;
        else c.flip += (Math.round(c.flip / Math.PI) * Math.PI - c.flip) * 0.15;
      }
    }
    this.coins = this.coins.filter(c => c.leftAt === undefined || this.clock - c.leftAt < (c.item ? SUCK : LEAVE));
  }

  view(coin: MatterCoin) {
    const deg = (rad: number) => (rad * 180) / Math.PI;
    if (coin.item && coin.leftAt !== undefined && this.clock >= coin.leftAt) {
      // Sucked out: pulled up towards the middle of the lid, accelerating, and gone
      // as it passes the rim (the jar clips its contents).
      const k = Math.min(1, (this.clock - coin.leftAt) / SUCK);
      const e = k * k * k;
      const f = coin.frozen ?? { x: coin.spawn.x, y: coin.spawn.y, angle: 0 };
      const exitY = this.top() - (coin.item.radius + 0.2) * U;
      return { x: (f.x + (f.x * 0.25 - f.x) * e) / U, y: (f.y + (exitY - f.y) * e) / U, rot: deg(f.angle * (1 - e)), opacity: 1, dust: 0, aspect: coin.look.aspect };
    }
    if (coin.leftAt !== undefined && this.clock >= coin.leftAt) {
      const k = Math.min(1, (this.clock - coin.leftAt) / LEAVE);
      const f = coin.frozen ?? { x: coin.spawn.x, y: coin.spawn.y, angle: 0 };
      return { x: f.x / U, y: f.y / U, rot: deg(f.angle), opacity: 1 - k, dust: k, aspect: coin.look.aspect };
    }
    if (!coin.body) return { x: coin.spawn.x / U, y: coin.spawn.y / U, rot: coin.look.rot, opacity: 0, dust: 0, aspect: coin.look.aspect };
    // The oval narrows towards edge-on and widens back as the coin tumbles.
    const aspect = this.shape === "bead" ? 1 : Math.max(0.16, coin.look.aspect * Math.abs(Math.cos(coin.flip)));
    const arrive = Math.min(1, (this.clock - coin.releaseAt) / ARRIVE_DURATION);
    return { x: coin.body.position.x / U, y: coin.body.position.y / U, rot: deg(coin.body.angle), opacity: 1, dust: 0, aspect, arrive };
  }
}
