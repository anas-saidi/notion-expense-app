const NOTION_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

type NotionFetchOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  cache?: RequestCache;
  retries?: number;
  timeoutMs?: number;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function notionFetchJson<T>(
  token: string,
  path: string,
  {
    method = "GET",
    body,
    cache = "no-store",
    retries = 2,
    timeoutMs = 15000,
  }: NotionFetchOptions = {},
): Promise<{ status: number; data: T }> {
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
      await wait(350 * (attempt + 1));
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
        body: { ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
      },
    );
    results.push(...(data.results ?? []));
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}
