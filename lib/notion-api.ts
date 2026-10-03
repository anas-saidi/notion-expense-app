import { mirrorResponse } from "./mirror/context";
const NOTION_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

type NotionFetchOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  cache?: RequestCache;
  retries?: number;
  timeoutMs?: number;
  /** Internal display-report hint: retrieve matching mirror rows atomically. */
  _mirrorAllRows?: boolean;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Pace starts per connection within this server process. Serverless instances have
// independent queues; Retry-After is still authoritative for shared limits.
type RequestQueue = { tail: Promise<void>; nextStart: number; pausedUntil: number };
const notionState = globalThis as typeof globalThis & { financeNotionQueues?: Map<string, RequestQueue> };
const queues = notionState.financeNotionQueues ??= new Map<string, RequestQueue>();
async function scheduleRequest(token: string) {
  let queue = queues.get(token);
  if (!queue) {
    queue = { tail: Promise.resolve(), nextStart: 0, pausedUntil: 0 };
    queues.set(token, queue);
  }
  const state = queue;
  const turn = state.tail.then(async () => {
    let delay: number;
    while ((delay = Math.max(state.nextStart, state.pausedUntil) - Date.now()) > 0) await wait(delay);
    state.nextStart = Date.now() + 350;
  });
  state.tail = turn.catch(() => {});
  await turn;
}

const schemas = new Map<string, { expires: number; promise: Promise<any> }>();
/** Cache metadata only, never financial balances. Failed reads are not cached. */
export async function readDatabaseSchema(token: string, databaseId: string): Promise<any> {
  const mirrored = await mirrorResponse(token, `/databases/${databaseId}`, "GET", undefined);
  if (mirrored !== undefined) return mirrored.data;
  const key = `${token}:${databaseId}`;
  const cached = schemas.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  if (schemas.size >= 100) {
    for (const [id, entry] of schemas) if (entry.expires <= Date.now()) schemas.delete(id);
    if (schemas.size >= 100) schemas.delete(schemas.keys().next().value!);
  }
  const promise = notionFetchJson<any>(token, `/databases/${databaseId}`).then(result => result.data);
  const entry = { expires: Date.now() + 5 * 60_000, promise };
  schemas.set(key, entry);
  void promise.catch(() => { if (schemas.get(key) === entry) schemas.delete(key); });
  return promise;
}

export async function notionFetchJson<T>(
  token: string,
  path: string,
  {
    method = "GET",
    body,
    cache = "no-store",
    retries = 2,
    timeoutMs = 15000,
    _mirrorAllRows = false,
  }: NotionFetchOptions = {},
): Promise<{ status: number; data: T }> {
  const mirrored = await mirrorResponse(token, path, method, body, _mirrorAllRows);
  if (mirrored !== undefined) return mirrored;
  // Creating a page is not idempotent: after a timeout, network error or 5xx
  // Notion may already have written it, so only 429 (rejected before
  // processing) is safe to retry. Reads, queries and PATCHes can be repeated.
  const isCreate = method === "POST" && !path.endsWith("/query");
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const canRetry = attempt < retries;
    let response: Response;
    let data: any;
    try {
      await scheduleRequest(token);
      response = await fetch(`${NOTION_BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        cache,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      data = await response.json();
    } catch (error) {
      lastError = error;
      if (canRetry && !isCreate) {
        await wait(350 * (attempt + 1));
        continue;
      }
      break;
    }

    if (response.ok) {
      return { status: response.status, data: data as T };
    }

    const message =
      typeof data?.message === "string"
        ? data.message
        : `Notion request failed with status ${response.status}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    lastError = error;

    const retryable = response.status === 429 || (response.status >= 500 && !isCreate);
    if (retryable && canRetry) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? data?.additional_data?.retry_after);
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 350 * 2 ** attempt;
      const queue = queues.get(token)!;
      queue.pausedUntil = Math.max(queue.pausedUntil, Date.now() + delay);
      await wait(delay);
      continue;
    }
    throw error;
  }

  throw lastError instanceof Error ? lastError : new Error("Notion request failed");
}

/**
 * Query a database and follow `next_cursor` until every matching row is
 * loaded. Use this whenever the results are summed — a single page silently
 * stops at 100 rows.
 */
export async function queryDatabaseAll<T = any>(
  token: string,
  databaseId: string,
  body: Record<string, unknown> = {},
): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | undefined;
  do {
    const { data } = await notionFetchJson<{ results: T[]; has_more: boolean; next_cursor: string | null }>(
      token,
      `/databases/${databaseId}/query`,
      {
        method: "POST",
        _mirrorAllRows: true,
        body: { ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
      },
    );
    results.push(...(data.results ?? []));
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}
