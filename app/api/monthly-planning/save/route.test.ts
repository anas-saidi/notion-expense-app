import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const save = (budgetItems = [{ categoryId: "anas-car", amount: 500, defaultAccount: "anas-account" }]) =>
  POST(new NextRequest("http://localhost/api/monthly-planning/save", {
    method: "POST",
    body: JSON.stringify({ month: "2026-10", allowClear: true, budgetItems }),
  }));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("does not report a saved plan when Notion is unconfigured", async () => {
  vi.stubEnv("NOTION_TOKEN", "");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const response = await save();
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining("not saved") });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("retries a rate-limited Anas allocation and saves the remaining categories", async () => {
  vi.stubEnv("NOTION_TOKEN", "test");
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ results: [] }))
    .mockResolvedValueOnce(Response.json({ message: "Rate limited" }, { status: 429 }))
    .mockResolvedValueOnce(Response.json({ id: "car-fund" }))
    .mockResolvedValueOnce(Response.json({ id: "food-fund" }));
  vi.stubGlobal("fetch", fetchMock);
  const response = await save([
    { categoryId: "anas-car", amount: 500, defaultAccount: "anas-account" },
    { categoryId: "anas-food", amount: 900, defaultAccount: "anas-account" },
  ]);
  expect(response.status).toBe(200);
  expect((await response.json()).savedFunds).toEqual([
    { id: "car-fund", categoryId: "anas-car", planned: 500, mode: "created" },
    { id: "food-fund", categoryId: "anas-food", planned: 900, mode: "created" },
  ]);
  expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[2][1].body);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).properties).toMatchObject({
    Planned: { number: 500 }, Date: { date: { start: "2026-10-01" } },
    "🏦 Accounts": { relation: [{ id: "anas-account" }] },
  });
});

it("reports a rejected write as an error", async () => {
  vi.stubEnv("NOTION_TOKEN", "test");
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(Response.json({ results: [] }))
    .mockResolvedValueOnce(Response.json({ message: "Invalid relation" }, { status: 400 })));
  const response = await save();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Invalid relation" });
});

it("queries the month once, follows pagination, and preserves existing updates and explicit clears", async () => {
  vi.stubEnv("NOTION_TOKEN", "batch-test");
  const fund = (id: string, categoryId: string, planned: number) => ({ id, properties: { Category: { relation: [{ id: categoryId }] }, Planned: { number: planned } } });
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ results: [fund("car", "anas-car", 300)], has_more: true, next_cursor: "page2" }))
    .mockResolvedValueOnce(Response.json({ results: [fund("food", "anas-food", 200)], has_more: false }))
    .mockResolvedValueOnce(Response.json({ id: "car" }))
    .mockResolvedValueOnce(Response.json({ id: "food" }))
    .mockResolvedValueOnce(Response.json({ id: "new" }));
  vi.stubGlobal("fetch", fetchMock);
  const response = await save([
    { categoryId: "anas-car", amount: 500, defaultAccount: "anas-account" },
    { categoryId: "anas-food", amount: 0, defaultAccount: "anas-account" },
    { categoryId: "anas-other", amount: 50, defaultAccount: "anas-account" },
  ]);
  expect(response.status).toBe(200);
  expect((await response.json()).savedFunds.map((f: any) => f.mode)).toEqual(["updated", "cleared", "created"]);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/query"))).toHaveLength(2);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).start_cursor).toBe("page2");
  expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ archived: true });
});
