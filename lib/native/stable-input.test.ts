import { expect, it } from "vitest";
import { stableInput } from "./stable-input";
it("gives restored financial requests the same identity despite JSON property order", () => {
  const first = { month: "2026-10", budgetItems: [{ categoryId: "food", amount: 125, defaultAccount: "joint" }] };
  const restored = { budgetItems: [{ defaultAccount: "joint", amount: 125, categoryId: "food" }], month: "2026-10" };
  expect(JSON.stringify(stableInput(first))).toBe(JSON.stringify(stableInput(restored)));
});
it("preserves allocation order, amounts, nulls, and empty values", () => {
  const value = { allocations: [{ id: "b", amount: 0 }, { id: "a", amount: 25 }], account: null, name: "" };
  expect(stableInput(value)).toEqual(value);
  expect(stableInput(value)).not.toEqual({ ...value, allocations: [...value.allocations].reverse() });
});
