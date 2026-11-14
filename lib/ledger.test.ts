import { describe, expect, it } from "vitest";
import { answerLedger, lookupSpan, validateLedgerLookup, type LedgerLookup } from "./ledger";

const today = "2026-11-13";
const cats = [{ id: "eat", name: "Eat out" }, { id: "gro", name: "Groceries" }];
const t = (id: string, name: string, amount: number, date: string, category: string | null, type: string | null = "Expense") => ({ id, name, amount, date, category, type });
const tx = [
  t("1", "Lunch outside", 115, "2026-11-04", "eat"), t("2", "Dinner w Rabie", 108, "2026-11-08", "eat"),
  t("3", "Coffee", 20, "2026-11-12", "gro"), t("4", "Coffee beans", 90, "2026-10-20", "gro"),
  t("5", "Brunch", 410, "2026-10-10", "eat"), t("6", "Salary", 9000, "2026-11-01", null, "Income"),
];

describe("validateLedgerLookup", () => {
  const base = { kind: "total", type: "Expense", categoryIds: ["eat"], search: null, period: { start: "2026-11", end: "2026-11" }, compare: null, question: null };
  it("accepts a sound lookup and rejects unknown categories or future months", () => {
    expect(validateLedgerLookup(base, ["eat", "gro"], today)).toEqual({ lookup: { kind: "total", type: "Expense", categoryIds: ["eat"], search: null, period: { start: "2026-11", end: "2026-11" }, compare: null } });
    expect(() => validateLedgerLookup({ ...base, categoryIds: ["nope"] }, ["eat"], today)).toThrow();
    expect(() => validateLedgerLookup({ ...base, period: { start: "2026-12", end: "2026-12" } }, ["eat"], today)).toThrow();
    expect(() => validateLedgerLookup({ ...base, kind: "compare", compare: null }, ["eat"], today)).toThrow();
  });
  it("passes a clarifying question through", () => {
    expect(validateLedgerLookup({ ...base, question: "Which month?" }, ["eat"], today)).toEqual({ question: "Which month?" });
  });
});

describe("answerLedger", () => {
  it("counts a category this month and compares with last month", () => {
    const lookup: LedgerLookup = { kind: "compare", type: "Expense", categoryIds: ["eat"], search: null, period: { start: "2026-11", end: "2026-11" }, compare: { start: "2026-10", end: "2026-10" } };
    const answer = answerLedger(lookup, tx, cats);
    expect(answer.total).toBe(223); expect(answer.compareTotal).toBe(410);
    expect(answer.counted.map(x => x.id)).toEqual(["1", "2"]);
    expect(lookupSpan(lookup)).toEqual({ start: "2026-10", end: "2026-11" });
  });
  it("searches descriptions across categories and ignores income for spending", () => {
    const lookup: LedgerLookup = { kind: "total", type: "Expense", categoryIds: [], search: "coffee", period: { start: "2026-10", end: "2026-11" }, compare: null };
    expect(answerLedger(lookup, tx, cats).total).toBe(110);
  });
  it("ranks categories for where money went", () => {
    const lookup: LedgerLookup = { kind: "top", type: "Expense", categoryIds: [], search: null, period: { start: "2026-11", end: "2026-11" }, compare: null };
    expect(answerLedger(lookup, tx, cats).byCategory.map(c => [c.name, c.total])).toEqual([["Eat out", 223], ["Groceries", 20]]);
  });
});
