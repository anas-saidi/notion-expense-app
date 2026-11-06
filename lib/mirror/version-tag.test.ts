import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import * as stores from "./store";
import { MIRROR_DDL, MirrorStore, mirrorDatabases, mirrorScope, normalizeDatabaseId } from "./store";
import { withMirrorReads } from "./routes";
import { mirrorVersionTag } from "./version-tag";
import { queryDatabaseAll } from "../notion-api";

const db = new PGlite();
const store = new MirrorStore({ query: async (sql, params) => {
  if (sql === MIRROR_DDL) { await db.exec(sql); return { rows: [] }; }
  return db.query<any>(sql, params);
} });
// One household per test: a finished save holds the next import back for the settle window.
let run = 0, token = "", scope = "";
const id = mirrorDatabases().transactions;
const url = "http://localhost/api/transactions?start=2026-11-01&end=2026-11-30";
async function publish(names: string[]) {
  const lease = await store.acquire(scope);
  await store.publish(scope, lease!, { [normalizeDatabaseId(id)]: {
    schema: { properties: {} }, pages: names.map(name => ({ id: name, properties: {} })),
  } });
}
const read = (handler = vi.fn(async (..._args: any[]) => Response.json({ rows: await queryDatabaseAll(token, id) }))) => ({ handler, route: withMirrorReads(handler) });
const get = (etag?: string) => new Request(url, { headers: { cookie: "session=abc", ...(etag ? { "if-none-match": etag } : {}) } });

beforeAll(async () => { await db.waitReady; await db.exec(MIRROR_DDL); }, 20000);
afterAll(async () => { await db.close(); });
beforeEach(() => {
  token = `version-tag-test-${run++}`; scope = mirrorScope(token);
  vi.stubEnv("NOTION_TOKEN", token);
  vi.stubEnv("NOTION_FINANCE_RECORDS_DB", "finance-records-test");
  vi.spyOn(stores, "mirrorStore").mockReturnValue(store);
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("no live Notion in this test"); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("answers an unchanged read with 304 without reading the ledger", async () => {
  await publish(["one", "two"]);
  const first = read();
  const full = await first.route(get());
  const etag = full.headers.get("ETag");
  expect(full.status).toBe(200);
  expect(etag).toMatch(/^W\/"[0-9a-f]{32}"$/);
  expect(full.headers.get("Cache-Control")).toBe("private, no-cache");

  const second = read();
  const cached = await second.route(get(etag!));
  expect(cached.status).toBe(304);
  expect(await cached.text()).toBe("");
  expect(second.handler).not.toHaveBeenCalled();
});

it("sends the full read again once the stored copy changes", async () => {
  await publish(["one"]);
  const before = (await read().route(get())).headers.get("ETag")!;
  await publish(["one", "three"]);
  const after = await read().route(get(before));
  expect(after.status).toBe(200);
  expect((await after.json()).rows).toHaveLength(2);
  expect(after.headers.get("ETag")).not.toBe(before);
});

it("never caches while a save is in progress", async () => {
  await publish(["one"]);
  const etag = (await read().route(get())).headers.get("ETag")!;
  const write = await store.beginWrite(scope);
  try {
    const during = read(vi.fn(async (..._args: any[]) => Response.json({ ok: true })));
    const response = await during.route(get(etag));
    expect(response.status).toBe(200);
    expect(during.handler).toHaveBeenCalledOnce();
    expect(response.headers.get("ETag")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  } finally { await store.finishWrite(scope, write); }
});

it("does not tag reads that came from live Notion or from a Postgres-only setup", async () => {
  await publish(["one"]);
  const live = await read(vi.fn(async (..._args: any[]) => Response.json({ ok: true }))).route(get());
  expect(live.headers.get("ETag")).toBeNull();

  vi.stubEnv("NOTION_FINANCE_RECORDS_DB", "");
  expect(await mirrorVersionTag(get())).toBeNull();
});

it("changes the tag every hour and per session", async () => {
  await publish(["one"]);
  const hour = 3_600_000, base = Math.floor(Date.now() / hour) * hour;
  const a = await mirrorVersionTag(get(), base);
  const sameHour = await mirrorVersionTag(get(), base + hour - 1);
  const nextHour = await mirrorVersionTag(get(), base + hour);
  const otherSession = await mirrorVersionTag(new Request(url, { headers: { cookie: "session=xyz" } }), base);
  expect(sameHour!.etag).toBe(a!.etag);
  expect(nextHour!.etag).not.toBe(a!.etag);
  expect(otherSession!.etag).not.toBe(a!.etag);
});
