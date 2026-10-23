import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { assertJointIncomeAccount, incomeUseProperties } from "../../../lib/notion-joint-income";
vi.mock("../../../lib/notion-joint-income", () => ({ assertJointIncomeAccount: vi.fn(), incomeUseProperties: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("NOTION_TOKEN", "test-token"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const save = (incomeUse?: string) => POST(new NextRequest("http://localhost/api/monthly-income", { method: "POST", body: JSON.stringify({ name: "Gift", accountId: "joint", amount: 500, date: "2026-10-12", ...(incomeUse ? { incomeUse } : {}) }) }));
it("preserves the old create payload for income without a choice", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "income" })); vi.stubGlobal("fetch", fetcher);
  const response = await save();
  expect(response.status).toBe(200);
  expect((await response.json()).income.incomeUse).toBe("contributions");
  expect(assertJointIncomeAccount).not.toHaveBeenCalled();
  expect(incomeUseProperties).not.toHaveBeenCalled();
  expect(JSON.parse(fetcher.mock.calls[0][1].body).properties.Type).toEqual({ select: { name: "Income" } });
});
it("persists free income only after account and baseline validation", async () => {
  vi.mocked(incomeUseProperties).mockResolvedValue({ "Unassigned income": { checkbox: true }, "Unassigned allocation baseline": { number: 1000 } });
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "income" })); vi.stubGlobal("fetch", fetcher);
  const response = await save("unassigned");
  expect(response.status).toBe(200);
  expect(assertJointIncomeAccount).toHaveBeenCalledWith("test-token", "joint");
  expect(JSON.parse(fetcher.mock.calls[0][1].body).properties["Unassigned allocation baseline"]).toEqual({ number: 1000 });
  expect((await response.json()).income.incomeUse).toBe("unassigned");
});
it("rejects an unknown use and creates nothing if the baseline cannot be saved", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect((await save("anything")).status).toBe(400);
  vi.mocked(incomeUseProperties).mockRejectedValue(new Error("Notion unavailable"));
  expect((await save("unassigned")).status).toBe(500);
  expect(fetcher).not.toHaveBeenCalled();
});
