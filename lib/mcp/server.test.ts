import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
const fake = vi.hoisted(() => ({ accounts: vi.fn(), categories: vi.fn(), transactions: vi.fn(), monthlyReport: vi.fn(), write: vi.fn() }));
vi.mock("./finance", () => fake);
import { createFinanceMcp } from "./server";
let client: Client;
let server: ReturnType<typeof createFinanceMcp>;
beforeEach(async () => {
  vi.clearAllMocks();
  fake.accounts.mockResolvedValue({ accounts: [], currency: "MAD" });
  fake.write.mockResolvedValue({ success: true, id: "saved" });
  server = createFinanceMcp();
  client = new Client({ name: "test", version: "1" });
  const [a,b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
});
afterEach(async () => { await client.close(); await server.close(); });
describe("Finance MCP tools", () => {
  it("initializes and advertises bounded read/write tools with correct annotations", async () => {
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name)).toEqual(["get_accounts", "list_categories", "list_transactions", "get_monthly_report", "record_expense", "record_income", "rebalance_budget", "get_finance_context"]);
    expect(tools.find(t => t.name === "get_accounts")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find(t => t.name === "record_expense")?.annotations).toMatchObject({ readOnlyHint: false, idempotentHint: true, openWorldHint: false });
  });
  it("returns structured finance reads", async () => {
    expect((await client.callTool({ name: "get_accounts", arguments: {} })).structuredContent).toEqual({ accounts: [], currency: "MAD" });
  });
  it("rejects invalid IDs, dates, fractional cents, and missing write IDs before service calls", async () => {
    for (const input of [
      { amount: 10, date: "2026-02-30" }, { amount: 10.001, date: "2026-10-19" }, { amount: -1, date: "2026-10-19" },
    ]) {
      const result = await client.callTool({ name: "record_expense", arguments: { requestId: "c8aac2ee-d66a-4cc6-bbd8-642a48e682c4", name: "Lunch", accountId: "d99b19b8-4cd8-4d7c-8fea-033cfad0ae77", categoryId: "6dce4cd4-8c79-4513-9f7b-315b118d50be", ...input } });
      expect(result.isError).toBe(true);
    }
    expect((await client.callTool({ name: "record_income", arguments: { name: "Income", amount: 50, date: "2026-10-19", accountId: "bogus" } })).isError).toBe(true);
    expect(fake.write).not.toHaveBeenCalled();
  });
  it("rejects unordered/unbounded reports and invalid months", async () => {
    expect((await client.callTool({ name: "list_transactions", arguments: { start: "2026-10-20", end: "2026-10-01" } })).isError).toBe(true);
    expect((await client.callTool({ name: "list_transactions", arguments: { start: "2020-01-01", end: "2026-10-01" } })).isError).toBe(true);
    expect((await client.callTool({ name: "get_monthly_report", arguments: { month: "2026-13", scope: "joint" } })).isError).toBe(true);
    expect(fake.transactions).not.toHaveBeenCalled(); expect(fake.monthlyReport).not.toHaveBeenCalled();
  });
  it("passes a valid write ID unchanged and returns the verified receipt", async () => {
    const args = { requestId: "c8aac2ee-d66a-4cc6-bbd8-642a48e682c4", name: "Income", amount: 50.25, date: "2026-10-19", accountId: "d99b19b8-4cd8-4d7c-8fea-033cfad0ae77" };
    const result = await client.callTool({ name: "record_income", arguments: args });
    expect(result.structuredContent).toEqual({ success: true, id: "saved" });
    expect(fake.write).toHaveBeenCalledWith("record_income", args);
  });
});
