import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { notionFetchJson, queryDatabaseAll } from "../../../lib/notion-api";
import { readContributionContext } from "../../../lib/contribution-service";
vi.mock("../../../lib/mirror/routes", () => ({ withMirrorMutation: (handler: unknown) => handler }));
vi.mock("../../../lib/contribution-store", () => ({ contributionPool: () => ({ connect: async () => ({ query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }) }) }));
vi.mock("../../../lib/contribution-service", () => ({ readContributionContext: vi.fn() }));
vi.mock("../../../lib/notion-api", () => ({ notionFetchJson: vi.fn(), queryDatabaseAll: vi.fn() }));
vi.mock("../../../lib/bills", async importOriginal => ({ ...await importOriginal<any>(), billToday: () => "2026-10-31" }));
const requestId = "00000000-0000-4000-8000-000000000001";
const send = (extra = {}) => POST(new NextRequest("http://localhost/api/contribution-repayments", { method: "POST", body: JSON.stringify({ partner: "anas", amount: 300, date: "2026-10-31", requestId, ...extra }) }));
beforeEach(() => {
  vi.stubEnv("NOTION_TOKEN", "test");
  vi.mocked(queryDatabaseAll).mockResolvedValue([]);
  vi.mocked(notionFetchJson).mockImplementation(async (_token, path) => ({ status: 200, data: path.startsWith("/databases/") ? { properties: { "Contribution repayment": { type: "rich_text" } } } : { id: "repayment-id" } }) as any);
  vi.mocked(readContributionContext).mockResolvedValue({ accounts: [ { id: "joint", label: "Joined Account", balance: 494 }, { id: "anas", label: "Hubby Account" } ], ledger: { outstanding: { anas: 820.75, salma: 314.25 } } } as any);
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
it("records a marked transfer, never an expense or contribution", async () => {
  expect((await send()).status).toBe(200);
  expect(vi.mocked(notionFetchJson).mock.calls.find(c => c[1] === "/pages")?.[2]).toMatchObject({ retries: 0, method: "POST", body: { properties: {
    Type: { select: { name: "Transfer" } }, Amount: { number: 300 },
    "🏦 account ( out )": { relation: [{ id: "joint" }] }, "🏦 account ( in )": { relation: [{ id: "anas" }] },
    "Contribution repayment": { rich_text: [{ text: { content: requestId } }] },
  } } });
});
it("returns an existing transfer on retry instead of creating a duplicate", async () => {
  vi.mocked(queryDatabaseAll).mockResolvedValue([{ id: "existing", properties: { Amount: { number: 300 }, Date: { date: { start: "2026-10-31" } }, "🏦 account ( in )": { relation: [{ id: "anas" }] } } }]);
  expect(await (await send()).json()).toEqual({ success: true, id: "existing" });
  expect(vi.mocked(notionFetchJson).mock.calls.some(c => c[1] === "/pages")).toBe(false);
  expect((await send({ amount: 301 })).status).toBe(409);
});
it("rejects payments beyond outstanding advances or recorded cash", async () => {
  expect((await send({ amount: 821 })).status).toBe(409);
  expect((await send({ amount: 500 })).status).toBe(409);
  expect(vi.mocked(notionFetchJson).mock.calls.some(c => c[1] === "/pages")).toBe(false);
});
it("rejects future dates, invalid dates and fractional cents before any write", async () => {
  for (const input of [{ date: "2026-11-01" }, { date: "2026-02-30" }, { amount: 0 }, { amount: 1.001 }, { partner: "other" }]) expect((await send(input)).status).toBe(400);
  expect(notionFetchJson).not.toHaveBeenCalled();
});
