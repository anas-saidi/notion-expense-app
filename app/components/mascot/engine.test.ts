import { describe, expect, it } from "vitest";
import { MascotEngine, coinCounts, poseFor, type MascotFrame, type MascotTarget } from "./engine";
import { deriveTarget, reactionForBalanceChange } from "./mood";
import { duoBody, jarShape } from "./poses";
import { radiusAtAngle } from "./shape";
import { COIN_CAPACITY } from "./coins";

const joint: MascotTarget = { scope: "joint", gap: 0.5, mood: "idle" };

describe("mascot engine", () => {
  it("is a pure function of time", () => {
    const engine = new MascotEngine(joint);
    engine.setTarget({ ...joint, scope: "anas" }, 1);
    expect(engine.sample(1.2)).toEqual(engine.sample(1.2));
  });

  it("pulls the joint lobes apart as the funding gap grows", () => {
    const waist = (gap: number) => radiusAtAngle(duoBody(gap).radii, Math.PI / 2);
    expect(waist(1)).toBeLessThan(waist(0));
  });

  it("draws one face for personal and two for joint", () => {
    expect(new MascotEngine({ ...joint, scope: "salma" }, { calm: true }).sample(0).eyes).toHaveLength(2);
    expect(new MascotEngine(joint, { calm: true }).sample(0).eyes).toHaveLength(4);
  });

  it("returns to rest once a reaction has played", () => {
    const rest = new MascotEngine(joint);
    const reacting = new MascotEngine(joint);
    reacting.react("cheer", 2);
    expect(reacting.sample(2.3).body).not.toBe(rest.sample(2.3).body);
    expect(reacting.sample(3.5)).toEqual(rest.sample(3.5));
  });
});

describe("mascot mood", () => {
  const base = { scope: "joint" as const, fundingGap: 0, spentPct: 50, unassigned: 0, loading: false };
  it("celebrates a funded joint budget as a heart", () => {
    expect(deriveTarget(base)).toMatchObject({ mood: "happy", celebrate: true, gap: 0 });
  });
  it("lets budget health outrank celebration", () => {
    expect(deriveTarget({ ...base, spentPct: 105 })).toMatchObject({ mood: "sad", celebrate: false });
    expect(deriveTarget({ ...base, spentPct: 90 }).mood).toBe("worried");
    expect(deriveTarget({ ...base, loading: true }).mood).toBe("sleepy");
  });
  it("maps a shortfall to separation without ever fully splitting", () => {
    const gap = deriveTarget({ ...base, fundingGap: 2651 }).gap;
    expect(gap).toBeGreaterThan(0.5);
    expect(deriveTarget({ ...base, fundingGap: 1e7 }).gap).toBeLessThanOrEqual(1);
  });
  it("scales expense reactions against what's left", () => {
    expect(reactionForBalanceChange(500, 3845)).toBe("cheer");
    expect(reactionForBalanceChange(-40, 3845)).toBe("dip");
    expect(reactionForBalanceChange(-1500, 3845)).toBe("wince");
    expect(reactionForBalanceChange(0.2, 3845)).toBeNull();
  });
});

describe("coin jar", () => {
  const jar = (anas: number, salma = 0): MascotTarget => ({ scope: "joint", gap: 0, mood: "idle", coins: { anas, salma } });
  const settled = (engine: MascotEngine, t: number) => engine.sample(t).coins!.filter(c => c.opacity === 1);

  it("fills to each owner's share, capped at the jar's capacity", () => {
    const frame = new MascotEngine(jar(0.5, 0.25), { calm: true }).sample(0);
    const count = (o: string) => frame.coins!.filter(c => c.owner === o).length;
    expect(count("anas")).toBe(Math.round(0.5 * COIN_CAPACITY));
    expect(count("salma")).toBe(Math.round(0.25 * COIN_CAPACITY));
    expect(new MascotEngine(jar(0.8, 0.8), { calm: true }).sample(0).coins!.length).toBe(COIN_CAPACITY);
  });

  it("drops new coins in and flies removed ones out", () => {
    const engine = new MascotEngine(jar(0.2));
    const before = settled(engine, 0).length;
    engine.setTarget(jar(0.4), 1);
    expect(settled(engine, 5).length).toBeGreaterThan(before);
    engine.setTarget(jar(0.1), 6);
    const leaving = engine.sample(6.2).coins!.filter(c => c.opacity < 1);
    expect(leaving.length).toBeGreaterThan(0);
    expect(leaving.every(c => c.owner === "anas")).toBe(true);
    expect(settled(engine, 10).length).toBe(Math.round(0.1 * COIN_CAPACITY));
  });
});

