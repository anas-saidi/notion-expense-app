import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "./route";
import { assertExpenseFitsBudget } from "@/lib/notion-transactions";
vi.mock("@/lib/notion-transactions", () => ({ assertExpenseFitsBudget: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.mocked(assertExpenseFitsBudget).mockClear(); });
const page = (id: string) => ({ id, properties: {} });
describe("transaction history pagination", () => {
  it("fetches every page for an explicit all-time report", async () => {
    vi.stubEnv("NOTION_TOKEN", "test-token");
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ results: [page("one"), page("two")], has_more: true, next_cursor: "next" }))
      .mockResolvedValueOnce(Response.json({ results: [page("three")], has_more: false }));
    vi.stubGlobal("fetch", fetcher);
    const response = await GET(new NextRequest("http://localhost/api/transactions?all=true&page_size=1"));
    expect((await response.json()).transactions.map((item: { id: string }) => item.id)).toEqual(["one", "two", "three"]);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).start_cursor).toBe("next");
  });
  it("keeps the existing recent-activity cap without all=true", async () => {
    vi.stubEnv("NOTION_TOKEN", "test-token");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ results: [page("one"), page("two")], has_more: true, next_cursor: "next" }));
    vi.stubGlobal("fetch", fetcher);
    const response = await GET(new NextRequest("http://localhost/api/transactions?page_size=1"));
    expect((await response.json()).transactions).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).filter.and).toContainEqual({ property: "Type", select: { does_not_equal: "Due" } });
  });
  it("does not present an incomplete total if a later page fails", async () => {
    vi.stubEnv("NOTION_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ results: [page("one")], has_more: true, next_cursor: "next" })).mockImplementation(() => Promise.resolve(Response.json({ message: "Unavailable" }, { status: 503 }))));
    const response = await GET(new NextRequest("http://localhost/api/transactions?all=true"));
    expect(response.status).toBe(503);
    expect((await response.json()).transactions).toBeUndefined();
  });
});

describe("transaction edits", () => {
  const stored = (type: string) => ({ id: "tx", parent: { type: "database_id", database_id: "1926a2be892280be968aefa6e6dace95" }, properties: { Type: { select: { name: type } } } });
  const patch = (body: object) => PATCH(new NextRequest("http://localhost/api/transactions", { method: "PATCH", body: JSON.stringify(body) }));
  const edit = { id: "tx", name: "Salary", amount: 9000, accountId: "acct", date: "2026-10-01" };

  it("edits income without a category or budget check", async () => {
    vi.stubEnv("NOTION_TOKEN", "test-token");
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(stored("Income")))
      .mockResolvedValueOnce(Response.json({ id: "tx", properties: {} }));
    vi.stubGlobal("fetch", fetcher);
    const response = await patch(edit);
    expect(response.status).toBe(200);
    const properties = JSON.parse(fetcher.mock.calls[1][1].body).properties;
    expect(properties.Amount).toEqual({ number: 9000 });
    expect(properties.Category).toBeUndefined();
    expect(properties.Type).toBeUndefined();
    expect(assertExpenseFitsBudget).not.toHaveBeenCalled();
  });
  it("still requires a category for expenses", async () => {
    vi.stubEnv("NOTION_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(stored("Expense"))));
    expect((await patch(edit)).status).toBe(400);
  });
  it("keeps transfers read-only", async () => {
    vi.stubEnv("NOTION_TOKEN", "test-token");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(stored("Transfer")));
    vi.stubGlobal("fetch", fetcher);
    expect((await patch({ ...edit, categoryId: "cat" })).status).toBe(409);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
