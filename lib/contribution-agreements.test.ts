import { describe, expect, it } from "vitest";
import { contributionLedger, type ContributionAgreement } from "./contribution-agreements";
import { calculateContributionStatus, contributionDue } from "../app/components/contribution-utils";
import { calculateMonthPlanCapacity } from "../app/components/month-plan-capacity";
import type { Account, Category, MonthlySummary, Transaction } from "../app/components/app-types";

const accounts: Account[] = [
  { id: "a", label: "Hubby Account", balance: 10000, readyToAssign: 10000, contributionPercent: .65, type: "Checking", icon: "" },
  { id: "s", label: "Wife Account", balance: 10000, readyToAssign: 10000, contributionPercent: .35, type: "Checking", icon: "" },
  { id: "j", label: "Joined Account", balance: 1031.5, readyToAssign: 252, type: "Joined", icon: "" },
];
const categories: Category[] = [
  { id: "shared", name: "Groceries", type: ["Obligations"], owner: null, defaultAccount: "j", available: 779.15, isTeamFund: true, icon: null, planned: 0, lastMonthSpent: null },
  { id: "personal", name: "Gifts ( Anas )", type: ["Wants"], owner: "Anas", defaultAccount: "a", available: 0, isTeamFund: false, icon: null, planned: 0, lastMonthSpent: null },
  { id: "saving", name: "Bedroom", type: ["Saving"], owner: null, defaultAccount: "j", available: 0, isTeamFund: true, icon: null, planned: 0, lastMonthSpent: null },
];
const agreement: ContributionAgreement = { month: "2026-10", targets: { anas: 11638.25, salma: 6266.75 }, original: { anas: 11638.25, salma: 6266.75 }, shares: { anas: .65, salma: .35 }, confirmedAt: "2026-10-31T12:00:00Z", updatedAt: "2026-10-31T12:00:00Z", version: "v1" };
const transfer = (id: string, amount: number, fromAccountId = "a", toAccountId = "j", date = "2026-10-20"): Transaction => ({ id, name: id, amount, date, type: "Transfer", fromAccountId, toAccountId, category: null, accountId: null });
const expense = (id: string, amount: number, accountId: string, category = "shared", date = "2026-10-19"): Transaction => ({ id, name: id, amount, date, category, accountId, type: "Expense" });
const entries: Transaction[] = [
  transfer("ordinary", 10394), transfer("overbudget", 495, "a", "j", "2026-10-29"), expense("direct", 1720, "a"),
  transfer("salma", 276, "s"), expense("salma-direct", 6305, "s"),
  { ...transfer("separate-savings", 3000), savingsFundingTarget: "separate" },
  expense("bedroom", 6000, "j", "saving"), expense("personal-from-joint", 150, "j", "personal", "2026-10-23"),
];
const summary: MonthlySummary = { start: "2026-10-01", end: "2026-10-31", totalAssigned: 17905, totalSpent: 0, assignedByCategory: [], spentByCategory: [], contributionAgreements: [agreement] };
const calculate = (activity = entries, balance = 1031.5) => calculateContributionStatus({ accounts: accounts.map(a => a.id === "j" ? { ...a, balance } : a), categories, transactions: activity.filter(t => t.date.startsWith("2026-10")), debtTransactions: activity, debtCategories: categories, monthlySummary: summary })!;