describe("coin jar extras", () => {
  const jar = (anas: number, salma = 0): MascotTarget => ({ scope: "joint", gap: 0, mood: "idle", coins: { anas, salma } });

  it("shows at least one coin for any contribution, and an empty shell for none", () => {
    expect(coinCounts({ anas: 0.001, salma: 0 })).toEqual({ anas: 1, salma: 0 });
    expect(new MascotEngine(jar(0), { calm: true }).sample(0).coins).toEqual([]);
  });

  it("settles physics coins inside the jar without piling through each other", () => {
    const engine = new MascotEngine(jar(0.3), { physics: true });
    engine.setTarget(jar(0.6, 0.2), 0);
    engine.shake(2);
    for (let t = 0; t <= 6; t += 1 / 60) engine.sample(t);
    const coins = engine.sample(6).coins!.filter(c => c.opacity === 1);
    const want = coinCounts({ anas: 0.6, salma: 0.2 });
    expect(coins.length).toBe(want.anas + want.salma);
    for (const c of coins) expect(Math.hypot(c.x, c.y)).toBeLessThanOrEqual(100);
    let tooClose = 0;
    for (let i = 0; i < coins.length; i++) for (let j = i + 1; j < coins.length; j++) {
      if (Math.hypot(coins[i].x - coins[j].x, coins[i].y - coins[j].y) < 12) tooClose++;
    }
    expect(tooClose).toBe(0);
  });

  it("gives a full jar a face label behind the eyes", () => {
    expect(new MascotEngine(jar(0.9), { calm: true }).sample(0).faceWindow).toBeDefined();
    expect(new MascotEngine({ scope: "anas", gap: 0, mood: "idle" }, { calm: true }).sample(0).faceWindow).toBeUndefined();
  });
});

describe("spent coins crumble to dust", () => {
  const jar = (anas: number): MascotTarget => ({ scope: "anas", gap: 0, mood: "idle", coins: { anas } });
  it.each([false, "custom", "matter"] as const)("dissolves in place, then is gone (physics: %s)", physics => {
    const engine = new MascotEngine(jar(0.5), { physics });
    for (let t = 0; t <= 2; t += 1 / 60) engine.sample(t);
    const before = engine.sample(2).coins!;
    engine.setTarget(jar(0.3), 2);
    for (let t = 2; t <= 2.35; t += 1 / 60) engine.sample(t);
    const crumbling = engine.sample(2.35).coins!.filter(c => c.dust > 0 && c.dust < 1);
    expect(crumbling.length).toBeGreaterThan(0);
    // Crumbling coins stay where they were rather than flying off.
    for (const c of crumbling) expect(before.some(b => Math.hypot(b.x - c.x, b.y - c.y) < 2)).toBe(true);
    for (let t = 2.35; t <= 5; t += 1 / 60) engine.sample(t);
    expect(engine.sample(5).coins!.filter(c => c.dust > 0 && c.dust < 1)).toHaveLength(0);
  });
});

