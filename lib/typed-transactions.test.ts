import { describe, expect, it, vi } from "vitest";
import { parseTransactionLines, reconcileTypedChoices, saveTypedBatch } from "./typed-transactions";
const reference = new Date(2026, 8, 27, 0, 30);
const parse = (text: string) => parseTransactionLines(text, reference);
describe("typed transactions", () => {
  it("parses the requested example using the local calendar", () => {
    expect(parse("pizza 19 yesterday")[0].transaction).toEqual({ name: "pizza", amount: 19, date: "2026-09-26", type: "Expense" });
  });
  it("keeps original line numbers and skips empty lines", () => {
    const rows = parse("\n pizza 19 yesterday\r\n\ncoffee 12,50\n19 MAD lunch");
    expect(rows.map(row => row.line)).toEqual([2, 4, 5]);
    expect(rows.map(row => row.transaction?.amount)).toEqual([19, 12.5, 19]);
  });
  it.each([
    ["coffee 12 monday", "2026-09-21"], ["coffee 12 last sunday", "2026-09-20"],
    ["coffee 12 2 days ago", "2026-09-25"], ["coffee 12 day before yesterday", "2026-09-25"],
    ["coffee 12 on 2024-02-29", "2024-02-29"], ["coffee .50 today", "2026-09-27"],
  ])("parses %s", (input, date) => expect(parse(input)[0].transaction?.date).toBe(date));
  it("handles month and year boundaries", () => {
    expect(parseTransactionLines("pizza 19 yesterday", new Date(2026, 0, 1))[0].transaction?.date).toBe("2025-12-31");
  });
  it.each(["pizza", "19", "pizza 0", "pizza 19 20", "pizza 1,234", "pizza 19.999", "pizza 19 yesterday today", "pizza 19 2026-02-30", "pizza 19 09/12", "pizza $19", "pizza 19 eur", "pizza 19 next monday", "pizza 19 last week", "pizza 19 999999 days ago"])("rejects ambiguous or invalid input: %s", input => expect(parse(input)[0].error).toBeTruthy());
  it("stops after a partial failure without resubmitting saved items", async () => {
    const save = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Offline"));
    const saved = vi.fn();
    expect(await saveTypedBatch([1, 2, 3], save, saved)).toEqual({ saved: 1, error: "Offline" });
    expect(save.mock.calls).toEqual([[1], [2]]);
    expect(saved.mock.calls).toEqual([[1]]);
  });
});

it("retains choices on unchanged lines when adding, editing, and deleting lines", () => {
  const choices = { 1: "food", 2: "travel" };
  expect(reconcileTypedChoices("pizza 19\ntaxi 40", "coffee 12\npizza 19\ntaxi 40", choices)).toEqual({ 2: "food", 3: "travel" });
  expect(reconcileTypedChoices("pizza 19\ntaxi 40", "pizza 20\ntaxi 40", choices)).toEqual({ 2: "travel" });
  expect(reconcileTypedChoices("pizza 19\ntaxi 40", "taxi 40", choices)).toEqual({ 1: "travel" });
});

it.each([["pizza -19", "Expense"], ["salary 5000", "Income"], ["received 200 gift", "Income"], ["refund +50", "Income"], ["paid 20 taxi", "Expense"], ["pizza 19", "Expense"]])("infers type for %s", (line, type) => {
  expect(parse(line)[0].transaction?.type).toBe(type);
  expect(parse(line)[0].transaction?.amount).toBeGreaterThan(0);
});
it("supports mixed types and a default date without changing relative dates", () => {
  const rows = parseTransactionLines("pizza 19\nsalary 5000 yesterday", reference, "2026-09-01");
  expect(rows.map(row => [row.transaction?.type, row.transaction?.date])).toEqual([["Expense", "2026-09-01"], ["Income", "2026-09-26"]]);
});
it.each(["salary -5000", "paid +20 taxi", "netflix 15 every month"])("rejects conflicting or unsupported instructions: %s", line => expect(parse(line)[0].error).toBeTruthy());
