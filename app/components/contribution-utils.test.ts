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

describe("calculateContributionStatus", () => {
  it("reconstructs opening cash and preserves independent partner obligations", () => {
    const result = calculateContributionStatus({ accounts, categories, transactions, monthlySummary });
    expect(result).toMatchObject({
      openingJointBalance: 2257,
      jointPlan: 19291,
      partnerRequirement: 17034,
      anasPlan: 11072.1,
      salmaPlan: 5961.9,
      anasActual: 2295,
      salmaActual: 6994,
    });
    expect(result!.anasPlan - result!.anasActual).toBeCloseTo(8777.1);
    expect(result!.salmaActual - result!.salmaPlan).toBeCloseTo(1032.1);
  });

  it("keeps the reconstructed opening balance stable as new activity arrives", () => {
    const before = calculateContributionStatus({ accounts, categories, transactions, monthlySummary });
    const afterAccounts = accounts.map((account) => account.id === "joint" ? { ...account, balance: 2400 } : account);
    const afterTransactions = [...transactions,
      { id: "new-transfer", name: "New transfer", amount: 500, date: "2026-09-18", category: null, accountId: null, type: "Transfer" as const, fromAccountId: "anas", toAccountId: "joint" },
      { id: "new-expense", name: "New expense", amount: 100, date: "2026-09-18", category: "household", accountId: "joint", type: "Expense" as const },
    ];
    const after = calculateContributionStatus({ accounts: afterAccounts, categories, transactions: afterTransactions, monthlySummary });
    expect(after!.openingJointBalance).toBe(before!.openingJointBalance);
  });
});
