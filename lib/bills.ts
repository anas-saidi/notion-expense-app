/** Bill schedules and payments share Transactions; occurrences are calculated, never generated. */
export type BillRepeat = "None" | "Monthly" | "Yearly";
export type BillValues = { amount: number; categoryId: string };
export type BillMetadata = {
  v: 1; end?: string; account?: string; skipped?: string[];
  overrides?: Record<string, Partial<BillValues> & { due?: string }>;
  revisions?: (BillValues & { until: string })[];
};
export type BillSchedule = BillValues & { id: string; name: string; dueDate: string; repeat: BillRepeat; metadata: BillMetadata };
export type BillPayment = { id: string; name?: string; billId: string; period: string; date: string; amount: number; categoryId: string; accountId: string };
export type BillOccurrence = BillValues & {
  id: string; billId: string; period: string; name: string; dueDate: string; repeat: BillRepeat;
  accountId?: string; state: "Due" | "Overdue" | "Paid" | "Skipped"; payments: BillPayment[];
};
export type BillsData = { schedules: BillSchedule[]; payments: BillPayment[]; today: string };
export const normalizedId = (id: string) => id.replace(/-/g, "").toLowerCase();
export const isPeriod = (value: unknown): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value.slice(0, 4) >= "1900";
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !isPeriod(value.slice(0, 7))) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function billToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function nextPeriod(period: string, months = 1) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return date.toISOString().slice(0, 7);
}
export function anchoredDate(anchor: string, period: string) {
  const [year, month] = period.split("-").map(Number);
  const day = Math.min(Number(anchor.slice(8, 10)), new Date(Date.UTC(year, month, 0)).getUTCDate());
  return `${period}-${String(day).padStart(2, "0")}`;
}
const isValues = (value: any) => Number.isFinite(value?.amount) && value.amount > 0 && typeof value.categoryId === "string" && !!value.categoryId;
export function parseBillMetadata(text: string): BillMetadata {
  const value = text.trim() ? JSON.parse(text) : { v: 1 };
  if (!value || value.v !== 1 || (value.end !== undefined && !isPeriod(value.end)) ||
      (value.account !== undefined && typeof value.account !== "string") ||
      (value.skipped !== undefined && (!Array.isArray(value.skipped) || !value.skipped.every(isPeriod))) ||
      (value.revisions !== undefined && (!Array.isArray(value.revisions) || !value.revisions.every((r: any) => isValues(r) && isPeriod(r.until))))) throw new Error("Invalid bill metadata");
  if (value.overrides !== undefined) {
    if (!value.overrides || Array.isArray(value.overrides) || typeof value.overrides !== "object") throw new Error("Invalid bill overrides");
    for (const [period, override] of Object.entries(value.overrides) as [string, any][]) {
      if (!isPeriod(period) || !override || typeof override !== "object" || Array.isArray(override) ||
          (override.amount !== undefined && !(Number.isFinite(override.amount) && override.amount > 0)) ||
          (override.categoryId !== undefined && !(typeof override.categoryId === "string" && override.categoryId)) ||
          (override.due !== undefined && !isCalendarDate(override.due))) throw new Error("Invalid bill override");
    }
  }
  return value;
}
export function valuesForPeriod(schedule: BillSchedule, period: string) {
  const revision = [...(schedule.metadata.revisions ?? [])].sort((a, b) => a.until.localeCompare(b.until)).find(r => r.until >= period);
  const override = schedule.metadata.overrides?.[period];
  return { amount: override?.amount ?? revision?.amount ?? schedule.amount, categoryId: override?.categoryId ?? revision?.categoryId ?? schedule.categoryId,
    dueDate: override?.due ?? anchoredDate(schedule.dueDate, period) };
}
export function deriveOccurrences(schedules: BillSchedule[], payments: BillPayment[], today: string, horizon: string): BillOccurrence[] {
  if (!isCalendarDate(today) || !isPeriod(horizon)) throw new Error("Invalid bill date range");
  const result: BillOccurrence[] = [];
  const byOccurrence = new Map<string, BillPayment[]>();
  for (const payment of payments) {
    const key = `${normalizedId(payment.billId)}:${payment.period}`;
    byOccurrence.set(key, [...(byOccurrence.get(key) ?? []), payment]);
  }
  const visited = new Set<string>();
  for (const schedule of schedules) {
    if (!isValues(schedule) || !isCalendarDate(schedule.dueDate) || !["None", "Monthly", "Yearly"].includes(schedule.repeat)) throw new Error(`Invalid bill: ${schedule.name}`);
    const first = schedule.dueDate.slice(0, 7);
    const end = schedule.metadata.end && schedule.metadata.end < horizon ? schedule.metadata.end : horizon;
    for (let period = first; period <= end; period = nextPeriod(period, schedule.repeat === "Yearly" ? 12 : 1)) {
      const id = `${normalizedId(schedule.id)}:${period}`;
      const linked = byOccurrence.get(id) ?? [];
      const values = valuesForPeriod(schedule, period);
      result.push({ id, billId: schedule.id, period, name: schedule.name, repeat: schedule.repeat, ...values,
        accountId: schedule.metadata.account, payments: linked,
        state: linked.length ? "Paid" : schedule.metadata.skipped?.includes(period) ? "Skipped" : values.dueDate < today ? "Overdue" : "Due" });
      visited.add(id);
      if (schedule.repeat === "None") break;
    }
  }
  // Preserve payment history when a series was stopped, moved, or archived.
  for (const [id, linked] of byOccurrence) {
    if (visited.has(id)) continue;
    const p = linked[0]; const schedule = schedules.find(s => normalizedId(s.id) === normalizedId(p.billId));
    result.push({ id, billId: p.billId, period: p.period, name: schedule?.name ?? p.name ?? "Bill payment", repeat: schedule?.repeat ?? "None",
      ...(schedule ? valuesForPeriod(schedule, p.period) : { amount: p.amount, categoryId: p.categoryId, dueDate: `${p.period}-01` }), payments: linked, state: "Paid" });
  }
  return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
}
export function earmarkedByCategory(occurrences: BillOccurrence[], cutoff: string) {
  const totals: Record<string, number> = {};
  for (const bill of occurrences) if ((bill.state === "Due" || bill.state === "Overdue") && bill.dueDate <= cutoff) {
    const id = normalizedId(bill.categoryId); totals[id] = (totals[id] ?? 0) + bill.amount;
  }
  return totals;
}
