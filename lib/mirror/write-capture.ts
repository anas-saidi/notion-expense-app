import { AsyncLocalStorage } from "node:async_hooks";
import { waitUntil } from "@vercel/functions";
import { mirrorReadContext } from "./context";
import { slimMirrorPage } from "./slim";
import type { MirrorStore } from "./store";
import { scheduleMirrorSync } from "./sync";

/**
 * Every Notion write made while a write fence is open, observed at the fetch
 * layer so raw-fetch handlers and notionFetchJson are covered alike.
 * `started` counts writes Notion may have applied; `pages` holds the page each
 * successful write returned. The mirror is patched only when both match.
 */
export type WriteCapture = { started: number; pages: any[] };
const shared = globalThis as typeof globalThis & { financeWriteCaptures?: AsyncLocalStorage<WriteCapture> };
const captures = shared.financeWriteCaptures ??= new AsyncLocalStorage<WriteCapture>();
const WRAPPED = Symbol.for("finance.writeCaptureFetch");
// Notion recomputes rollups/formulas on related pages a few seconds after a
// write. Re-read those pages a few times before the settled full import.
export const TARGET_REFRESH_DELAYS_MS = [1_000, 4_000, 10_000];
// A write whose related pages exceed this (for example a category with its
// whole history) keeps the old behavior: live reads until the full import.
export const MAX_RELATED_PAGES = 30;

function notionWritePath(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("https://api.notion.com/v1/")) return null;
  const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
  if (method === "GET" || method === "HEAD") return null;
  const path = new URL(url).pathname.replace(/^\/v1/, "");
  return path.endsWith("/query") || path === "/search" ? null : path;
}

function ensureFetchCapture() {
  const current = globalThis.fetch as typeof fetch & { [WRAPPED]?: true };
  if (current[WRAPPED]) return;
  const wrapped = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
    const capture = captures.getStore();
    if (!capture || !notionWritePath(input, init)) return current(input, init);
    capture.started += 1;
    const response = await current(input, init);
    // Notion rejects 4xx before applying anything; 5xx and network errors may
    // still have written, so they stay counted and block the patch.
    if (response.status >= 400 && response.status < 500) capture.started -= 1;
    else if (response.ok) {
      try {
        const data = await response.clone().json();
        if (data?.object === "page" && typeof data.id === "string") capture.pages.push(data);
      } catch { /* Unreadable body: stays unmatched, so no patch. */ }
    }
    return response;
  }, { [WRAPPED]: true as const });
  globalThis.fetch = wrapped as typeof fetch;
}

export function newWriteCapture(): WriteCapture { return { started: 0, pages: [] }; }
export function captureWrites<T>(capture: WriteCapture, action: () => Promise<T>) {
  ensureFetchCapture();
  return captures.run(capture, action);
}

function relationIds(page: any) {
  const ids: string[] = [];
  for (const property of Object.values<any>(page?.properties ?? {})) {
    if (Array.isArray(property?.relation)) for (const item of property.relation) if (typeof item?.id === "string") ids.push(item.id);
  }
  return ids;
}
const pageKey = (id: string) => id.replace(/-/g, "").toLowerCase();

async function readPages(token: string, ids: string[]) {
  const { notionFetchJson } = await import("../notion-api");
  return mirrorReadContext.run({ enabled: false, sources: new Set(), syncedAt: [], databases: new Map() }, () =>
    Promise.all(ids.map(async id => (await notionFetchJson<any>(token, `/pages/${id}`)).data)));
}

/** Written pages plus the pages they relate to now or related to before. */
export async function collectWriteOverlay(token: string, store: MirrorStore, scope: string, written: any[]) {
  const latest = new Map<string, any>();
  for (const page of written) latest.set(pageKey(page.id), page);
  const pages = [...latest.values()];
  const previous = await store.pagesById(scope, pages.map(page => page.id));
  const targets = new Map<string, string>();
  for (const page of [...pages, ...previous]) {
    for (const id of relationIds(page)) if (!latest.has(pageKey(id))) targets.set(pageKey(id), id);
  }
  if (targets.size > MAX_RELATED_PAGES) return null;
  const related = await readPages(token, [...targets.values()]);
  return { pages: [...pages, ...related].map(slimMirrorPage), targets: [...targets.values()] };
}

function scheduleTargetRefresh(token: string, store: MirrorStore, scope: string, revision: string, targets: string[]) {
  const task = (async () => {
    let expected = revision;
    for (const [index, delay] of TARGET_REFRESH_DELAYS_MS.entries()) {
      await new Promise(resolve => setTimeout(resolve, delay - (TARGET_REFRESH_DELAYS_MS[index - 1] ?? 0)));
      const pages = (await readPages(token, targets)).map(slimMirrorPage);
      const next = await store.refreshPages(scope, expected, pages);
      if (!next) return; // Another write or import owns the snapshot now.
      expected = next;
    }
  })().catch(() => console.error("Financial mirror could not refresh related pages; the settled import still runs"));
  waitUntil(task);
  return task;
}

/**
 * Close a write fence. When every Notion write in it is known, the written
 * pages and their related pages go into the published snapshot in the same
 * transaction that removes the fence, so the next reads stay on the mirror.
 * Otherwise the snapshot stays unpublished until the settled full import.
 */
export async function closeWriteFence(token: string, store: MirrorStore, scope: string, fenceId: string, capture: WriteCapture | null) {
  let overlay: Awaited<ReturnType<typeof collectWriteOverlay>> = null;
  if (capture && capture.started === capture.pages.length) {
    try { overlay = await collectWriteOverlay(token, store, scope, capture.pages); }
    catch { overlay = null; }
  }
  try {
    const result = await store.finishWrite(scope, fenceId, overlay?.pages);
    if (result.applied && result.revision && overlay?.targets.length) scheduleTargetRefresh(token, store, scope, result.revision, overlay.targets);
    return result;
  } finally {
    scheduleMirrorSync(token, true);
  }
}
