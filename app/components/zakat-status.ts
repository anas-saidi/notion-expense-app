import type { ZakatResponse } from "../../lib/zakat-data";

/** What Home needs to remind about zakat, cached per device so Home never waits on the slow full check. */
export type ZakatStatus = {
  checkedAt: string; nextDue: string | null; overdue: number; overdueSince: string | null;
  /** 2.5% of today's wealth, rounded up: what the next due date would cost if it were today. Missing in older caches. */
  estimate?: number;
};
const KEY = "zakatStatus:v1";
export const REMIND_DAYS_BEFORE = 30;
export const RECHECK_MS = 24 * 60 * 60 * 1000;

/** Pay the higher end: round what's owed up to the next 10 MAD. */
export const payAmount = (owed: number, paid = 0) => Math.max(Math.ceil((owed - paid) / 10) * 10, 0);

export function statusFrom(data: ZakatResponse): ZakatStatus {
  const unpaid = data.schedule.years.filter(y => y.status === "overdue" || y.status === "partly paid");
  return {
    checkedAt: new Date().toISOString(),
    nextDue: data.schedule.current?.due ?? null,
    overdue: unpaid.reduce((sum, y) => sum + payAmount(y.owed, y.paid), 0),
    overdueSince: unpaid[0]?.due ?? null,
    ...(data.schedule.current ? { estimate: payAmount(data.schedule.current.estimate) } : {}),
  };
}

/** Zakat as Bills shows it: computed from the zakat check, never stored as a bill. */
export type ZakatBill = { state: "Due" | "Overdue"; dueDate: string; amount: number; estimated: boolean };

/**
 * The zakat row for a Bills list. Overdue zakat shows in the current month; upcoming zakat shows in its
 * due month, and in the current month once due by `cutoff` (the end of that month).
 */
export function zakatBillFor(status: ZakatStatus | null, { month, currentMonth, cutoff }: { month: string; currentMonth: string; cutoff: string }): ZakatBill | null {
  if (!status) return null;
  if (status.overdue > 0 && status.overdueSince) return month === currentMonth ? { state: "Overdue", dueDate: status.overdueSince, amount: status.overdue, estimated: false } : null;
  if (!status.nextDue || !status.estimate) return null;
  const shows = month === currentMonth ? status.nextDue <= cutoff : status.nextDue.slice(0, 7) === month;
  return shows ? { state: "Due", dueDate: status.nextDue, amount: status.estimate, estimated: true } : null;
}

/** Bills and other screens ask the app shell to open the zakat screen. */
export const ZAKAT_OPEN_EVENT = "zakat-open";
export const openZakat = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(ZAKAT_OPEN_EVENT)); };

export function readZakatStatus(): ZakatStatus | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const ZAKAT_STATUS_EVENT = "zakat-status";
export function writeZakatStatus(status: ZakatStatus | null) {
  try {
    if (status) localStorage.setItem(KEY, JSON.stringify(status));
    else localStorage.removeItem(KEY);
  } catch {}
  // Any mounted reminder re-reads, including one that mounted after the check started.
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ZAKAT_STATUS_EVENT));
}

/** While zakat is overdue, a cached "overdue" may already be paid on another device: recheck it this often. */
export const OVERDUE_RECHECK_MS = 5 * 60 * 1000;

/** Whether the cached status is old enough to check again: daily, or every few minutes while something is overdue. */
export function needsRecheck(status: ZakatStatus | null, now = Date.now()) {
  if (!status) return true;
  const age = now - Date.parse(status.checkedAt);
  return !(age >= 0) || age >= (status.overdue > 0 ? OVERDUE_RECHECK_MS : RECHECK_MS);
}

let checking: Promise<ZakatStatus | null> | null = null;
const check = () => fetch("/api/zakat", { cache: "no-store" })
  .then(async res => {
    if (!res.ok) return null;
    const status = statusFrom(await res.json());
    writeZakatStatus(status);
    return status;
  })
  .catch(() => null);

/**
 * One background check at a time, however many reminders mount while the app loads.
 * `fresh` waits for any check already running (it may have started before a new payment) and then checks again.
 */
export function refreshZakatStatus({ fresh = false } = {}): Promise<ZakatStatus | null> {
  if (checking && !fresh) return checking;
  const run: Promise<ZakatStatus | null> = (checking ?? Promise.resolve(null)).then(check).finally(() => { if (checking === run) checking = null; });
  checking = run;
  return run;
}

/**
 * After a zakat payment is saved: check until the payment shows, since Notion can take a moment to list it.
 * Stops once the amount overdue drops, or after a few tries; the overdue recheck covers anything later.
 */
export async function refreshZakatAfterPayment(waits = [0, 20_000, 60_000], sleep = (ms: number) => new Promise(r => setTimeout(r, ms))) {
  const before = readZakatStatus()?.overdue ?? 0;
  for (const ms of waits) {
    if (ms) await sleep(ms);
    const status = await refreshZakatStatus({ fresh: true });
    if (status && (before === 0 || status.overdue < before)) return status;
  }
  return null;
}

/** Days from today (Casablanca) to a YYYY-MM-DD date. */
export function daysUntil(date: string, now = new Date()) {
  const today = now.toLocaleDateString("en-CA", { timeZone: "Africa/Casablanca" });
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** Remind when something is overdue, or from REMIND_DAYS_BEFORE days before the next due date. */
export function reminderFor(status: ZakatStatus | null, now = new Date()): { kind: "overdue"; amount: number; since: string } | { kind: "soon"; due: string; days: number } | null {
  if (!status) return null;
  if (status.overdue > 0 && status.overdueSince) return { kind: "overdue", amount: status.overdue, since: status.overdueSince };
  if (!status.nextDue) return null;
  const days = daysUntil(status.nextDue, now);
  return days <= REMIND_DAYS_BEFORE ? { kind: "soon", due: status.nextDue, days } : null;
}