describe("outlines", () => {
  const jar = (scope: "anas" | "salma" | "joint", outline: "orb" | "squircle" | "partner" = "partner"): MascotTarget =>
    ({ scope, gap: 0, mood: "idle", outline, coins: scope === "joint" ? { anas: 0.4, salma: 0.3 } : { [scope]: 0.5 } });

  it.each(["egg", "drop", "bean", "pebble"] as const)("gives each partner their own silhouette, with joint between them (Salma: %s)", salma => {
    expect(jarShape("partner", "anas", salma).key).toBe("squircle");
    expect(jarShape("partner", "salma", salma).key).toBe(salma);
    const joint = jarShape("partner", "joint", salma);
    const anas = jarShape("partner", "anas", salma).radii, wife = jarShape("partner", "salma", salma).radii;
    joint.radii.forEach((r, i) => expect(r).toBeCloseTo((anas[i] + wife[i]) / 2));
  });

  it.each(["custom", "matter"] as const)("keeps %s physics coins inside a squircle jar", physics => {
    const engine = new MascotEngine(jar("anas", "squircle"), { physics });
    engine.shake(2);
    for (let t = 0; t <= 4; t += 1 / 60) engine.sample(t);
    const radii = jarShape("squircle", "anas").radii;
    for (const c of engine.sample(4).coins!) {
      expect(Math.hypot(c.x, c.y)).toBeLessThanOrEqual(radiusAtAngle(radii, Math.atan2(c.y, c.x)) * 100 + 0.5);
    }
  });

  it.each([false, "custom", "matter"] as const)("re-forms the pile quietly when the scope changes (physics: %s)", physics => {
    const engine = new MascotEngine(jar("anas"), { physics });
    engine.sample(0);
    engine.setTarget(jar("salma"), 1);
    const frame = engine.sample(1.2);
    expect(frame.coins!.every(c => c.dust === 0)).toBe(true);
    expect(frame.coins!.every(c => c.owner === "salma")).toBe(true);
  });
});

describe("physics under real frame timing", () => {
  it.each(["custom", "matter"] as const)("keeps %s coins in the jar with uneven frame times", physics => {
    const joint: MascotTarget = { scope: "joint", gap: 0, mood: "idle", outline: "partner", coins: { anas: 0.49, salma: 0.37 } };
    const engine = new MascotEngine(joint, { physics });
    // Browser frames are never exactly 1/60 s; deterministic jitter between 16 and 17.4 ms.
    let t = 0, i = 0;
    const run = (secs: number) => { for (const end = t + secs; t < end; t += (16 + ((i++ * 7) % 15) / 10) / 1000) engine.sample(t); };
    run(2);
    engine.setTarget({ ...joint, scope: "anas", coins: { anas: 0.4 } }, t);
    run(2);
    engine.setTarget(joint, t);
    engine.shake(1);
    run(3);
    const coins = engine.sample(t).coins!.filter(c => c.opacity > 0);
    expect(coins.length).toBeGreaterThan(0);
    for (const c of coins) expect(Math.hypot(c.x, c.y)).toBeLessThan(110);
  });
});

describe("beads", () => {
  const jar = (anas: number): MascotTarget => ({ scope: "anas", gap: 0, mood: "idle", outline: "partner", coins: { anas } });
  it.each([false, "matter"] as const)("arrive only when new, and stay round (physics: %s)", physics => {
    const engine = new MascotEngine(jar(0.3), { physics, coinShape: "bead" });
    let t = 0, i = 0;
    const run = (secs: number) => { for (const end = t + secs; t < end; t += (16 + (i++ % 3) * 0.5) / 1000) engine.sample(t); };
    run(1);
    const seeded = engine.sample(t).coins!;
    expect(seeded.every(c => c.arrive === 1)).toBe(true);
    engine.setTarget(jar(0.4), t);
    run(0.3);
    expect(engine.sample(t).coins!.some(c => c.arrive > 0 && c.arrive < 1)).toBe(true);
    run(3);
    const settled = engine.sample(t).coins!;
    expect(settled.every(c => c.arrive === 1)).toBe(true);
    if (physics) expect(settled.every(c => c.aspect === 1)).toBe(true);
    for (const c of settled) expect(Math.hypot(c.x, c.y)).toBeLessThan(110);
  });
});

