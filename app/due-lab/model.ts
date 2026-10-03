/**
 * Due bills lab model: derived occurrences (docs/due-bills-feature-spec.md).
 *
 * A bill is one Schedule. Its occurrences are never stored: deriveOccurrences()
 * works them out from the schedule, its metadata, and the payments linked to
 * it. Only payments (ordinary Expenses) and metadata edits are written.
 * Everything here is pure so the same code could back the UI and the server.
 */

export type Period = string; // "YYYY-MM"
export type Scope = "Joint" | "Anas" | "Salma";
export type Repeat = "None" | "Monthly" | "Yearly";

/** Stand-in for a Notion category. Available = assigned − spent, like its rollup. */
export type Category = { id: string; name: string; icon: string; scope: Scope; assigned: number };
export type Account = { id: string; name: string; scope: Scope };

export type BillMetadata = {
  v: 1;
  end?: Period;
  account?: string;
  skipped: Period[];
  overrides: Record<Period, { amount?: number; categoryId?: string; due?: string }>;
  revisions: { until: Period; amount: number; categoryId: string }[];
};

/** The schedule row: Type = Due, no Date, no Account. */
export type Schedule = {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  dueDate: string; // first occurrence; its day (and month, for yearly) is the anchor
  repeat: Repeat;
  meta: BillMetadata;
};

/** An ordinary Expense row, linked to a schedule through Bill + Bill period. */
export type Payment = {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  accountId: string;
  date: string;
  billId?: string;
  period?: Period;
};

export type OccurrenceState = "paid" | "skipped" | "overdue" | "due";
export type Occurrence = {
  key: string;
  bill: Schedule;
  period: Period;
  due: string;
  amount: number;
  categoryId: string;
  state: OccurrenceState;
  payments: Payment[];
};

export type BillOp =
  | { kind: "skip"; period: Period }
  | { kind: "restore"; period: Period }
  | { kind: "override"; period: Period; amount: number; due: string }
  | { kind: "editFuture"; from: Period; amount: number; categoryId: string }
  | { kind: "stop"; end: Period };

export const TODAY = "2026-09-28";

// ── Calendar ────────────────────────────────────────────────────────────────

export const periodOf = (date: string): Period => date.slice(0, 7);

