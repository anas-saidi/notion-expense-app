import { it as test } from "vitest";
import assert from "node:assert/strict";
import { getPlanningMonth } from "./planning-month";

test("October remains the planning target when rollover arrives before any allocations", () => {
  assert.equal(getPlanningMonth("2026-10", []), "2026-10");
});
test("a funded current month advances to next month, including year rollover", () => {
  const funds = [{ categoryId: "food", planned: 500 }];
  assert.equal(getPlanningMonth("2026-10", funds), "2026-11");
  assert.equal(getPlanningMonth("2026-12", funds), "2027-01");
});
test("zero allocations and returns do not count as a plan", () => {
  assert.equal(getPlanningMonth("2026-10", [
    { categoryId: "food", planned: 0 },
    { categoryId: "bills", planned: 100, reverse: true },
  ]), "2026-10");
});
