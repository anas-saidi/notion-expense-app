import { afterEach, describe, expect, it, vi } from "vitest";
import { needsRecheck, payAmount, zakatBillFor, refreshZakatAfterPayment, refreshZakatStatus, reminderFor } from "./zakat-status";

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

describe("zakat status rechecks", () => {
  const at = Date.parse("2026-11-17T20:00:00Z");
  const checked = (minutesAgo: number, overdue: number) => ({ checkedAt: new Date(at - minutesAgo * 60_000).toISOString(), nextDue: "2027-06-25", overdue, overdueSince: overdue ? "2026-07-06" : null });

  it("rechecks an overdue status after a few minutes, a settled one only daily", () => {
    expect(needsRecheck(checked(4, 4280), at)).toBe(false);
    expect(needsRecheck(checked(5, 4280), at)).toBe(true);
    expect(needsRecheck(checked(60, 0), at)).toBe(false);
    expect(needsRecheck(checked(24 * 60, 0), at)).toBe(true);
    expect(needsRecheck(null, at)).toBe(true);
  });
});

describe("zakat refresh after a payment", () => {
  const store = new Map<string, string>();
  const response = (owed: number, paid: number) => ({ schedule: { years: [{ due: "2026-07-06", owed, paid, status: paid >= owed ? "covered" : "overdue" }], current: { due: "2027-06-25" } } });
  const mockFetch = (bodies: any[]) => vi.fn(async () => ({ ok: true, json: async () => bodies.shift() }));

  afterEach(() => { vi.unstubAllGlobals(); store.clear(); });
  const setup = (bodies: any[]) => {
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    vi.stubGlobal("window", { dispatchEvent: () => true });
    vi.stubGlobal("Event", class { constructor(public type: string) {} });
    const fetch = mockFetch(bodies);
    vi.stubGlobal("fetch", fetch);
    store.set("zakatStatus:v1", JSON.stringify({ checkedAt: new Date().toISOString(), nextDue: "2027-06-25", overdue: 4280, overdueSince: "2026-07-06" }));
    return fetch;
  };

  it("keeps checking until Notion lists the payment", async () => {
    const fetch = setup([response(4272, 0), response(4272, 4300)]);
    const status = await refreshZakatAfterPayment([0, 1, 1], async () => {});
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(status?.overdue).toBe(0);
    expect(JSON.parse(store.get("zakatStatus:v1")!).overdue).toBe(0);
  });

  it("does not reuse a check that started before the payment", async () => {
    const fetch = setup([response(4272, 0), response(4272, 4300)]);
    const early = refreshZakatStatus();
    const after = refreshZakatStatus({ fresh: true });
    expect((await early)?.overdue).toBe(4280);
    expect((await after)?.overdue).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("zakat row in Bills", () => {
  const nov = { month: "2026-11", currentMonth: "2026-11", cutoff: "2026-11-30" };
  const settled = { checkedAt: "2026-11-17T20:00:00Z", nextDue: "2027-06-25", overdue: 0, overdueSince: null, estimate: 2180 };

  it("shows overdue zakat in the current month only", () => {
    const overdue = { ...settled, overdue: 4280, overdueSince: "2026-07-06" };
    expect(zakatBillFor(overdue, nov)).toEqual({ state: "Overdue", dueDate: "2026-07-06", amount: 4280, estimated: false });
    expect(zakatBillFor(overdue, { ...nov, month: "2026-12" })).toBeNull();
  });

  it("shows upcoming zakat as an estimate in its due month", () => {
    expect(zakatBillFor(settled, nov)).toBeNull();
    expect(zakatBillFor(settled, { ...nov, month: "2027-06" })).toEqual({ state: "Due", dueDate: "2027-06-25", amount: 2180, estimated: true });
    expect(zakatBillFor(settled, { month: "2027-06", currentMonth: "2027-06", cutoff: "2027-06-30" })?.state).toBe("Due");
  });

  it("stays out without a status or an estimate", () => {
    expect(zakatBillFor(null, nov)).toBeNull();
    expect(zakatBillFor({ ...settled, estimate: undefined }, { ...nov, month: "2027-06" })).toBeNull();
  });
});
