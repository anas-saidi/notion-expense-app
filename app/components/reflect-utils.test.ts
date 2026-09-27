import { describe, expect, it } from "vitest";
import type { Account, Category, Transaction } from "./app-types";
import { buildSpendingBreakdown, reflectMonthCount, reflectPreset, UNCATEGORIZED, UNKNOWN_ACCOUNT } from "./reflect-utils";
const accounts: Account[] = [{ id: "joint", label: "Joined Account", icon: "", type: null, balance: 0, readyToAssign: 0 }, { id: "anas", label: "Anas", icon: "", type: null, balance: 0, readyToAssign: 0 }];
const category = (id: string): Category => ({ id, name: id, icon: null, type: ["Household"], owner: null, defaultAccount: "joint", available: null, planned: null, lastMonthSpent: null, isTeamFund: true });
const categories = [category("food"), category("rent"), category("travel")];
const transaction = (id: string, amount: number, overrides: Partial<Transaction> = {}): Transaction => ({ id, name: id, amount, category: "food", accountId: "joint", type: "Expense", date: "2026-09-10", ...overrides });
const breakdown = (transactions: Transaction[], excludedCategories: string[] = [], excludedAccounts: string[] = []) => buildSpendingBreakdown(transactions, categories, accounts, "joint", excludedCategories, excludedAccounts);

describe("Reflect spending breakdown", () => {
  it("ranks categories by net spending with shares summing to one", () => {
    const result = breakdown([transaction("lunch", 25), transaction("dinner", 75), transaction("rent", 300, { category: "rent" })]);
    expect(result.total).toBe(400);
    expect(result.spending.map(row => [row.id, row.net, row.share])).toEqual([["rent", 300, .75], ["food", 100, .25]]);
    expect(result.transactionCount).toBe(3);
  });
  it("excludes transfers and uncategorized income", () => {
    expect(breakdown([transaction("transfer", 1000, { type: "Transfer" }), transaction("salary", 2000, { type: "Income", category: null }), transaction("pizza", 20)]).total).toBe(20);
  });
  it("offsets same-category inflows and separates positive-inflow categories", () => {
    const result = breakdown([transaction("food", 100), transaction("food refund", 30, { type: "Income" }), transaction("travel", 50, { category: "travel" }), transaction("reimbursement", 80, { type: "Income", category: "travel" })]);
    expect(result.total).toBe(70);
    expect(result.spending[0].share).toBe(1);
    expect(result.inflows[0].net).toBe(-30);
    expect(result.inflows[0].transactions).toHaveLength(2);
  });
  it("treats negative expenses as inflows and keeps fully offset categories inspectable", () => {
    const result = breakdown([transaction("food", 20), transaction("refund", -20)]);
    expect(result.total).toBe(0);
    expect(result.settled[0].net).toBe(0);
    expect(result.spending).toHaveLength(0);
  });
  it("filters before calculating percentages and keeps no-selection distinct from all", () => {
    const transactions = [transaction("food", 40), transaction("rent", 60, { category: "rent" })];
    expect(breakdown(transactions, ["rent"]).spending[0].share).toBe(1);
    expect(breakdown(transactions, ["rent", "food"]).total).toBe(0);
    expect(breakdown(transactions, [], ["joint"]).transactionCount).toBe(0);
  });
  it("keeps missing and archived categories discoverable without inventing labels", () => {
    const result = breakdown([transaction("legacy", 10, { category: null }), transaction("old", 20, { category: "deleted" })]);
    expect(result.spending.map(row => row.name)).toEqual(["Archived category", "Uncategorized"]);
    expect(breakdown([transaction("legacy", 10, { category: null })], [UNCATEGORIZED]).total).toBe(0);
  });
  it("supports legacy expenses and missing accounts while respecting scope", () => {
    expect(breakdown([transaction("legacy", 20, { type: null, accountId: null })]).total).toBe(20);
    expect(breakdown([transaction("legacy", 20, { type: null, accountId: null })], [], [UNKNOWN_ACCOUNT]).total).toBe(0);
    expect(breakdown([transaction("personal", 20, { category: null, accountId: "anas" })]).total).toBe(0);
  });
  it("uses integer cents, ignores invalid values, and does not mutate source transactions", () => {
    const input = [transaction("a", .1), transaction("b", .2), transaction("bad", NaN)];
    expect(breakdown(input).total).toBe(.3);
    expect(input.map(item => item.id)).toEqual(["a", "b", "bad"]);
  });
});
describe("Reflect periods", () => {
  const now = new Date(2026, 0, 15);
  it("crosses year boundaries for rolling presets", () => {
    expect(reflectPreset("3", now)).toEqual({ start: "2025-11", end: "2026-01" });
    expect(reflectPreset("last-month", now)).toEqual({ start: "2025-12", end: "2025-12" });
    expect(reflectPreset("last-year", now)).toEqual({ start: "2025-01", end: "2025-12" });
    expect(reflectPreset("all", now)).toEqual({ start: "", end: "" });
  });
  it("counts inclusive months including empty months in the requested range", () => {
    expect(reflectMonthCount({ start: "2025-11", end: "2026-01" }, [], now)).toBe(3);
    expect(reflectMonthCount({ start: "2026-01", end: "2026-01" }, [], now)).toBe(1);
  });
  it("uses the first recorded month through now for all-time averages", () => {
    expect(reflectMonthCount({ start: "", end: "" }, [transaction("old", 10, { date: "2025-11-02" })], now)).toBe(3);
  });
});
