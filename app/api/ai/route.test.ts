import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";
import { generateFinanceJSON } from "../../../lib/gemini";
import { readBills } from "../../../lib/notion-bills";
import { queryDatabaseAll } from "../../../lib/notion-api";
import { GET as readAccounts } from "../accounts/route";
vi.mock("../../../lib/gemini", () => ({ generateFinanceJSON: vi.fn() }));
vi.mock("../../../lib/notion-bills", () => ({ readBills: vi.fn() }));
vi.mock("../../../lib/notion-api", () => ({ queryDatabaseAll: vi.fn() }));
vi.mock("../accounts/route", () => ({ GET: vi.fn() }));
const food = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", repair = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const request = (body: unknown, origin = "http://localhost") => new NextRequest("http://localhost/api/ai", { method: "POST", headers: { origin }, body: JSON.stringify(body) });
const page = (id: string, name: string, available: number) => ({ id, properties: { Category: { title: [{ plain_text: name }] }, Available: { number: available }, Type: { multi_select: [{ name: "Team" }] }, "Team Fund": { formula: { boolean: true } } } });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("GEMINI_API_KEY", "fake-key"); vi.stubEnv("NOTION_TOKEN", "fake-token");
  vi.mocked(queryDatabaseAll).mockResolvedValue([page(food, "Groceries", 1000), page(repair, "Repairs", 0)]);
  vi.mocked(readAccounts).mockImplementation(async () => NextResponse.json({ accounts: [], _debug: { matchedProperties: {}, allPropertyNames: [] } }) as unknown as Awaited<ReturnType<typeof readAccounts>>);
  vi.mocked(readBills).mockResolvedValue({ schedules: [], payments: [], today: "2026-10-11" });
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
it("rejects a cross-origin request before invoking the model", async () => {
  expect((await POST(request({ action: "parse", text: "coffee 12" }, "https://elsewhere.test"))).status).toBe(403);
  expect(generateFinanceJSON).not.toHaveBeenCalled();
});
it("returns actionable configuration feedback without requiring Gemini for local parsing", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  expect((await POST(request({ action: "parse", text: "coffee 12" }))).status).toBe(503);
  expect(generateFinanceJSON).not.toHaveBeenCalled();
});
it("parses a draft without reading finance history or writing Notion", async () => {
  vi.mocked(generateFinanceJSON).mockResolvedValue({ transactions: [{ name: "Coffee", amount: 12, date: "2026-10-10", type: "Expense", categoryId: food, accountId: null }], questions: [] });
  const res = await POST(request({ action: "parse", text: "coffee yesterday 12", defaultDate: "2026-10-11", categories: [{ id: food, name: "Groceries" }], accounts: [] }));
  expect(res.status).toBe(200); expect((await res.json()).transactions[0].amount).toBe(12);
  expect(readBills).not.toHaveBeenCalled(); expect(queryDatabaseAll).not.toHaveBeenCalled();
});
it("does not infer that unreadable bills mean no reservations", async () => {
  vi.mocked(readBills).mockRejectedValue(new Error("Bills unavailable"));
  expect((await POST(request({ action: "reallocate", text: "Cover repair", scope: "joint", month: "2026-10" }))).status).toBe(503);
  expect(generateFinanceJSON).not.toHaveBeenCalled();
});
it("passes minimal aliased budget context and restores IDs only after validation", async () => {
  vi.mocked(generateFinanceJSON).mockResolvedValue({ explanation: "Cover repair", moves: [{ fromId: "c0", toId: "c1", amount: 300, reason: "Flexible spending" }] });
  const res = await POST(request({ action: "reallocate", text: "Cover repair", scope: "joint", month: "2026-10" }));
  expect(res.status).toBe(200); expect((await res.json()).moves[0].fromId).toBe(food);
  const context = JSON.stringify(vi.mocked(generateFinanceJSON).mock.calls[0][1]);
  expect(context).not.toContain(food); expect(context).not.toContain("fake-token");
});
it("protects unpaid bill reservations when validating model moves", async () => {
  vi.mocked(readBills).mockResolvedValue({ today: "2026-10-11", payments: [], schedules: [{ id: "bill", name: "Private bill title", categoryId: food, amount: 800, dueDate: "2026-10-15", repeat: "None", metadata: { v: 1 } }] });
  vi.mocked(generateFinanceJSON).mockResolvedValue({ explanation: "Move", moves: [{ fromId: "c0", toId: "c1", amount: 300, reason: "Move money" }] });
  const res = await POST(request({ action: "reallocate", text: "Cover repair", scope: "joint", month: "2026-10" }));
  expect(res.status).toBe(502);
  const context = JSON.stringify(vi.mocked(generateFinanceJSON).mock.calls[0][1]);
  expect(context).toContain('"reserved":800'); expect(context).not.toContain("Private bill title");
});
it("rechecks live balances without a Gemini call or API key", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.mocked(queryDatabaseAll).mockResolvedValue([page(food, "Groceries", 1000), page(repair, "Repairs", 0)]);
  const res = await POST(request({ action: "check", scope: "joint", month: "2026-10", balances: { [food]: 1000, [repair]: 0 }, moves: [{ fromId: food, toId: repair, amount: 300, reason: "Reviewed" }] }));
  expect(res.status).toBe(200); expect(generateFinanceJSON).not.toHaveBeenCalled();
});
it("rejects stale balances at confirmation", async () => {
  vi.mocked(queryDatabaseAll).mockResolvedValue([page(food, "Groceries", 200), page(repair, "Repairs", 0)]);
  const res = await POST(request({ action: "check", scope: "joint", month: "2026-10", balances: { [food]: 1000, [repair]: 0 }, moves: [] }));
  expect(res.status).toBe(409); expect(generateFinanceJSON).not.toHaveBeenCalled();
});
it("returns the category default account and preserves an explicitly matched account", async () => {
  const category = { id: food, name: "Groceries", defaultAccountId: repair };
  const base = { action: "parse", text: "veggies 300", defaultDate: "2026-10-11", categories: [category], accounts: [{ id: repair, name: "Joined Account" }, { id: food, name: "Personal Account" }], defaultAccountId: food };
  const draft = { name: "veggies", amount: 300, date: "2026-10-11", type: "Expense", categoryId: food, accountId: null };
  vi.mocked(generateFinanceJSON).mockResolvedValue({ transactions: [draft], questions: [] });
  expect((await (await POST(request(base))).json()).transactions[0].accountId).toBe(repair);
  expect(vi.mocked(generateFinanceJSON).mock.calls[0][1]).toMatchObject({ categories: [category] });
  vi.mocked(generateFinanceJSON).mockResolvedValue({ transactions: [{ ...draft, accountId: food }], questions: [] });
  expect((await (await POST(request(base))).json()).transactions[0].accountId).toBe(food);
});