describe("confirmed monthly contributions and advances", () => {
  it("reproduces October, excludes separate savings, and repays personal borrowing first", () => {
    const status = calculate();
    expect([status.anasPlan, status.salmaPlan]).toEqual([11638.25, 6266.75]);
    expect([status.anasActual, status.salmaActual]).toEqual([12459, 6581]);
    expect(status.advances?.outstanding).toEqual({ anas: 820.75, salma: 314.25 });
  });
  it("keeps agreed targets and personal advances stable through cash corrections and Joined expenses", () => {
    const status = calculate([...entries, expense("missing-joint-expense", 537.5, "j")], 494);
    expect([status.anasPlan, status.salmaPlan]).toEqual([11638.25, 6266.75]);
    expect(status.advances?.outstanding).toEqual({ anas: 820.75, salma: 314.25 });
    expect(calculate().advances).toEqual(calculate(entries, 494).advances);
  });
  it("recalculates advances when personal shared expenses are added, edited, deleted or reassigned", () => {
    expect(calculate([...entries, expense("late-personal", 10.25, "a")]).advances?.outstanding.anas).toBe(831);
    expect(calculate(entries.map(t => t.id === "direct" ? { ...t, amount: 1700 } : t)).advances?.outstanding.anas).toBe(800.75);
    expect(calculate(entries.filter(t => t.id !== "direct")).advances?.outstanding.anas).toBe(0);
    expect(calculate(entries.map(t => t.id === "direct" ? { ...t, accountId: "j" } : t)).advances?.outstanding.anas).toBe(0);
  });
  it("keeps new personal borrowing due even when the partner contributed above the agreement", () => {
    const status = calculate([...entries, expense("later-personal-purchase", 100, "j", "personal", "2026-10-30")]);
    expect(status.agreement?.targets.anas).toBe(11638.25);
    expect(status.anasPersonalDebt).toBe(100);
    expect(contributionDue(status, "anas")).toBe(100);
    expect(status.advances?.outstanding.anas).toBe(820.75);
  });
  it("carries through December without duplicating October's advance", () => {
    expect(contributionLedger(accounts, categories, entries, [agreement], "2026-12").carried).toEqual({ anas: 820.75, salma: 314.25 });
    const november = { ...agreement, month: "2026-11", targets: { anas: 650, salma: 350 }, original: { anas: 650, salma: 350 } };
    expect(contributionLedger(accounts, categories, entries, [agreement, november], "2026-12").outstanding).toEqual({ anas: 820.75, salma: 314.25 });
  });
  it("records partial repayment without undoing November contribution or October history", () => {
    const payment = { ...transfer("repayment", 300, "j", "a", "2026-11-01"), contributionRepaymentId: "request" };
    const november = { ...agreement, month: "2026-11", targets: { anas: 650, salma: 350 }, original: { anas: 650, salma: 350 } };
    const ledger = contributionLedger(accounts, categories, [...entries, payment, transfer("november", 650, "a", "j", "2026-11-01")], [agreement, november], "2026-11");
    expect(ledger.outstanding).toEqual({ anas: 520.75, salma: 314.25 });
    expect(ledger.months[0].aboveOriginal.anas).toBe(820.75);
    expect(ledger.months[0].repaid.anas).toBe(300);
    expect(ledger.months[1].contributed.anas).toBe(650);
    expect(contributionLedger(accounts, categories, entries, [agreement], "2026-11").outstanding.anas).toBe(820.75);
  });
  it("applies an advance to the next month's contribution without moving cash", () => {
    const november = { ...agreement, month: "2026-11", targets: { anas: 650, salma: 350 }, original: { anas: 650, salma: 350 } };
    // Salma's 314,25 advance applied: her contribution half (offset marker) and Joined's repayment half, same day.
    const applied = [
      { ...transfer("offset-in", 314.25, "s", "j", "2026-11-01"), contributionRepaymentId: "offset:request" },
      { ...transfer("offset-out", 314.25, "j", "s", "2026-11-01"), contributionRepaymentId: "request" },
    ];
    const ledger = contributionLedger(accounts, categories, [...entries, ...applied], [agreement, november], "2026-11");
    expect(ledger.outstanding.salma).toBe(0);
    expect(ledger.months[1].contributed.salma).toBe(314.25);
    expect(ledger.months[1].outstanding.salma).toBe(0);
    expect(ledger.outstanding.anas).toBe(820.75);
  });
  it("preserves original amounts after an explicit agreement revision", () => {
    const revised = { ...agreement, targets: { ...agreement.targets, anas: 12000 } };
    const month = contributionLedger(accounts, categories, entries, [revised], "2026-10").months[0];
    expect(month.aboveOriginal.anas).toBe(820.75);
    expect(month.outstanding.anas).toBe(459);
  });
  it("never spends a future month's advance and exposes over-repayment after corrections", () => {
    const payment = { ...transfer("too-early", 900, "j", "a", "2026-09-30"), contributionRepaymentId: "request" };
    const ledger = contributionLedger(accounts, categories, [...entries, payment], [agreement], "2026-10");
    expect(ledger.outstanding.anas).toBe(820.75);
    expect(ledger.unappliedRepayments.anas).toBe(900);
  });
  it("funds an advance reservation before allocating new money, including negative capacity", () => {
    const capacity = calculateMonthPlanCapacity({ joint: 252.35 - 1135, anas: 5000, salma: 5000 }, { joint: 1000, anas: 0, salma: 0 }, { anas: .65, salma: .35 });
    expect(capacity.due).toEqual({ anas: 1223.72, salma: 658.93 });
    expect(capacity.due.anas + capacity.due.salma).toBeCloseTo(1882.65);
  });
});
