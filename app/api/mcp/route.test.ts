import { beforeEach, expect, it, vi, afterEach } from "vitest";
import { createHash } from "node:crypto";
const fake = vi.hoisted(() => ({ accounts: vi.fn(), categories: vi.fn(), transactions: vi.fn(), monthlyReport: vi.fn(), write: vi.fn() }));
vi.mock("../../../lib/mcp/finance", () => fake);
import { GET, POST } from "./route";
const key = "test-key-longer-than-thirty-two-characters";
const req = (body: string, auth = true) => new Request("https://finance.example/api/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(auth ? { Authorization: `Bearer ${key}` } : {}) }, body });
beforeEach(() => { vi.stubEnv("MCP_TOKEN_SHA256", createHash("sha256").update(key).digest("hex")); vi.clearAllMocks(); });
afterEach(() => vi.unstubAllEnvs());
it("authenticates before parsing or tool execution, even when local-development cookies exist", async () => {
  expect((await POST(req("invalid", false))).status).toBe(401);
  expect(fake.accounts).not.toHaveBeenCalled(); expect(fake.write).not.toHaveBeenCalled();
});
it("rejects oversized and invalid JSON bodies", async () => {
  expect((await POST(req("x".repeat(65537)))).status).toBe(413);
  expect((await POST(req("invalid"))).status).toBe(400);
});
it("initializes with stateless JSON transport", async () => {
  const response = await POST(req(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } } })));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect((await response.json()).result.serverInfo.name).toBe("couple-finance");
});
it("lists tools on a fresh serverless invocation without in-memory sessions", async () => {
  const response = await POST(req(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })));
  expect(response.status).toBe(200);
  expect((await response.json()).result.tools).toHaveLength(8);
});
it("does not expose public GET or an unauthenticated stream", async () => {
  expect((await GET(new Request("https://finance.example/api/mcp"))).status).toBe(401);
  expect((await GET(new Request("https://finance.example/api/mcp", { headers: { Authorization: `Bearer ${key}` } }))).status).toBe(405);
});
