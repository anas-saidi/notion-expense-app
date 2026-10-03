import type { PlanningFund } from "./planning-month";
import type { MonthlySummary, Transaction } from "../app/components/app-types";
import { monthBounds } from "../app/components/app-utils";

const inFlight = new Map<string, Promise<unknown>>();
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Share concurrent reads only; completed financial responses are never cached. */
export function fetchApiJson<T>(url: string, retries = 2): Promise<T> {
  const existing = inFlight.get(url);
  if (existing) return existing as Promise<T>;
  const request = (async () => {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (response.ok) {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("finance-data-source", { detail: {
          url, source: response.headers.get("X-Finance-Data-Source"), syncedAt: response.headers.get("X-Finance-Synced-At"),
        } }));
        return data as T;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        await wait(retryAfter > 0 ? retryAfter * 1000 : 900 * (attempt + 1));
        continue;
      }
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }
  })();
  inFlight.set(url, request);
  const clean = () => { if (inFlight.get(url) === request) inFlight.delete(url); };
  void request.then(clean, clean);
  return request;
}

/** A successful mutation must not join a read that started before the write. */
export function invalidateFinancialReads() { inFlight.clear(); }

export type MonthlyData = { summary: MonthlySummary; transactions: Transaction[]; funds: PlanningFund[] };
export function fetchMonthlyData(startMonth: string, endMonth = startMonth) {
  const start = monthBounds(`${startMonth}-01`).start;
  const end = monthBounds(`${endMonth}-01`).end;
  return fetchApiJson<MonthlyData>(`/api/monthly-summary?start=${start}&end=${end}&includeTransactions=true`);
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
