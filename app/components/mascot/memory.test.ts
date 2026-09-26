import { describe, expect, it } from "vitest";
import { parseSeenItems, parseSeenLevel, startFrom } from "./memory";

const house = { id: "rent:0.3", glyph: "🏠", radius: 0.3 };
const plate = { id: "food:0.2", glyph: "🍽️", radius: 0.2 };

describe("remembered jar", () => {
  it("starts an emoji jar exactly as last seen, so only changes animate", () => {
    expect(startFrom("items", [house], [house, plate])).toEqual([house]);
  });

  it("fills the emoji jar once from empty the very first time", () => {
    expect(startFrom("items", null, [house, plate])).toEqual([]);
  });

  it("starts the pool at its last level, and settled the first time", () => {
    expect(startFrom("level", 0.8, 0.4)).toBe(0.8);
    expect(startFrom("level", null, 0.4)).toBe(0.4);
  });

  it("starts settled when storage is unavailable or the record is corrupt", () => {
    const current = [house];
    expect(startFrom("items", undefined, current)).toBe(current);
    expect(startFrom("items", [{ id: 1 }], current)).toBe(current);
    expect(startFrom("level", "full", 0.4)).toBe(0.4);
  });

  it("validates stored values", () => {
    expect(parseSeenItems([house])).toEqual([house]);
    expect(parseSeenItems([{ ...house, radius: Number.NaN }])).toBeNull();
    expect(parseSeenItems([{ ...house, radius: 0 }])).toBeNull();
    expect(parseSeenItems({})).toBeNull();
    expect(parseSeenLevel(1.4)).toBe(1);
    expect(parseSeenLevel(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
