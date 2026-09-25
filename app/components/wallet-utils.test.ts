import { describe, expect, it } from "vitest";
import { cashBackingGap, getCategoryAvailableByScope, scopeMonthlySummary } from "./wallet-utils";
import type { Account, Category, MonthlySummary } from "./app-types";
const category = (id: string, available: number | null, extra = {}): Category => ({ id, name: id, available, icon: null, type: ["Team"], owner: null, defaultAccount: null, planned: null, lastMonthSpent: null, isTeamFund: true, ...extra });
const accounts: Account[] = [{ id: "joint", label: "Joined Account", icon: "", type: null, balance: 1304, readyToAssign: 0 }, { id: "anas", label: "Hubby Account", icon: "", type: null, balance: 0, readyToAssign: 0 }];
describe("Home wallet semantics", () => {
  it("keeps historical monthly activity distinct from current allocations and cash", () => {
    const categories = [category("food", 4000), category("bills", -195.5)];
    const summary: MonthlySummary = { start: "2026-09-01", end: "2026-09-30", totalAssigned: 19291, totalSpent: 11604, assignedByCategory: [{ categoryId: "food", accountId: "joint", total: 19291 }], spentByCategory: [{ categoryId: "food", accountId: "anas", total: 11604 }] };
    const monthly = scopeMonthlySummary(summary, categories, accounts, "joint");
    expect(monthly.totalAssigned - monthly.totalSpent).toBe(7687);
    expect(monthly.totalSpent).toBe(11604); // Personal payer still counts in joint categories.
    const available = getCategoryAvailableByScope(categories).joint;
    expect(available).toBe(3804.5);
    expect(cashBackingGap(available, 1304)).toBe(2500.5);
    expect(cashBackingGap(available, 1304 + 1656)).toBe(844.5);
  });
  it("preserves negative balances, excludes savings, and separates personal scope", () => {
    expect(getCategoryAvailableByScope([category("over", -50), category("unknown", null), category("savings", 900, { type: ["Savings"] }), category("personal", 200, { isTeamFund: false, type: [], owner: "Anas" })])).toEqual({ joint: -50, anas: 200, salma: 0 });
  });
  it("does not invent a gap from missing data or surplus cash", () => {
    expect(cashBackingGap(null, 1304)).toBeNull();
    expect(cashBackingGap(3804.5, null)).toBeNull();
    expect(cashBackingGap(100, 200)).toBe(0);
    expect(cashBackingGap(-50, 0)).toBe(0);
    expect(cashBackingGap(100, -50)).toBe(150);
  });
});

it("includes a mid-month category funded by rebalancing using its default account", () => {
  const categories = [category("Car Expenses", 150, { isTeamFund: false, type: ["Obligations"], defaultAccount: "joint" })];
  expect(getCategoryAvailableByScope(categories, accounts).joint).toBe(150);
  const summary: MonthlySummary = { start: "2026-09-01", end: "2026-09-30", totalAssigned: 0, totalSpent: 5750, assignedByCategory: [], spentByCategory: [{ categoryId: "Car Expenses", total: 5750 }] };
  expect(scopeMonthlySummary(summary, categories, accounts, "joint").totalSpent).toBe(5750);
  expect(scopeMonthlySummary(summary, categories, accounts, "anas").totalSpent).toBe(0);
});
