import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
vi.mock("@/lib/notion-transactions", () => ({ assertExpenseFitsBudget: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
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
  });
  it("does not present an incomplete total if a later page fails", async () => {
    vi.stubEnv("NOTION_TOKEN", "test-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ results: [page("one")], has_more: true, next_cursor: "next" })).mockResolvedValueOnce(Response.json({ message: "Unavailable" }, { status: 503 })));
    const response = await GET(new NextRequest("http://localhost/api/transactions?all=true"));
    expect(response.status).toBe(503);
    expect((await response.json()).transactions).toBeUndefined();
  });
});
