import { describe, expect, it } from "vitest";
import { calculateContributionStatus } from "./contribution-utils";
import type { Account, Category, MonthlySummary, Transaction } from "./app-types";

const accounts: Account[] = [
  { id: "anas", label: "Hubby Account", icon: "", type: "Checking", balance: 0, readyToAssign: 0, contributionPercent: 0.65 },
  { id: "joint", label: "Joined Account", icon: "", type: "Joined", balance: 2000, readyToAssign: 0 },
  { id: "salma", label: "Wife Account", icon: "", type: "Checking", balance: 0, readyToAssign: 0, contributionPercent: 0.35 },
];
const categories: Category[] = [
  { id: "household", name: "Household", icon: null, type: [], owner: null, defaultAccount: "joint", available: 0, planned: 0, lastMonthSpent: null, isTeamFund: true },
];
const monthlySummary: MonthlySummary = {
  start: "2026-09-01", end: "2026-09-30", totalAssigned: 19291, totalSpent: 0,
  assignedByCategory: [{ categoryId: "household", accountId: "joint", total: 19291 }], spentByCategory: [],
};
const transactions: Transaction[] = [
  { id: "a", name: "Anas transfer", amount: 2000, date: "2026-09-17", category: null, accountId: null, type: "Transfer", fromAccountId: "anas", toAccountId: "joint" },
  { id: "s", name: "Salma transfer", amount: 3465, date: "2026-09-02", category: null, accountId: null, type: "Transfer", fromAccountId: "salma", toAccountId: "joint" },
  { id: "j", name: "Joint spending", amount: 5722, date: "2026-09-10", category: "household", accountId: "joint", type: "Expense" },
  { id: "ad", name: "Anas direct", amount: 295, date: "2026-09-10", category: "household", accountId: "anas", type: "Expense" },
  { id: "sd", name: "Salma direct", amount: 3529, date: "2026-09-10", category: "household", accountId: "salma", type: "Expense" },
];

const calculate = (cash = 1194, available = 3844.5, activity: Transaction[] = [
  { ...transactions[0], amount: 4500 },
  transactions[1],
  { ...transactions[3], amount: 4934 },
  transactions[4],
]) => calculateContributionStatus({
  accounts: accounts.map(a => a.id === "joint" ? { ...a, balance: cash } : a),
  categories: [{ ...categories[0], available }], transactions: activity, monthlySummary,
})!;
const due = (result: NonNullable<ReturnType<typeof calculateContributionStatus>>) => [result.anasPlan - result.anasActual, result.salmaPlan - result.salmaActual];

describe("reconciled contributions", () => {
  it("includes carry-over and credits personal joint spending", () => {
    const result = calculate();
    expect(result.fundingGap).toBe(2650.5);
    expect(result.anasActual).toBe(9434);
    expect(result.salmaActual).toBe(6994);
    expect(due(result)[0]).toBeCloseTo(2650.5);
    expect(due(result)[1]).toBeCloseTo(0);
  });
  it("closes the shortfall exactly after both displayed contributions arrive", () => {
    const before = calculate();
    const [anasDue, salmaDue] = due(before);
    const original: Transaction[] = [ { ...transactions[0], amount: 4500 }, transactions[1], { ...transactions[3], amount: 4934 }, transactions[4] ];
    const after = calculate(1194 + anasDue + salmaDue, 3844.5, [...original,
      { ...transactions[0], id: "pay-a", amount: anasDue },
      { ...transactions[1], id: "pay-s", amount: salmaDue },
    ]);
    expect(after.fundingGap).toBe(0);
    expect(due(after)).toEqual([0, 0]);
  });
  it("reduces dues by a partial transfer without moving the target", () => {
    const activity = [{ ...transactions[0], amount: 500 }];
    const before = calculate(0, 1000, []);
    const after = calculate(500, 1000, activity);
    expect(due(before)).toEqual([650, 350]);
    expect(due(after)).toEqual([150, 350]);
  });
  it("keeps dues unchanged when joint spending reduces cash and availability together", () => {
    expect(due(calculate(1094, 3744.5))).toEqual(due(calculate()));
  });
  it("credits direct personal spending while reducing the remaining allocation", () => {
    const after = calculate(0, 900, [{ ...transactions[3], amount: 100 }]);
    expect(due(after)).toEqual([550, 350]);
  });
  it("does not demand overfunding when one partner is ahead", () => {
    const result = calculate(0, 100, [{ ...transactions[1], amount: 1000 }]);
    expect(due(result)).toEqual([100, 0]);
  });
  it("supports carry-over without new monthly assignments", () => {
    const result = calculateContributionStatus({ accounts, categories: [{ ...categories[0], available: 3000 }], transactions: [], monthlySummary: { ...monthlySummary, assignedByCategory: [], totalAssigned: 0 } })!;
    expect(due(result)).toEqual([650, 350]);
  });
  it("rounds once to cents, keeps dues nonnegative, and never exceeds the gap", () => {
    for (const available of [0, 0.01, 0.03, 1.01, 3844.5]) {
      const result = calculate(0, available, []);
      const [a, s] = due(result);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(Math.round((a + s) * 100)).toBe(Math.round(available * 100));
    }
    expect(due(calculate(4000))).toEqual([0, 0]);
  });
  it("subtracts refunds from transfer credit", () => {
    const result = calculate(0, 100, [{ ...transactions[0], amount: 500 }, { ...transactions[0], id: "refund", amount: 100, fromAccountId: "joint", toAccountId: "anas" }]);
    expect(result.anasTransferred).toBe(400);
    expect(due(result)).toEqual([0, 100]);
  });
  it("does not invent obligations when balances or split settings are missing", () => {
    expect(calculateContributionStatus({ accounts: accounts.map(a => a.id === "joint" ? { ...a, balance: null } : a), categories, transactions, monthlySummary })).toBeNull();
    expect(calculateContributionStatus({ accounts: accounts.map(a => a.id === "anas" ? { ...a, contributionPercent: null } : a), categories, transactions, monthlySummary })).toBeNull();
  });
});

