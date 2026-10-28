import { describe, expect, it } from "vitest";
import { cashMovement, checkView, checkedFundsAfter, casablancaDay, type BalanceCheck } from "./balance-checks";
import type { Transaction } from "../app/components/app-types";
const check: BalanceCheck = { accountId: "abc", version: "one", actualBalance: 1650, ledgerBalance: 2000,
  checkedAt: "2026-10-28T12:00:00Z", checkedDay: "2026-10-28", knownTransactionIds: ["old"] };
const transaction = (extra: Partial<Transaction> = {}): Transaction => ({ id: "new", name: "Coffee", amount: 50, date: "2026-10-28", type: "Expense", accountId: "abc", category: null, ...extra });

describe("shared physical balance checks", () => {
  it("keeps a recorded count independent from the ledger and later edits to old transactions", () => {
    expect(checkView(check, [transaction({ id: "old", amount: 350 })], "2026-10-28").estimatedActual).toBe(1650);
    expect(checkView(check, [], "2026-10-28").estimatedActual).toBe(1650);
  });
  it("carries later spending and receipts forward once and keeps cents", () => {
    const view = checkView(check, [transaction({ amount: 19.95 }), transaction({ id: "income", type: "Income", amount: 100 })], "2026-10-28");
    expect(view.estimatedActual).toBe(1730.05);
    expect(view).not.toHaveProperty("knownTransactionIds");
    expect(checkedFundsAfter(view, 1800)).toBe(-69.95);
    expect(checkedFundsAfter(undefined, 50)).toBeNull();
  });
  it("does not spend already-counted missing transactions again, including same-day entries", () => {
    expect(checkView(check, [transaction({ date: "2026-10-27", amount: 350 })], "2026-10-28").estimatedActual).toBe(1650);
    const explained = { ...check, knownTransactionIds: [...check.knownTransactionIds, "new"] };
    expect(checkView(explained, [transaction({ amount: 350 })], "2026-10-28").estimatedActual).toBe(1650);
  });
  it("moves bank and cash independently without spending category-only transfers", () => {
    const transfer = transaction({ type: "Transfer", accountId: null, fromAccountId: "a-bc", toAccountId: "cash", amount: 200 });
    expect(cashMovement(transfer, "abc")).toBe(-200);
    expect(cashMovement(transfer, "cash")).toBe(200);
    expect(cashMovement(transaction({ type: "Transfer", accountId: "abc" }), "abc")).toBe(0);
    expect(cashMovement({ ...transfer, toAccountId: "abc" }, "abc")).toBe(0);
    expect(checkView(check, [transaction({ accountId: "other" })], "2026-10-28").estimatedActual).toBe(1650);
  });
  it("does not apply future-dated payments until their day", () => {
    expect(checkView(check, [transaction({ date: "2026-10-29" })], "2026-10-28").estimatedActual).toBe(1650);
    expect(checkView(check, [transaction({ date: "2026-10-29" })], "2026-10-29").estimatedActual).toBe(1600);
  });
  it("uses Casablanca's day across UTC midnight", () => {
    expect(casablancaDay(new Date("2026-10-28T23:30:00Z"))).toBe("2026-10-29");
  });
});
