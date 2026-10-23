import { describe, expect, it } from "vitest";
import { remainingUnassignedIncome as reserve } from "./joint-income";
const first = { id: "a", amount: 500, baseline: 1000, createdAt: "2026-10-01" };
describe("unassigned joint income", () => {
  it("keeps income free despite earlier unfunded allocations", () => {
    expect(reserve([first], 1000)).toBe(500);
    expect(reserve([], 1000)).toBe(0);
  });
  it("consumes free money before additional contributions, including an edited existing plan", () => {
    expect(reserve([first], 1200)).toBe(300);
    expect(reserve([first], 1500)).toBe(0);
    expect(reserve([first], 1600)).toBe(0);
  });
  it("restores reversed assignments without inventing additional free money", () => {
    expect(reserve([first], 900)).toBe(500);
    expect(reserve([first], 1300)).toBe(200);
  });
  it("handles successive incomes, allocation changes, and unsorted input", () => {
    const second = { ...first, id: "b", amount: 200, baseline: 1400, createdAt: "2026-11-01" };
    expect(reserve([second, first], 1400)).toBe(300);
    expect(reserve([first, second], 1600)).toBe(100);
    expect(reserve([first, second], 1000)).toBe(700);
    expect(reserve([second], 1600)).toBe(0);
  });
  it("uses cents consistently", () => {
    expect(reserve([{ ...first, amount: 0.3, baseline: 0.1 }], 0.3)).toBe(0.1);
  });
});
