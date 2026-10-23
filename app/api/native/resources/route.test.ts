import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
const fake = vi.hoisted(() => ({ pending: vi.fn(), funds: vi.fn(), activity: vi.fn(), transactions: vi.fn(), sync: vi.fn(), startSync: vi.fn(), bills: vi.fn(), planning: vi.fn(), categories: vi.fn(), accounts: vi.fn() }));
vi.mock("../../pending/route", () => ({ GET: fake.pending }));
vi.mock("../../monthly-planning/funds/route", () => ({ GET: fake.funds }));
vi.mock("../../categories/[id]/activity/route", () => ({ GET: fake.activity }));
vi.mock("../../transactions/route", () => ({ GET: fake.transactions }));
vi.mock("../../sync/route", () => ({ GET: fake.sync, POST: fake.startSync }));
vi.mock("../../bills/route", () => ({ GET: fake.bills }));
vi.mock("../../categories/route", () => ({ GET: fake.categories }));
vi.mock("../../accounts/route", () => ({ GET: fake.accounts }));
vi.mock("../../../../lib/native/planning-context", () => ({ planningContext: fake.planning }));
import { GET, POST } from "./route";
const key = "native-resource-test-key-of-at-least-32-characters";
const request = (query: string, token = key) => new NextRequest(`https://finance.example/api/native/resources?${query}`, { headers: { Authorization: `Bearer ${token}` } });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NATIVE_TOKEN_SHA256", createHash("sha256").update(key).digest("hex")); });
afterEach(() => vi.unstubAllEnvs());
it("authenticates before accessing pending private data or triggering an import", async () => {
  expect((await GET(request("kind=pending", "bad"))).status).toBe(401);
  expect((await POST(request("kind=sync", "bad"))).status).toBe(401);
  expect(fake.pending).not.toHaveBeenCalled(); expect(fake.startSync).not.toHaveBeenCalled();
});
it("rejects arbitrary destinations and invalid category IDs", async () => {
  expect((await GET(request("kind=https://evil.example"))).status).toBe(400);
  expect((await GET(request("kind=activity&id=../../accounts"))).status).toBe(400);
  expect(fake.activity).not.toHaveBeenCalled();
});
it("preserves upstream failures instead of substituting empty data", async () => {
  fake.pending.mockResolvedValue(Response.json({ error: "Notion unavailable" }, { status: 503 }));
  const response = await GET(request("kind=pending"));
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "Notion unavailable" });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
it("exposes only explicit sync as a resource POST action", async () => {
  expect((await POST(request("kind=transactions"))).status).toBe(400);
  fake.startSync.mockResolvedValue(Response.json({ syncing: true }, { status: 202 }));
  expect((await POST(request("kind=sync"))).status).toBe(202);
});
