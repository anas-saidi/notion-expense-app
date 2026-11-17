"use client";
import { useEffect, useState } from "react";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { fmt } from "./app-utils";
import { needsRecheck, readZakatStatus, refreshZakatStatus, reminderFor, ZAKAT_STATUS_EVENT, type ZakatStatus } from "./zakat-status";

const longDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The zakat status cached on this device, refreshed in the background: daily, or every few minutes while overdue.
 * `enabled: false` skips reading and checking (for a screen that doesn't show zakat right now).
 */
export function useZakatStatus({ refreshKey = 0, enabled = true }: { refreshKey?: number; enabled?: boolean } = {}) {
  const [status, setStatus] = useState<ZakatStatus | null>(null);

  useEffect(() => {
    if (!enabled) { setStatus(null); return; }
    const reread = () => setStatus(readZakatStatus());
    reread();
    // Recheck on mount and whenever the app comes back to the front: a payment saved on another device,
    // or a check cut off when the app was closed, then clears the reminder without waiting a day.
    const recheck = () => { if (document.visibilityState !== "hidden" && needsRecheck(readZakatStatus())) void refreshZakatStatus(); };
    window.addEventListener(ZAKAT_STATUS_EVENT, reread);
    document.addEventListener("visibilitychange", recheck);
    recheck();
    return () => {
      window.removeEventListener(ZAKAT_STATUS_EVENT, reread);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [refreshKey, enabled]);

  return status;
}

/** Home reminder: overdue zakat, or the next due date from 30 days before. */
export function ZakatReminder({ onOpen, refreshKey = 0 }: { onOpen: () => void; refreshKey?: number }) {
  const reminder = reminderFor(useZakatStatus({ refreshKey }));
  if (!reminder) return null;
  return <Banner
    tone={reminder.kind === "overdue" ? "warning" : "info"}
    role="status"
    title={reminder.kind === "overdue" ? `Zakat overdue: pay ${fmt(reminder.amount)} MAD` : `Zakat due ${longDate(reminder.due)}`}
    action={<Button variant="secondary" size="compact" onClick={onOpen}>Open</Button>}
    style={{ margin: "0 16px 12px" }}
  >
    {reminder.kind === "overdue" ? `Due since ${longDate(reminder.since)}.` : reminder.days <= 0 ? "Due today." : `In ${reminder.days} ${reminder.days === 1 ? "day" : "days"}.`}
  </Banner>;
}
