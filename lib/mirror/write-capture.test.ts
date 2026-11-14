import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));
import * as stores from "./store";
import * as sync from "./sync";
import { MIRROR_DDL, MirrorStore, mirrorDatabases, mirrorScope, normalizeDatabaseId } from "./store";
import { withMirrorMutation, withMirrorReads } from "./routes";
import { queryDatabaseAll } from "../notion-api";
import { TARGET_REFRESH_DELAYS_MS } from "./write-capture";

const db = new PGlite();
const store = new MirrorStore({ query: (sql, params) => db.query<any>(sql, params) });
const TOKEN = "write-capture-test";
const scope = mirrorScope(TOKEN);
const { transactions, accounts, categories } = mirrorDatabases();
const page = (id: string, database: string, properties: Record<string, any> = {}, extra: Record<string, any> = {}) =>
  ({ object: "page", id, parent: { type: "database_id", database_id: database }, archived: false, in_trash: false, created_by: { id: "u" }, properties, ...extra });
const rel = (...ids: string[]) => ({ type: "relation", relation: ids.map(id => ({ id })) });
const balance = (value: number) => ({ Balance: { type: "formula", formula: { type: "number", number: value } } });

let notion: Map<string, any>;
let calls: string[];
function fakeNotion(overrides: (method: string, path: string, body: any) => Response | undefined = () => undefined) {
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = new URL(input).pathname.replace(/^\/v1/, "");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push(`${method} ${path}`);
    const custom = overrides(method, path, body);
    if (custom) return custom;
    if (method === "GET" && path.startsWith("/pages/")) return Response.json(notion.get(path.slice(7)));
    if (method === "POST" && path === "/pages") {
      const created = page(body.id ?? "new-tx", body.parent.database_id, body.properties);
      notion.set(created.id, created);
      return Response.json(created);
    }
    if (method === "PATCH" && path.startsWith("/pages/")) {
      const id = path.slice(7);
      const updated = { ...notion.get(id), ...("archived" in body ? { archived: body.archived } : {}), properties: { ...notion.get(id).properties, ...body.properties } };
      notion.set(id, updated);
      return Response.json(updated);
    }
    return Response.json({ object: "error" }, { status: 500 });
  }));
}
async function publish(pages: Record<string, any[]>) {
  await db.query("UPDATE finance_mirror SET not_before=NULL, lease_id=NULL, lease_until=NULL WHERE scope=$1", [scope]);
  await db.query("DELETE FROM finance_mirror_writes WHERE scope=$1", [scope]);
  const lease = await store.acquire(scope);
  const snapshot = Object.fromEntries(Object.entries(pages).map(([id, list]) => [normalizeDatabaseId(id), { schema: { properties: {} }, pages: list }]));
  expect(await store.publish(scope, lease!, snapshot)).toBeTruthy();
}
const readAll = (database: string) => withMirrorReads(async () => Response.json(await queryDatabaseAll(TOKEN, database)))();
async function mirrored(database: string) {
  const response = await readAll(database);
  return { source: response.headers.get("X-Finance-Data-Source"), rows: await response.json() as any[] };
}
const createTransaction = withMirrorMutation(async () => {
  const res = await fetch("https://api.notion.com/v1/pages", { method: "POST", body: JSON.stringify({ parent: { database_id: transactions }, properties: { Category: rel("cat-1"), Account: rel("acc-1") } }) });
  return Response.json({ id: (await res.json()).id });
});

