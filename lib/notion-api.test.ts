import { afterEach, expect, it, vi } from "vitest";
import { notionFetchJson, queryDatabaseAll } from "./notion-api";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const fail = (status: number) => Response.json({ message: `status ${status}` }, { status });

async function run<T>(promise: Promise<T>) {
  vi.useFakeTimers();
  const settled = promise.then((value) => ({ value }), (error) => ({ error }));
  await vi.runAllTimersAsync();
  return settled as Promise<{ value?: T; error?: any }>;
}

it("does not retry a page create after a 5xx, since Notion may have written it", async () => {
  const fetchMock = vi.fn().mockResolvedValue(fail(502));
  vi.stubGlobal("fetch", fetchMock);
  const { error } = await run(notionFetchJson("t", "/pages", { method: "POST", body: {} }));
  expect(error.status).toBe(502);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("does not retry a page create after a network error or timeout", async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));
  vi.stubGlobal("fetch", fetchMock);
  const { error } = await run(notionFetchJson("t", "/pages", { method: "POST", body: {} }));
  expect(error.message).toBe("timeout");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("retries a page create on 429, which Notion rejects before processing", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(fail(429)).mockResolvedValueOnce(Response.json({ id: "p" }));
  vi.stubGlobal("fetch", fetchMock);
  const { value } = await run(notionFetchJson("t", "/pages", { method: "POST", body: {} }));
  expect(value?.data).toEqual({ id: "p" });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("retries queries on 5xx and network errors", async () => {
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new Error("reset"))
    .mockResolvedValueOnce(fail(503))
    .mockResolvedValueOnce(Response.json({ results: [] }));
  vi.stubGlobal("fetch", fetchMock);
  const { value } = await run(notionFetchJson("t", "/databases/db/query", { method: "POST", body: {} }));
  expect(value?.data).toEqual({ results: [] });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("never retries a 4xx", async () => {
  const fetchMock = vi.fn().mockResolvedValue(fail(400));
  vi.stubGlobal("fetch", fetchMock);
  const { error } = await run(notionFetchJson("t", "/databases/db/query", { method: "POST", body: {} }));
  expect(error.status).toBe(400);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("follows next_cursor until every row is loaded", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ results: [{ id: 1 }, { id: 2 }], has_more: true, next_cursor: "c1" }))
    .mockResolvedValueOnce(Response.json({ results: [{ id: 3 }], has_more: false, next_cursor: null }));
  vi.stubGlobal("fetch", fetchMock);
  const rows = await queryDatabaseAll("t", "db", { filter: { x: 1 } });
  expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ filter: { x: 1 }, page_size: 100 });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ filter: { x: 1 }, page_size: 100, start_cursor: "c1" });
});
