import { expect, it } from "vitest";
import { readAccountBalance } from "./savings-funding";

it("reads current cash when an earlier Balance property is a relation", () => {
  expect(readAccountBalance({ Balance: { type: "relation", relation: [{ id: "opening-balance" }] }, "Current Balance": { formula: { number: 3047 } } })).toBe(3047);
});
it("prefers current balance over other numeric aliases and preserves zero", () => {
  expect(readAccountBalance({ Balance: { number: 6000 }, "Current Balance": { formula: { number: 0 } } })).toBe(0);
});
it("supports numeric and rollup aliases while failing closed on unknown balances", () => {
  expect(readAccountBalance({ "Ledger Balance": { rollup: { number: 3047 } } })).toBe(3047);
  expect(readAccountBalance({ balance: { number: 3047 } })).toBe(3047);
  expect(readAccountBalance({ Balance: { relation: [] }, "Current Balance": { formula: { number: null } } })).toBeUndefined();
});
