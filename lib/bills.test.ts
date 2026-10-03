import { describe, expect, it } from "vitest";
import { anchoredDate, billToday, deriveOccurrences, earmarkedByCategory, isCalendarDate, parseBillMetadata, type BillSchedule, type BillPayment } from "./bills";
const schedule: BillSchedule = { id: "ab-cd", name: "Rent", amount: 600, categoryId: "category", dueDate: "2026-01-31", repeat: "Monthly", metadata: { v: 1 } };
const payment: BillPayment = { id: "paid", billId: "abcd", period: "2026-02", date: "2026-03-02", amount: 550, categoryId: "category", accountId: "account" };
describe("bill occurrences", () => {
  it("clamps month-end and leap-day anchors without drifting", () => {
    expect(anchoredDate("2026-01-31", "2026-02")).toBe("2026-02-28");
    expect(anchoredDate("2026-01-31", "2026-03")).toBe("2026-03-31");
    expect(anchoredDate("2024-02-29", "2025-02")).toBe("2025-02-28");
    expect(anchoredDate("2024-02-29", "2028-02")).toBe("2028-02-29");
  });
  it("keeps older unpaid occurrences and reservations across rollover", () => {
    const rows = deriveOccurrences([schedule], [payment], "2026-03-10", "2026-03");
    expect(rows.map(r => r.state)).toEqual(["Overdue", "Paid", "Due"]);
    expect(rows.map(r => r.amount)).toEqual([600, 600, 600]);
    expect(earmarkedByCategory(rows, "2026-03-31")).toEqual({ category: 1200 });
  });
  it("a payment releases only its reservation; undo brings the expectation back", () => {
    const paid = deriveOccurrences([schedule], [payment], "2026-02-28", "2026-02")[1];
    expect(paid.state).toBe("Paid"); expect(paid.amount).toBe(600); expect(paid.payments[0].amount).toBe(550);
    expect(deriveOccurrences([schedule], [], "2026-03-10", "2026-02")[1]).toMatchObject({ state: "Overdue", amount: 600 });
  });
  it("skips, restores, and stops without erasing past due occurrences", () => {
    const modified = { ...schedule, metadata: { v: 1 as const, skipped: ["2026-02"], end: "2026-03" } };
    const rows = deriveOccurrences([modified], [], "2026-05-10", "2026-05");
    expect(rows).toHaveLength(3); expect(rows[1].state).toBe("Skipped"); expect(rows[0].state).toBe("Overdue");
    expect(earmarkedByCategory(rows, "2026-05-31")).toEqual({ category: 1200 });
    expect(deriveOccurrences([{ ...modified, metadata: { v: 1, end: "2026-03" } }], [], "2026-05-10", "2026-05")[1].state).toBe("Overdue");
  });
  it("yearly schedules occur only in their anchor month; one-offs occur once", () => {
    expect(deriveOccurrences([{ ...schedule, repeat: "Yearly" }], [], "2026-03-10", "2028-02").map(r => r.period)).toEqual(["2026-01", "2027-01", "2028-01"]);
    expect(deriveOccurrences([{ ...schedule, repeat: "None" }], [], "2026-03-10", "2028-02")).toHaveLength(1);
  });
  it("preserves old expectations when future values change and isolates overrides", () => {
    const edited: BillSchedule = { ...schedule, amount: 800, categoryId: "new", metadata: { v: 1, revisions: [{ until: "2026-02", amount: 600, categoryId: "old" }], overrides: { "2026-02": { amount: 650, due: "2026-03-05" } } } };
    const rows = deriveOccurrences([edited], [payment], "2026-03-10", "2026-03");
    expect(rows[0]).toMatchObject({ amount: 600, categoryId: "old" });
    expect(rows[1]).toMatchObject({ amount: 650, categoryId: "old", dueDate: "2026-03-05", period: "2026-02", state: "Paid" });
    expect(rows[2]).toMatchObject({ amount: 800, categoryId: "new" });
  });
  it("surfaces duplicate and orphan payments rather than discarding expenses", () => {
    const rows = deriveOccurrences([schedule], [payment, { ...payment, id: "duplicate" }], "2026-03-10", "2026-03");
    expect(rows[1].payments).toHaveLength(2); expect(rows[1].state).toBe("Paid");
    expect(deriveOccurrences([], [payment], "2026-03-10", "2026-03")[0]).toMatchObject({ state: "Paid", amount: 550 });
  });
  it("keeps a prepaid future occurrence in actual payment history", () => {
    const future = { ...payment, period: "2026-11", date: "2026-03-01" };
    const rows = deriveOccurrences([schedule], [future], "2026-03-10", "2026-03");
    expect(rows.find(r => r.period === "2026-11")).toMatchObject({ state: "Paid", payments: [future] });
  });
  it("rejects malformed dates and metadata without treating them as empty", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(() => parseBillMetadata('{"v":1,"skipped":["2026-13"]}')).toThrow();
    expect(() => parseBillMetadata('{"v":1,"overrides":{"2026-10":{"amount":-10}}}')).toThrow();
    expect(() => deriveOccurrences([{ ...schedule, dueDate: "2026-02-30" }], [], "2026-03-10", "2026-03")).toThrow();
  });
  it("uses Casablanca calendar dates across UTC midnight", () => {
    expect(billToday(new Date("2026-10-02T23:30:00Z"))).toBe("2026-10-03");
  });
});
