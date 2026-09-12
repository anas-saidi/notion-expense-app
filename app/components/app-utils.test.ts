import { describe, expect, it } from "vitest";
import type { Account, Category, Transaction } from "./app-types";
import { comparisonPeriods, expenseBalancePreview, fmt, isExpenseTransaction, resolveTransactionScopes } from "./app-utils";

const accounts: Account[] = [
  { id: "joint", label: "Joined account", icon: "", type: null, balance: 900, readyToAssign: 0 },
  { id: "anas", label: "Hubby current", icon: "", type: null, balance: 500, readyToAssign: 0 },
  { id: "salma", label: "Wife current", icon: "", type: null, balance: 400, readyToAssign: 0 },
];
const categories: Category[] = [
  { id: "food", name: "Food", icon: null, type: ["Team"], owner: null, defaultAccount: "joint", available: 10, planned: 100, lastMonthSpent: 0, isTeamFund: true },
  { id: "personal", name: "Personal", icon: null, type: ["Budget"], owner: "Anas", defaultAccount: "anas", available: 10, planned: 100, lastMonthSpent: 0, isTeamFund: false },
];

describe("transaction scope", () => {
  it("uses category ownership first for expenses and includes uncategorized account expenses", () => {
    expect(resolveTransactionScopes({ id: "1", name: "x", amount: 1, date: "", category: "food", accountId: "anas", type: "Expense" }, categories, accounts)).toEqual(["joint"]);
    expect(resolveTransactionScopes({ id: "2", name: "x", amount: 1, date: "", category: null, accountId: "salma", type: "Expense" }, categories, accounts)).toEqual(["salma"]);
  });

  it("includes cross-scope transfers once in each endpoint scope and leaves unknown ownership unassigned", () => {
    const transfer: Transaction = { id: "3", name: "move", amount: 10, date: "", category: null, accountId: null, type: "Transfer", fromAccountId: "anas", toAccountId: "joint" };
    expect(resolveTransactionScopes(transfer, categories, accounts)).toEqual(["anas", "joint"]);
    expect(resolveTransactionScopes({ id: "4", name: "?", amount: 1, date: "", category: null, accountId: null, type: "Expense" }, categories, accounts)).toEqual([]);
  });

  it("keeps legacy missing-type records expense-compatible without treating transfers as expenses", () => {
    expect(isExpenseTransaction({ id: "1", name: "", amount: 1, date: "", category: null, accountId: null })).toBe(true);
    expect(isExpenseTransaction({ id: "2", name: "", amount: 1, date: "", category: null, accountId: null, type: "Transfer" })).toBe(false);
  });
});

describe("money and time calculations", () => {
  it("restores the booked expense before applying a same-account edit", () => {
    expect(expenseBalancePreview({ currentAccountId: "joint", currentBalance: 900, originalAccountId: "joint", originalAmount: 100, editedAmount: 120 })).toBe(880);
    expect(expenseBalancePreview({ currentAccountId: "anas", currentBalance: 500, originalAccountId: "joint", originalAmount: 100, editedAmount: 120 })).toBe(380);
  });

  it("uses equal current-month periods and caps shorter previous months", () => {
    expect(comparisonPeriods("2026-09", new Date(2026, 8, 5))).toEqual({ current: { start: "2026-09-01", end: "2026-09-05" }, previous: { start: "2026-08-01", end: "2026-08-05" } });
    expect(comparisonPeriods("2024-03", new Date(2024, 2, 31)).previous.end).toBe("2024-02-29");
    expect(comparisonPeriods("2025-03", new Date(2025, 2, 31)).previous.end).toBe("2025-02-28");
    expect(comparisonPeriods("2026-12", new Date(2027, 0, 2)).current.end).toBe("2026-12-31");
  });

  it("preserves cents while omitting unnecessary decimals", () => {
    expect(fmt(12)).not.toMatch(/[,.]00$/);
    expect(fmt(12.5)).toMatch(/12[,.]50/);
  });
});
