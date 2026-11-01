import { afterEach, expect, it, vi } from "vitest";
import { contributionScope } from "./contribution-scope";
import { mirrorScope } from "./mirror/store";
afterEach(() => vi.unstubAllEnvs());
it("keeps the existing namespace when no stable contribution scope is configured", () => {
  vi.stubEnv("FINANCE_CONTRIBUTION_SCOPE", "");
  expect(contributionScope("old-token")).toBe(mirrorScope("old-token"));
  expect(contributionScope("new-token")).not.toBe(contributionScope("old-token"));
});
it("preserves access to the existing agreements after token rotation without moving other stores", () => {
  const existingScope = mirrorScope("old-token");
  vi.stubEnv("FINANCE_CONTRIBUTION_SCOPE", existingScope);
  expect(contributionScope("new-token")).toBe(existingScope);
  expect(mirrorScope("new-token")).not.toBe(existingScope);
});
it("rejects invalid configuration instead of quietly reading an empty ledger", () => {
  vi.stubEnv("FINANCE_CONTRIBUTION_SCOPE", "wrong-household");
  expect(() => contributionScope("token")).toThrow("contribution namespace is invalid");
});