beforeAll(async () => { await db.waitReady; await db.exec(MIRROR_DDL); }, 20000);
afterAll(async () => { await db.close(); });
// Background re-reads only run in the test that waits for them.
const DEFAULT_DELAYS = [...TARGET_REFRESH_DELAYS_MS];
beforeEach(async () => {
  TARGET_REFRESH_DELAYS_MS.splice(0, DEFAULT_DELAYS.length, 600_000, 600_000, 600_000);
  vi.stubEnv("NOTION_TOKEN", TOKEN);
  vi.stubEnv("NOTION_FINANCE_RECORDS_DB", "");
  vi.spyOn(stores, "mirrorStore").mockReturnValue(store);
  vi.spyOn(sync, "scheduleMirrorSync").mockImplementation(() => {});
  calls = [];
  const old = page("old-tx", transactions, { Category: rel("cat-1"), Account: rel("acc-1") });
  notion = new Map<string, any>([
    ["old-tx", old],
    ["acc-1", page("acc-1", accounts, balance(500))],
    ["cat-1", page("cat-1", categories, { Available: { type: "formula", formula: { type: "number", number: 80 } } })],
    ["cat-2", page("cat-2", categories, { Available: { type: "formula", formula: { type: "number", number: 40 } } })],
  ]);
  await publish({ [transactions]: [old], [accounts]: [notion.get("acc-1")], [categories]: [notion.get("cat-1"), notion.get("cat-2")] });
  // Notion recomputes the account after the write.
  notion.set("acc-1", page("acc-1", accounts, balance(450)));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("keeps the mirror published after a save, with the new page first and related pages re-read", async () => {
  fakeNotion();
  expect((await createTransaction()).status).toBe(200);
  const tx = await mirrored(transactions);
  expect(tx.source).toBe("mirror");
  expect(tx.rows.map(row => row.id)).toEqual(["new-tx", "old-tx"]);
  expect(tx.rows[0].created_by).toBeUndefined(); // stored slim, like a full import
  const account = await mirrored(accounts);
  expect(account.rows[0].properties.Balance.formula.number).toBe(450);
  expect(calls).toEqual(expect.arrayContaining(["POST /pages", "GET /pages/acc-1", "GET /pages/cat-1"]));
  expect(sync.scheduleMirrorSync).toHaveBeenCalledWith(TOKEN, true);
});

it("re-reads relations the edit removed as well as the ones it added", async () => {
  fakeNotion();
  const move = withMirrorMutation(async () => {
    await fetch("https://api.notion.com/v1/pages/old-tx", { method: "PATCH", body: JSON.stringify({ properties: { Category: rel("cat-2") } }) });
    return Response.json({ ok: true });
  });
  notion.set("cat-1", page("cat-1", categories, { Available: { type: "formula", formula: { type: "number", number: 100 } } }));
  await move();
  expect(calls).toEqual(expect.arrayContaining(["GET /pages/cat-1", "GET /pages/cat-2"]));
  const cats = await mirrored(categories);
  expect(cats.source).toBe("mirror");
  expect(cats.rows.find(row => row.id === "cat-1").properties.Available.formula.number).toBe(100);
  expect((await mirrored(transactions)).rows[0].properties.Category.relation).toEqual([{ id: "cat-2" }]);
});

it("drops an archived page from mirror reads", async () => {
  fakeNotion();
  await withMirrorMutation(async () => {
    await fetch("https://api.notion.com/v1/pages/old-tx", { method: "PATCH", body: JSON.stringify({ archived: true }) });
    return Response.json({ ok: true });
  })();
  const tx = await mirrored(transactions);
  expect(tx.source).toBe("mirror");
  expect(tx.rows).toEqual([]);
});

it("stays fenced when a write's outcome is unknown", async () => {
  fakeNotion((method, path) => method === "POST" && path === "/pages" ? Response.json({ object: "error" }, { status: 502 }) : undefined);
  await createTransaction().catch(() => {});
  expect(await store.read(scope, transactions, 60000, {})).toBeNull();
});

it("stays fenced after a write that returns no page", async () => {
  fakeNotion((method, path) => method === "PATCH" && path.startsWith("/blocks/") ? Response.json({ object: "list", results: [] }) : undefined);
  await withMirrorMutation(async () => {
    await fetch("https://api.notion.com/v1/blocks/old-tx/children", { method: "PATCH", body: "{}" });
    return Response.json({ ok: true });
  })();
  expect(await store.read(scope, transactions, 60000, {})).toBeNull();
});

it("stays fenced when the handler throws", async () => {
  fakeNotion();
  await withMirrorMutation(async () => {
    await fetch("https://api.notion.com/v1/pages", { method: "POST", body: JSON.stringify({ parent: { database_id: transactions }, properties: {} }) });
    throw new Error("boom");
  })().catch(() => {});
  expect(await store.read(scope, transactions, 60000, {})).toBeNull();
});

it("keeps the mirror published when Notion rejected the only write", async () => {
  fakeNotion(method => method === "POST" ? Response.json({ object: "error" }, { status: 400 }) : undefined);
  await createTransaction();
  expect((await mirrored(transactions)).rows.map(row => row.id)).toEqual(["old-tx"]);
});

it("does not patch a snapshot that was already stale or shared with another open write", async () => {
  fakeNotion();
  const other = await store.beginWrite(scope);
  await createTransaction();
  await store.finishWrite(scope, other);
  expect(await store.read(scope, transactions, 60000, {})).toBeNull();
  // Still stale: a later save cannot republish an incomplete snapshot.
  await db.query("UPDATE finance_mirror SET not_before=NULL WHERE scope=$1", [scope]);
  await createTransaction();
  expect(await store.read(scope, transactions, 60000, {})).toBeNull();
});

it("changes the version tag when a save patches the same generation", async () => {
  fakeNotion();
  const before = await store.version(scope, 60000);
  await createTransaction();
  const after = await store.version(scope, 60000);
  expect(after?.generation).toBe(before?.generation);
  expect(after?.revision).not.toBe(before?.revision);
});

it("re-reads related pages again after Notion recomputes, unless something else changed the snapshot", async () => {
  TARGET_REFRESH_DELAYS_MS.splice(0, 3, 50, 1500, 3000);
  try {
    fakeNotion();
    await createTransaction();
    notion.set("acc-1", page("acc-1", accounts, balance(425)));
    await vi.waitFor(async () => expect((await mirrored(accounts)).rows[0].properties.Balance.formula.number).toBe(425), { timeout: 3000 });
    const write = await store.beginWrite(scope);
    notion.set("acc-1", page("acc-1", accounts, balance(1)));
    calls = [];
    await vi.waitFor(() => expect(calls).toContain("GET /pages/acc-1"), { timeout: 4000 });
    await new Promise(resolve => setTimeout(resolve, 300));
    await store.finishWrite(scope, write);
    const raw = await db.query<any>("SELECT page FROM finance_mirror_records WHERE scope=$1 AND page->>'id'='acc-1'", [scope]);
    expect(raw.rows[0].page.properties.Balance.formula.number).toBe(425);
  } finally { TARGET_REFRESH_DELAYS_MS.splice(0, 3, ...DEFAULT_DELAYS); }
}, 15000);
