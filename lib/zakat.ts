/**
 * Zakat on cash savings, silver standard.
 * - Wealth: the owner's accounts, rebuilt day by day the way the Accounts "Current Balance" formula adds up,
 *   except money lent out stays counted (it is still owed to the owner).
 * - Hawl: 354 days. A day below the nisab breaks it; a new one starts the next day back at or above it.
 * - Zakat: 2.5% of wealth on the due date. Payments settle the oldest unpaid year first; a surplus is not
 *   carried forward, so an overpayment never lowers a later year.
 */
export const HAWL_DAYS = 354;
export const ZAKAT_RATE = 0.025;

export type Movement = { date: string | null; amount: number };
export type LedgerAccount = {
  startDate: string;
  startingAmount: number;
  income: Movement[];
  expenses: Movement[];
  transfersIn: Movement[];
  transfersOut: Movement[];
  reconciliations: Movement[];
};
export type ZakatSetup = {
  /** First day of the current chain of hawls, verified from history before the ledger starts. */
  hawlStart: string;
  /** Wealth before the ledger starts isn't checked again: it was verified when hawlStart was set. */
  ledgerStart: string;
};
export type ZakatPayment = { date: string; amount: number };
export type ZakatYear = {
  number: number;
  start: string;
  due: string;
  wealth: number;
  nisab: number;
  owed: number;
  paid: number;
  payments: ZakatPayment[];
  /** "not checked": due before the ledger starts, so the app can't see the wealth on that day. */
  status: "covered" | "overdue" | "partly paid" | "not checked";
};
export type ZakatSchedule = {
  years: ZakatYear[];
  current: { start: string; due: string; daysLeft: number; wealthToday: number; nisabToday: number; estimate: number } | null;
  breaks: Array<{ date: string; wealth: number; nisab: number }>;
};

const DAY = 86_400_000;
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/** End-of-day total across the accounts from `from` to `to`. Undated entries count on the account's start date. */
export function dailyWealth(accounts: LedgerAccount[], from: string, to: string) {
  const delta = new Map<string, number>();
  const add = (date: string | null, amount: number, fallback: string) => {
    const key = date ?? fallback;
    delta.set(key, (delta.get(key) ?? 0) + amount);
  };
  for (const a of accounts) {
    add(a.startDate, a.startingAmount, a.startDate);
    a.income.forEach(m => add(m.date, m.amount, a.startDate));
    a.expenses.forEach(m => add(m.date, -m.amount, a.startDate));
    a.transfersIn.forEach(m => add(m.date, m.amount, a.startDate));
    a.transfersOut.forEach(m => add(m.date, -m.amount, a.startDate));
    a.reconciliations.forEach(m => add(m.date, m.amount, a.startDate));
  }
  let total = 0;
  for (const [date, amount] of delta) if (date < from) total += amount;
  const out = new Map<string, number>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    total += delta.get(d) ?? 0;
    out.set(d, total);
  }
  return out;
}

export function zakatSchedule(input: {
  setup: ZakatSetup;
  today: string;
  wealth: (date: string) => number;
  nisab: (date: string) => number;
  payments: ZakatPayment[];
}): ZakatSchedule {
  const { setup, today, wealth, nisab } = input;
  const breaks: ZakatSchedule["breaks"] = [];
  let start = setup.hawlStart;
  let below = false;
  const dues: Array<{ start: string; due: string }> = [];
  let nextDue = addDays(start, HAWL_DAYS);
  for (let d = setup.ledgerStart > start ? setup.ledgerStart : start; d <= today; d = addDays(d, 1)) {
    const w = wealth(d), n = nisab(d);
    if (w < n) {
      if (!below) breaks.push({ date: d, wealth: w, nisab: n });
      below = true;
      continue;
    }
    if (below) {
      below = false;
      start = d;
      nextDue = addDays(d, HAWL_DAYS);
    }
    if (d === nextDue) {
      dues.push({ start, due: d });
      start = d;
      nextDue = addDays(d, HAWL_DAYS);
    }
  }
  // Due dates before the ledger starts were verified with the setup; walk them without a wealth check.
  const preLedger: Array<{ start: string; due: string }> = [];
  for (let s = setup.hawlStart, due = addDays(s, HAWL_DAYS); due < setup.ledgerStart && due <= today; s = due, due = addDays(due, HAWL_DAYS)) preLedger.push({ start: s, due });

  const queue = [...input.payments].filter(p => p.amount > 0).sort((a, b) => a.date.localeCompare(b.date));
  const years: ZakatYear[] = [...preLedger, ...dues].map((y, i) => {
    const w = y.due >= setup.ledgerStart ? wealth(y.due) : NaN;
    const owed = Number.isFinite(w) ? Math.max(w, 0) * ZAKAT_RATE : NaN;
    const year: ZakatYear = { number: i + 1, start: y.start, due: y.due, wealth: w, nisab: nisab(y.due), owed, paid: 0, payments: [], status: "overdue" };
    return year;
  });
  for (const year of years) {
    if (!Number.isFinite(year.owed)) {
      year.status = "not checked";
      continue;
    }
    while (queue.length && year.paid < year.owed) {
      const p = queue.shift()!;
      year.payments.push(p);
      year.paid += p.amount;
    }
    year.status = year.paid >= year.owed ? "covered" : year.paid > 0 ? "partly paid" : "overdue";
  }
  const current = below ? null : {
    start,
    due: nextDue,
    daysLeft: daysBetween(today, nextDue),
    wealthToday: wealth(today),
    nisabToday: nisab(today),
    estimate: Math.max(wealth(today), 0) * ZAKAT_RATE,
  };
  return { years, current, breaks };
}
