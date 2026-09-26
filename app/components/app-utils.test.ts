import { describe, expect, it, vi } from "vitest";
import type { Account, Category, Transaction } from "./app-types";
import { comparisonPeriods, evalExpr, expenseBalancePreview, expenseBudgetGate, fmt, getLeftToAssignByScope, isExpenseTransaction, isPastMonth, parseAmount, resolveTransactionScopes, scopeFromAccountLabel } from "./app-utils";

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
  it("treats the current generic saving account as Anas personal", () => {
    expect(scopeFromAccountLabel("Saving Account")).toBe("anas");
  });

  it("uses live contribution remaining instead of the stored joint due when provided", () => {
    const scopedAccounts: Account[] = [
      { id: "anas", label: "Hubby Account", icon: "", type: "Checking", balance: 12334, readyToAssign: 12334, jointDue: 12068 },
      { id: "salma", label: "Wife Account", icon: "", type: "Checking", balance: 1000, readyToAssign: 1000, jointDue: 0 },
    ];
    expect(getLeftToAssignByScope(scopedAccounts).anas).toBe(266);
    expect(getLeftToAssignByScope(scopedAccounts, { anas: 11072 }).anas).toBe(1262);
  });

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

describe("amount parsing", () => {
  it.each([
    ["50", 50],
    ["12.50", 12.5],
    ["12,50", 12.5],
    ["1500,50", 1500.5],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["50+30", 80],
    ["2+3*4", 14],
    ["-50", -50],
    ["-5+3", -2],
    ["2*-3", -6],
    ["100/4", 25],
    ["0.1+0.2", 0.3],
    [" 1 000 ", 1000],
    ["0-0", 0],
  ])("parses %s as %s", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(["", "abc", "50x", "5*", "5-", "100/0+20", "(2+3)*4", "1e3", "12.5.3", "5..5", "1,2,3", "12.34,5.6"])(
    "rejects %j",
    (input) => {
      expect(parseAmount(input)).toBeNull();
      expect(evalExpr(input)).toBe(0);
    },
  );
});

describe("expense budget gate", () => {
  it.each([
    ["within budget", { available: 100, amount: 60 }, { unfunded: false, overBudget: false, shortfall: 0 }],
    ["exactly the budget", { available: 100, amount: 100 }, { unfunded: false, overBudget: false, shortfall: 0 }],
    ["over budget", { available: 50, amount: 60 }, { unfunded: false, overBudget: true, shortfall: 10 }],
    ["no budget", { available: 0, amount: 60 }, { unfunded: true, overBudget: false, shortfall: 60 }],
    ["already overspent", { available: -200, amount: 500 }, { unfunded: true, overBudget: false, shortfall: 500 }],
    ["float dust on zero", { available: 1e-13, amount: 5 }, { unfunded: true, overBudget: false, shortfall: 5 }],
    ["unknown available", { available: null, amount: 60 }, { unfunded: false, overBudget: false, shortfall: 0 }],
    ["edit with unchanged amount in overspent category", { available: -50, amount: 100, originalAmount: 100 }, { unfunded: false, overBudget: false, shortfall: 0 }],
    ["edit lowering the amount", { available: -50, amount: 80, originalAmount: 100 }, { unfunded: false, overBudget: false, shortfall: 0 }],
    ["edit raising the amount within budget", { available: 30, amount: 120, originalAmount: 100 }, { unfunded: false, overBudget: false, shortfall: 0 }],
    ["edit raising the amount past budget", { available: 30, amount: 150, originalAmount: 100 }, { unfunded: false, overBudget: true, shortfall: 20 }],
  ] as const)("%s", (_label, input, expected) => {
    expect(expenseBudgetGate(input)).toEqual(expected);
  });
});

describe("isPastMonth", () => {
  it("compares against the local current month, including across a year boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 0, 30)); // 1 Jan 2026, 00:30 local
    try {
      expect(isPastMonth("2025-12")).toBe(true);
      expect(isPastMonth("2026-01")).toBe(false);
      expect(isPastMonth("2026-02")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
