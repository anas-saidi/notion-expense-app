import { afterEach, expect, it, vi } from "vitest";
import { fetchApiJson, fetchMonthlyData, loadHomeData } from "./app-data";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("coalesces simultaneous reads but fetches a fresh response on the next refresh", async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(r => { resolve = r; }))
    .mockResolvedValueOnce(Response.json({ balance: 20 }));
  vi.stubGlobal("fetch", fetcher);
  const first = fetchApiJson<{ balance: number }>("/api/test-balance");
  const second = fetchApiJson<{ balance: number }>("/api/test-balance");
  expect(fetcher).toHaveBeenCalledTimes(1);
  resolve(Response.json({ balance: 10 }));
  expect(await Promise.all([first, second])).toEqual([{ balance: 10 }, { balance: 10 }]);
  expect(await fetchApiJson("/api/test-balance")).toEqual({ balance: 20 });
});

it("uses one response for monthly summary and all contribution transactions", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ summary: { totalSpent: 12 }, transactions: [{ id: "transfer" }] })));
  const [summary, history] = await Promise.all([fetchMonthlyData("2026-09"), fetchMonthlyData("2026-09")]);
  expect(summary).toEqual(history);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(vi.mocked(fetch).mock.calls[0][0]).toContain("includeTransactions=true");
});

it("releases Home when essentials are ready even while secondary data is pending", async () => {
  let resolve!: () => void;
  const ready = vi.fn();
  const secondary = new Promise<void>(r => { resolve = r; });
  const loaded = loadHomeData({ essentials: [async () => {}, async () => {}], onReady: ready, secondary: [() => secondary] });
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(ready).toHaveBeenCalledOnce();
  resolve();
  await loaded;
});

it("keeps Home available when a secondary read fails; essentials failing block readiness", async () => {
  const ready = vi.fn();
  const results = await loadHomeData({ essentials: [async () => {}], onReady: ready, secondary: [async () => { throw new Error("monthly unavailable"); }] });
  expect(ready).toHaveBeenCalledOnce();
  expect(results[0].status).toBe("rejected");
  ready.mockClear();
  await expect(loadHomeData({ essentials: [async () => { throw new Error("accounts unavailable"); }], onReady: ready, secondary: [] })).rejects.toThrow("accounts unavailable");
  expect(ready).not.toHaveBeenCalled();
});

it("starts fresh after a mutation and an old read cannot clear the newer in-flight response", async () => {
  const { invalidateFinancialReads } = await import("./app-data");
  const resolves: ((response: Response) => void)[] = [];
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { resolves.push(resolve); }));
  vi.stubGlobal("fetch", fetcher);
  const old = fetchApiJson("/api/mutation-race");
  invalidateFinancialReads();
  const fresh = fetchApiJson("/api/mutation-race");
  resolves[0](Response.json({ balance: 100 })); await old;
  const shared = fetchApiJson("/api/mutation-race");
  expect(fetcher).toHaveBeenCalledTimes(2);
  resolves[1](Response.json({ balance: 90 }));
  expect(await Promise.all([fresh, shared])).toEqual([{ balance: 90 }, { balance: 90 }]);
});
