import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { authenticateMcp } from "./auth";
const key = "a-test-connection-key-that-is-long-enough";
const request = (token = key, origin?: string) => new Request("https://finance.example/api/mcp", { headers: { Authorization: `Bearer ${token}`, ...(origin ? { Origin: origin } : {}) } });
afterEach(() => vi.unstubAllEnvs());
describe("MCP authentication", () => {
  it("fails closed when absent or misconfigured", () => {
    vi.stubEnv("MCP_TOKEN_SHA256", "");
    expect(authenticateMcp(request())?.status).toBe(503);
    vi.stubEnv("MCP_TOKEN_SHA256", "invalid");
    expect(authenticateMcp(request())?.status).toBe(503);
  });
  it("accepts only the matching dedicated Bearer key", () => {
    vi.stubEnv("MCP_TOKEN_SHA256", createHash("sha256").update(key).digest("hex"));
    expect(authenticateMcp(request())).toBeNull();
    expect(authenticateMcp(request("wrong-token"))?.status).toBe(401);
    expect(authenticateMcp(new Request("https://finance.example/api/mcp", { headers: { Cookie: "session=something" } }))?.status).toBe(401);
  });
  it("rejects cross-origin browser requests", () => {
    vi.stubEnv("MCP_TOKEN_SHA256", createHash("sha256").update(key).digest("hex"));
    expect(authenticateMcp(request(key, "https://evil.example"))?.status).toBe(403);
    expect(authenticateMcp(request(key, "https://finance.example"))).toBeNull();
  });
});
