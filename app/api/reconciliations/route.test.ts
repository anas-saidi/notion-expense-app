import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ checks: [] as { accountId: string; version: string }[], closed: [] as string[], closeFails: false }));
vi.mock("../../../lib/mirror/routes", () => ({ withMirrorMutation: (fn: unknown) => fn }));
vi.mock("../../../lib/mirror/store", () => ({ mirrorScope: () => "household" }));
vi.mock("@/lib/notion-api", () => ({ notionFetchJson: async (_: string, path: string) => path.startsWith("/databases/")
  ? { data: { properties: { Account: { type: "relation" }, "Real Balance": { type: "number" }, "Current Balance": { type: "number" }, "Reconciliation Date": { type: "date" }, Name: { type: "title" } } } }
  : { data: { id: "rec-1" } } }));
vi.mock("../../../lib/balance-check-store", () => ({ balanceCheckStore: () => ({
  list: async () => state.checks,
  close: async (_: string, accountId: string) => { if (state.closeFails) throw new Error("down"); state.closed.push(accountId); return true; },
}) }));
import { POST } from "./route";
const accountId = "1936a2be-8922-80d9-8c4d-f1047b5abac0";
const reconcile = () => POST(new NextRequest("http://localhost/api/reconciliations", { method: "POST", body: JSON.stringify({ accountId, actualBalance: 1013, currentBalance: 1492 }) }));
beforeEach(() => { vi.stubEnv("NOTION_TOKEN", "t"); state.checks = [{ accountId: "1936a2be892280d98c4df1047b5abac0", version: "v1" }]; state.closed = []; state.closeFails = false; });

it("closes the account's open balance check so its stale estimate can't reverse the reconciliation", async () => {
  const response = await reconcile();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, balanceCheckClosed: true });
  expect(state.closed).toEqual(["1936a2be892280d98c4df1047b5abac0"]);
});

it("still reports the saved reconciliation when the check can't be closed", async () => {
  state.closeFails = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await reconcile();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, balanceCheckClosed: false });
});
