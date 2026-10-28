import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { BALANCE_CHECK_DDL, BalanceCheckStore } from "./balance-check-store";
import type { BalanceCheck } from "./balance-checks";
const db = new PGlite();
const store = new BalanceCheckStore({ query: async (sql, params) => {
  if (sql === BALANCE_CHECK_DDL) { await db.exec(sql); return { rows: [] }; }
  return db.query(sql, params);
} });
const check: BalanceCheck = { accountId: "account", version: "one", actualBalance: 1650, ledgerBalance: 2000,
  checkedAt: "2026-10-28T12:00:00Z", checkedDay: "2026-10-28", knownTransactionIds: ["old"] };
beforeAll(async () => { await db.waitReady; }, 20000);
afterAll(async () => { await db.close(); });
it("shares a durable check by household while isolating other households", async () => {
  expect(await store.save("household", check, null)).toBe(true);
  expect(await store.list("household")).toEqual([check]);
  expect(await store.list("another-household")).toEqual([]);
});
it("rejects concurrent overwrites and stale resolution, then allows a new check after closure", async () => {
  expect(await store.save("household", { ...check, version: "two" }, null)).toBe(false);
  expect(await store.save("household", { ...check, version: "two" }, "one")).toBe(true);
  expect(await store.save("household", { ...check, version: "stale" }, "one")).toBe(false);
  expect(await store.close("household", "account", "one")).toBe(false);
  expect(await store.close("household", "account", "two")).toBe(true);
  expect(await store.list("household")).toEqual([]);
  expect(await store.save("household", { ...check, version: "three" }, null)).toBe(true);
});
