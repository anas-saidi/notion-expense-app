import type { Category, Transaction } from "./app-types";
import { isSavingsCategory } from "./wallet-utils";

export type CategoryRunway = {
  category: Category;
  daysCovered: number;
  dailySpend: number;
  suggestedTopUp: number;
};

export const RUNWAY_WINDOW_DAYS = 28;
export function runwayWindow(date: string): { start: string; end: string } {
  const start = new Date(`${date}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - RUNWAY_WINDOW_DAYS + 1);
  return { start: start.toISOString().slice(0, 10), end: date };
}

/** Everyday categories only, using a complete rolling window rather than recent activity. */
export function runningLowCategories(categories: Category[], transactions: Transaction[], date: string): CategoryRunway[] {
  const window = runwayWindow(date);
  const [year, monthNumber, day] = date.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const remainingDays = daysInMonth - day;
  if (remainingDays < 3) return [];
  const activity = new Map<string, { net: number; days: Set<string> }>();
  for (const txn of transactions) {
    if (!txn.category || !txn.date || txn.date < window.start || txn.date > window.end || txn.type === "Transfer") continue;
    if (!Number.isFinite(txn.amount)) continue;
    const entry = activity.get(txn.category) ?? { net: 0, days: new Set<string>() };
    entry.net += txn.type === "Income" ? -txn.amount : txn.amount;
    if (txn.type !== "Income" && txn.amount > 0) entry.days.add(txn.date);
    activity.set(txn.category, entry);
  }
  return categories.flatMap(category => {
    if (category.spendingPattern !== "Everyday" || category.archived || category.snoozed || isSavingsCategory(category)) return [];
    const available = category.available;
    const entry = activity.get(category.id);
    if (available == null || !Number.isFinite(available) || available < 0 || !entry || entry.net <= 0 || entry.days.size < 3) return [];
    const days = [...entry.days].sort();
    const dayNumber = (value: string) => Date.parse(`${value}T12:00:00Z`) / 86400000;
    const first = dayNumber(days[0]);
    const last = dayNumber(days[days.length - 1]);
    // Repeated use across a week, still active in the last seven days.
    if (last - first < 7 || dayNumber(date) - last >= 7) return [];
    const dailySpend = entry.net / RUNWAY_WINDOW_DAYS;
    const daysCovered = available / dailySpend;
    // Only interrupt when less than a week remains and run-out is clearly before month end.
    if (daysCovered >= 7 || daysCovered >= remainingDays - 2) return [];
    return [{ category, dailySpend, daysCovered, suggestedTopUp: Math.ceil(dailySpend * remainingDays - available) }];
  }).sort((a, b) => a.daysCovered - b.daysCovered || b.suggestedTopUp - a.suggestedTopUp);
}

export function runwayLabel(days: number): string {
  if (days < 1) return "Less than a day left";
  const rounded = Math.round(days);
  return `About ${rounded} day${rounded === 1 ? "" : "s"} left`;
}
