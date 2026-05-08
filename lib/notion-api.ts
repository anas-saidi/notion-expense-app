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
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${NOTION_BASE_URL}${path}`, {
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

      const data = await response.json();

      if (response.ok) {
        return { status: response.status, data: data as T };
      }

      const message =
        typeof data?.message === "string"
          ? data.message
          : `Notion request failed with status ${response.status}`;

      if ((response.status >= 500 || response.status === 429) && attempt < retries) {
        await wait(350 * (attempt + 1));
        continue;
      }

      const error = new Error(message) as Error & { status?: number };
      error.status = response.status;
      throw error;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await wait(350 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Notion request failed");
}
