import { describe, expect, it } from "vitest";
import type { Category } from "../app-types";
import { allocationJarItems, budgetJarItems, spendingJarItems, topSpentJarItems } from "./budgetJar";

const cat = (id: string, icon: string | null, extra: Partial<Category> = {}): Category => ({
  id, name: id, icon, type: ["Obligations"], owner: "Anas", defaultAccount: null, available: 0, planned: null, lastMonthSpent: null, isTeamFund: false, ...extra,
});

describe("budget jar", () => {
  it("gives each category with money left one emoji, bigger for a bigger share, within legible bounds", () => {
    const items = budgetJarItems(
      [cat("rent", "🏠", { available: 3500 }), cat("food", "🍽️", { available: 900 }), cat("phone", "📱", { available: 50 })],
      "anas",
    );
    expect(items.map(i => i.glyph)).toEqual(["🏠", "🍽️", "📱"]);
    expect(items[0].radius).toBeGreaterThan(items[1].radius);
    expect(items[2].radius).toBeGreaterThanOrEqual(0.13);
    expect(items[0].radius).toBeLessThanOrEqual(0.34);
  });

  it("matches the Available number: leaves out savings, other scopes, and spent or unfunded categories", () => {
    const items = budgetJarItems(
      [
        cat("save", "🐷", { type: ["Savings"], available: 900 }),
        cat("joint", "🛒", { isTeamFund: true, owner: null, type: ["Team"], available: 400 }),
        cat("idle", "💤"),
        cat("spent", "👪", { available: 0, planned: 4050 }),
        cat("overspent", "🚗", { available: -120 }),
        cat("gadgets", "😎", { available: 790 }),
      ],
      "anas",
    );
    expect(items.map(i => i.glyph)).toEqual(["😎"]);
  });

  it("keeps an item's id when its share changes, so it resizes in place instead of leaving", () => {
    const a = budgetJarItems([cat("rent", "🏠", { available: 3500 }), cat("food", "🍽️", { available: 900 })], "anas");
    const b = budgetJarItems([cat("rent", "🏠", { available: 3500 }), cat("food", "🍽️", { available: 2500 })], "anas");
    expect(a[1].id).toBe(b[1].id);
    expect(a[1].radius).not.toBe(b[1].radius);
  });
});

describe("topSpentJarItems", () => {
  const cats = [cat("rent", "🏠", { name: "Rent" }), cat("food", "🍽️", { name: "Groceries" }), cat("moto", "🏍️", { name: "Transport" }), cat("gym", null, { name: "Gym" })];

  it("picks the three biggest spenders, biggest first, sized by their share of the pool", () => {
    const items = topSpentJarItems(
      [{ categoryId: "food", total: 900 }, { categoryId: "rent", total: 3500 }, { categoryId: "gym", total: 100 }, { categoryId: "moto", total: 700 }, { categoryId: "food", total: 100 }],
      cats, 10000,
    );
    expect(items.map(i => i.name)).toEqual(["Rent", "Groceries", "Transport"]);
    expect(items[0].radius).toBeGreaterThan(items[2].radius);
    expect(items[0].id).toBe("spent:rent");
  });

  it("stays empty without a plan or spending, and skips unknown categories", () => {
    expect(topSpentJarItems([{ categoryId: "rent", total: 10 }], cats, 0)).toEqual([]);
    expect(topSpentJarItems([{ categoryId: "ghost", total: 500 }], cats, 1000)).toEqual([]);
  });
});

describe("allocationJarItems", () => {
  const row = (categoryId: string, icon: string | null, amount: number) => ({ categoryId, icon, amount });

  it("shows only assigned categories, sized by their share of the pool", () => {
    const items = allocationJarItems([row("rent", "🏠", 3000), row("food", "🍽️", 1000), row("gym", "🏋️", 0)], 6000);
    expect(items.map(i => i.glyph)).toEqual(["🏠", "🍽️"]);
    expect(items[0].radius).toBeGreaterThan(items[1].radius);
  });

  it("grows the destination and shrinks the source when money moves, keeping ids", () => {
    const before = allocationJarItems([row("rent", "🏠", 3000), row("food", "🍽️", 1000)], 6000);
    const after = allocationJarItems([row("rent", "🏠", 2000), row("food", "🍽️", 2000)], 6000);
    expect(after.map(i => i.id).sort()).toEqual(before.map(i => i.id).sort());
    expect(after.find(i => i.id === "food")!.radius).toBeGreaterThan(before.find(i => i.id === "food")!.radius);
    expect(after.find(i => i.id === "rent")!.radius).toBeLessThan(before.find(i => i.id === "rent")!.radius);
  });

  it("is empty without a pool", () => {
    expect(allocationJarItems([row("rent", "🏠", 100)], 0)).toEqual([]);
  });
});

describe("spending jar", () => {
  it("sizes each category by its share of spending, biggest first, and caps how many it holds", () => {
    const rows = [
      { id: "food", icon: "🍽️", share: 0.2 },
      { id: "rent", icon: "🏠", share: 0.5 },
      { id: "none", icon: "💤", share: 0 },
      ...Array.from({ length: 14 }, (_, i) => ({ id: `small${i}`, icon: null, share: 0.3 / 14 })),
    ];
    const items = spendingJarItems(rows);
    expect(items[0].glyph).toBe("🏠");
    expect(items[0].radius).toBeGreaterThan(items[1].radius);
    expect(items.some(i => i.id === "none")).toBe(false);
    expect(items).toHaveLength(12);
    expect(items[items.length - 1]).toMatchObject({ glyph: "🧾", radius: 0.13 });
  });
});
