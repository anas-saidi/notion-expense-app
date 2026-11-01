import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ pool: vi.fn() }));
vi.mock("pg", () => ({ Pool: mocks.pool }));
import { mirrorConfigured, mirrorStore } from "./mirror/store";
import { contributionPool } from "./contribution-store";
import { balanceCheckStore } from "./balance-check-store";
import { withSavingsFundingLock } from "./savings-funding-lock";
import { mcpOperations } from "./mcp/operations";
import { withMirrorMutation, withMirrorReads } from "./mirror/routes";
import { notionFetchJson } from "./notion-api";
import { scheduleMirrorSync } from "./mirror/sync";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("direct Notion mode opens no database pools, including background sync and dependent writes", async () => {
  vi.stubEnv("FINANCE_NOTION_ONLY", "true");
  vi.stubEnv("DATABASE_URL", "postgres://must-not-connect");
  expect(mirrorConfigured()).toBe(false);
  expect(mirrorStore()).toBeNull();
  expect(() => contributionPool()).toThrow("unavailable");
  expect(() => balanceCheckStore()).toThrow("unavailable");
  expect(() => mcpOperations()).toThrow("unavailable");
  const mutation = vi.fn(async () => Response.json({ success: true }));
  expect((await withMirrorMutation(mutation)()).status).toBe(503);
  expect(mutation).not.toHaveBeenCalled();
  const deposit = vi.fn();
  await expect(withSavingsFundingLock("deposit", deposit)).rejects.toThrow("unavailable");
  expect(deposit).not.toHaveBeenCalled();
  scheduleMirrorSync("token");
  expect(mocks.pool).not.toHaveBeenCalled();
});
it("serves display data from Notion with provenance and never touches Postgres", async () => {
  vi.stubEnv("FINANCE_NOTION_ONLY", "true");
  vi.stubEnv("DATABASE_URL", "postgres://must-not-connect");
  const fetcher = vi.fn().mockResolvedValue(Response.json({ results: [{ id: "live" }] }));
  vi.stubGlobal("fetch", fetcher);
  const response = await withMirrorReads(async () => Response.json((await notionFetchJson("read-only-test", "/databases/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/query", { method: "POST", body: {} })).data))();
  expect(await response.json()).toEqual({ results: [{ id: "live" }] });
  expect(response.headers.get("X-Finance-Data-Source")).toBe("notion");
  expect(fetcher).toHaveBeenCalledOnce();
  expect(mocks.pool).not.toHaveBeenCalled();
});

it("selects Notion durable stores and serialized writes without opening PostgreSQL", async () => {
  vi.stubEnv("FINANCE_NOTION_ONLY", "true");
  vi.stubEnv("DATABASE_URL", "postgres://must-not-connect");
  vi.stubEnv("NOTION_TOKEN", "test");
  vi.stubEnv("NOTION_FINANCE_RECORDS_DB", "finance-records");
  vi.stubEnv("NOTION_SINGLE_WRITER", "true");
  vi.stubEnv("VERCEL", "");
  const { contributionStore } = await import("./contribution-store");
  expect(contributionStore().constructor.name).toBe("NotionContributionStore");
  expect(balanceCheckStore().constructor.name).toBe("NotionBalanceCheckStore");
  expect(mcpOperations().constructor.name).toBe("NotionOperations");
  const write = vi.fn(async () => Response.json({ ok: true }));
  expect((await withMirrorMutation(write)()).status).toBe(200);
  expect(write).toHaveBeenCalledOnce();
  expect(mocks.pool).not.toHaveBeenCalled();
});