describe("pool", () => {
  const pool = (fill: number): MascotTarget => ({ scope: "joint", gap: 0, mood: "idle", outline: "partner", fill });
  const level = (f: MascotFrame) => { const ys = f.surface!.match(/-?\d+(\.\d+)?/g)!.map(Number).filter((_, i) => i % 2 === 1); return ys.reduce((s, y) => s + y, 0) / ys.length; };
  const flatness = (f: MascotFrame) => { const ys = f.surface!.match(/-?\d+(\.\d+)?/g)!.map(Number).filter((_, i) => i % 2 === 1); return Math.max(...ys) - Math.min(...ys); };
  let t = 0, i = 0;
  const run = (e: MascotEngine, secs: number) => { for (const end = t + secs; t < end; t += (16 + (i++ % 3) * 0.5) / 1000) e.sample(t); return e.sample(t); };

  it("rises smoothly when money comes in, then settles to a calm resting wave", () => {
    t = 0;
    const e = new MascotEngine(pool(0.4));
    const before = level(run(e, 1));
    e.setTarget(pool(0.6), t);
    const after = run(e, 4);
    expect(level(after)).toBeLessThan(before - 10); // higher surface = smaller y
    expect(flatness(after)).toBeLessThanOrEqual(2.2); // the resting wave is ±1
  });

  it("eases down smoothly when money is pulled out, without a sharp dent", () => {
    t = 0;
    const e = new MascotEngine(pool(0.6));
    const start = level(run(e, 1));
    e.setTarget(pool(0.5), t);
    // Soft start: barely moved after 50 ms, then a gentle slosh at most, then flat at the new level.
    const early = run(e, 0.05);
    expect(Math.abs(level(early) - start)).toBeLessThan(2);
    let worst = 0;
    for (let k = 0; k < 60; k++) worst = Math.max(worst, flatness(run(e, 1 / 60)));
    expect(worst).toBeLessThan(25);
    const end = run(e, 4);
    expect(level(end)).toBeGreaterThan(start + 8);
    expect(flatness(end)).toBeLessThanOrEqual(2.2);
  });

  it("leans with tilt and stays calm under Reduce Motion", () => {
    t = 0;
    const e = new MascotEngine(pool(0.5));
    e.setTilt(0.4);
    const f = run(e, 4);
    const ys = f.surface!.match(/-?\d+(\.\d+)?/g)!.map(Number).filter((_, k) => k % 2 === 1);
    // Gravity tilted right (like the coins) piles water on the right: the surface rises there.
    expect(ys[0] - ys[ys.length - 1]).toBeGreaterThan(80);
    const still = new MascotEngine(pool(0.5), { calm: true }).sample(0);
    expect(still.surface).toBeUndefined(); // Reduce Motion: the plain static level, no simulated surface
  });
});

describe("eyes watch the water", () => {
  const eyeY = (f: MascotFrame) => f.eyes.reduce((s, e) => s + Number(/translate\(\S+ (\S+)\)/.exec(e.transform)![1]), 0) / f.eyes.length;
  const at = (fill: number) => new MascotEngine({ scope: "anas", gap: 0, mood: "idle", fill }).sample(0);
  it("look down at a low pool and up at a full one", () => {
    expect(eyeY(at(0.1))).toBeGreaterThan(eyeY(at(0.9)) + 3);
  });
});

describe("watching keeps expressions", () => {
  it("keeps each mood's eye shapes while watching a low pool", () => {
    const eyes = (mood: MascotTarget["mood"]) => new MascotEngine({ scope: "anas", gap: 0, mood, fill: 0.1 }, { calm: true }).sample(0).eyes.map(e => {
      // Shape (path) plus the eye's own tilt/openness, which live in its transform.
      const tilt = /rotate\((\S+)\)/.exec(e.transform)![1];
      const open = /scale\(1 (\S+)\)/.exec(e.transform)![1];
      return `${e.d}|${tilt}|${open}`;
    }).join();
    const shapes = new Set((["idle", "happy", "worried", "sad", "sleepy"] as const).map(eyes));
    expect(shapes.size).toBe(5);
  });
});

describe("joint jars are one body", () => {
  it("draws a joint emoji jar as the joint shape, not the two-lobe Shape body", () => {
    const items = [{ id: "a", glyph: "🏠", radius: 0.2 }];
    const pose = poseFor({ scope: "joint", gap: 0.5, mood: "idle", outline: "partner", items });
    expect(pose.radii).toEqual(jarShape("partner", "joint").radii);
  });
});

