import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { McpOperations, MCP_OPERATIONS_DDL } from "./operations";
const db = new PGlite();
const driver = { query: async (sql: string, params?: any[]) => {
  if (sql === MCP_OPERATIONS_DDL) { await db.exec(sql); return { rows: [] }; }
  return db.query<any>(sql, params);
} };
const store = new McpOperations(driver);
beforeAll(async () => { await db.waitReady; }, 20000);
afterAll(() => db.close());
it("returns the saved receipt without repeating a write, including after a new server instance", async () => {
  const run = vi.fn(async () => ({ success: true, id: "expense" }));
  const first = await store.once("family", "one", "record_expense", { amount: 20 }, run);
  expect(await new McpOperations(driver).once("family", "one", "record_expense", { amount: 20 }, run)).toEqual(first);
  expect(run).toHaveBeenCalledTimes(1);
});
it("rejects changed inputs and tool names for the same request ID", async () => {
  const run = vi.fn(async () => ({ success: true }));
  await store.once("family", "two", "record_expense", { amount: 20 }, run);
  await expect(store.once("family", "two", "record_expense", { amount: 21 }, run)).rejects.toThrow("different inputs");
  await expect(store.once("family", "two", "record_income", { amount: 20 }, run)).rejects.toThrow("different inputs");
  expect(run).toHaveBeenCalledTimes(1);
});
it("never retries an unknown outcome", async () => {
  const run = vi.fn(async () => { throw new Error("network timeout"); });
  await expect(store.once("family", "uncertain", "record_expense", {}, run)).rejects.toThrow("Check activity");
  await expect(store.once("family", "uncertain", "record_expense", {}, run)).rejects.toThrow("outcome is unknown");
  expect(run).toHaveBeenCalledTimes(1);
});
it("one concurrent request claims the action", async () => {
  let finish!: () => void;
  const blocked = new Promise<void>(resolve => { finish = resolve; });
  const run = vi.fn(async () => { await blocked; return { success: true }; });
  const first = store.once("family", "concurrent", "record_income", {}, run);
  await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  await expect(store.once("family", "concurrent", "record_income", {}, run)).rejects.toThrow("pending");
  finish(); await first;
  expect(run).toHaveBeenCalledTimes(1);
});
it("isolates different household connections", async () => {
  const run = vi.fn(async () => ({ success: true }));
  await store.once("other-family", "one", "record_expense", { amount: 20 }, run);
  expect(run).toHaveBeenCalledTimes(1);
});
