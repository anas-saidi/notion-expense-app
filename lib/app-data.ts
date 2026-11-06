import type { PlanningFund } from "./planning-month";
import type { MonthlySummary, Transaction } from "../app/components/app-types";
import { monthBounds } from "../app/components/app-utils";

const inFlight = new Map<string, Promise<unknown>>();
const controllers = new Map<AbortController, string>();
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// An expired mirror needs a fully paginated ledger read: let that finish instead of relaunching it.
// Accounts recompute every account's Notion formulas on each read, so they get longer than the rest.
export const readTimeout = (url: string) => url.includes("includeJointDebt=true") ? 180000 : url.startsWith("/api/accounts") ? 60000 : 30000;

// The last good answer of the reads Home needs first, kept on this device so the
// app can show it the moment it opens and refresh in the background. Only these
// reads: they are small, and they are the ones a person waits on at launch.
const SAVED_PREFIX = "finance-read:v1:";
const SAVED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SAVED_MAX_CHARS = 1_500_000;
const SAVED_READS = ["/api/categories?", "/api/accounts", "/api/bills", "/api/transactions?page_size=100", "/api/monthly-summary?"];
const savable = (url: string) => SAVED_READS.some(prefix => url === prefix || url.startsWith(prefix));

function saveRead(url: string, data: unknown, now = Date.now()) {
  if (typeof window === "undefined" || !savable(url)) return;
  try {
    const value = JSON.stringify({ savedAt: now, data });
    if (value.length > SAVED_MAX_CHARS) return;
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(SAVED_PREFIX) || key === SAVED_PREFIX + url) continue;
      const savedAt = Number(JSON.parse(localStorage.getItem(key) ?? "{}").savedAt);
      if (!(now - savedAt < SAVED_MAX_AGE_MS)) localStorage.removeItem(key);
    }
    localStorage.setItem(SAVED_PREFIX + url, value);
  } catch { /* Storage full, blocked or private: the live read still works. */ }
}

/** The last good answer for this read on this device, if it is under a week old. */
export function readSavedApiJson<T>(url: string, now = Date.now()): { data: T; savedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PREFIX + url) ?? "null");
    if (!saved || typeof saved.savedAt !== "number" || now - saved.savedAt >= SAVED_MAX_AGE_MS || saved.data == null) return null;
    return { data: saved.data as T, savedAt: saved.savedAt };
  } catch { return null; }
}

export function clearSavedReads() {
  if (typeof window === "undefined") return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(SAVED_PREFIX)) localStorage.removeItem(key);
    }
  } catch { /* Nothing saved to clear. */ }
}

/** Share concurrent reads. The browser keeps the last response and revalidates it
 * every time (no-cache): an unchanged answer comes back as a tiny 304. */
export function fetchApiJson<T>(url: string, retries = 2): Promise<T> {
  const existing = inFlight.get(url);
  if (existing) return existing as Promise<T>;
  const controller = new AbortController();
  controllers.set(controller, url);
  const request = (async () => {
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(url, { cache: "no-cache", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(readTimeout(url))]) });
      } catch (error) {
        // A slow Notion answer is worth one more try; a user's own Retry (controller abort) is not.
        if (error instanceof DOMException && error.name === "TimeoutError" && !controller.signal.aborted && attempt < Math.min(retries, 1)) continue;
        throw error instanceof DOMException && error.name === "TimeoutError" ? new Error("Notion is slow to respond right now. Try again in a moment.") : error;
      }
      const data = await response.json();
      if (response.ok) {
        saveRead(url, data);
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("finance-data-source", { detail: {
          url, source: response.headers.get("X-Finance-Data-Source"), syncedAt: response.headers.get("X-Finance-Synced-At"),
        } }));
        return data as T;
      }
      if (data.retryable !== false && (response.status === 429 || response.status >= 500) && attempt < retries) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        await wait(retryAfter > 0 ? retryAfter * 1000 : 900 * (attempt + 1));
        controller.signal.throwIfAborted();
        continue;
      }
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }
  })();
  inFlight.set(url, request);
  const clean = () => { controllers.delete(controller); if (inFlight.get(url) === request) inFlight.delete(url); };
  void request.then(clean, clean);
  return request;
}

/** A successful mutation must not join a read that started before the write. */
export function invalidateFinancialReads() { inFlight.clear(); }

export type MonthlyData = { summary: MonthlySummary; transactions: Transaction[]; funds: PlanningFund[]; jointDebtTransactions?: Transaction[] };
export function monthlyDataUrl(startMonth: string, endMonth = startMonth, includeJointDebt = false) {
  const start = monthBounds(`${startMonth}-01`).start;
  const end = monthBounds(`${endMonth}-01`).end;
  return `/api/monthly-summary?start=${start}&end=${end}&includeTransactions=true${includeJointDebt ? "&includeJointDebt=true" : ""}`;
}
export function fetchMonthlyData(startMonth: string, endMonth = startMonth, includeJointDebt = false) {
  return fetchApiJson<MonthlyData>(monthlyDataUrl(startMonth, endMonth, includeJointDebt));
}

export function historyReadUrls(startMonth: string, endMonth = startMonth) {
  const start = startMonth ? monthBounds(`${startMonth}-01`).start : "";
  const end = startMonth ? monthBounds(`${endMonth}-01`).end : "";
  return {
    transactions: `/api/transactions?${start ? `start=${start}&end=${end}` : "all=true"}`,
    summary: start ? `/api/monthly-summary?start=${start}&end=${end}&includeTransactions=true` : null,
  };
}

/** Activity needs transactions, not the funds query used by spending comparisons. */
export async function fetchHistoryData({ startMonth, endMonth = startMonth, view, snapshot }: {
  startMonth: string; endMonth?: string; view: "spending" | "activity";
  snapshot?: { month: string; expires: number; data: MonthlyData } | null;
}) {
  const monthly = startMonth && startMonth === endMonth
    ? snapshot?.month === startMonth && snapshot.expires > Date.now() ? snapshot.data
      : view === "spending" ? await fetchMonthlyData(startMonth, endMonth) : null
    : null;
  const transactions = monthly?.transactions ?? (await fetchApiJson<{ transactions: Transaction[] }>(historyReadUrls(startMonth, endMonth).transactions)).transactions;
  return { transactions: transactions ?? [], summary: monthly?.summary ?? null };
}

/** Explicit user recovery cancels pending GETs so retry cannot rejoin a stalled read. */
export function restartFinancialReads(matches: (url: string) => boolean = () => true) {
  for (const url of inFlight.keys()) if (matches(url)) inFlight.delete(url);
  for (const [controller, url] of controllers) if (matches(url)) {
    controller.abort();
    controllers.delete(controller);
  }
}

/** Financial essentials first; failures in a secondary section cannot hide Home. */
export async function loadHomeData({ essentials, onReady, secondary }: {
  essentials: (() => Promise<unknown>)[];
  onReady: () => void;
  secondary: (() => Promise<unknown>)[];
}) {
  await Promise.all(essentials.map(load => load()));
  onReady();
  return Promise.allSettled(secondary.map(load => load()));
}
