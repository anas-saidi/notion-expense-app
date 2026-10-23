import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { authenticateNative } from "./auth";
const key = "native-device-key-with-at-least-32-characters";
const request = (token = key, origin?: string) => new Request("https://finance.example/api/native/snapshot", { headers: { Authorization: `Bearer ${token}`, ...(origin ? { Origin: origin } : {}) } });
afterEach(() => vi.unstubAllEnvs());
describe("native device authentication", () => {
  it("fails closed without a valid server hash", () => {
    vi.stubEnv("NATIVE_TOKEN_SHA256", "");
    expect(authenticateNative(request())?.status).toBe(503);
    vi.stubEnv("NATIVE_TOKEN_SHA256", "invalid");
    expect(authenticateNative(request())?.status).toBe(503);
  });
  it("requires its own bearer key, not a browser cookie", () => {
    vi.stubEnv("NATIVE_TOKEN_SHA256", createHash("sha256").update(key).digest("hex"));
    expect(authenticateNative(request())).toBeNull();
    expect(authenticateNative(request("x".repeat(40)))?.status).toBe(401);
    expect(authenticateNative(new Request("https://finance.example", { headers: { Cookie: "session=anything" } }))?.status).toBe(401);
  });
  it("rejects cross-origin browser access", () => {
    vi.stubEnv("NATIVE_TOKEN_SHA256", createHash("sha256").update(key).digest("hex"));
    expect(authenticateNative(request(key, "https://evil.example"))?.status).toBe(403);
    expect(authenticateNative(request(key, "https://finance.example"))).toBeNull();
  });
});
