import { describe, expect, it } from "vitest";
import { getCategoryAllocatedByScope, getCategoryAvailableByScope, scopeMonthlySummary } from "./wallet-utils";
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
  });
  it("preserves negative balances, excludes savings from spending cash, and separates personal scope", () => {
    expect(getCategoryAvailableByScope([category("over", -50), category("unknown", null), category("savings", 900, { type: ["Savings"], isTeamFund: false, owner: "Anas" }), category("personal", 200, { isTeamFund: false, type: [], owner: "Anas" })])).toEqual({ joint: -50, anas: 200, salma: 0 });
  });
});

it("includes a mid-month category funded by rebalancing using its default account", () => {
  const categories = [category("Car Expenses", 150, { isTeamFund: false, type: ["Obligations"], defaultAccount: "joint" })];
  expect(getCategoryAvailableByScope(categories, accounts).joint).toBe(150);
  const summary: MonthlySummary = { start: "2026-09-01", end: "2026-09-30", totalAssigned: 0, totalSpent: 5750, assignedByCategory: [], spentByCategory: [{ categoryId: "Car Expenses", total: 5750 }] };
  expect(scopeMonthlySummary(summary, categories, accounts, "joint").totalSpent).toBe(5750);
  expect(scopeMonthlySummary(summary, categories, accounts, "anas").totalSpent).toBe(0);
});


it("counts savings assignments in their owner's monthly allocation total", () => {
  const catalog = [
    category("anas-savings", 900, { type: ["Savings"], isTeamFund: false, owner: "Anas" }),
    category("salma-savings", 300, { type: ["Savings"], isTeamFund: false, owner: "Salma" }),
    category("personal", 200, { type: ["Budget"], isTeamFund: false, owner: "Anas" }),
  ];
  const bankAccounts = [...accounts, { id: "savings", label: "Saving Account", icon: "", type: "Savings", balance: 1200, readyToAssign: 0 }];
  const summary: MonthlySummary = {
    start: "2026-10-01", end: "2026-10-31", totalAssigned: 1400, totalSpent: 0,
    assignedByCategory: [
      { categoryId: "anas-savings", accountId: "savings", total: 900 },
      { categoryId: "salma-savings", accountId: "savings", total: 300 },
      { categoryId: "personal", accountId: "anas", total: 200 },
    ], spentByCategory: [],
  };
  expect(scopeMonthlySummary(summary, catalog, bankAccounts, "anas").totalAssigned).toBe(1100);
  expect(scopeMonthlySummary(summary, catalog, bankAccounts, "salma").totalAssigned).toBe(300);
  expect(scopeMonthlySummary(summary, catalog, bankAccounts, "joint").totalAssigned).toBe(0);
});

it("includes owned savings in allocated totals without making them spending cash", () => {
  const catalog = [
    category("food", -50),
    category("personal", 200, { isTeamFund: false, owner: "Anas" }),
    category("savings", 900, { type: ["Savings"], isTeamFund: false, owner: "Anas" }),
  ];
  expect(getCategoryAllocatedByScope(catalog, accounts)).toEqual({ joint: -50, anas: 1100, salma: 0 });
  expect(getCategoryAvailableByScope(catalog, accounts)).toEqual({ joint: -50, anas: 200, salma: 0 });
});
