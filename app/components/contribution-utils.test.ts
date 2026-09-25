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
