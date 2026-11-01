import { afterEach, expect, it, vi } from "vitest";
import { fetchApiJson, fetchMonthlyData, loadHomeData, restartFinancialReads } from "./app-data";
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

it("does not automatically retry exhausted quota, but a manual retry can recover", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ error: "Shared database quota exceeded", code: "DATABASE_QUOTA_EXCEEDED", retryable: false }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ balance: 20 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(fetchApiJson("/api/quota-recovery")).rejects.toThrow("Shared database quota exceeded");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(await fetchApiJson("/api/quota-recovery")).toEqual({ balance: 20 });
});

it("still retries a transient service failure", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: "Temporarily unavailable" }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ balance: 30 }));
  vi.stubGlobal("fetch", fetcher);
  const request = fetchApiJson("/api/transient-recovery");
  await vi.runAllTimersAsync();
  expect(await request).toEqual({ balance: 30 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});


it("manual recovery aborts a stalled read and a retry gets a fresh response", async () => {
  let oldSignal!: AbortSignal;
  const fetcher = vi.fn().mockImplementationOnce((_url, options) => {
    oldSignal = options.signal;
    return new Promise((_resolve, reject) => oldSignal.addEventListener("abort", () => reject(oldSignal.reason), { once: true }));
  }).mockResolvedValueOnce(Response.json({ balance: 42 }));
  vi.stubGlobal("fetch", fetcher);
  const old = fetchApiJson("/api/stalled-recovery");
  const rejected = expect(old).rejects.toMatchObject({ name: "AbortError" });
  restartFinancialReads();
  const fresh = fetchApiJson("/api/stalled-recovery");
  await rejected;
  expect(oldSignal.aborted).toBe(true);
  expect(await fresh).toEqual({ balance: 42 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("manual recovery prevents an abandoned transient read from retrying after backoff", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Busy" }, { status: 503 })));
  const old = fetchApiJson("/api/backoff-recovery");
  const rejected = expect(old).rejects.toMatchObject({ name: "AbortError" });
  await vi.advanceTimersByTimeAsync(0);
  restartFinancialReads();
  await vi.runAllTimersAsync();
  await rejected;
  expect(fetch).toHaveBeenCalledTimes(1);
});
