import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mirrorReadContext } from "./mirror/context";
import { notionFetchJson, queryDatabaseAll } from "./notion-api";
import { assertJointIncomeAccount, incomeUseProperties, jointFreeIncomeReserve } from "./notion-joint-income";
import { PROP_INCOME_BASELINE, PROP_INCOME_UNASSIGNED } from "./joint-income";
vi.mock("./notion-api", () => ({ notionFetchJson: vi.fn(), queryDatabaseAll: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const income = (id: string, amount: number, baseline: number) => ({ id, created_time: id, properties: {
  Account: { relation: [{ id: "joint" }] }, Amount: { number: amount },
  [PROP_INCOME_UNASSIGNED]: { checkbox: true }, [PROP_INCOME_BASELINE]: { number: baseline },
} });
describe("persisted free income", () => {
  it("adds only missing metadata and snapshots all-time net allocations", async () => {
    vi.mocked(notionFetchJson).mockResolvedValue({ status: 200, data: { properties: { [PROP_INCOME_UNASSIGNED]: { type: "checkbox" } } } });
    vi.mocked(queryDatabaseAll).mockResolvedValue([{ properties: { Planned: { number: 1200 } } }, { properties: { Planned: { number: 200 }, Reverse: { checkbox: true } } }]);
    expect(await incomeUseProperties("token", "joint", true)).toEqual({ [PROP_INCOME_UNASSIGNED]: { checkbox: true }, [PROP_INCOME_BASELINE]: { number: 1000 } });
    expect(vi.mocked(notionFetchJson).mock.calls[1][2]?.body).toEqual({ properties: { [PROP_INCOME_BASELINE]: { number: {} } } });
    expect(vi.mocked(queryDatabaseAll).mock.calls[0][2]).not.toHaveProperty("filter.and");
  });
  it("rejects an incompatible existing property without creating income", async () => {
    vi.mocked(notionFetchJson).mockResolvedValue({ status: 200, data: { properties: { [PROP_INCOME_UNASSIGNED]: { type: "select" } } } });
    await expect(incomeUseProperties("token", "joint", true)).rejects.toThrow("checkbox");
    expect(queryDatabaseAll).not.toHaveBeenCalled();
  });
  it("reconstructs reserve across month boundaries and edited allocations", async () => {
    vi.mocked(queryDatabaseAll).mockResolvedValueOnce([income("2026-09", 500, 1000), income("2026-10", 200, 1400)])
      .mockResolvedValueOnce([{ properties: { Planned: { number: 1600 } } }]);
    expect(await jointFreeIncomeReserve("token", "joint")).toBe(100);
  });
  it("retains legacy behavior and skips the funds lookup for ordinary income", async () => {
    vi.mocked(queryDatabaseAll).mockResolvedValue([ { properties: { Amount: { number: 500 } } } ]);
    expect(await jointFreeIncomeReserve("token", "joint")).toBe(0);
    expect(queryDatabaseAll).toHaveBeenCalledTimes(1);
  });
  it("fails closed on a missing baseline or unavailable ledger", async () => {
    const page = income("a", 500, 1000); delete (page.properties as any)[PROP_INCOME_BASELINE];
    vi.mocked(queryDatabaseAll).mockResolvedValueOnce([page]).mockResolvedValueOnce([]);
    await expect(jointFreeIncomeReserve("token", "joint")).rejects.toThrow("baseline");
    vi.mocked(queryDatabaseAll).mockRejectedValueOnce(new Error("Unavailable"));
    await expect(jointFreeIncomeReserve("token", "joint")).rejects.toThrow("Unavailable");
  });
  it("restricts free income to a joint spending account belonging to this app", async () => {
    const account = (label: string) => ({ parent: { database_id: "1926a2be-8922-8014-bb54-d9f5e9d1234b" }, properties: { Name: { type: "title", title: [{ plain_text: label }] } } });
    vi.mocked(notionFetchJson).mockResolvedValueOnce({ status: 200, data: account("Joined Account") });
    await expect(assertJointIncomeAccount("token", "joint")).resolves.toBeUndefined();
    vi.mocked(notionFetchJson).mockResolvedValueOnce({ status: 200, data: account("Hubby Account") });
    await expect(assertJointIncomeAccount("token", "anas")).rejects.toThrow("joint spending");
  });
});

describe("Notion-only display cache", () => {
  const displayRead = <T,>(fn: () => Promise<T>) => mirrorReadContext.run({ enabled: true, sources: new Set(), syncedAt: [], databases: new Map() }, fn);
  // One reserve read = the unassigned incomes query, then the all-time funds query.
  const nextReserve = (account: string, assigned: number) => vi.mocked(queryDatabaseAll)
    .mockResolvedValueOnce([{ ...income("2026-10", 500, 1000), properties: { ...income("2026-10", 500, 1000).properties, Account: { relation: [{ id: account }] } } }])
    .mockResolvedValueOnce([{ properties: { Planned: { number: assigned } } }]);
  afterEach(() => { delete process.env.FINANCE_NOTION_ONLY; vi.restoreAllMocks(); });

  it("serves the last value and refreshes it in the background once stale", async () => {
    process.env.FINANCE_NOTION_ONLY = "true";
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    nextReserve("cached", 1100);
    expect(await displayRead(() => jointFreeIncomeReserve("token", "cached"))).toBe(400);
    expect(await displayRead(() => jointFreeIncomeReserve("token", "cached"))).toBe(400);
    expect(queryDatabaseAll).toHaveBeenCalledTimes(2);

    now.mockReturnValue(1_000_000 + 31_000);
    nextReserve("cached", 1300);
    expect(await displayRead(() => jointFreeIncomeReserve("token", "cached"))).toBe(400);
    await vi.waitFor(() => expect(queryDatabaseAll).toHaveBeenCalledTimes(4));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(await displayRead(() => jointFreeIncomeReserve("token", "cached"))).toBe(200);
  });

  it("stays live for writes and when the shared database is on", async () => {
    process.env.FINANCE_NOTION_ONLY = "true";
    nextReserve("live", 1100); nextReserve("live", 1300);
    expect(await jointFreeIncomeReserve("token", "live")).toBe(400);
    expect(await jointFreeIncomeReserve("token", "live")).toBe(200);
    delete process.env.FINANCE_NOTION_ONLY;
    nextReserve("live", 1400);
    expect(await displayRead(() => jointFreeIncomeReserve("token", "live"))).toBe(100);
  });
});
