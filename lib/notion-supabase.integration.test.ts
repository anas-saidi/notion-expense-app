import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { parseEnv } from "node:util";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const fixture = vi.hoisted(() => ({ scope: "", created: [] as string[] }));
vi.mock("./mirror/sync", () => ({ scheduleMirrorSync: vi.fn() }));
vi.mock("./notion-api", async importOriginal => {
  const api = await importOriginal<typeof import("./notion-api")>();
  return { ...api, queryDatabaseAll: async (token: string, database: string, body?: any) => {
    const rows = await api.queryDatabaseAll(token, database, body);
    // Simulate delayed query indexing while page-by-ID reads remain available.
    if (body?.filter?.and?.some((f: any) => f.property === "Scope" && f.rich_text?.equals === fixture.scope)) return [];
    return rows;
  } };
});
import { NotionLedger } from "./notion-ledger";
import { NotionOperations } from "./notion-finance-stores";
import { notionFetchJson } from "./notion-api";
import { coordinationPool } from "./financial-write-coordinator";
import { scheduleMirrorSync } from "./mirror/sync";

const live = process.env.RUN_SUPABASE_INTEGRATION === "true";
beforeAll(() => {
  if (!live) return;
  const env = parseEnv(readFileSync(".env.local", "utf8"));
  for (const key of ["NOTION_TOKEN", "NOTION_FINANCE_RECORDS_DB", "DATABASE_URL", "FINANCE_COORDINATION_DATABASE_URL", "FINANCE_CONTRIBUTION_SCOPE"]) if (env[key]) process.env[key] = env[key];
  process.env.NOTION_SINGLE_WRITER = "false";
  process.env.FINANCE_NOTION_ONLY = "false";
  process.env.VERCEL = "1";
  fixture.scope = `qa:${randomUUID()}`;
});
afterAll(async () => {
  if (!live) return;
  const receipts = await coordinationPool().query("SELECT page_id FROM finance_notion_write_receipts WHERE scope=$1", [fixture.scope]);
  for (const id of new Set([...fixture.created, ...receipts.rows.map(row => row.page_id)])) await notionFetchJson(process.env.NOTION_TOKEN!, `/pages/${id}`, { method: "PATCH", body: { archived: true }, retries: 0 });
  await coordinationPool().query("DELETE FROM finance_notion_write_receipts WHERE scope=$1", [fixture.scope]);
  await coordinationPool().query("DELETE FROM finance_mcp_operations WHERE scope=$1", [fixture.scope]);
  const shared = globalThis as any;
  await shared.financeCoordinationPool?.end();
  await shared.financeMirrorPool?.end();
});

it.runIf(live)("preserves revision history across fresh ledger instances despite delayed Notion indexing", async () => {
  const first = new NotionLedger();
  const created = await first.revise(fixture.scope, "checkpoint", "migration-verification", null, { fixture: true, revision: 1 });
  expect(created).not.toBeNull(); fixture.created.push(created!.id);
  // Query returns no pages. The new instance must use SQL page identities and
  // retrieve actual Notion records, not a process-memory financial fallback.
  const nextInstance = new NotionLedger();
  const visible = await nextInstance.current<any>(fixture.scope, "checkpoint", "migration-verification");
  expect(visible?.version).toBe(created!.version);
  expect(visible?.payload.revision).toBe(1);
  const revised = await nextInstance.revise(fixture.scope, "checkpoint", "migration-verification", created!.version, { fixture: true, revision: 2 });
  expect(revised?.replaces).toBe(created!.version); fixture.created.push(revised!.id);
  expect(await new NotionLedger().revise(fixture.scope, "checkpoint", "migration-verification", created!.version, { fixture: true, revision: 3 })).toBeNull();
  expect((await new NotionLedger().current<any>(fixture.scope, "checkpoint", "migration-verification"))?.payload.revision).toBe(2);
  expect(scheduleMirrorSync).toHaveBeenCalled();
}, 90000);

it.runIf(live)("deduplicates completed and uncertain operations through SQL and Notion receipts", async () => {
  const store = new NotionOperations(), createdAt = new Date().toISOString();
  const run = vi.fn(async () => ({ id: "qa-no-financial-write" }));
  expect(await store.once(fixture.scope, "completed", "qa-check", { fixture: true }, run, createdAt)).toEqual({ id: "qa-no-financial-write" });
  expect(await new NotionOperations().once(fixture.scope, "completed", "qa-check", { fixture: true }, run, createdAt)).toEqual({ id: "qa-no-financial-write" });
  await expect(store.once(fixture.scope, "completed", "qa-check", { fixture: false }, run, createdAt)).rejects.toThrow("different inputs");
  expect(run).toHaveBeenCalledOnce();
  const uncertain = vi.fn(async (): Promise<Record<string, unknown>> => { throw new Error("Synthetic unknown outcome"); });
  await expect(store.once(fixture.scope, "uncertain", "qa-check", {}, uncertain, createdAt)).rejects.toThrow("Synthetic unknown");
  await expect(new NotionOperations().once(fixture.scope, "uncertain", "qa-check", {}, uncertain, createdAt)).rejects.toThrow("pending");
  expect(uncertain).toHaveBeenCalledOnce();
}, 90000);
