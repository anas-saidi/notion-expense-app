import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const transaction = (id: string, type: string, amount: number, category: string | null) => ({ id, properties: {
  Type: { select: { name: type } }, Amount: { number: amount },
  Category: { relation: category ? [{ id: category }] : [] }, Date: { date: { start: "2026-09-15" } },
} });
it("shares fully paginated transactions while excluding transfers, income, and uncategorized expenses from spending", async () => {
  vi.stubEnv("NOTION_TOKEN", "summary-test");
  const fetcher = vi.fn().mockImplementation(async (url: string, options: any) => {
    const body = JSON.parse(options.body);
    if (url.includes("1936a2be")) return Response.json({ results: [
      { properties: { Planned: { number: 100 }, Category: { relation: [{ id: "food" }] } } },
      { properties: { Planned: { number: 20 }, Reverse: { checkbox: true }, Category: { relation: [{ id: "food" }] } } },
    ] });
    return Response.json(body.start_cursor
      ? { results: [transaction("expense2", "Expense", 7, "food")], has_more: false }
      : { results: [transaction("expense", "Expense", 10, "food"), transaction("income", "Income", 100, "food"), transaction("transfer", "Transfer", 50, null), transaction("uncategorized", "Expense", 20, null)], has_more: true, next_cursor: "next" });
  });
  vi.stubGlobal("fetch", fetcher);
  const response = await GET(new NextRequest("http://localhost/api/monthly-summary?month=2026-09&includeTransactions=true"));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.summary).toMatchObject({ totalSpent: 17, totalAssigned: 80, spentByCategory: [{ categoryId: "food", total: 17, accountId: null }] });
  expect(data.funds).toEqual([
    { categoryId: "food", planned: 100, reverse: false },
    { categoryId: "food", planned: 20, reverse: true },
  ]);
  expect(data.transactions.map((t: any) => t.id)).toEqual(["expense", "income", "transfer", "uncategorized", "expense2"]);
  expect(fetcher).toHaveBeenCalledTimes(3);
  const transactionQuery = JSON.parse(fetcher.mock.calls[1][1].body);
  expect(transactionQuery.filter.and).toHaveLength(2);
});
