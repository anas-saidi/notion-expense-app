import { describe, expect, it } from "vitest";
import { validateParsing, validateReallocation } from "./finance-ai";

const categories = [{ id: "food", name: "Groceries", available: 1000, reserved: 600 }, { id: "repair", name: "Repairs", available: 0, reserved: 0 }];
const draft = { name: "Lunch", amount: 35, date: "2026-10-11", type: "Expense", categoryId: "food", accountId: null };
const move = { fromId: "food", toId: "repair", amount: 300, reason: "Use discretionary money." };
describe("transaction drafts", () => {
  it("preserves multiple transactions and unresolved choices", () => {
    expect(validateParsing({ transactions: [draft, { ...draft, name: "Salary", type: "Income" }], questions: [] }, categories, []).transactions).toHaveLength(2);
  });
  it("returns clarification without inventing transactions", () => {
    expect(validateParsing({ transactions: [], questions: ["How much did you spend?"] }, [], []).questions).toEqual(["How much did you spend?"]);
  });
  it.each([{ amount: -5 }, { amount: 12.345 }, { amount: Infinity }, { date: "2026-02-30" }, { categoryId: "invented" }, { accountId: "unknown" }, { type: "Transfer" }, { name: "" }])("rejects invalid model drafts: %j", change => {
    expect(() => validateParsing({ transactions: [{ ...draft, ...change }], questions: [] }, categories, [])).toThrow();
  });
});
describe("budget suggestions", () => {
  it("conserves money and keeps the original snapshot for review", () => {
    expect(validateReallocation({ explanation: "Cover the repair", moves: [move] }, categories)).toEqual({ explanation: "Cover the repair", moves: [move], balances: { food: 1000, repair: 0 } });
  });
  it("rejects bill money being drained", () => {
    expect(() => validateReallocation({ explanation: "Move", moves: [{ ...move, amount: 401 }] }, categories)).toThrow();
  });
  it("does not round fractional balances up into spendable money", () => {
    expect(() => validateReallocation({ explanation: "Move", moves: [{ ...move, amount: 11 }] }, [{ ...categories[0], available: 10.6, reserved: 0 }, categories[1]])).toThrow();
  });
  it("rejects cumulative overspending across destinations", () => {
    expect(() => validateReallocation({ explanation: "Move", moves: [move, { ...move, toId: "fun", amount: 200 }] }, [...categories, { id: "fun", name: "Fun", available: 0, reserved: 0 }])).toThrow();
  });
  it.each([{ fromId: "unknown" }, { toId: "food" }, { amount: 0 }, { amount: 1.5 }])("rejects unsafe moves: %j", change => {
    expect(() => validateReallocation({ explanation: "Move", moves: [{ ...move, ...change }] }, categories)).toThrow();
  });
  it("rejects circular moves and duplicate moves", () => {
    expect(() => validateReallocation({ explanation: "Move", moves: [move, { ...move, fromId: "repair", toId: "food", amount: 1 }] }, categories)).toThrow();
    expect(() => validateReallocation({ explanation: "Move", moves: [move, move] }, categories)).toThrow();
  });
  it("can explain an unaffordable request without suggesting any move", () => {
    expect(validateReallocation({ explanation: "Not enough discretionary money", moves: [] }, categories).moves).toEqual([]);
  });
});
