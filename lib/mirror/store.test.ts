import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { MIRROR_DDL, MirrorStore, mirrorScope, snapshotFingerprint } from "./store";

const db = new PGlite();
const driver = { query: async (sql: string, params?: any[]) => {
  if (sql === MIRROR_DDL) { await db.exec(sql); return { rows: [] }; }
  return db.query<any>(sql, params);
} };
const store = new MirrorStore(driver);
const snapshot = { abc: { schema: { properties: {} }, pages: [{ id: "one" }] } };
beforeAll(async () => { await db.waitReady; await db.exec(MIRROR_DDL); }, 20000);
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

it("distinguishes an empty published database from a missing or invalid snapshot", async () => {
  const lease = await store.acquire("empty-query");
  await store.publish("empty-query", lease!, { abc: { schema: { properties: {} }, pages: [
    { id: "archived", archived: true }, { id: "trashed", in_trash: true },
  ] } });
  const empty = { results: [], has_more: false, next_cursor: null };
  expect((await store.read("empty-query", "abc", 60000, {}))?.data.queryResult).toEqual(empty);
  expect((await store.read("empty-query", "abc", 60000, {}, false, true))?.data.queryResult).toEqual(empty);
  expect((await store.read("sql-filter", "abc", 60000, { start_cursor: "mirror:100" }))?.data.queryResult).toEqual(empty);
  expect(await store.read("empty-query", "missing", 60000, {})).toBeNull();
  const fence = await store.beginWrite("empty-query");
  expect(await store.read("empty-query", "abc", 60000, {})).toBeNull();
  await store.finishWrite("empty-query", fence);
});

it("reads migrated tables without running schema DDL on a cold driver", async () => {
  const queries: string[] = [];
  const cold = new MirrorStore({ query: async (sql, params) => {
    queries.push(sql);
    if (/\b(CREATE|ALTER|DROP)\b/i.test(sql)) throw new Error("Request-time schema mutation");
    return db.query<any>(sql, params);
  } });
  expect((await cold.read("sql-filter", "abc", 60000, {}, false, true))?.data.queryResult.results).toHaveLength(12);
  expect(queries).toHaveLength(2); // Scope setup and the consistent display read.
});


it("fingerprints complete snapshots without treating object-key order as a change", () => {
  const a = { abc: { schema: { b: 2, a: 1 }, pages: [{ id: "one", properties: { b: 2, a: 1 } }, { id: "two" }] } };
  const reordered = { abc: { pages: [{ properties: { a: 1, b: 2 }, id: "one" }, { id: "two" }], schema: { a: 1, b: 2 } } };
  expect(snapshotFingerprint(a)).toBe(snapshotFingerprint(reordered));
  expect(snapshotFingerprint(a)).not.toBe(snapshotFingerprint({ abc: { ...a.abc, pages: [...a.abc.pages].reverse() } }));
  expect(snapshotFingerprint(a)).not.toBe(snapshotFingerprint({ abc: { ...a.abc, schema: { a: 3, b: 2 } } }));
});

it("renews verified unchanged snapshots without replacing records or schemas", async () => {
  const queries: string[] = [];
  const observed = new MirrorStore({ query: async (sql, params) => { queries.push(sql); return db.query<any>(sql, params); } });
  const first = await observed.acquire("unchanged");
  await observed.publish("unchanged", first!, snapshot);
  await db.query("UPDATE finance_mirror SET synced_at=now()-interval '20 minutes' WHERE scope=$1", ["unchanged"]);
  const second = await observed.acquire("unchanged");
  queries.length = 0;
  await observed.publish("unchanged", second!, snapshot);
  expect(queries.filter(sql => /(?:INSERT INTO|DELETE FROM) finance_mirror_(?:records|schemas)/.test(sql))).toEqual([]);
  const head = (await db.query<any>("SELECT generation,content_generation,lease_id,now()-synced_at < interval '1 minute' AS fresh FROM finance_mirror WHERE scope=$1", ["unchanged"])).rows[0];
  expect(head).toEqual({ generation: first!.id, content_generation: first!.id, lease_id: null, fresh: true });
  expect((await observed.read("unchanged", "abc", 60000))?.data.pages).toEqual(snapshot.abc.pages);
});

it("does not trust a fingerprint left behind by an older publisher", async () => {
  const first = await store.acquire("old-publisher");
  await store.publish("old-publisher", first!, snapshot);
  // Legacy publication changes generation without updating fingerprint metadata.
  await db.query("UPDATE finance_mirror SET content_generation='11111111-1111-4111-8111-111111111111' WHERE scope=$1", ["old-publisher"]);
  const next = await store.acquire("old-publisher");
  await store.publish("old-publisher", next!, snapshot);
  const head = (await db.query<any>("SELECT generation,content_generation FROM finance_mirror WHERE scope=$1", ["old-publisher"])).rows[0];
  expect(head).toEqual({ generation: next!.id, content_generation: next!.id });
});

