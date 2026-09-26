/**
 * The "pool of money" surface. Deliberately predictable rather than simulated:
 * spring-column water looked nervous at mascot size, so the surface is two
 * slow sine waves, the level eases between amounts, and only the lean (phone
 * tilt) keeps a damped spring, which reads as a gentle slosh.
 *
 * - A change of level eases in and out over 0.6–1.2 s depending on its size.
 * - The waves swell slightly for a moment when the level changes, then calm.
 * - The surface stays perpendicular to gravity when the phone tilts.
 *
 * Units are viewBox units (jar rest radius = 100, y down).
 */

const SLOSH_K = 18;
const SLOSH_DAMP = 4.5;
const STEP = 1 / 120;
/** Resting wave amplitude, and the extra swell right after a change. */
const WAVE = 1;
const SWELL = 2.2;

const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);

export class PoolSim {
  tilt = 0;
  /** Surface slope (dy/dx); follows gravity tilt with a damped slosh. */
  slope = 0;
  private slopeVel = 0;
  private from: number;
  private to: number;
  private t0 = -Infinity;
  private dur = 1;
  private pending = 0;

  constructor(level: number) {
    this.from = this.to = level;
  }

  /** Displayed level (0 empty, 1 full) at time t. */
  levelAt(t: number) {
    const k = Math.min(1, Math.max(0, (t - this.t0) / this.dur));
    return this.from + (this.to - this.from) * easeInOutCubic(k);
  }

  /** Ease from wherever the level is now to a new amount. */
  setLevel(level: number, t: number) {
    if (Math.abs(level - this.to) < 0.001) return;
    this.from = this.levelAt(t);
    this.to = level;
    this.t0 = t;
    this.dur = 0.6 + Math.min(0.6, Math.abs(level - this.from) * 2);
  }

  /** Advance the lean (the only stateful part). */
  step(dt: number) {
    this.pending = Math.min(this.pending + dt, 0.05);
    // Gravity tilted to the right (positive tilt, the way coins slide) piles water
    // on the right, so the surface rises there (y shrinks).
    const want = -Math.tan(this.tilt);
    while (this.pending >= STEP) {
      this.pending -= STEP;
      this.slopeVel += (-(this.slope - want) * SLOSH_K - this.slopeVel * SLOSH_DAMP) * STEP;
      this.slope += this.slopeVel * STEP;
    }
  }

  /** Surface points across the jar at time t, given the resting level's y. */
  surface(levelY: number, t: number): Array<{ x: number; y: number }> {
    const since = t - this.t0;
    const amp = WAVE + (since >= 0 ? SWELL * Math.exp(-since * 1.6) : 0);
    return Array.from({ length: 31 }, (_, i) => {
      const x = -150 + i * 10;
      const wave = 0.6 * Math.sin(x / 30 + t * 1.4) + 0.4 * Math.sin(x / 17 - t * 2);
      return { x, y: levelY + this.slope * x + amp * wave };
    });
  }
}
