import { expect, it } from "vitest";
import { checkTransactionExpectation } from "./transaction-expectation";
import type { Transaction } from "../app/components/app-types";
const original: Transaction = { id: "tx", name: "Coffee", amount: 19.95, date: "2026-10-23", type: "Expense", category: "cat", accountId: "acct" };
it("accepts an unchanged cached version and keeps old clients working", () => {
  expect(checkTransactionExpectation(original, original)).toBeNull();
  expect(checkTransactionExpectation(original, undefined)).toBeNull();
});
it("rejects stale money, category, account, description and date", () => {
  for (const patch of [{ amount: 20 }, { name: "Changed" }, { category: "other" }, { accountId: "other" }, { date: "2026-10-22" }]) {
    expect(checkTransactionExpectation({ ...original, ...patch }, original)?.status).toBe(409);
  }
});
it("rejects malformed expected versions", () => {
  for (const input of [null, [], "bad", {}, { ...original, amount: "19.95" }, { ...original, accountId: {} }]) expect(checkTransactionExpectation(original, input)?.status).toBe(400);
});
it("checks income target changes as well as amount", () => {
  expect(checkTransactionExpectation({ ...original, type: "Income", incomeUse: "unassigned" }, { ...original, incomeUse: "contributions" })?.status).toBe(409);
});
