import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ error: new Error("database unavailable") as Error | null, list: vi.fn(), notionError: false }));
vi.mock("../../../lib/mirror/routes", () => ({ withMirrorReads: (handler: unknown) => handler }));
vi.mock("../../../lib/contribution-store", () => ({ contributionStore: () => ({ list: async () => {
  state.list(); if (state.error) throw state.error; return [];
} }) }));
vi.mock("../../../lib/notion-api", () => ({ queryDatabaseAll: async (_: string, id: string) => {
  if (state.notionError) throw new Error("Notion unavailable");
  return id.startsWith("1936") ? [{ properties: { Planned: { number: 100 }, Category: { relation: [{ id: "food" }] } } }]
    : [{ id: "expense", properties: { Name: { title: [] }, Amount: { number: 25 }, Type: { select: { name: "Expense" } }, Date: { date: { start: "2026-10-15" } }, Category: { relation: [{ id: "food" }] } } }];
} }));
import { GET } from "./route";
afterEach(() => { vi.unstubAllEnvs(); state.list.mockClear(); state.error = new Error("database unavailable"); state.notionError = false; });
const request = () => GET(new NextRequest("http://localhost/api/monthly-summary?month=2026-10&includeJointDebt=true"));
it("returns valid Notion totals while explicitly marking database-only contributions unavailable", async () => {
  vi.stubEnv("NOTION_TOKEN", "test");
  const response = await request();
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.summary).toMatchObject({ totalSpent: 25, totalAssigned: 100 });
  expect(data.transactions).toHaveLength(1);
  expect(data.summary.contributionError).toBeTruthy();
  expect(data.summary).not.toHaveProperty("contributionAgreements");
});
it("distinguishes a successful empty agreement read from an unavailable read", async () => {
  vi.stubEnv("NOTION_TOKEN", "test"); state.error = null;
  const data = await (await request()).json();
  expect(data.summary.contributionAgreements).toEqual([]);
  expect(data.summary).not.toHaveProperty("contributionError");
});
it("does not disguise a Notion failure as valid zero totals", async () => {
  vi.stubEnv("NOTION_TOKEN", "test"); state.notionError = true;
  const response = await request();
  expect(response.status).toBe(500);
  expect(await response.json()).not.toHaveProperty("summary");
});
