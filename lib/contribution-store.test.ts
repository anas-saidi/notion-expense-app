import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { CONTRIBUTION_DDL, ContributionStore } from "./contribution-store";
const db = new PGlite();
const store = new ContributionStore({ query: async (sql, params) => {
  if (sql === CONTRIBUTION_DDL) { await db.exec(sql); return { rows: [] }; }
  return db.query(sql, params);
} });
beforeAll(async () => { await db.waitReady; }, 20000);
afterAll(async () => { await db.close(); });
it("persists one agreement per month with immutable original values, revision history and household isolation", async () => {
  const first = await store.save("home", "2026-10", { anas: 11638.25, salma: 6266.75 }, { anas: .65, salma: .35 }, null);
  expect(first?.targets.anas).toBe(11638.25);
  expect(await store.save("home", "2026-10", { anas: 0, salma: 0 }, { anas: .65, salma: .35 }, null)).toBeNull();
  const revised = await store.save("home", "2026-10", { anas: 12000, salma: 6266.75 }, { anas: .65, salma: .35 }, first!.version);
  expect(revised?.original.anas).toBe(11638.25);
  expect(revised?.targets.anas).toBe(12000);
  expect(await store.save("home", "2026-10", { anas: 5, salma: 5 }, { anas: .65, salma: .35 }, first!.version)).toBeNull();
  expect(await new ContributionStore({ query: async (sql, params) => { if (sql === CONTRIBUTION_DDL) { await db.exec(sql); return { rows: [] }; } return db.query(sql, params); } }).list("home")).toEqual([revised]);
  expect(await store.list("other-home")).toEqual([]);
  expect((await db.query("SELECT * FROM finance_contribution_agreement_history WHERE scope='home'")).rows).toHaveLength(2);
});
it("retains plan-addition recovery markers through ordinary contribution edits", async () => {
  const shares = { anas: .65, salma: .35 };
  const additions = { operation: { categoryId: "category", amount: 50, shares, state: "completed" as const } };
  const initial = await store.save("amendments", "2026-11", { anas: 100, salma: 50 }, shares, null, additions);
  const revised = await store.save("amendments", "2026-11", { anas: 110, salma: 60 }, shares, initial!.version);
  expect(revised?.planAdditions).toEqual(additions);
  expect(revised?.original).toEqual({ anas: 100, salma: 50 });
});