export function addMonths(period: Period, delta: number): Period {
  const [y, m] = period.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

const daysInMonth = (period: Period) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** The anchor day, clamped to the period's last day: Jan 31 → Feb 28 → Mar 31. */
export function nominalDue(bill: Schedule, period: Period): string {
  const day = Math.min(Number(bill.dueDate.slice(8, 10)), daysInMonth(period));
  return `${period}-${String(day).padStart(2, "0")}`;
}

/** Every period the schedule produces, from its start through `through`. */
export function periodsFor(bill: Schedule, through: Period): Period[] {
  const start = periodOf(bill.dueDate);
  if (bill.repeat === "None") return start <= through ? [start] : [];
  const last = bill.meta.end && bill.meta.end < through ? bill.meta.end : through;
  const step = bill.repeat === "Monthly" ? 1 : 12;
  const periods: Period[] = [];
  for (let p = start; p <= last; p = addMonths(p, step)) periods.push(p);
  return periods;
}

// ── Derivation ──────────────────────────────────────────────────────────────

/** Expected values: override → first revision covering the period → current values. */
export function expectedFor(bill: Schedule, period: Period) {
  const revision = bill.meta.revisions
    .filter((r) => r.until >= period)
    .sort((a, b) => a.until.localeCompare(b.until))[0];
  const override = bill.meta.overrides[period];
  return {
    amount: override?.amount ?? revision?.amount ?? bill.amount,
    categoryId: override?.categoryId ?? revision?.categoryId ?? bill.categoryId,
    due: override?.due ?? nominalDue(bill, period),
  };
}

/**
 * All occurrences through `through`. A payment settles the occurrence it is
 * linked to; the payment's own amount never feeds back into expectations.
 */
export function deriveOccurrences(bills: Schedule[], payments: Payment[], today: string, through: Period): Occurrence[] {
  const byKey = new Map<string, Payment[]>();
  for (const p of payments) {
    if (!p.billId || !p.period) continue;
    const key = `${p.billId}:${p.period}`;
    byKey.set(key, [...(byKey.get(key) ?? []), p]);
  }
  return bills.flatMap((bill) =>
    periodsFor(bill, through).map((period) => {
      const key = `${bill.id}:${period}`;
      const linked = byKey.get(key) ?? [];
      const expected = expectedFor(bill, period);
      const state: OccurrenceState = linked.length
        ? "paid"
        : bill.meta.skipped.includes(period)
          ? "skipped"
          : expected.due < today
            ? "overdue"
            : "due";
      return { key, bill, period, ...expected, state, payments: linked };
    }),
  );
}

export const isUnpaid = (o: Occurrence) => o.state === "due" || o.state === "overdue";

/** Periods with more than one linked payment, e.g. two devices paying at once. */
export function duplicatePaymentKeys(payments: Payment[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const p of payments) {
    if (!p.billId || !p.period) continue;
    const key = `${p.billId}:${p.period}`;
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  }
  return dupes;
}

// ── Money ───────────────────────────────────────────────────────────────────

/** Stand-in for Notion's Available rollup. In production, read it; never recompute it. */
export function availableFor(category: Category, payments: Payment[]): number {
  return category.assigned - payments.filter((p) => p.categoryId === category.id).reduce((s, p) => s + p.amount, 0);
}

/** Available / Earmarked / Free after bills for one category, reserving through `cutoff`. */
export function categoryPosition(category: Category, occurrences: Occurrence[], payments: Payment[], cutoff: string) {
  const available = availableFor(category, payments);
  const earmarked = occurrences
    .filter((o) => isUnpaid(o) && o.categoryId === category.id && o.due <= cutoff)
    .reduce((s, o) => s + o.amount, 0);
  return { available, earmarked, free: available - earmarked };
}

export const monthEnd = (period: Period) => `${period}-${String(daysInMonth(period)).padStart(2, "0")}`;

// ── Metadata operations ─────────────────────────────────────────────────────

/** Metadata edits are operations, so re-applying one after a conflict is safe. */
export function applyOp(bill: Schedule, op: BillOp): Schedule {
  const meta = bill.meta;
  switch (op.kind) {
    case "skip":
      return meta.skipped.includes(op.period) ? bill : { ...bill, meta: { ...meta, skipped: [...meta.skipped, op.period] } };
    case "restore":
      return { ...bill, meta: { ...meta, skipped: meta.skipped.filter((p) => p !== op.period) } };
    case "override":
      return { ...bill, meta: { ...meta, overrides: { ...meta.overrides, [op.period]: { ...meta.overrides[op.period], amount: op.amount, due: op.due } } } };
    case "stop":
      return { ...bill, meta: { ...meta, end: op.end } };
    case "editFuture": {
      // Freeze what periods before `from` expect, then change the current values.
      const before = addMonths(op.from, -1);
      const kept = meta.revisions.filter((r) => r.until < op.from);
      const covering = meta.revisions.filter((r) => r.until >= op.from).sort((a, b) => a.until.localeCompare(b.until))[0]
        ?? { amount: bill.amount, categoryId: bill.categoryId };
      const needsFreeze = before >= periodOf(bill.dueDate) && !kept.some((r) => r.until === before);
      const revisions = needsFreeze ? [...kept, { until: before, amount: covering.amount, categoryId: covering.categoryId }] : kept;
      return { ...bill, amount: op.amount, categoryId: op.categoryId, meta: { ...meta, revisions } };
    }
  }
}

export const emptyMeta = (): BillMetadata => ({ v: 1, skipped: [], overrides: {}, revisions: [] });

// ── Sample data ─────────────────────────────────────────────────────────────

export const accounts: Account[] = [
  { id: "joint-bank", name: "Joint account", scope: "Joint" },
  { id: "joint-cash", name: "Household cash", scope: "Joint" },
  { id: "anas-bank", name: "Anas account", scope: "Anas" },
  { id: "salma-bank", name: "Salma account", scope: "Salma" },
];

const schedule = (s: Omit<Schedule, "meta"> & { meta?: Partial<BillMetadata> }): Schedule => ({ ...s, meta: { ...emptyMeta(), ...s.meta } });

export const seedBills: Schedule[] = [
  schedule({ id: "water", name: "Water & electricity", amount: 460, categoryId: "utilities", dueDate: "2026-07-25", repeat: "Monthly", meta: { account: "joint-bank", revisions: [{ until: "2026-07", amount: 420, categoryId: "utilities" }] } }),
  schedule({ id: "internet", name: "Internet", amount: 300, categoryId: "utilities", dueDate: "2026-06-28", repeat: "Monthly", meta: { account: "joint-bank", skipped: ["2026-07"] } }),
  schedule({ id: "rent", name: "Rent", amount: 4200, categoryId: "home", dueDate: "2026-06-30", repeat: "Monthly", meta: { account: "joint-bank" } }),
  schedule({ id: "repair", name: "Washing machine repair", amount: 650, categoryId: "home", dueDate: "2026-09-30", repeat: "None", meta: { account: "joint-cash" } }),
  schedule({ id: "insurance", name: "Home insurance", amount: 1800, categoryId: "home", dueDate: "2025-10-10", repeat: "Yearly", meta: { account: "joint-bank" } }),
  schedule({ id: "music", name: "Music subscription", amount: 65, categoryId: "subscriptions", dueDate: "2026-07-15", repeat: "Monthly", meta: { account: "joint-bank" } }),
  schedule({ id: "phone", name: "Mobile plan", amount: 149, categoryId: "phone", dueDate: "2026-08-29", repeat: "Monthly", meta: { account: "anas-bank" } }),
  schedule({ id: "cloud", name: "Cloud storage", amount: 29, categoryId: "salma-subs", dueDate: "2026-07-30", repeat: "Monthly", meta: { account: "salma-bank" } }),
];

const paid = (billId: string, period: Period, amount: number, date: string, accountId: string, id = `${billId}-${period}`): Payment => {
  const bill = seedBills.find((b) => b.id === billId)!;
  return { id, name: bill.name, amount, categoryId: expectedFor(bill, period).categoryId, accountId, date, billId, period };
};

export const seedPayments: Payment[] = [
  paid("water", "2026-07", 431, "2026-07-24", "joint-bank"),
  paid("water", "2026-08", 455, "2026-08-25", "joint-bank"),
  paid("internet", "2026-06", 300, "2026-06-28", "joint-bank"),
  paid("internet", "2026-08", 300, "2026-08-27", "joint-bank"),
  paid("rent", "2026-06", 4200, "2026-06-30", "joint-bank"),
  paid("rent", "2026-07", 4200, "2026-07-30", "joint-bank"),
  paid("rent", "2026-08", 4200, "2026-08-31", "joint-bank"),
  paid("insurance", "2025-10", 1800, "2025-10-09", "joint-bank"),
  paid("music", "2026-07", 65, "2026-07-15", "joint-bank"),
  paid("music", "2026-08", 65, "2026-08-15", "joint-bank"),
  paid("music", "2026-09", 65, "2026-09-15", "joint-bank"),
  paid("phone", "2026-08", 149, "2026-08-29", "anas-bank"),
  paid("cloud", "2026-07", 29, "2026-07-30", "salma-bank"),
  // Recorded from two phones at once: kept on purpose to show the anomaly.
  paid("cloud", "2026-08", 29, "2026-08-30", "salma-bank", "cloud-2026-08-a"),
  paid("cloud", "2026-08", 29, "2026-08-30", "salma-bank", "cloud-2026-08-b"),
];

/** Categories seeded with today's Available; `assigned` is back-filled so the rollup lands there. */
const withAvailable = (c: Omit<Category, "assigned"> & { available: number }): Category => ({
  id: c.id, name: c.name, icon: c.icon, scope: c.scope,
  assigned: c.available + seedPayments.filter((p) => p.categoryId === c.id).reduce((s, p) => s + p.amount, 0),
});

export const categories: Category[] = [
  withAvailable({ id: "home", name: "Home", icon: "🏠", scope: "Joint", available: 6400 }),
  withAvailable({ id: "utilities", name: "Utilities", icon: "💡", scope: "Joint", available: 1400 }),
  withAvailable({ id: "subscriptions", name: "Subscriptions", icon: "🎧", scope: "Joint", available: 500 }),
  withAvailable({ id: "phone", name: "Phone", icon: "📱", scope: "Anas", available: 100 }),
  withAvailable({ id: "salma-subs", name: "Subscriptions", icon: "🎧", scope: "Salma", available: 200 }),
];