it("keeps dues unchanged for free income and for the later allocation it funds", () => {
  const calculateFree = (cash: number, available: number, free: number) => calculateContributionStatus({
    accounts: accounts.map(a => a.id === "joint" ? { ...a, balance: cash, unassignedIncome: free } : a),
    categories: [{ ...categories[0], available }], transactions: [], monthlySummary,
  })!;
  expect(due(calculateFree(0, 1000, 0))).toEqual([650, 350]);
  expect(due(calculateFree(500, 1000, 500))).toEqual([650, 350]);
  expect(due(calculateFree(500, 1200, 300))).toEqual([650, 350]);
  expect(due(calculateFree(500, 1600, 0))).toEqual([715, 385]);
  expect(due(calculateFree(500, 1000, 0))).toEqual([325, 175]);
  expect(due(calculateFree(1500, 1000, 500))).toEqual([0, 0]);
});

describe("savings deposits and purchases", () => {
  const savings = { ...categories[0], id: "bedroom", name: "Bedroom", type: ["Saving"], available: 0, owner: "Salma", isTeamFund: false };
  const savingsCalc = (cash: number, remaining: number, activity: Transaction[] = [], extraAccounts: Account[] = []) => calculateContributionStatus({
    accounts: [...accounts.map(account => account.id === "joint" ? { ...account, balance: cash } : account), ...extraAccounts],
    categories: [{ ...categories[0], available: 1000 }, { ...savings, available: remaining }],
    transactions: activity, monthlySummary,
  })!;
  const deposit = (id: string, from: string, amount: number, target: "separate" | "shared"): Transaction => ({
    id, name: "To Bedroom", amount, date: "2026-10-18", category: "bedroom", accountId: null, type: "Transfer", fromAccountId: from, toAccountId: "joint", savingsFundingTarget: target,
  });
  it("keeps both dues intact after 3000 each is assigned, then 6000 spent from Bedroom", () => {
    const before = savingsCalc(0, 0);
    const deposits = [deposit("a", "anas", 3000, "separate"), deposit("s", "salma", 3000, "separate")];
    const funded = savingsCalc(6000, 6000, deposits);
    const spent = savingsCalc(0, 0, [...deposits, { id: "buy", name: "Bedroom purchase", amount: 6000, date: "2026-10-18", category: "bedroom", accountId: "joint", type: "Expense" }]);
    expect(due(before)).toEqual([650, 350]);
    expect(due(funded)).toEqual(due(before));
    expect(due(spent)).toEqual(due(before));
    expect(funded.anasActual).toBe(0); expect(funded.salmaActual).toBe(0);
    expect(spent.openingJointBalance).toBe(0);
  });
  it("reserves savings across months even without this month's deposits", () => {
    expect(due(savingsCalc(6000, 6000))).toEqual([650, 350]);
  });
  it("credits shared savings while adding them to the percentage-based target", () => {
    const result = savingsCalc(100, 100, [deposit("s", "salma", 100, "shared")]);
    expect(due(result)).toEqual([715, 285]);
    expect(result.salmaActual).toBe(100);
  });
  it("keeps ordinary contribution transfers working beside separate savings", () => {
    const transfers = [deposit("s", "salma", 3000, "separate"), { ...transactions[0], amount: 200 }];
    expect(due(savingsCalc(3200, 3000, transfers))).toEqual([450, 350]);
  });
  it("does not subtract a dedicated savings account's balance from joint cash", () => {
    const result = calculateContributionStatus({ accounts, categories: [{ ...categories[0], available: 3000 }, { ...savings, available: 6000, defaultAccount: "saving" }], transactions: [], monthlySummary })!;
    expect(due(result)).toEqual([650, 350]);
  });
  it("does not credit savings purchases from a personal account as household spending", () => {
    const expense: Transaction = { ...transactions[3], category: "bedroom", amount: 100 };
    expect(savingsCalc(0, 0, [expense]).anasActual).toBe(0);
  });
  it("fails closed when a held savings balance is unknown", () => {
    expect(calculateContributionStatus({ accounts, categories: [{ ...savings, available: null }], transactions: [], monthlySummary })).toBeNull();
  });
});
