import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { planningContext } from "../../../../lib/native/planning-context";
import { notionFetchJson } from "../../../../lib/notion-api";
vi.mock("../../../../lib/mirror/routes", () => ({ withMirrorMutation: (handler: unknown) => handler }));
vi.mock("../../../../lib/contribution-store", () => ({ contributionStore: () => ({ list: async () => [{ month: "2026-10" }] }) }));
vi.mock("../../../../lib/native/planning-context", () => ({ planningContext: vi.fn() }));
vi.mock("../../../../lib/notion-api", () => ({ queryDatabaseAll: vi.fn().mockResolvedValue([]), notionFetchJson: vi.fn().mockResolvedValue({ status: 200, data: { id: "fund" } }) }));
const context = (personal: number) => ({ capacity: { joint: -1135, anas: personal, salma: personal }, split: { anas: .65, salma: .35 }, categories: [{ id: "shared", name: "Groceries", type: ["Obligations"], owner: null, defaultAccount: "joint", available: 0, isTeamFund: true }] });
const save = () => POST(new NextRequest("http://localhost/api/monthly-planning/save", { method: "POST", body: JSON.stringify({ month: "2026-11", budgetItems: [{ categoryId: "shared", amount: 1000, defaultAccount: "joint" }] }) }));
beforeEach(() => { vi.stubEnv("NOTION_TOKEN", "test"); vi.stubEnv("DATABASE_URL", "configured"); });
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
it("rejects new plans that consume repayment commitments before writing allocations", async () => {
  vi.mocked(planningContext).mockResolvedValue(context(1000) as any);
  const response = await save();
  expect(response.status).toBe(409);
  expect((await response.json()).error).toContain("advance repayments");
  expect(notionFetchJson).not.toHaveBeenCalled();
});
it("allows a plan when contributions can cover both the advances and new allocations", async () => {
  vi.mocked(planningContext).mockResolvedValue(context(5000) as any);
  expect((await save()).status).toBe(200);
  expect(notionFetchJson).toHaveBeenCalledTimes(1);
});
