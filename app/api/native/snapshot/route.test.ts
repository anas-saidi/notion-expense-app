import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
const fake = vi.hoisted(() => ({ categories: vi.fn(), accounts: vi.fn(), monthly: vi.fn(), bills: vi.fn() }));
vi.mock("../../categories/route", () => ({ GET: fake.categories }));
vi.mock("../../accounts/route", () => ({ GET: fake.accounts }));
vi.mock("../../monthly-summary/route", () => ({ GET: fake.monthly }));
vi.mock("../../bills/route", () => ({ GET: fake.bills }));
import { GET } from "./route";
const key = "native-snapshot-test-key-with-32-characters";
const request = (month = "2026-10", auth = key) => new NextRequest(`https://finance.example/api/native/snapshot?month=${month}`, { headers: { Authorization: `Bearer ${auth}` } });
const category = { id: "food", name: "Food", icon: null, type: ["Team"], owner: null, defaultAccount: "joint", available: null, planned: 100, lastMonthSpent: null, isTeamFund: true };
const account = { id: "joint", label: "Joined Account", icon: "", type: null, balance: 50, readyToAssign: 0 };
const summary = { start: "2026-10-01", end: "2026-10-31", totalAssigned: 100, totalSpent: 25, assignedByCategory: [{ categoryId: "food", total: 100 }], spentByCategory: [{ categoryId: "food", total: 25 }] };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NATIVE_TOKEN_SHA256", createHash("sha256").update(key).digest("hex"));
  fake.categories.mockResolvedValue(Response.json({ categories: [category] }));
  fake.accounts.mockResolvedValue(Response.json({ accounts: [account] }));
  fake.monthly.mockResolvedValue(Response.json({ summary, transactions: [{ id: "one", name: "Food", amount: 25, date: "2026-10-22", category: "food", accountId: "joint", type: "Expense" }] }));
  fake.bills.mockResolvedValue(Response.json({ schedules: [], payments: [], today: "2026-10-22" }));
});
afterEach(() => vi.unstubAllEnvs());
describe("native snapshot", () => {
  it("authenticates before reading private data", async () => {
    expect((await GET(request("2026-10", "bad"))).status).toBe(401);
    expect(fake.categories).not.toHaveBeenCalled();
  });
  it("rejects invalid months before Notion access", async () => {
    expect((await GET(request("2026-13"))).status).toBe(400);
    expect(fake.categories).not.toHaveBeenCalled();
  });
  it("shares web scope semantics and preserves unknown amounts", async () => {
    const response = await GET(request());
    const data = await response.json();
    expect(data.categories[0]).toMatchObject({ scope: "joint", available: null });
    expect(data.accounts[0].scope).toBe("joint");
    expect(data.transactions[0].scopes).toEqual(["joint"]);
    expect(data.summary.totalAssigned).toBe(100);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(fake.monthly.mock.calls[0][0].nextUrl.searchParams.get("includeTransactions")).toBe("true");
  });
  it("preserves a usable snapshot when bills fail", async () => {
    fake.bills.mockResolvedValue(Response.json({ error: "Unavailable" }, { status: 503 }));
    const response = await GET(request());
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.billsError).toContain("unavailable");
    expect(data.accounts).toHaveLength(1);
  });
  it("does not turn primary read errors into empty financial data", async () => {
    fake.accounts.mockResolvedValue(Response.json({ error: "Notion unavailable" }, { status: 503 }));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Notion unavailable" });
  });
});
