import { describe, expect, it } from "vitest";
import type { Category, Transaction } from "./app-types";
import { runningLowCategories, runwayLabel, runwayWindow } from "./category-runway";

const category: Category = { id: "food", name: "Groceries", icon: null, type: ["Obligations"], spendingPattern: "Everyday", owner: null, defaultAccount: null, available: 236.55, planned: 3000, lastMonthSpent: null, isTeamFund: true };
const expense = (date: string, amount = 100, extra: Partial<Transaction> = {}): Transaction => ({ id: date, name: "Food", date, amount, category: "food", accountId: null, type: "Expense", ...extra });
const recurring = [expense("2026-10-01", 1200), expense("2026-10-09", 1200), expense("2026-10-19", 1239.45)];

describe("running-low estimates", () => {
  it("flags groceries before funds run out, using current Available after rebalancing", () => {
    const [risk] = runningLowCategories([category], recurring, "2026-10-19");
    expect(risk.daysCovered).toBeCloseTo(1.82, 2);
    expect(risk.suggestedTopUp).toBe(1324);
    expect(runningLowCategories([{ ...category, available: 2500 }], recurring, "2026-10-19")).toEqual([]);
  });

  it("does not extrapolate paid rent or several purchases on one day", () => {
    expect(runningLowCategories([{ ...category, available: 0 }], [expense("2026-10-01", 3500)], "2026-10-19")).toEqual([]);
    expect(runningLowCategories([category], [expense("2026-10-19"), expense("2026-10-19"), expense("2026-10-19")], "2026-10-19")).toEqual([]);
  });

  it("ignores transfers, future dates and other months; refunds reduce the estimate", () => {
    const baseline = runningLowCategories([category], recurring, "2026-10-19")[0];
    const extras = [expense("2026-10-18", 9999, { type: "Transfer" }), expense("2026-10-20", 9999), expense("2026-09-20", 9999)];
    expect(runningLowCategories([category], [...recurring, ...extras], "2026-10-19")[0]).toEqual(baseline);
    expect(runningLowCategories([category], [...recurring, expense("2026-10-19", 3000, { type: "Income" })], "2026-10-19")).toEqual([]);
  });

  it("excludes savings, inactive categories and unknown balances", () => {
    for (const patch of [{ type: ["Saving"] }, { snoozed: true }, { archived: true }, { available: null }, { available: -1 }]) {
      expect(runningLowCategories([{ ...category, ...patch }], recurring, "2026-10-19")).toEqual([]);
    }
  });

  it("requires a week of repeated use and recent spending", () => {
    expect(runningLowCategories([category], [expense("2026-10-15"), expense("2026-10-17"), expense("2026-10-19")], "2026-10-19")).toEqual([]);
    expect(runningLowCategories([category], recurring.slice(0, 2).concat(expense("2026-10-12")), "2026-10-19")).toEqual([]);
    expect(runningLowCategories([category], recurring, "2026-11-19")).toEqual([]);
    expect(runningLowCategories([category], recurring, "2026-10-05")).toEqual([]);
    expect(runningLowCategories([category], recurring.concat(expense("2026-10-29")), "2026-10-29")).toEqual([]);
  });

  it("uses only explicit Everyday choices, with no inference for unset categories", () => {
    for (const spendingPattern of [null, undefined, "Scheduled", "Flexible", "Goal"] as const) {
      expect(runningLowCategories([{ ...category, spendingPattern }], recurring, "2026-10-19")).toEqual([]);
    }
  });

  it("uses history across month boundaries, including on the first day", () => {
    expect(runwayWindow("2026-10-01")).toEqual({ start: "2026-09-04", end: "2026-10-01" });
    const history = [expense("2026-09-05", 1000), expense("2026-09-20", 1000), expense("2026-09-29", 1000)];
    expect(runningLowCategories([category], history, "2026-10-01")[0].daysCovered).toBeCloseTo(236.55 / (3000 / 28));
    expect(runningLowCategories([category], history.concat(expense("2026-09-03", 9999)), "2026-10-01")[0].dailySpend).toBeCloseTo(3000 / 28);
  });

  it("still warns when an everyday category is empty and orders the shortest runway first", () => {
    const other = { ...category, id: "rides", available: 0 };
    const risks = runningLowCategories([category, other], [...recurring, ...recurring.map(txn => ({ ...txn, category: "rides" }))], "2026-10-19");
    expect(risks.map(risk => risk.category.id)).toEqual(["rides", "food"]);
    expect(runwayLabel(risks[0].daysCovered)).toBe("Less than a day left");
    expect(runwayLabel(risks[1].daysCovered)).toBe("About 2 days left");
  });
});
