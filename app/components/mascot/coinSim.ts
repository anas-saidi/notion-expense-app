import { ARRIVE_DURATION, COIN_ASPECT, COIN_R, DUST_DURATION, coinLook, type CoinLook, type CoinOwner, type CoinSlot } from "./coins";
import { circleProfile, radiusAtAngle } from "./shape";
import { createRng } from "./math";

/**
 * Level-2 coin physics: position-based (Verlet) discs inside the round jar.
 *
 * Unlike the level-1 pile this is STATEFUL — it has to be stepped in order —
 * so it only runs when the mascot is animating. Everything is in body units
 * (jar rest radius = 1, y down). Fixed substeps keep it stable at any frame
 * rate, and the seeded RNG keeps runs reproducible.
 */

/**
 * Collision radius, sized to the coin's drawn HEIGHT rather than its width: a
 * wider disc leaves a gap between every row of flat, oval coins. Side by side
 * they overlap instead, which reads as depth.
 */
const DISC = COIN_R * COIN_ASPECT * 0.95;
/** Coins in a pile lie flat, so rolling only tilts them a little. */
const MAX_TILT = 18;
const GLASS = 0.06;
// Heavy, quick-settling coins: strong gravity and damping so they drop and stop
// rather than float, and enough solver passes that contacts feel firm.
const GRAVITY = 10;
const DAMPING = 0.975;
/** Share of tangential speed kept when a coin scrapes the jar wall. */
const WALL_FRICTION = 0.4;
/** Share of relative sliding removed per contact, so the pile holds its shape instead of flowing. */
const COIN_FRICTION = 0.35;
/** Below this per-substep movement a coin is at rest: zeroing it removes resting jitter. */
const SLEEP = 0.0004;
const ITERATIONS = 8;
const SUBSTEP = 1 / 120;
const LEAVE = DUST_DURATION;

export interface SimCoin {
  owner: CoinOwner;
  x: number; y: number;
  px: number; py: number;
  /** Accumulated roll, degrees. */
  spin: number;
  look: CoinLook;
  /** Time the coin started leaving, in sim seconds. */
  leftAt?: number;
  /** Not simulated until the sim clock reaches this. */
  releaseAt: number;
}

/** The fields every simulated coin exposes to the engine. */
export interface SimCoinBase { owner: CoinOwner; look: CoinLook; item?: { glyph: string; radius: number } }

/** What the engine needs from a coin simulation (ours, or the matter-js one). */
export interface CoinPhysics {
  tilt: number;
  readonly coins: SimCoinBase[];
  setOutline(radii: number[]): void;
  seed(owners: CoinOwner[], slots: CoinSlot[]): void;
  add(owner: CoinOwner, delay: number): void;
  remove(owner: CoinOwner, delay: number): void;
  count(owner: CoinOwner): number;
  kick(vx: number, vy: number): void;
  step(dt: number): void;
  /** `aspect` overrides the coin's resting look while it tumbles. */
  view(coin: SimCoinBase): { x: number; y: number; rot: number; opacity: number; dust: number; aspect?: number; arrive?: number };
}

export class CoinSim implements CoinPhysics {
  coins: SimCoin[] = [];
  private clock = 0;
  private rng = createRng(0x51a1);
  /** Frame time not yet simulated; only whole fixed steps run, for frame-rate-independent results. */
  private pending = 0;
  private created = 0;
  /** Gravity direction, radians from straight down (phone tilt). */
  tilt = 0;
  private outline = circleProfile(1);

  /** Walls follow the jar's outline (circle, squircle…), not a fixed circle. */
  setOutline(radii: number[]) { this.outline = radii; }
  private wallAt(angle: number) { return radiusAtAngle(this.outline, angle) - GLASS - DISC; }

  /** Start at rest in the level-1 spots, so switching modes doesn't jump. */
  seed(owners: CoinOwner[], slots: CoinSlot[]) {
    this.coins = owners.map((owner, i) => {
      const s = slots[i];
      this.created = i + 1;
      return { owner, x: s.x, y: s.y, px: s.x, py: s.y, spin: 0, look: coinLook(i), releaseAt: -Infinity };
    });
  }

  /** Drop a coin in from the top of the jar after `delay` seconds. */
  add(owner: CoinOwner, delay: number) {
    const x = (this.rng() - 0.5) * 0.5;
    const y = -this.wallAt(-Math.PI / 2) * 0.85;
    this.coins.push({ owner, x, y, px: x, py: y - 0.02, spin: 0, look: coinLook(this.created++), releaseAt: this.clock + delay });
  }

