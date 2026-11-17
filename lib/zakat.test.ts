import { describe, expect, it } from "vitest";
import { addDays, dailyWealth, HAWL_DAYS, zakatSchedule, type LedgerAccount } from "./zakat";

const account = (over: Partial<LedgerAccount> = {}): LedgerAccount => ({
  startDate: "2025-01-01", startingAmount: 0, income: [], expenses: [], transfersIn: [], transfersOut: [], reconciliations: [], ...over,
});
const flat = (value: number) => () => value;

describe("dailyWealth", () => {
  it("adds up like the Current Balance formula, day by day", () => {
    const w = dailyWealth([
      account({ startingAmount: 1000, income: [{ date: "2025-01-02", amount: 500 }], expenses: [{ date: "2025-01-03", amount: 200 }], transfersOut: [{ date: "2025-01-03", amount: 300 }], reconciliations: [{ date: "2025-01-04", amount: -50 }] }),
      account({ transfersIn: [{ date: "2025-01-03", amount: 300 }] }),
    ], "2025-01-01", "2025-01-04");
    expect([...w.values()]).toEqual([1000, 1500, 1300, 1250]);
  });

  it("counts undated entries on the start date and entries before the window", () => {
    const w = dailyWealth([account({ income: [{ date: null, amount: 40 }, { date: "2024-12-01", amount: 60 }] })], "2025-01-01", "2025-01-01");
    expect(w.get("2025-01-01")).toBe(100);
  });
});

describe("zakatSchedule", () => {
  const setup = { hawlStart: "2024-07-28", ledgerStart: "2025-01-31" };

  it("dues fall every 354 days from the hawl start", () => {
    const s = zakatSchedule({ setup, today: "2026-11-17", wealth: flat(100_000), nisab: flat(10_000), payments: [] });
    expect(s.years.map(y => y.due)).toEqual(["2025-07-17", "2026-07-06"]);
    expect(s.current?.due).toBe("2027-06-25");
    expect(s.years[0].owed).toBe(2500);
  });

  it("restarts the hawl the day after wealth comes back above the nisab", () => {
    const wealth = (d: string) => (d >= "2025-03-01" && d <= "2025-03-05" ? 5_000 : 100_000);
    const s = zakatSchedule({ setup, today: "2026-11-17", wealth, nisab: flat(10_000), payments: [] });
    expect(s.breaks).toEqual([{ date: "2025-03-01", wealth: 5_000, nisab: 10_000 }]);
    expect(s.years.map(y => [y.start, y.due])).toEqual([["2025-03-06", addDays("2025-03-06", HAWL_DAYS)]]);
  });

  it("settles the oldest year first and never carries a surplus forward", () => {
    const s = zakatSchedule({ setup, today: "2026-11-17", wealth: flat(100_000), nisab: flat(10_000), payments: [{ date: "2026-07-01", amount: 3_200 }] });
    expect(s.years.map(y => [y.paid, y.status])).toEqual([[3_200, "covered"], [0, "overdue"]]);
  });

  it("marks a part payment", () => {
    const s = zakatSchedule({ setup, today: "2025-12-01", wealth: flat(100_000), nisab: flat(10_000), payments: [{ date: "2025-08-01", amount: 1_000 }] });
    expect(s.years[0].status).toBe("partly paid");
  });

  it("has no current hawl while wealth is below the nisab", () => {
    const s = zakatSchedule({ setup, today: "2025-03-03", wealth: d => (d >= "2025-03-01" ? 1 : 100_000), nisab: flat(10_000), payments: [] });
    expect(s.current).toBeNull();
  });
});
