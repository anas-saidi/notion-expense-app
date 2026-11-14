import { describe, expect, it } from "vitest";
import { billRemaining, deriveOccurrences, earmarkedByCategory, parseBillMetadata, type BillPayment, type BillSchedule } from "./bills";
import { billShortfalls, rebalanceSuggestions } from "./suggestions";
import { shortfallBreakdown, accountsAgreeWithCategories } from "../app/components/app-utils";
import type { Account, Category } from "../app/components/app-types";

const dentist: BillSchedule = { id: "dd", name: "Dentist", amount: 800, categoryId: "med", dueDate: "2026-11-15", repeat: "None", metadata: { v: 1 } };
const part: BillPayment = { id: "p1", billId: "dd", period: "2026-11", date: "2026-11-10", amount: 400, categoryId: "med", accountId: "a" };

describe("part payments", () => {
  it("keeps a part-paid bill due for what's left", () => {
    const [bill] = deriveOccurrences([{ ...dentist, metadata: { v: 1, partial: ["2026-11"] } }], [part], "2026-11-14", "2026-11");
    expect(bill).toMatchObject({ state: "Due", paid: 400, amount: 800 });
    expect(billRemaining(bill)).toBe(400);
    expect(earmarkedByCategory([bill], "2026-11-30")).toEqual({ med: 400 });
  });
  it("settles once part payments reach the amount", () => {
    const [bill] = deriveOccurrences([{ ...dentist, metadata: { v: 1, partial: ["2026-11"] } }], [part, { ...part, id: "p2" }], "2026-11-14", "2026-11");
    expect(bill.state).toBe("Paid"); expect(billRemaining(bill)).toBe(0);
  });
  it("treats a smaller payment without the part mark as paid in full (a cheaper bill)", () => {
    expect(deriveOccurrences([dentist], [part], "2026-11-14", "2026-11")[0].state).toBe("Paid");
  });
  it("validates the part-paid periods in metadata", () => {
    expect(parseBillMetadata('{"v":1,"partial":["2026-11"]}').partial).toEqual(["2026-11"]);
    expect(() => parseBillMetadata('{"v":1,"partial":["nope"]}')).toThrow();
  });
  it("shortfalls and Rebalance pills use what's left, and say it was part paid", () => {
    const due = [{ name: "Dentist", categoryId: "med", amount: 400, dueDate: "2026-11-15", paid: 400 }];
    expect(billShortfalls(due, [{ id: "med", available: 0 }], "2026-11-14").get("med")).toEqual({ name: "Dentist", dueDate: "2026-11-15", short: 400, paid: 400 });
    expect(rebalanceSuggestions({ categories: [{ id: "med", name: "Medical Bills", available: 0 }], bills: due, today: "2026-11-14", formatAmount: String }))
      .toContain("Cover the 400 left on the Dentist bill in Medical Bills");
  });
});

describe("why short", () => {
  const accounts: Account[] = [
    { id: "j", label: "Joined Account", balance: 20, readyToAssign: -8179.5, type: "Joined", icon: "" },
    { id: "h", label: "Hubby Account", balance: 14713, readyToAssign: 8100, type: "Checking", icon: "" },
  ];
  it("adds up to the Joint shortfall", () => {
    const parts = shortfallBreakdown("joint", accounts, { anas: 7000, salma: 1000 }, 100);
    expect(parts.map(p => p.label)).toEqual(["Joint jars hold", "Joined has", "Contributions still to come", "Kept for advances owed back"]);
    const short = parts.reduce((sum, p) => sum + p.sign * p.amount, 0);
    expect(short).toBeCloseTo(8199.5 - 20 - 8000 + 100);
  });
  it("spots account and category reads from different moments", () => {
    const cat = (available: number): Category => ({ id: "t", name: "Transportation", type: [], owner: null, defaultAccount: "j", available, isTeamFund: true, icon: null, planned: 0, lastMonthSpent: null } as Category);
    const joinedOnly = [accounts[0]];
    expect(accountsAgreeWithCategories(joinedOnly, [cat(8199.5)])).toBe(true);
    expect(accountsAgreeWithCategories(joinedOnly, [cat(8929.5)])).toBe(false);
  });
});
