import type { PlanningFund } from "./planning-month";
import type { MonthlySummary, Transaction } from "../app/components/app-types";
import { monthBounds } from "../app/components/app-utils";

const inFlight = new Map<string, Promise<unknown>>();
const controllers = new Map<AbortController, string>();
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// An expired mirror needs a fully paginated ledger read: let that finish instead of relaunching it.
// Accounts recompute every account's Notion formulas on each read, so they get longer than the rest.
export const readTimeout = (url: string) => url.includes("includeJointDebt=true") ? 180000 : url.startsWith("/api/accounts") ? 60000 : 30000;

/** Share concurrent reads only; completed financial responses are never cached. */
export function fetchApiJson<T>(url: string, retries = 2): Promise<T> {
  const existing = inFlight.get(url);
  if (existing) return existing as Promise<T>;
  const controller = new AbortController();
  controllers.set(controller, url);
  const request = (async () => {
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(url, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(readTimeout(url))]) });
      } catch (error) {
        // A slow Notion answer is worth one more try; a user's own Retry (controller abort) is not.
        if (error instanceof DOMException && error.name === "TimeoutError" && !controller.signal.aborted && attempt < Math.min(retries, 1)) continue;
        throw error instanceof DOMException && error.name === "TimeoutError" ? new Error("Notion is slow to respond right now. Try again in a moment.") : error;
      }
      const data = await response.json();
      if (response.ok) {
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
export function fetchMonthlyData(startMonth: string, endMonth = startMonth, includeJointDebt = false) {
  const start = monthBounds(`${startMonth}-01`).start;
  const end = monthBounds(`${endMonth}-01`).end;
  return fetchApiJson<MonthlyData>(`/api/monthly-summary?start=${start}&end=${end}&includeTransactions=true${includeJointDebt ? "&includeJointDebt=true" : ""}`);
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
