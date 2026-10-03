import { describe, it, expect } from "vitest";
import {
  applyOp, categories, categoryPosition, deriveOccurrences, duplicatePaymentKeys, emptyMeta, monthEnd,
  seedBills, seedPayments, TODAY, type Payment, type Schedule,
} from "./model";

const bill = (over: Partial<Schedule> = {}): Schedule => ({
  id: "b", name: "Bill", amount: 600, categoryId: "utilities", dueDate: "2026-09-10", repeat: "Monthly", meta: emptyMeta(), ...over,
});
const pay = (period: string, amount: number, over: Partial<Payment> = {}): Payment => ({
  id: `p-${period}-${amount}`, name: "Bill", amount, categoryId: "utilities", accountId: "joint-bank", date: `${period}-10`, billId: "b", period, ...over,
});
const find = (occ: ReturnType<typeof deriveOccurrences>, period: string) => occ.find((o) => o.period === period)!;
const utilities = categories.find((c) => c.id === "utilities")!;

describe("deriveOccurrences", () => {
  it("produces every month from the start with no generation step", () => {
    const occ = deriveOccurrences([bill()], [], "2026-09-01", "2026-12");
    expect(occ.map((o) => o.period)).toEqual(["2026-09", "2026-10", "2026-11", "2026-12"]);
  });

  it("keeps an unpaid earlier occurrence overdue after month rollover", () => {
    const occ = deriveOccurrences([bill()], [], "2026-11-15", "2026-11");
    expect(find(occ, "2026-09").state).toBe("overdue");
    expect(find(occ, "2026-11").state).toBe("overdue");
  });

  it("a payment never changes the next occurrence's expected amount", () => {
    const occ = deriveOccurrences([bill()], [pay("2026-09", 550)], "2026-09-28", "2026-10");
    expect(find(occ, "2026-09").state).toBe("paid");
    expect(find(occ, "2026-10").amount).toBe(600);
  });

  it("clamps monthly anchors without losing the day: Jan 31 → Feb 28 → Mar 31", () => {
    const occ = deriveOccurrences([bill({ dueDate: "2026-01-31" })], [], "2026-01-01", "2026-03");
    expect(occ.map((o) => o.due)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("clamps a Feb 29 yearly anchor to Feb 28 in non-leap years", () => {
    const occ = deriveOccurrences([bill({ dueDate: "2028-02-29", repeat: "Yearly" })], [], "2028-01-01", "2029-12");
    expect(occ.map((o) => o.due)).toEqual(["2028-02-29", "2029-02-28"]);
  });

  it("a one-off bill has exactly one occurrence", () => {
    expect(deriveOccurrences([bill({ repeat: "None" })], [], TODAY, "2027-06")).toHaveLength(1);
  });

  it("flags two payments for the same occurrence instead of hiding one", () => {
    const payments = [pay("2026-09", 600, { id: "a" }), pay("2026-09", 600, { id: "b" })];
    expect(find(deriveOccurrences([bill()], payments, TODAY, "2026-09"), "2026-09").payments).toHaveLength(2);
    expect(duplicatePaymentKeys(payments)).toEqual(new Set(["b:2026-09"]));
  });

  it("undoing a payment (archiving it) returns the occurrence to overdue", () => {
    expect(find(deriveOccurrences([bill()], [], TODAY, "2026-09"), "2026-09").state).toBe("overdue");
  });
});

describe("financial contract", () => {
  const b = bill({ dueDate: "2026-09-30", repeat: "None" });
  const cutoff = monthEnd("2026-09");
  const position = (payments: Payment[], bills = [b]) =>
    categoryPosition(utilities, deriveOccurrences(bills, payments, TODAY, "2026-09"), [...seedPayments, ...payments], cutoff);

  it("an unpaid bill earmarks without touching Available", () => {
    expect(position([])).toEqual({ available: 1400, earmarked: 600, free: 800 });
  });
  it("paying the expected amount releases the reservation", () => {
    expect(position([pay("2026-09", 600)])).toEqual({ available: 800, earmarked: 0, free: 800 });
  });
  it("paying less leaves the difference available", () => {
    expect(position([pay("2026-09", 550)])).toEqual({ available: 850, earmarked: 0, free: 850 });
  });
  it("skipping releases the reservation with no spending", () => {
    expect(position([], [applyOp(b, { kind: "skip", period: "2026-09" })])).toEqual({ available: 1400, earmarked: 0, free: 1400 });
  });
  it("seed data: Utilities earmarks overdue water and today's internet", () => {
    const occ = deriveOccurrences(seedBills, seedPayments, TODAY, "2026-09");
    expect(categoryPosition(utilities, occ, seedPayments, cutoff)).toEqual({ available: 1400, earmarked: 760, free: 640 });
  });
});

describe("metadata operations", () => {
  it("skip affects only that occurrence and restore brings it back", () => {
    const skipped = applyOp(bill(), { kind: "skip", period: "2026-09" });
    const occ = deriveOccurrences([skipped], [], TODAY, "2026-10");
    expect([find(occ, "2026-09").state, find(occ, "2026-10").state]).toEqual(["skipped", "due"]);
    const restored = applyOp(skipped, { kind: "restore", period: "2026-09" });
    expect(find(deriveOccurrences([restored], [], TODAY, "2026-09"), "2026-09").state).toBe("overdue");
  });

  it("stop ends later occurrences and keeps earlier unpaid ones", () => {
    const stopped = applyOp(bill(), { kind: "stop", end: "2026-10" });
    const occ = deriveOccurrences([stopped], [], "2026-11-20", "2027-01");
    expect(occ.map((o) => [o.period, o.state])).toEqual([["2026-09", "overdue"], ["2026-10", "overdue"]]);
  });

  it("override changes one occurrence and keeps its period", () => {
    const edited = applyOp(bill(), { kind: "override", period: "2026-10", amount: 480, due: "2026-11-02" });
    const occ = deriveOccurrences([edited], [], TODAY, "2026-11");
    expect(find(occ, "2026-10")).toMatchObject({ amount: 480, due: "2026-11-02", key: "b:2026-10" });
    expect(find(occ, "2026-11").amount).toBe(600);
  });

  it("editing future occurrences keeps earlier unpaid ones at their original amount", () => {
    const edited = applyOp(bill(), { kind: "editFuture", from: "2026-11", amount: 650, categoryId: "utilities" });
    const occ = deriveOccurrences([edited], [], TODAY, "2026-12");
    expect(occ.map((o) => o.amount)).toEqual([600, 600, 650, 650]);
  });

  it("a second, earlier future edit doesn't rewrite periods before it", () => {
    let b = applyOp(bill(), { kind: "editFuture", from: "2026-12", amount: 700, categoryId: "utilities" });
    b = applyOp(b, { kind: "editFuture", from: "2026-10", amount: 650, categoryId: "utilities" });
    expect(deriveOccurrences([b], [], TODAY, "2026-12").map((o) => o.amount)).toEqual([600, 650, 650, 650]);
  });
});
