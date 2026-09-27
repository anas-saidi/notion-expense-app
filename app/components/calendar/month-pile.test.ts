import { describe, expect, it } from "vitest";
import { pileMonth, type PiledItem } from "./month-pile";

const S = 44;
const inBox = (p: PiledItem) => Math.abs(p.x) + p.r <= S + 1e-6 && p.y + p.r <= S + 1e-6 && p.y - p.r >= -S - 1e-6;
const apart = (pile: PiledItem[]) => pile.every((a, i) => pile.slice(i + 1).every((b) => Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r - 1e-6));

describe("pileMonth", () => {
  it("returns nothing for an empty month", () => {
    expect(pileMonth([], { size: S, fill: 0.5 })).toEqual([]);
    expect(pileMonth([{ id: "a", amount: 0 }], { size: S, fill: 0.5 })).toEqual([]);
  });

  it("sizes emojis by area, largest first", () => {
    const pile = pileMonth([{ id: "small", amount: 100 }, { id: "big", amount: 400 }], { size: S, fill: 0.3 });
    expect(pile.map((p) => p.id)).toEqual(["big", "small"]);
    expect(pile[0].r / pile[1].r).toBeCloseTo(2, 5);
  });

  it("rests the largest on the floor, in the middle", () => {
    const [first] = pileMonth([{ id: "a", amount: 500 }, { id: "b", amount: 100 }], { size: S, fill: 0.3 });
    expect(first.x).toBeCloseTo(0, 5);
    expect(first.y + first.r).toBeCloseTo(S, 5);
  });

  it("keeps every emoji in the box and apart from the others", () => {
    const pile = pileMonth([{ id: "a", amount: 500 }, { id: "b", amount: 300 }, { id: "c", amount: 200 }], { size: S, fill: 0.5 });
    expect(pile.every(inBox)).toBe(true);
    expect(apart(pile)).toBe(true);
  });

  it("shrinks a pile too tall for the box", () => {
    const pile = pileMonth([{ id: "trip", amount: 7000 }, { id: "food", amount: 3000 }, { id: "meds", amount: 900 }], { size: S, fill: 0.9 });
    expect(pile).toHaveLength(3);
    expect(pile.every(inBox)).toBe(true);
    expect(apart(pile)).toBe(true);
  });

  it("is deterministic", () => {
    const items = [{ id: "a", amount: 320 }, { id: "b", amount: 320 }, { id: "c", amount: 90 }];
    expect(pileMonth(items, { size: S, fill: 0.5 })).toEqual(pileMonth(items, { size: S, fill: 0.5 }));
  });
});
