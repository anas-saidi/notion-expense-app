import { AsyncLocalStorage } from "node:async_hooks";
import { mirrorScope, mirrorStore, normalizeDatabaseId } from "./store";
import { queryMirrorPages, UnsupportedMirrorQuery } from "./query";

type ReadContext = { enabled: boolean; sources: Set<string>; syncedAt: string[]; databases: Map<string, Promise<any>> };
export const mirrorReadContext = new AsyncLocalStorage<ReadContext>();
export function mirrorMaxAgeMs() {
  const seconds = Number(process.env.FINANCE_MIRROR_MAX_AGE_SECONDS ?? 900);
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 900) * 1000;
}
export async function mirrorResponse(token: string, path: string, method: string, body: any, allRows = false): Promise<any | undefined> {
  const context = mirrorReadContext.getStore();
  if (!context?.enabled) return undefined;
  const match = path.match(/^\/databases\/([a-f0-9-]+)(\/query)?$/i);
  if (!match || (match[2] ? method !== "POST" : method !== "GET")) return undefined;
  const store = mirrorStore();
  if (!store) { context.sources.add("notion"); return undefined; }
  const databaseId = normalizeDatabaseId(match[1]);
  const key = `${mirrorScope(token)}:${databaseId}:${match[2] ? JSON.stringify(body ?? {}) : "schema"}:${allRows}`;
  let read = context.databases.get(key);
  if (!read) {
    read = store.read(mirrorScope(token), databaseId, mirrorMaxAgeMs(), match[2] ? body ?? {} : undefined, !match[2], allRows).catch(() => null);
    context.databases.set(key, read);
  }
  const row = await read;
  const { scheduleMirrorSync } = await import("./sync");
  if (!row || Date.now() - Date.parse(row.syncedAt) > 60_000) scheduleMirrorSync(token);
  if (!row) { context.sources.add("notion"); return undefined; }
  try {
    const result = match[2] ? (row.data.queryResult ?? queryMirrorPages(row.data.pages, body)) : row.data.schema;
    if (!result) { context.sources.add("notion"); return undefined; }
    context.sources.add("mirror"); context.syncedAt.push(row.syncedAt);
    return { status: 200, data: result };
  } catch (error) {
    if (!(error instanceof UnsupportedMirrorQuery)) throw error;
    context.sources.add("notion"); return undefined;
  }
}
