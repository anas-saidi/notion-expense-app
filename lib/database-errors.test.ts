import { expect, it } from "vitest";
import { databaseQuotaFailure } from "./database-errors";

it("identifies provider quota exhaustion without treating other database failures as quota", () => {
  expect(databaseQuotaFailure({ code: "53000", message: "Your account or project has exceeded the quota. Upgrade your plan to increase limits." }))
    .toMatchObject({ code: "DATABASE_QUOTA_EXCEEDED", retryable: false });
  expect(databaseQuotaFailure({ code: "53000", message: "disk full" })).toBeNull();
  expect(databaseQuotaFailure(new Error("connection refused"))).toBeNull();
  expect(databaseQuotaFailure(null)).toBeNull();
});