describe("emoji jar changes", () => {
  const jar = (items: Array<{ id: string; glyph: string; radius: number }>): MascotTarget => ({ scope: "joint", gap: 0, mood: "idle", outline: "partner", items });
  const run = (e: MascotEngine, from: number, to: number) => { let f: MascotFrame = e.sample(from); for (let t = from; t <= to; t += 1 / 60) f = e.sample(t); return f; };

  it("resizes a category whose share changed in place, without it leaving the jar", () => {
    const e = new MascotEngine(jar([{ id: "rent", glyph: "🏠", radius: 0.2 }, { id: "food", glyph: "🍽️", radius: 0.2 }]));
    run(e, 0, 0.5);
    e.setTarget(jar([{ id: "rent", glyph: "🏠", radius: 0.3 }, { id: "food", glyph: "🍽️", radius: 0.2 }]), 0.5);
    const mid = run(e, 0.5, 0.6);
    expect(mid.coins!.every(c => (c.dust ?? 0) === 0)).toBe(true);
    const end = run(e, 0.6, 2);
    expect(end.coins!.length).toBe(2);
    expect(end.coins!.find(c => c.glyph === "🏠")!.itemRadius).toBeCloseTo(0.3, 2);
  });

  it("sucks a removed emoji up through the top and then drops it", () => {
    const e = new MascotEngine(jar([{ id: "rent", glyph: "🏠", radius: 0.2 }, { id: "food", glyph: "🍽️", radius: 0.2 }]));
    const before = run(e, 0, 1).coins!.find(c => c.glyph === "🏠")!;
    e.setTarget(jar([{ id: "food", glyph: "🍽️", radius: 0.2 }]), 1);
    const leaving = run(e, 1, 1.3).coins!.find(c => c.glyph === "🏠")!;
    expect(leaving.y).toBeLessThan(before.y);
    expect(run(e, 1.3, 2).coins!.map(c => c.glyph)).toEqual(["🍽️"]);
  });
});

describe("pool level in frames", () => {
  it("reports a liquid jar's level (what the low-pool colour reads), and none for other jars", () => {
    expect(new MascotEngine({ scope: "anas", gap: 0, mood: "worried", fill: 0.09, outline: "partner" }, { calm: true }).sample(0).level).toBeCloseTo(0.09);
    expect(new MascotEngine({ scope: "anas", gap: 0, mood: "idle", outline: "partner", items: [] }).sample(0).level).toBeUndefined();
  });
});

describe("emoji jar edge cases", () => {
  const pool = (items: Array<{ id: string; glyph: string; radius: number }>): MascotTarget => ({ scope: "joint", gap: 0, mood: "idle", outline: "partner", fill: 0.2, items });
  const run = (e: MascotEngine, from: number, to: number) => { let f: MascotFrame = e.sample(from); for (let t = from; t <= to; t += 1 / 60) f = e.sample(t); return f; };

  it("never flashes emojis that were still queued when the pool closes right after opening", () => {
    const e = new MascotEngine(pool([]));
    run(e, 0, 0.2);
    e.setTarget(pool([{ id: "a", glyph: "🚗", radius: 0.2 }, { id: "b", glyph: "🛒", radius: 0.2 }, { id: "c", glyph: "🏠", radius: 0.2 }]), 0.2);
    run(e, 0.2, 0.22); // only the first has dropped in
    e.setTarget(pool([]), 0.22);
    for (let t = 0.22; t <= 1.2; t += 1 / 60) {
      const f = e.sample(t);
      for (const c of f.coins ?? []) if (c.glyph !== "🚗") expect(c.opacity).toBe(0);
    }
    expect(e.sample(1.3).coins).toEqual([]);
  });

  it("swaps an emoji in place when its category's icon changes", () => {
    const jar = (glyph: string): MascotTarget => ({ scope: "anas", gap: 0, mood: "idle", outline: "partner", items: [{ id: "rent", glyph, radius: 0.25 }] });
    const e = new MascotEngine(jar("🏠"));
    run(e, 0, 0.3);
    e.setTarget(jar("🏡"), 0.3);
    const f = run(e, 0.3, 0.4);
    expect(f.coins!.map(c => c.glyph)).toEqual(["🏡"]);
    expect(f.coins![0].dust ?? 0).toBe(0);
  });
});
