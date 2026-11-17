import type { ZakatResponse } from "../../lib/zakat-data";

/** What Home needs to remind about zakat, cached per device so Home never waits on the slow full check. */
export type ZakatStatus = { checkedAt: string; nextDue: string | null; overdue: number; overdueSince: string | null };
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
  };
}

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

let checking: Promise<void> | null = null;
/** One background check at a time, however many reminders mount while the app loads. */
export function refreshZakatStatus(): Promise<void> {
  checking ??= fetch("/api/zakat", { cache: "no-store" })
    .then(async res => { if (res.ok) writeZakatStatus(statusFrom(await res.json())); })
    .catch(() => {})
    .finally(() => { checking = null; });
  return checking;
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
