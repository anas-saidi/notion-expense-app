import { afterEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { signedMirrorRefresh } from "./refresh-auth";
const now = Date.UTC(2026, 10, 3, 10);
const secret = "test-scheduler-secret";
function request(age = 0, key = secret, path = "/api/sync/refresh", method = "GET") {
  const timestamp = String(Math.floor((now - age) / 1000));
  return new Request(`https://notion-expense-app.vercel.app${path}`, { method, headers: {
    "x-finance-refresh-time": timestamp,
    "x-finance-refresh-signature": createHmac("sha256", key).update(`finance-mirror-refresh:GET:/api/sync/refresh:${timestamp}`).digest("hex"),
  } });
}
afterEach(() => vi.unstubAllEnvs());
it("accepts a current task-specific signature without transmitting the reusable secret", () => {
  vi.stubEnv("FINANCE_MIRROR_REFRESH_SECRET", secret);
  const req = request();
  expect(req.headers.get("authorization")).toBeNull();
  expect(signedMirrorRefresh(req, now)).toBe(true);
  expect(signedMirrorRefresh(request(299_000), now)).toBe(true);
});
it("rejects stale, future, incorrect and malformed signatures", () => {
  vi.stubEnv("FINANCE_MIRROR_REFRESH_SECRET", secret);
  expect(signedMirrorRefresh(request(301_000), now)).toBe(false);
  expect(signedMirrorRefresh(request(-31_000), now)).toBe(false);
  expect(signedMirrorRefresh(request(0, "different-secret"), now)).toBe(false);
  const req = request(); req.headers.set("x-finance-refresh-signature", "bad");
  expect(signedMirrorRefresh(req, now)).toBe(false);
  expect(signedMirrorRefresh(new Request(req.url), now)).toBe(false);
});
it("cannot authorize another route or method, or run without configured credentials", () => {
  vi.stubEnv("FINANCE_MIRROR_REFRESH_SECRET", secret);
  expect(signedMirrorRefresh(request(0, secret, "/api/expense"), now)).toBe(false);
  expect(signedMirrorRefresh(request(0, secret, "/api/sync/refresh", "POST"), now)).toBe(false);
  vi.stubEnv("FINANCE_MIRROR_REFRESH_SECRET", "");
  expect(signedMirrorRefresh(request(), now)).toBe(false);
});
