import { describe, expect, it } from "vitest";
import { calculateJointDebt } from "./joint-debt-utils";
import { calculateContributionStatus } from "./contribution-utils";
import type { Account, Category, Transaction } from "./app-types";
const accounts: Account[] = [
  { id: "a", label: "Hubby Account", balance: 1000, readyToAssign: 1000, contributionPercent: .65, type: "Checking", icon: "" },
  { id: "s", label: "Wife Account", balance: 1000, readyToAssign: 1000, contributionPercent: .35, type: "Checking", icon: "" },
  { id: "j", label: "Joined Account", balance: 0, readyToAssign: 0, type: "Joined", icon: "" },
];
const cat = (id: string, owner: string | null, type: string[] = []): Category => ({ id, name: id, owner, type, icon: null, defaultAccount: owner === "Anas" ? "a" : owner === "Salma" ? "s" : "j", available: 0, planned: 0, lastMonthSpent: null, isTeamFund: !owner });
const categories = [cat("personal-a", "Anas"), cat("personal-s", "Salma"), cat("house", null), cat("saving", "Anas", ["Saving"])];
const range = { start: "2026-10-01", end: "2026-10-31" };
const expense = (id: string, category = "personal-a", amount = 100.25, date = "2026-10-10"): Transaction => ({ id, name: "Personal", category, amount, date, accountId: "j", type: "Expense" });
const transfer = (amount: number, date = "2026-10-11", fromAccountId = "a"): Transaction => ({ id: "repay", name: "Transfer", category: null, accountId: null, type: "Transfer", fromAccountId, toAccountId: "j", date, amount });
const debt = (transactions: Transaction[]) => calculateJointDebt(accounts, categories, transactions, range);
const status = (transactions: Transaction[], cash = 0, available = 1000, history = transactions) => calculateContributionStatus({ accounts: accounts.map(a => a.id === "j" ? { ...a, balance: cash } : a), categories: categories.map(c => c.id === "house" ? { ...c, available } : c), transactions, debtTransactions: history, monthlySummary: { ...range, totalAssigned: 1000, totalSpent: 0, assignedByCategory: [], spentByCategory: [] } })!;
const dues = (s: ReturnType<typeof status>) => [Math.round((s.anasPlan - s.anasActual) * 100) / 100, Math.round((s.salmaPlan - s.salmaActual) * 100) / 100];
describe("personal borrowing from Joint", () => {
  it("charges exactly the amount to the budget owner, never the payment account's owner", () => {
    expect(debt([expense("a"), expense("s", "personal-s", 37.12)])).toMatchObject({ anas: 100.25, salma: 37.12 });
    expect(dues(status([expense("a")], -100.25))).toEqual([750.25, 350]);
    expect(dues(status([expense("s", "personal-s")], -100.25))).toEqual([650, 450.25]);
  });
  it("does not split debt even when Joint already has surplus cash", () => {
    expect(dues(status([expense("a")], 2000))).toEqual([100.25, 0]);
  });
  it("repays debt before crediting the rest as a contribution, without double counting", () => {
    const result = status([expense("a"), transfer(150.25)], 50);
    expect(result.anasPersonalDebt).toBe(0);
    expect(result.anasActual).toBe(50);
    expect(dues(result)).toEqual([600, 350]);
    expect(dues(status([expense("a"), transfer(40)], -60.25))).toEqual([710.25, 350]);
  });
  it("carries prior-month borrowing, and only deducts repayments in the contribution month", () => {
    const old = expense("old", "personal-a", 100.25, "2026-09-10");
    expect(dues(status([], 0, 1000, [old]))).toEqual([685.09, 314.91]);
    const result = status([transfer(100.25)], 100.25, 1000, [old, transfer(100.25)]);
    expect(result.anasActual).toBe(0);
    expect(dues(result)).toEqual([584.84, 314.91]);
    expect(debt([old, transfer(40, "2026-09-11")])).toEqual({ anas: 60.25, salma: 0, anasRepaid: 0, salmaRepaid: 0 });
  });
  it("keeps debt when the personal budget is archived or snoozed", () => {
    expect(calculateJointDebt(accounts, categories.map(c => ({ ...c, archived: true, snoozed: true })), [expense("a")], range).anas).toBe(100.25);
  });
  it("recalculates edited/deleted expenses and deleted repayments", () => {
    expect(debt([expense("a", "personal-a", 150), transfer(40)]).anas).toBe(110);
    expect(debt([transfer(40)]).anas).toBe(0);
    expect(debt([expense("a")]).anas).toBe(100.25);
    expect(debt([expense("a", "house")]).anas).toBe(0);
  });
  it("ignores joint budgets, personal-funded purchases, savings, income, and future records", () => {
    expect(debt([expense("j", "house"), expense("saving", "saving"), { ...expense("own"), accountId: "a" }, { ...expense("income"), type: "Income" }, expense("future", "personal-a", 100, "2026-11-01")]).anas).toBe(0);
  });
  it("does not consume savings deposits or a partner's transfer against the other's debt", () => {
    expect(debt([expense("a"), { ...transfer(500), savingsFundingTarget: "separate" }, transfer(500, "2026-10-12", "s")]).anas).toBe(100.25);
  });
  it("orders same-day transactions by creation time, not input order, and does not prepay future borrowing", () => {
    const loan = { ...expense("a"), createdAt: "2026-10-10T12:00:00Z" };
    const paid = { ...transfer(40, "2026-10-10"), createdAt: "2026-10-10T13:00:00Z" };
    expect(debt([paid, loan]).anas).toBe(60.25);
    expect(debt([transfer(500, "2026-10-09"), loan]).anas).toBe(100.25);
  });
});
