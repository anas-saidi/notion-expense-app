import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const page = (id: string, name: string, disabled = false) => ({ id, properties: {
  "Account Name": { type: "title", title: [{ plain_text: name }] },
  "Account Type": { type: "select", select: { name: "Checking" } },
  Disabled: { type: "checkbox", checkbox: disabled },
  "Current Balance": { type: "formula", formula: { type: "number", number: 120 } },
  "Ready to Assign": { type: "rollup", rollup: { type: "number", number: 30 } },
  "Contribution %": { type: "number", number: 50 },
} });

it("maps account row metadata without a schema request, filtering disabled rows across all pages", async () => {
  vi.stubEnv("NOTION_TOKEN", "account-row-types");
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ results: [page("disabled", "Inactive", true), page("z", "Zebra")], has_more: true, next_cursor: "next" }))
    .mockResolvedValueOnce(Response.json({ results: [page("a", "Alpha")], has_more: false }));
  vi.stubGlobal("fetch", fetcher);
  const response = await GET(new NextRequest("http://localhost/api/accounts"));
  expect(response.status).toBe(200);
  const { accounts } = await response.json();
  expect(accounts.map((a: any) => a.id)).toEqual(["a", "z"]);
  expect(accounts[0]).toMatchObject({ label: "Alpha", type: "Checking", balance: 120, readyToAssign: 30, contributionPercent: 50, jointDue: null });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(([url]) => url.endsWith("/query"))).toBe(true);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).start_cursor).toBe("next");
});

it("returns an empty account catalog without needing schema metadata", async () => {
  vi.stubEnv("NOTION_TOKEN", "empty-account-types");
  const fetcher = vi.fn().mockResolvedValue(Response.json({ results: [], has_more: false }));
  vi.stubGlobal("fetch", fetcher);
  expect((await (await GET(new NextRequest("http://localhost/api/accounts"))).json()).accounts).toEqual([]);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
