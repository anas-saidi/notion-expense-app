import { describe, expect, it } from "vitest";
import { budgetStatus, budgetStatusRank, monthProgress, pace } from "./category-status";

describe("budgetStatus", () => {
  it("is good with plenty left", () => {
    expect(budgetStatus({ available: 3100, spent: 1400, planned: 4500 })).toMatchObject({ state: "normal", low: false, amount: 3100 });
  });

  it("is spending fast only with little left and behind the calendar", () => {
    // 15% left on the 10th: well behind the month.
    expect(budgetStatus({ available: 90, spent: 510, planned: 600, progress: 0.3 })).toMatchObject({ state: "normal", low: true });
    // 15% left on the 28th: that's just the month running out, on pace.
    expect(budgetStatus({ available: 90, spent: 510, planned: 600, progress: 0.9 }).low).toBe(false);
    // 40% left early on is a lot left, never low.
    expect(budgetStatus({ available: 400, spent: 600, planned: 1000, progress: 0.1 }).low).toBe(false);
  });

  it("paces a pot of money against the month", () => {
    expect(pace(-0.1, 0.5)).toBe("over");
    expect(pace(0.1, 0.2)).toBe("low");
    expect(pace(0.1, 0.95)).toBe("good");
    expect(pace(0.5, 0.5)).toBe("good");
  });

  it("measures how far through a month a date is", () => {
    expect(monthProgress("2026-09", new Date(2026, 8, 16))).toBeCloseTo(0.5, 1);
    expect(monthProgress("2026-08", new Date(2026, 8, 16))).toBe(1);
    expect(monthProgress("2026-10", new Date(2026, 8, 16))).toBe(0);
  });

  it("is over below zero", () => {
    expect(budgetStatus({ available: -130, spent: 1930, planned: 1800 })).toMatchObject({ state: "over", amount: -130 });
  });

  it("is empty when spent to exactly zero, unfunded when it never had money", () => {
    expect(budgetStatus({ available: 0, spent: 100, planned: 100 }).state).toBe("empty");
    expect(budgetStatus({ available: 0, spent: 0, planned: 0 }).state).toBe("unfunded");
  });

  it("uses what was left of the plan for a past month", () => {
    expect(budgetStatus({ available: 0, spent: 300, planned: 1000, past: true })).toMatchObject({ state: "normal", amount: 700 });
    expect(budgetStatus({ available: 0, spent: 1200, planned: 1000, past: true }).state).toBe("over");
  });

  it("ranks what needs attention first", () => {
    const rank = (a: number, s: number) => budgetStatusRank(budgetStatus({ available: a, spent: s, planned: 0, progress: 0.5 }));
    expect([rank(-1, 10), rank(5, 95), rank(500, 10), rank(0, 10), rank(0, 0)]).toEqual([0, 1, 2, 3, 4]);
  });
});
