"use client";
import { useEffect, useState } from "react";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { fmt } from "./app-utils";
import { readZakatStatus, RECHECK_MS, refreshZakatStatus, reminderFor, ZAKAT_STATUS_EVENT, type ZakatStatus } from "./zakat-status";

const longDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Home reminder: overdue zakat, or the next due date from 30 days before.
 * Reads the status cached on this device and refreshes it in the background at most once a day.
 */
export function ZakatReminder({ onOpen, refreshKey = 0 }: { onOpen: () => void; refreshKey?: number }) {
  const [status, setStatus] = useState<ZakatStatus | null>(null);

  useEffect(() => {
    const reread = () => setStatus(readZakatStatus());
    reread();
    window.addEventListener(ZAKAT_STATUS_EVENT, reread);
    const cached = readZakatStatus();
    if (!cached || Date.now() - Date.parse(cached.checkedAt) >= RECHECK_MS) void refreshZakatStatus();
    return () => window.removeEventListener(ZAKAT_STATUS_EVENT, reread);
  }, [refreshKey]);

  const reminder = reminderFor(status);
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
