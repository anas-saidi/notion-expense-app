import { describe, expect, it, vi } from "vitest";
import type { Account, Category, Transaction } from "./app-types";
import { comparisonPeriods, evalExpr, expenseBalancePreview, expenseBudgetGate, fmt, getAssignBalanceByScope, getSavingsReservationByScope, getLeftToAssignByScope, withAssignable, isExpenseTransaction, isPastMonth, parseAmount, resolveTransactionScopes, scopeFromAccountLabel } from "./app-utils";

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

  it("reports a shortfall instead of clamping it to zero", () => {
    const shortAccounts: Account[] = [
      { id: "joint", label: "Joined account", icon: "", type: "Checking", balance: 695, readyToAssign: -1478 },
      { id: "anas", label: "Hubby Account", icon: "", type: "Checking", balance: 1000, readyToAssign: 500, jointDue: 800 },
      { id: "salma", label: "Wife Account", icon: "", type: "Checking", balance: 1000, readyToAssign: 1000, jointDue: 678 },
    ];
    // Anas owes 800 but only 500 is unfunded: 300 short, while the clamped figure says 0.
    expect(getLeftToAssignByScope(shortAccounts).anas).toBe(0);
    expect(getAssignBalanceByScope(shortAccounts)).toEqual({ joint: 0, anas: -300, salma: 322 });
  });

  it("keeps a partner's Joint due out of what their account can assign", () => {
    const list: Account[] = [
      { id: "joint", label: "Joined account", icon: "", type: "Checking", balance: 695, readyToAssign: -1478 },
      { id: "anas", label: "Hubby Account", icon: "", type: "Checking", balance: 1905, readyToAssign: 1305, jointDue: 900 },
      { id: "save", label: "Saving Account", icon: "", type: "Savings", balance: 5000, readyToAssign: 5000 },
    ];
    const byId = Object.fromEntries(withAssignable(list, { anas: 842 }).map(a => [a.id, a.assignable]));
    expect(byId).toEqual({ joint: -1478, anas: 463, save: 5000 });
    expect(withAssignable(list).find(a => a.id === "anas")?.assignable).toBe(405);
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


describe("savings reservations", () => {
  const banks = (personal: number, savingReady: number): Account[] => [
    { id: "anas", label: "Hubby Account", icon: "", type: "Checking", balance: personal, readyToAssign: personal, jointDue: 100 },
    { id: "save", label: "Saving Account", icon: "", type: "Savings", balance: 1000 + savingReady, readyToAssign: savingReady },
  ];
  it("reserves only savings allocations not yet covered by savings cash", () => {
    const list = banks(2000, -600);
    expect(getSavingsReservationByScope(list)).toEqual({ anas: 600, salma: 0 });
    expect(getAssignBalanceByScope(list).anas).toBe(1300);
    expect(getLeftToAssignByScope(list).anas).toBe(1300);
    expect(withAssignable(list).find(account => account.id === "anas")?.assignable).toBe(1300);
  });
  it("keeps capacity unchanged through partial and full transfers, without a second deduction", () => {
    const before = getAssignBalanceByScope(banks(2000, -600)).anas;
    expect(getAssignBalanceByScope(banks(1750, -350)).anas).toBe(before);
    expect(getAssignBalanceByScope(banks(1400, 0)).anas).toBe(before);
  });
  it("does not release extra personal capacity when savings has a surplus", () => {
    expect(getAssignBalanceByScope(banks(2000, 500)).anas).toBe(1900);
  });
  it("preserves a savings shortfall rather than allowing it to disappear", () => {
    const list = banks(200, -600);
    expect(getAssignBalanceByScope(list).anas).toBe(-500);
    expect(getLeftToAssignByScope(list).anas).toBe(0);
    expect(withAssignable(list).find(account => account.id === "anas")?.assignable).toBe(-500);
  });
  it("uses Salma's explicit savings ownership ahead of the generic saving-account fallback", () => {
    const list: Account[] = [{ id: "wife-save", label: "Wife Saving Account", icon: "", type: "Savings", balance: 0, readyToAssign: -250.75 }];
    expect(getSavingsReservationByScope(list)).toEqual({ anas: 0, salma: 250.75 });
    expect(scopeFromAccountLabel("Wife Saving Account")).toBe("salma");
  });
  it("reserves a deficit once across multiple personal accounts", () => {
    const list = [...banks(200, -600), { id: "anas2", label: "Hubby second", icon: "", type: "Checking", balance: 1000, readyToAssign: 1000, jointDue: 0 }];
    const personal = withAssignable(list).filter(account => account.id !== "save");
    expect(personal.reduce((total, account) => total + (account.assignable ?? 0), 0)).toBe(500);
    expect(getAssignBalanceByScope(list).anas).toBe(500);
  });
});