  /** Take out the top-most (smallest y) coin of `owner`. */
  remove(owner: CoinOwner, delay: number) {
    const top = this.coins
      .filter(c => c.owner === owner && c.leftAt === undefined)
      .sort((a, b) => a.y - b.y)[0];
    if (top) top.leftAt = this.clock + delay;
  }

  count(owner: CoinOwner) {
    return this.coins.filter(c => c.owner === owner && c.leftAt === undefined).length;
  }

  /** Add a velocity (body units / s) to every settled coin, varied per coin. */
  kick(vx: number, vy: number) {
    for (const c of this.coins) {
      if (c.leftAt !== undefined || c.releaseAt > this.clock) continue;
      const jx = vx * (0.6 + this.rng() * 0.8) + (this.rng() - 0.5) * Math.abs(vy) * 0.5;
      const jy = vy * (0.6 + this.rng() * 0.8);
      c.px -= jx * SUBSTEP;
      c.py -= jy * SUBSTEP;
    }
  }

  step(dt: number) {
    this.pending = Math.min(this.pending + dt, 0.05);
    while (this.pending >= SUBSTEP) {
      this.pending -= SUBSTEP;
      this.substep(SUBSTEP);
    }
    this.coins = this.coins.filter(c => c.leftAt === undefined || this.clock - c.leftAt < LEAVE);
  }

  private substep(h: number) {
    this.clock += h;
    const gx = Math.sin(this.tilt) * GRAVITY;
    const gy = Math.cos(this.tilt) * GRAVITY;
    const live = this.coins.filter(c => c.leftAt === undefined && c.releaseAt <= this.clock);

    for (const c of live) {
      const vx = (c.x - c.px) * DAMPING;
      const vy = (c.y - c.py) * DAMPING;
      c.px = c.x;
      c.py = c.y;
      c.x += vx + gx * h * h;
      c.y += vy + gy * h * h;
      c.spin = Math.max(-MAX_TILT, Math.min(MAX_TILT, c.spin + vx * 60));
    }

    for (let it = 0; it < ITERATIONS; it++) {
      for (let i = 0; i < live.length; i++) {
        const a = live[i];
        for (let j = i + 1; j < live.length; j++) {
          const b = live[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= 4 * DISC * DISC || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const push = (2 * DISC - d) / 2 / d;
          a.x -= dx * push; a.y -= dy * push;
          b.x += dx * push; b.y += dy * push;
          if (it === 0) {
            // Friction: cancel part of the sliding along the contact.
            const nx = dx / d, ny = dy / d;
            const rvx = (b.x - b.px) - (a.x - a.px);
            const rvy = (b.y - b.py) - (a.y - a.py);
            const rn = rvx * nx + rvy * ny;
            const tx = (rvx - rn * nx) * COIN_FRICTION / 2;
            const ty = (rvy - rn * ny) * COIN_FRICTION / 2;
            a.px -= tx; a.py -= ty;
            b.px += tx; b.py += ty;
          }
        }
      }
      for (const c of live) {
        const d = Math.hypot(c.x, c.y);
        const wall = this.wallAt(Math.atan2(c.y, c.x));
        if (d <= wall) continue;
        const nx = c.x / d, ny = c.y / d;
        c.x = nx * wall;
        c.y = ny * wall;
        // Keep the normal component of velocity out, damp the tangential one (friction).
        const vx = c.x - c.px, vy = c.y - c.py;
        const vn = vx * nx + vy * ny;
        const tx = vx - vn * nx, ty = vy - vn * ny;
        c.px = c.x - tx * WALL_FRICTION - Math.min(vn, 0) * nx * 0.3;
        c.py = c.y - ty * WALL_FRICTION - Math.min(vn, 0) * ny * 0.3;
      }
    }

    for (const c of live) {
      if (Math.abs(c.x - c.px) < SLEEP && Math.abs(c.y - c.py) < SLEEP) { c.px = c.x; c.py = c.y; }
    }
  }

  /** Render state for a coin: position, rotation and fade (for leavers). */
  view(c: SimCoin) {
    // A spent coin crumbles where it lies (it already left the collision set).
    if (c.leftAt !== undefined && this.clock >= c.leftAt) {
      const k = Math.min(1, (this.clock - c.leftAt) / LEAVE);
      return { x: c.x, y: c.y, rot: c.look.rot + c.spin, opacity: 1 - k, dust: k };
    }
    const arrive = Math.min(1, (this.clock - c.releaseAt) / ARRIVE_DURATION);
    return { x: c.x, y: c.y, rot: c.look.rot + c.spin, opacity: c.releaseAt > this.clock ? 0 : 1, dust: 0, arrive };
  }

  get time() { return this.clock; }
}
