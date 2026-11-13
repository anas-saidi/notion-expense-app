import { describe, expect, it } from "vitest";
import { pickReallocationContext } from "./finance-ai";

const c = (id: string, name: string, available: number, reserved = 0) => ({ id, name, available, reserved });
const budget = [
  c("g", "Groceries", -120), c("e", "Eat out", 300), c("s", "Shopping", 900), c("m", "Medical Bills", 800, 800),
  c("t", "Transportation", 0), c("r", "Rent", 3500, 3500), c("x", "Sécurité", 150),
];

describe("pickReallocationContext", () => {
  it("sends named categories, then short ones, then givers by spare money, and leaves out the rest", () => {
    const picked = pickReallocationContext("cover groceries, keep eat out", budget).map(x => x.id);
    expect(picked).toEqual(["g", "e", "s", "x"]);
  });
  it("matches names by a word and ignores accents", () => {
    expect(pickReallocationContext("take from securite", budget).map(x => x.id)[0]).toBe("x");
    expect(pickReallocationContext("pay the medical one", budget).map(x => x.id)).toContain("m");
  });
  it("caps the context and keeps room for givers", () => {
    const many = Array.from({ length: 30 }, (_, i) => c(`n${i}`, `Need${i}`, -10 - i)).concat([c("big", "Savings pot", 5000)]);
    const picked = pickReallocationContext("even things out", many, 12);
    expect(picked).toHaveLength(12);
    expect(picked.map(x => x.id)).toContain("big");
  });
});
