import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { MIRROR_DDL, MirrorStore, mirrorScope } from "./store";

const db = new PGlite();
const driver = { query: async (sql: string, params?: any[]) => {
  if (sql === MIRROR_DDL) { await db.exec(sql); return { rows: [] }; }
  return db.query<any>(sql, params);
} };
const store = new MirrorStore(driver);
const snapshot = { abc: { schema: { properties: {} }, pages: [{ id: "one" }] } };
beforeAll(async () => { await db.waitReady; }, 20000);
afterAll(async () => { await db.close(); });

it("atomically publishes complete snapshots and isolates connections", async () => {
  const lease = await store.acquire("household-a");
  expect(lease).not.toBeNull();
  expect(await store.read("household-a", "abc", 60000)).toBeNull();
  expect(await store.publish("household-a", lease!, snapshot)).toBeTruthy();
  expect((await store.read("household-a", "a-b-c", 60000))?.data.pages).toEqual([{ id: "one" }]);
  expect(await store.read("household-b", "abc", 60000)).toBeNull();
  expect(mirrorScope("token-a")).not.toBe(mirrorScope("token-b"));
});

it("allows one importer and rejects an expired owner's commit", async () => {
  const lease = await store.acquire("leases");
  expect(await store.acquire("leases")).toBeNull();
  await db.query("UPDATE finance_mirror SET lease_until=now()-interval '1 second' WHERE scope=$1", ["leases"]);
  const newer = await store.acquire("leases");
  expect(newer).not.toBeNull();
  expect(await store.publish("leases", lease!, snapshot)).toBeNull();
  await store.release("leases", lease!.id);
  expect(await store.acquire("leases")).toBeNull();
  expect(await store.publish("leases", newer!, snapshot)).toBeTruthy();
});

it("replaces schemas and records together and removes old generations", async () => {
  const first = await store.acquire("replacement");
  await store.publish("replacement", first!, snapshot);
  const next = await store.acquire("replacement");
  await store.publish("replacement", next!, { abc: { schema: { properties: { Updated: {} } }, pages: [{ id: "two" }] } });
  const result = await store.read("replacement", "abc", 60000);
  expect(result?.data).toEqual({ schema: { properties: { Updated: {} } }, pages: [{ id: "two" }] });
  const records = await db.query("SELECT generation,page FROM finance_mirror_records WHERE scope=$1", ["replacement"]);
  expect(records.rows).toHaveLength(1);
  expect(records.rows[0]).toMatchObject({ generation: next!.id, page: { id: "two" } });
  expect(await store.publish("replacement", first!, snapshot)).toBeNull();
  expect((await store.read("replacement", "abc", 60000))?.data.pages).toEqual([{ id: "two" }]);
});

it("fences stale snapshots during concurrent writes and rejects pre-write imports", async () => {
  const lease = await store.acquire("write-race");
  await store.publish("write-race", lease!, snapshot);
  const importing = await store.acquire("write-race");
  const writeA = await store.beginWrite("write-race");
  const writeB = await store.beginWrite("write-race");
  expect(await store.read("write-race", "abc", 60000)).toBeNull();
  expect(await store.publish("write-race", importing!, snapshot)).toBeNull();
  await store.release("write-race", importing!.id);
  await store.finishWrite("write-race", writeA);
  expect(await store.acquire("write-race")).toBeNull();
  await store.finishWrite("write-race", writeB);
  expect(await store.acquire("write-race")).toBeNull(); // formula-settling window
  await db.query("UPDATE finance_mirror SET not_before=now()-interval '1 second' WHERE scope=$1", ["write-race"]);
  const fresh = await store.acquire("write-race");
  expect(fresh).not.toBeNull();
  await store.publish("write-race", fresh!, snapshot);
  expect(await store.read("write-race", "abc", 60000)).not.toBeNull();
});

it("falls back rather than serving snapshots past their freshness limit", async () => {
  const lease = await store.acquire("expired");
  await store.publish("expired", lease!, snapshot);
  await db.query("UPDATE finance_mirror SET synced_at=now()-interval '20 minutes' WHERE scope=$1", ["expired"]);
  expect(await store.read("expired", "abc", 900000)).toBeNull();
});

it("recovers abandoned write fences after their expiry", async () => {
  await store.beginWrite("abandoned");
  expect(await store.acquire("abandoned")).toBeNull();
  await db.query("UPDATE finance_mirror_writes SET expires_at=now()-interval '1 second' WHERE scope=$1", ["abandoned"]);
  expect(await store.acquire("abandoned")).not.toBeNull();
});


it("filters and paginates inside Postgres, while full reports use one consistent read", async () => {
  const pages = Array.from({ length: 12 }, (_, i) => ({ id: String(i), properties: {
    Type: { select: { name: i === 11 ? "Due" : "Expense" } },
    Date: { date: { start: `2026-10-${String(i + 1).padStart(2, "0")}` } },
    Category: { relation: [{ id: "abc" }] }, Bill: { relation: i % 2 ? [{ id: "bill" }] : [] },
  } }));
  const lease = await store.acquire("sql-filter");
  await store.publish("sql-filter", lease!, { abc: { schema: { properties: {} }, pages } });
  const body = { filter: { and: [
    { property: "Type", select: { does_not_equal: "Due" } },
    { property: "Date", date: { on_or_after: "2026-10-05" } },
    { property: "Category", relation: { contains: "a-b-c" } },
  ] }, sorts: [{ property: "Date", direction: "descending" }], page_size: 2 };
  const first = (await store.read("sql-filter", "abc", 60000, body))!.data.queryResult;
  expect(first.results.map((p: any) => p.id)).toEqual(["10", "9"]);
  expect(first.has_more).toBe(true);
  const second = (await store.read("sql-filter", "abc", 60000, { ...body, start_cursor: first.next_cursor }))!.data.queryResult;
  expect(second.results.map((p: any) => p.id)).toEqual(["8", "7"]);
  const all = (await store.read("sql-filter", "abc", 60000, body, false, true))!.data.queryResult;
  expect(all.results).toHaveLength(7);
  expect(all.has_more).toBe(false);
  expect(all.next_cursor).toBeNull();
  expect(await store.read("sql-filter", "missing-db", 60000, {})).toBeNull();
});
