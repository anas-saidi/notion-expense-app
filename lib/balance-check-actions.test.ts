import { afterEach, expect, it, vi } from "vitest";
import { changeBalanceCheck } from "./balance-check-actions";
const change = { action: "save" as const, accountId: "account", actualBalance: 20, expectedVersion: "old" };
const check = { accountId: "account", version: "new", actualBalance: 20, estimatedActual: 20 };
afterEach(() => vi.unstubAllGlobals());
it("finishes a confirmed save while the follow-up read remains pending", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ check })); vi.stubGlobal("fetch", fetcher);
  const committed = vi.fn();
  const refresh = vi.fn(() => new Promise<void>(() => {}));
  await changeBalanceCheck(change, { committed, refresh });
  expect(committed).toHaveBeenCalledWith(check);
  expect(refresh).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledOnce();
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(change);
});
it("retains confirmation when a follow-up read fails, without retrying the write", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ check })); vi.stubGlobal("fetch", fetcher);
  const committed = vi.fn(), refreshFailed = vi.fn();
  await changeBalanceCheck(change, { committed, refresh: async () => { throw new Error("read unavailable"); }, refreshFailed });
  await vi.waitFor(() => expect(refreshFailed).toHaveBeenCalledOnce());
  expect(committed).toHaveBeenCalledWith(check);
  expect(fetcher).toHaveBeenCalledOnce();
});
it("preserves rejected and conflicting saves as errors without applying or refreshing them", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Changed on another device" }, { status: 409 })));
  const committed = vi.fn(), refresh = vi.fn();
  await expect(changeBalanceCheck(change, { committed, refresh })).rejects.toThrow("Changed on another device");
  expect(committed).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
});
it("applies a confirmed close immediately without waiting for refresh", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true })));
  const committed = vi.fn();
  await changeBalanceCheck({ ...change, action: "close" }, { committed, refresh: () => new Promise<void>(() => {}) });
  expect(committed).toHaveBeenCalledWith(null);
});
it("does not report a malformed successful response as a saved or closed check", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({})));
  const committed = vi.fn();
  await expect(changeBalanceCheck(change, { committed })).rejects.toThrow("Review the saved check");
  await expect(changeBalanceCheck({ ...change, action: "close" }, { committed })).rejects.toThrow("Review the saved check");
  expect(committed).not.toHaveBeenCalled();
});
