import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import * as stores from "./store";
import { MIRROR_DDL, MirrorStore, mirrorDatabases, mirrorScope, normalizeDatabaseId } from "./store";
import { withMirrorMutation, withMirrorReads } from "./routes";
import { notionFetchJson, queryDatabaseAll } from "../notion-api";
const db = new PGlite();
const store = new MirrorStore({ query: async (sql, params) => {
  if (sql === MIRROR_DDL) { await db.exec(sql); return { rows: [] }; }
  return db.query<any>(sql, params);
} });
beforeAll(async () => { await db.waitReady; }, 20000);
afterAll(async () => { await db.close(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("serves opted-in paginated display reads entirely from Postgres with provenance", async () => {
  const token = "route-display-test", id = mirrorDatabases().transactions, scope = mirrorScope(token);
  const lease = await store.acquire(scope);
  await store.publish(scope, lease!, { [normalizeDatabaseId(id)]: {
    schema: { properties: {} }, pages: Array.from({ length: 205 }, (_, i) => ({ id: String(i), properties: { Type: { select: { name: "Expense" } } } })),
  } });
  vi.spyOn(stores, "mirrorStore").mockReturnValue(store);
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  const response = await withMirrorReads(async () => Response.json({ rows: await queryDatabaseAll(token, id) }))();
  expect((await response.json()).rows).toHaveLength(205);
  expect(response.headers.get("X-Finance-Data-Source")).toBe("mirror");
  expect(response.headers.get("X-Finance-Synced-At")).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
});

it("uses live reads by default for budget gates even when a mirror is available", async () => {
  vi.spyOn(stores, "mirrorStore").mockReturnValue(store);
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "live" })); vi.stubGlobal("fetch", fetcher);
  expect((await notionFetchJson("budget-gate-test", "/pages/category")).data).toEqual({ id: "live" });
  expect(fetcher).toHaveBeenCalledOnce();
});

it("refuses a write before touching Notion if the shared snapshot cannot be invalidated", async () => {
  vi.stubEnv("NOTION_TOKEN", "write-route-test");
  vi.spyOn(stores, "mirrorStore").mockReturnValue(store);
  vi.spyOn(store, "beginWrite").mockRejectedValue(new Error("database down"));
  const write = vi.fn(async () => Response.json({ success: true }));
  const response = await withMirrorMutation(write)();
  expect(response.status).toBe(503);
  expect(write).not.toHaveBeenCalled();
});
