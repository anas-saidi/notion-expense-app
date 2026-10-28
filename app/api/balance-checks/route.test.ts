import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { BalanceCheck } from "../../../lib/balance-checks";
const state = vi.hoisted(() => ({ checks: [] as BalanceCheck[], balance: 2000, pages: [] as any[], rejectSave: false }));
vi.mock("../../../lib/notion-accounts", () => ({ readAccountResponse: async () => Response.json({ accounts: [{ id: "a".repeat(32), balance: state.balance }] }) }));
vi.mock("../../../lib/notion-api", () => ({ queryDatabaseAll: async () => state.pages }));
vi.mock("../../../lib/mirror/routes", () => ({ withMirrorReads: (fn: unknown) => fn }));
vi.mock("../../../lib/mirror/store", () => ({ mirrorScope: () => "household" }));
vi.mock("../../../lib/balance-check-store", () => ({ balanceCheckStore: () => ({
  list: async () => state.checks,
  save: async (_: string, check: BalanceCheck) => { if (state.rejectSave) return false; state.checks = [check]; return true; },
  close: async () => { state.checks = []; return true; },
}) }));
import { GET, POST } from "./route";
const accountId = "a".repeat(32);
const post = (body: object) => POST(new NextRequest("http://localhost/api/balance-checks", { method: "POST", body: JSON.stringify({ accountId, ...body }) }));
beforeEach(() => {
  vi.stubEnv("NOTION_TOKEN", "test-token"); state.checks = []; state.balance = 2000; state.pages = []; state.rejectSave = false;
});
it("records a pending actual count without a Notion write and returns a sanitized view", async () => {
  expect((await post({ action: "save", actualBalance: 1650, expectedVersion: null })).status).toBe(200);
  expect(state.checks[0].ledgerBalance).toBe(2000);
  expect(state.checks[0].actualBalance).toBe(1650);
  const response = await GET(); const data = await response.json();
  expect(data.checks[0].estimatedActual).toBe(1650);
  expect(data.checks[0]).not.toHaveProperty("knownTransactionIds");
});
it("rejects empty/non-numeric balances and unknown accounts", async () => {
  expect((await post({ action: "save", actualBalance: "", expectedVersion: null })).status).toBe(400);
  expect((await post({ action: "save", actualBalance: null, expectedVersion: null })).status).toBe(400);
  expect((await post({ action: "save", accountId: "b".repeat(32), actualBalance: 50, expectedVersion: null })).status).toBe(409);
  expect(state.checks).toEqual([]);
});
it("does not let a spouse's stale edit overwrite a newer count", async () => {
  await post({ action: "save", actualBalance: 1650 });
  expect((await post({ action: "save", actualBalance: 1500, expectedVersion: "old" })).status).toBe(409);
  state.rejectSave = true;
  expect((await post({ action: "save", actualBalance: 1500, expectedVersion: state.checks[0].version })).status).toBe(409);
  expect(state.checks[0].actualBalance).toBe(1650);
});
it("cannot resolve a remaining discrepancy; closes only when current ledger and estimated actual match", async () => {
  await post({ action: "save", actualBalance: 1650 });
  const expectedVersion = state.checks[0].version;
  expect((await post({ action: "close", expectedVersion })).status).toBe(409);
  expect(state.checks.length).toBe(1);
  state.balance = 1650;
  expect((await post({ action: "close", expectedVersion })).status).toBe(200);
  expect(state.checks).toEqual([]);
});
it("includes an already-paid missing transaction without reducing actual funds again", async () => {
  await post({ action: "save", actualBalance: 1650 });
  state.pages = [{ id: "new-expense", properties: { Name: { title: [] }, Type: { select: { name: "Expense" } }, Amount: { number: 350 }, Date: { date: { start: state.checks[0].checkedDay } }, Account: { relation: [{ id: accountId }] } } }];
  const data = await (await GET()).json();
  expect(data.checks[0].estimatedActual).toBe(1300);
  const response = await post({ action: "include", transactionId: "new-expense", expectedVersion: state.checks[0].version });
  expect(response.status).toBe(200);
  expect((await response.json()).check.estimatedActual).toBe(1650);
});