it("keeps expiry and write fences effective even when content is unchanged", async () => {
  const first = await store.acquire("unchanged-fences");
  await store.publish("unchanged-fences", first!, snapshot);
  const expired = await store.acquire("unchanged-fences");
  await db.query("UPDATE finance_mirror SET synced_at=now()-interval '20 minutes',lease_until=now()-interval '1 second' WHERE scope=$1", ["unchanged-fences"]);
  expect(await store.publish("unchanged-fences", expired!, snapshot)).toBeNull();
  expect(await store.read("unchanged-fences", "abc", 60000)).toBeNull();
  const importing = await store.acquire("unchanged-fences");
  const write = await store.beginWrite("unchanged-fences");
  expect(await store.publish("unchanged-fences", importing!, snapshot)).toBeNull();
  expect(await store.read("unchanged-fences", "abc", 60000)).toBeNull();
  await store.release("unchanged-fences", importing!.id);
  await store.finishWrite("unchanged-fences", write);
});

it("pins a pool connection and rolls back a failure after a partial batch", async () => {
  const first = await store.acquire("rollback-batch");
  await store.publish("rollback-batch", first!, snapshot);
  let batch = 0;
  const release = vi.fn();
  const statements: string[] = [];
  const client = { query: async (sql: string, params?: any[]) => {
    statements.push(sql);
    if (sql.startsWith("INSERT INTO finance_mirror_records") && ++batch === 2) throw new Error("Simulated batch failure");
    return db.query<any>(sql, params);
  }, release };
  const pooled = new MirrorStore({ query: async (sql, params) => {
    if (sql === "BEGIN" || sql.includes("WITH previous") || sql.startsWith("INSERT INTO finance_mirror_records")) throw new Error("Transaction escaped its connection");
    return db.query<any>(sql, params);
  }, connect: async () => client });
  const next = await pooled.acquire("rollback-batch");
  const pages = Array.from({ length: 450 }, (_, i) => ({ id: `new-${i}` }));
  await expect(pooled.publish("rollback-batch", next!, { abc: { schema: {}, pages } })).rejects.toThrow("Simulated batch failure");
  expect(statements[0]).toBe("BEGIN");expect(statements.at(-1)).toBe("ROLLBACK");expect(release).toHaveBeenCalledTimes(1);
  expect((await store.read("rollback-batch", "abc", 60000))?.data.pages).toEqual(snapshot.abc.pages);
  const rows = await db.query<any>("SELECT DISTINCT generation FROM finance_mirror_records WHERE scope=$1", ["rollback-batch"]);
  expect(rows.rows).toEqual([{ generation: first!.id }]);
  await store.release("rollback-batch", next!.id);
});

it("publishes all records across bounded batches, including an empty database", async () => {
  const batches: number[] = [];
  const bounded = new MirrorStore({ query: async (sql, params) => {
    if (sql.startsWith("INSERT INTO finance_mirror_records")) batches.push(params!.length);
    return db.query<any>(sql, params);
  } });
  const pages = Array.from({ length: 505 }, (_, i) => ({ id: String(i) }));
  const lease = await bounded.acquire("bounded-batches");
  await bounded.publish("bounded-batches", lease!, { abc: { schema: {}, pages }, empty: { schema: {}, pages: [] } });
  expect(batches).toEqual([403, 403, 213]);
  expect((await bounded.read("bounded-batches", "abc", 60000))?.data.pages).toEqual(pages);
  expect((await bounded.read("bounded-batches", "empty", 60000))?.data.pages).toEqual([]);
});


it("ignores only Notion database response trace IDs, not financial properties with the same name", () => {
  const a = { abc: { schema: { request_id: "request-a", properties: { request_id: { name: "request_id" } } }, pages: [{ id: "one", request_id: "user-data-a" }] } };
  expect(snapshotFingerprint(a)).toBe(snapshotFingerprint({ abc: { ...a.abc, schema: { ...a.abc.schema, request_id: "request-b" } } }));
  expect(snapshotFingerprint(a)).not.toBe(snapshotFingerprint({ abc: { ...a.abc, pages: [{ id: "one", request_id: "user-data-b" }] } }));
  expect(snapshotFingerprint(a)).not.toBe(snapshotFingerprint({ abc: { ...a.abc, schema: { ...a.abc.schema, properties: { request_id: { name: "Changed property" } } } } }));
});
