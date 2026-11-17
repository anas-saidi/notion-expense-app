import { describe, expect, it } from "vitest";
import { payAmount, reminderFor } from "./zakat-status";

const now = new Date("2027-05-26T10:00:00Z");
const base = { checkedAt: now.toISOString(), nextDue: "2027-06-25", overdue: 0, overdueSince: null };

describe("zakat reminder", () => {
  it("rounds what's owed up to the next 10 MAD", () => {
    expect(payAmount(4272.07)).toBe(4280);
    expect(payAmount(2335.69, 3200)).toBe(0);
  });

  it("reminds about overdue zakat first", () => {
    expect(reminderFor({ ...base, overdue: 4280, overdueSince: "2026-07-06" }, now)).toEqual({ kind: "overdue", amount: 4280, since: "2026-07-06" });
  });

  it("reminds from 30 days before the due date, not earlier", () => {
    expect(reminderFor(base, now)).toEqual({ kind: "soon", due: "2027-06-25", days: 30 });
    expect(reminderFor(base, new Date("2027-05-25T10:00:00Z"))).toBeNull();
  });

  it("stays quiet without a status or a running hawl", () => {
    expect(reminderFor(null, now)).toBeNull();
    expect(reminderFor({ ...base, nextDue: null }, now)).toBeNull();
  });
});
