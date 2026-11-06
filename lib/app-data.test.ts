import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSavedReads, fetchApiJson, fetchMonthlyData, fetchHistoryData, historyReadUrls, loadHomeData, readSavedApiJson, readTimeout, restartFinancialReads } from "./app-data";
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

describe("slow Notion reads", () => {
  it("retries once when a read times out, then succeeds", async () => {
    const ok = { ok: true, status: 200, headers: new Headers(), json: async () => ({ accounts: [] }) };
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockResolvedValueOnce(ok);
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchApiJson("/api/accounts?slow-1")).resolves.toEqual({ accounts: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("gives up after the second timeout with a plain message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")));
    await expect(fetchApiJson("/api/accounts?slow-2")).rejects.toThrow("Notion is slow to respond right now. Try again in a moment.");
    vi.unstubAllGlobals();
  });

  it("gives accounts longer than other reads", () => {
    expect(readTimeout("/api/accounts")).toBe(60000);
    expect(readTimeout("/api/categories")).toBe(30000);
  });
});


it("retries Activity without aborting or replacing a pending Home balance read", async () => {
  const urls: string[] = [];
  const signals = new Map<string, AbortSignal>();
  const resolve = new Map<string, (response: Response) => void>();
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => new Promise<Response>((done, reject) => {
    urls.push(url); signals.set(url, init.signal!); resolve.set(url, done);
    init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  })));
  const home = fetchApiJson("/api/accounts?screen-scope");
  const oldHistory = fetchApiJson("/api/transactions?screen-scope").catch(error => error.name);
  restartFinancialReads(url => url === "/api/transactions?screen-scope");
  expect(signals.get("/api/accounts?screen-scope")!.aborted).toBe(false);
  expect(signals.get("/api/transactions?screen-scope")!.aborted).toBe(true);
  expect(await oldHistory).toBe("AbortError");
  const history = fetchApiJson("/api/transactions?screen-scope");
  expect(fetchApiJson("/api/accounts?screen-scope")).toBe(home);
  expect(urls).toEqual(["/api/accounts?screen-scope", "/api/transactions?screen-scope", "/api/transactions?screen-scope"]);
  resolve.get("/api/accounts?screen-scope")!(Response.json({ accounts: [] }));
  resolve.get("/api/transactions?screen-scope")!(Response.json({ transactions: [] }));
  await Promise.all([home, history]);
});


it("loads Activity directly without waiting for the monthly funds/summary request", async () => {
  const request = vi.fn().mockResolvedValue(Response.json({ transactions: [{ id: "activity-only" }] }));
  vi.stubGlobal("fetch", request);
  const result = await fetchHistoryData({ startMonth: "2026-11", view: "activity" });
  expect(result).toEqual({ transactions: [{ id: "activity-only" }], summary: null });
  expect(request).toHaveBeenCalledOnce();
  expect(request.mock.calls[0][0]).toBe("/api/transactions?start=2026-11-01&end=2026-11-30");
});
it("retains the monthly summary when the visible task is the spending comparison", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ transactions: [], summary: { totalSpent: 20 } })));
  const result = await fetchHistoryData({ startMonth: "2026-10", view: "spending" });
  expect(result.summary).toEqual({ totalSpent: 20 });
  expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/api/monthly-summary?");
});
it("can reuse an already completed matching Home snapshot for Activity", async () => {
  vi.stubGlobal("fetch", vi.fn());
  const snapshot = { month: "2026-11", expires: Date.now() + 10000, data: { transactions: [], funds: [], summary: { totalSpent: 15 } } };
  const result = await fetchHistoryData({ startMonth: "2026-11", view: "activity", snapshot: snapshot as any });
  expect(result.summary).toEqual({ totalSpent: 15 });
  expect(fetch).not.toHaveBeenCalled();
  expect(historyReadUrls("").transactions).toBe("/api/transactions?all=true");
});

describe("device-saved reads", () => {
  const memoryStorage = () => {
    const values = new Map<string, string>();
    return {
      get length() { return values.size; },
      key: (i: number) => [...values.keys()][i] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
  };
  const setup = () => {
    const storage = memoryStorage();
    vi.stubGlobal("window", { dispatchEvent: () => true });
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("CustomEvent", class { constructor(public type: string) {} });
    return storage;
  };

  it("keeps the last good answer for launch reads and revalidates instead of bypassing the cache", async () => {
    setup();
    const fetcher = vi.fn().mockResolvedValue(Response.json({ accounts: [{ id: "a", balance: 10 }] }));
    vi.stubGlobal("fetch", fetcher);
    await fetchApiJson("/api/accounts");
    expect(fetcher.mock.calls[0][1].cache).toBe("no-cache");
    expect(readSavedApiJson("/api/accounts")?.data).toEqual({ accounts: [{ id: "a", balance: 10 }] });
  });

  it("does not keep other reads, failed reads, or answers older than a week", async () => {
    const storage = setup();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ funds: [] }))
      .mockResolvedValueOnce(Response.json({ error: "nope", retryable: false }, { status: 400 })));
    await fetchApiJson("/api/monthly-planning/funds?month=2026-12");
    await expect(fetchApiJson("/api/bills")).rejects.toThrow("nope");
    expect(readSavedApiJson("/api/monthly-planning/funds?month=2026-12")).toBeNull();
    expect(readSavedApiJson("/api/bills")).toBeNull();

    const week = 7 * 24 * 60 * 60 * 1000;
    storage.setItem("finance-read:v1:/api/accounts", JSON.stringify({ savedAt: Date.now() - week, data: { accounts: [] } }));
    expect(readSavedApiJson("/api/accounts")).toBeNull();
  });

  it("clears every saved answer", async () => {
    const storage = setup();
    storage.setItem("theme", "dark");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ bills: [] })));
    await fetchApiJson("/api/bills");
    clearSavedReads();
    expect(readSavedApiJson("/api/bills")).toBeNull();
    expect(storage.getItem("theme")).toBe("dark");
  });
});
