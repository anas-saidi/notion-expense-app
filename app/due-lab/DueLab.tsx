"use client";

import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { BottomSheet } from "../components/ui/BottomSheet";
import { Money } from "../components/Money";
import { fmt } from "../components/app-utils";
import { useAppHaptics } from "../components/ui/useAppHaptics";
import {
  AlertTriangleIcon, ArrowLeftIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, RepeatIcon, ReviveIcon, XIcon,
} from "../components/ui/icons";
import {
  accounts, addMonths, applyOp, availableFor, categories, categoryPosition, deriveOccurrences, duplicatePaymentKeys,
  emptyMeta, isUnpaid, monthEnd, periodOf, seedBills, seedPayments, TODAY,
  type BillOp, type Occurrence, type Payment, type Period, type Repeat, type Schedule, type Scope,
} from "./model";

/**
 * Lab: due bills on the derived-occurrence model. Bills are schedules; every
 * occurrence on screen comes from deriveOccurrences(). Sample data only;
 * nothing is sent to Notion and a reload resets it.
 */

type Filter = "Due" | "Paid" | "Skipped";
type Sheet =
  | { kind: "add" }
  | { kind: "occurrence"; key: string }
  | { kind: "edit"; key: string }
  | { kind: "payment"; id: string }
  | null;
type Confirm = "stop" | "delete" | "undo" | null;

const SCOPES: Scope[] = ["Joint", "Anas", "Salma"];
const FILTERS: Filter[] = ["Due", "Paid", "Skipped"];

const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const monthLabel = (period: Period) => new Date(`${period}-01T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const monthName = (period: Period) => new Date(`${period}-01T12:00:00`).toLocaleDateString("en-GB", { month: "long" });
const repeatLabel = (repeat: Repeat) => (repeat === "None" ? "One-off" : repeat);
const categoryOf = (id: string) => categories.find((c) => c.id === id);
const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Unknown account";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Not crypto.randomUUID(): it's missing over plain http on a LAN IP, which is how the lab gets tested on a phone.
let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++idCounter}`;

function occurrenceStatus(o: Occurrence) {
  if (o.state === "skipped") return `Skipped for ${dateLabel(o.due)}`;
  if (o.state === "overdue") return `Overdue since ${dateLabel(o.due)}`;
  if (o.due === TODAY) return "Due today";
  return `Due ${dateLabel(o.due)}`;
}

export default function DueLab() {
  const [bills, setBills] = useState<Schedule[]>(seedBills);
  const [payments, setPayments] = useState<Payment[]>(seedPayments);
  const [scope, setScope] = useState<Scope>("Joint");
  const [month, setMonth] = useState<Period>(periodOf(TODAY));
  const [filter, setFilter] = useState<Filter>("Due");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [editMode, setEditMode] = useState<"only" | "future">("only");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { haptic } = useAppHaptics();

  const current = periodOf(TODAY);
  const view = month === current ? "current" : month > current ? "future" : "past";
  const cutoff = monthEnd(month);

  // Derive a year past the view so an occurrence moved earlier by an override still shows up.
  const occurrences = useMemo(() => deriveOccurrences(bills, payments, TODAY, addMonths(month, 12)), [bills, payments, month]);
  const duplicates = useMemo(() => duplicatePaymentKeys(payments), [payments]);

  const inScope = (categoryId: string) => categoryOf(categoryId)?.scope === scope;
  const scopeCategories = categories.filter((c) => c.scope === scope);
  const scopeAccounts = accounts.filter((a) => a.scope === scope);
  const scoped = occurrences.filter((o) => inScope(o.categoryId));

  const dueRows = scoped.filter((o) => isUnpaid(o) && o.due <= cutoff).sort((a, b) => a.due.localeCompare(b.due));
  const paidRows = payments
    .filter((p) => p.billId && inScope(p.categoryId) && periodOf(p.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date));
  const skippedRows = scoped.filter((o) => o.state === "skipped" && o.period === month);
  const counts: Record<Filter, number> = { Due: dueRows.length, Paid: paidRows.length, Skipped: skippedRows.length };

  const positions = scopeCategories.map((c) => ({ category: c, ...categoryPosition(c, occurrences, payments, cutoff) }));
  const earmarked = positions.reduce((s, p) => s + p.earmarked, 0);

  const selected = sheet && (sheet.kind === "occurrence" || sheet.kind === "edit") ? occurrences.find((o) => o.key === sheet.key) : undefined;
  const selectedPayment = sheet?.kind === "payment" ? payments.find((p) => p.id === sheet.id) : undefined;

  const open = (next: Sheet) => {
    setSheet(next);
    setConfirm(null);
    setError("");
    setEditMode("only");
  };
  const close = () => open(null);
  const done = (message: string) => {
    setNotice(message);
    haptic("success");
    close();
  };
  const updateBill = (id: string, op: BillOp) => setBills((old) => old.map((b) => (b.id === id ? applyOp(b, op) : b)));
  const shift = (delta: number) => {
    setMonth((m) => addMonths(m, delta));
    setNotice("");
  };
  const reset = () => {
    setBills(seedBills);
    setPayments(seedPayments);
    setMonth(current);
    setFilter("Due");
    setNotice("Sample data restored.");
  };

  function addBill(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name")).trim();
    const amount = Number(f.get("amount"));
    const dueDate = String(f.get("due"));
    const categoryId = String(f.get("category"));
    const account = String(f.get("account"));
    if (!name || !Number.isFinite(amount) || amount <= 0 || !dueDate) {
      setError("Add a name, an amount above zero, and a due date.");
      return;
    }
    const bill: Schedule = {
      id: newId("bill"), name, amount, categoryId, dueDate, repeat: String(f.get("repeat")) as Repeat,
      meta: { ...emptyMeta(), account: account || undefined },
    };
    const next = [...bills, bill];
    setBills(next);
    if (dueDate > cutoff) setMonth(periodOf(dueDate));
    setFilter("Due");
    // An obligation can exist before it's funded: save, then say how short the category is.
    const through = dueDate > cutoff ? monthEnd(periodOf(dueDate)) : cutoff;
    const occ = deriveOccurrences(next, payments, TODAY, periodOf(through));
    const { free } = categoryPosition(categoryOf(categoryId)!, occ, payments, through);
    const short = free < 0 ? ` ${categoryOf(categoryId)!.name} is ${fmt(Math.abs(free))} MAD short for its bills.` : "";
    done(`${name} added.${short}`);
  }

  function payOccurrence(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget);
    const amount = Number(f.get("amount"));
    const date = String(f.get("date"));
    const accountId = String(f.get("account"));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount above zero.");
      return;
    }
    // The server route re-derives from fresh reads before writing; locally, the same check.
    const fresh = deriveOccurrences(bills, payments, TODAY, selected.period).find((o) => o.key === selected.key);
    if (!fresh || !isUnpaid(fresh)) {
      setError("This bill was already paid or skipped.");
      return;
    }
    const category = categoryOf(selected.categoryId)!;
    const available = availableFor(category, payments);
    if (amount > available) {
      haptic("warning");
      setError(`${category.name} has ${fmt(available)} MAD available. Fund it with at least ${fmt(amount - available)} MAD before recording this payment.`);
      return;
    }
    const payment: Payment = {
      id: newId("payment"), name: selected.bill.name, amount, categoryId: selected.categoryId, accountId, date,
      billId: selected.bill.id, period: selected.period,
    };
    setPayments((old) => [...old, payment]);
    done(`${selected.bill.name} paid. Its earmarked ${fmt(selected.amount)} MAD is released.`);
  }

  function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget);
    const amount = Number(f.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount above zero.");
      return;
    }
    const { bill, period } = selected;
    if (bill.repeat === "None") {
      const dueDate = String(f.get("due"));
      setBills((old) => old.map((b) => (b.id === bill.id ? { ...b, amount, dueDate, categoryId: String(f.get("category")), meta: { ...b.meta, overrides: {} } } : b)));
    } else if (editMode === "only") {
      updateBill(bill.id, { kind: "override", period, amount, due: String(f.get("due")) });
    } else {
      updateBill(bill.id, { kind: "editFuture", from: period, amount, categoryId: String(f.get("category")) });
    }
    done(editMode === "future" && bill.repeat !== "None" ? `${bill.name} updated from ${monthName(period)} on.` : `${bill.name} updated.`);
  }

  return (
    <main style={pageStyle}>
      <header style={topBarStyle}>
        <a href="/" aria-label="Back to app" style={iconButtonStyle}><ArrowLeftIcon size={20} /></a>
        <span style={mutedStyle}>Due lab (sample data)</span>
        <button type="button" aria-label="Reset sample data" onClick={reset} style={iconButtonStyle}><ReviveIcon /></button>
      </header>

      <div role="group" aria-label="Budget scope" style={{ ...chipsStyle, justifyContent: "center" }}>
        {SCOPES.map((s) => (
          <button key={s} type="button" aria-pressed={scope === s} style={chipStyle(scope === s)} onClick={() => { setScope(s); setNotice(""); haptic("selection"); }}>{s}</button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Due</h1>
        <button type="button" style={primaryButtonStyle} onClick={() => open({ kind: "add" })}><PlusIcon /> Add bill</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} style={iconButtonStyle}><ChevronLeftIcon /></button>
        <strong style={{ fontSize: 17, fontWeight: 600 }}>{monthLabel(month)}</strong>
        <button type="button" aria-label="Next month" onClick={() => shift(1)} style={iconButtonStyle}><ChevronRightIcon /></button>
      </div>

      {view === "past" ? (
        <p style={mutedStyle}>A past month: what was paid and skipped then. Anything still unpaid from it shows as overdue.</p>
      ) : (
        <section aria-label="Money set aside for bills" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <span style={labelStyle}>Earmarked through {dateLabel(cutoff)}</span>
            <strong style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em" }}><Money value={earmarked} currency /></strong>
            <span style={mutedStyle}>{plural(dueRows.length, "unpaid bill")}, overdue included. Still your money until you pay.</span>
          </div>
          <ul aria-label="By category" style={listStyle}>
            {positions.map(({ category, available, earmarked: held, free }) => (
              <li key={category.id} style={{ ...rowStyle, borderBottom: "1px solid var(--border)" }}>
                <span aria-hidden="true" style={emojiStyle}>{category.icon}</span>
                <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{category.name}</span>
                  {view === "current" ? (
                    <span style={captionStyle}><span style={{ display: "block" }}><Money value={available} /> available</span><span style={{ display: "block" }}><Money value={held} /> earmarked</span></span>
                  ) : (
                    <span style={captionStyle}>Earmarked through {monthName(month)}</span>
                  )}
                  {view === "current" && free < 0 && (
                    <span style={{ ...captionStyle, color: "var(--danger)" }}>Fund <Money value={-free} /> more to cover these bills</span>
                  )}
                </span>
                {view === "current" ? (
                  <span style={{ display: "grid", justifyItems: "end", gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: free < 0 ? "var(--danger)" : "var(--text)" }}><Money value={free} /></span>
                    <span style={captionStyle}>free after bills</span>
                  </span>
                ) : (
                  <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}><Money value={held} /></span>
                )}
              </li>
            ))}
          </ul>
          {view === "future" && (
            <p style={mutedStyle}>Free after bills is left out for future months: {monthName(month)}’s income and allocations aren’t in yet, so today’s balance would look short.</p>
          )}
        </section>
      )}

      <div role="group" aria-label="Show" style={chipsStyle}>
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} style={chipStyle(filter === f)} onClick={() => { setFilter(f); haptic("selection"); }}>
            {f} <span style={{ fontWeight: 400, opacity: 0.8 }}>{counts[f]}</span>
          </button>
        ))}
      </div>

      <section aria-label={`${filter} bills`} style={{ marginTop: -8 }}>
        <div role="status" style={{ ...mutedStyle, color: "var(--text2)", paddingBottom: notice ? 12 : 0 }}>{notice}</div>
        {counts[filter] === 0 ? (
          <div style={{ display: "grid", justifyItems: "center", gap: 8, padding: "32px 16px", textAlign: "center", color: "var(--text2)" }}>
            <CheckIcon size={24} />
            <strong style={{ fontSize: 17, color: "var(--text)" }}>{filter === "Due" ? "Nothing due" : `Nothing ${filter.toLowerCase()} in ${monthName(month)}`}</strong>
            <span style={mutedStyle}>{filter === "Due" ? "Bills you add show up here every month on their own." : "Bills appear here as you pay or skip them."}</span>
          </div>
        ) : (
          <ul style={listStyle}>
            {filter === "Paid"
              ? paidRows.map((p) => {
                  const dupe = duplicates.has(`${p.billId}:${p.period}`);
                  const late = p.period && p.period !== periodOf(p.date) ? ` for ${monthName(p.period)}` : "";
                  return (
                    <BillRow key={p.id} icon={categoryOf(p.categoryId)?.icon} title={p.name} amount={p.amount} onClick={() => open({ kind: "payment", id: p.id })}
                      detail={categoryOf(p.categoryId)?.name ?? ""}
                      status={dupe ? "Recorded twice" : `Paid ${dateLabel(p.date)}${late}`} danger={dupe} />
                  );
                })
              : (filter === "Due" ? dueRows : skippedRows).map((o) => (
                  <BillRow key={o.key} icon={categoryOf(o.categoryId)?.icon} title={o.bill.name} amount={o.amount} onClick={() => open({ kind: "occurrence", key: o.key })}
                    detail={<>{categoryOf(o.categoryId)?.name}{o.bill.repeat !== "None" && <span style={{ display: "block" }}><RepeatIcon size={12} style={{ verticalAlign: "-1px" }} /> {o.bill.repeat}</span>}</>}
                    status={occurrenceStatus(o)} danger={o.state === "overdue"} />
                ))}
          </ul>
        )}
      </section>

      <footer style={{ ...mutedStyle, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        Demo date {dateLabel(TODAY)} 2026. Occurrences are derived from each bill’s schedule; only payments and skips are stored. Nothing is sent to Notion, and a reload resets it.
      </footer>

      <BottomSheet open={sheet !== null} onClose={close} label={sheet?.kind === "add" ? "Add bill" : selected?.bill.name ?? selectedPayment?.name} detent="content">
        <div style={sheetContentStyle}>
          {sheet?.kind === "add" && (
            <>
              <SheetHeader title="Add bill" onClose={close} />
              <p style={mutedStyle}>Money stays available until you pay. The bill just sets part of it aside.</p>
              <form onSubmit={addBill} style={formStyle}>
                <Field label="Name"><input name="name" placeholder="e.g. Internet" required maxLength={100} style={inputStyle} /></Field>
                <Field label="Expected amount (MAD)"><input name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required style={inputStyle} /></Field>
                <Field label="Category">
                  <select name="category" style={inputStyle}>{scopeCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select>
                </Field>
                <div style={pairStyle}>
                  <Field label="First due date"><input name="due" type="date" defaultValue={view === "current" ? TODAY : `${month}-01`} required style={inputStyle} /></Field>
                  <Field label="Repeat">
                    <select name="repeat" defaultValue="Monthly" style={inputStyle}><option value="None">One-off</option><option>Monthly</option><option>Yearly</option></select>
                  </Field>
                </div>
                <Field label="Usually paid from">
                  <select name="account" style={inputStyle}><option value="">Choose when paying</option>{scopeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                </Field>
                <ErrorText error={error} />
                <button type="submit" style={primaryButtonStyle}>Add bill</button>
              </form>
            </>
          )}

          {sheet?.kind === "occurrence" && selected && (
            <>
              <SheetHeader title={selected.bill.name} onClose={close} />
              <p style={mutedStyle}><span style={{ display: "block" }}>{occurrenceStatus(selected)}</span><span style={{ display: "block" }}>{categoryOf(selected.categoryId)?.name}</span><span style={{ display: "block" }}>{repeatLabel(selected.bill.repeat)}</span></p>
              {selected.state === "skipped" ? (
                <>
                  <div style={amountStyle}><Money value={selected.amount} currency /></div>
                  <p style={mutedStyle}>Skipped, so nothing is set aside for it. Restoring sets <Money value={selected.amount} /> aside again.</p>
                  <button type="button" style={secondaryButtonStyle} onClick={() => { updateBill(selected.bill.id, { kind: "restore", period: selected.period }); done(`${selected.bill.name} for ${monthName(selected.period)} restored.`); }}>
                    <ReviveIcon /> Restore
                  </button>
                </>
              ) : (
                <PayForm key={selected.key} occurrence={selected} payments={payments} occurrences={occurrences} cutoff={cutoff}
                  accounts={scopeAccounts} error={error} onSubmit={payOccurrence} onChange={() => setError("")}
                  onEdit={() => { open({ kind: "edit", key: selected.key }); }}
                  onSkip={() => { updateBill(selected.bill.id, { kind: "skip", period: selected.period }); done(`${selected.bill.name} for ${monthName(selected.period)} skipped. Next one still comes.`); }} />
              )}
              <SeriesActions occurrence={selected} occurrences={occurrences} payments={payments} confirm={confirm} setConfirm={setConfirm}
                onStop={() => { updateBill(selected.bill.id, { kind: "stop", end: selected.period }); done(`${selected.bill.name} stops after ${monthName(selected.period)}.`); }}
                onDelete={() => { setBills((old) => old.filter((b) => b.id !== selected.bill.id)); done(`${selected.bill.name} deleted. Its payments stay as expenses.`); }} />
            </>
          )}

          {sheet?.kind === "edit" && selected && (
            <>
              <SheetHeader title={`Edit ${selected.bill.name}`} onClose={close} />
              {selected.bill.repeat !== "None" && (
                <div role="radiogroup" aria-label="What to change" style={chipsStyle}>
                  {(["only", "future"] as const).map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={editMode === m} style={chipStyle(editMode === m)} onClick={() => setEditMode(m)}>
                      {m === "only" ? `Only ${monthName(selected.period)}` : `${monthName(selected.period)} and later`}
                    </button>
                  ))}
                </div>
              )}
              <form key={editMode} onSubmit={saveEdit} style={formStyle}>
                <Field label="Expected amount (MAD)">
                  <input name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required defaultValue={selected.amount} style={inputStyle} />
                </Field>
                {(selected.bill.repeat === "None" || editMode === "only") && (
                  <Field label="Due date"><input name="due" type="date" required defaultValue={selected.due} style={inputStyle} /></Field>
                )}
                {(selected.bill.repeat === "None" || editMode === "future") && (
                  <Field label="Category">
                    <select name="category" defaultValue={selected.categoryId} style={inputStyle}>{scopeCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select>
                  </Field>
                )}
                <EditNote occurrence={selected} occurrences={occurrences} mode={editMode} />
                <ErrorText error={error} />
                <button type="submit" style={primaryButtonStyle}>Save</button>
              </form>
            </>
          )}

          {sheet?.kind === "payment" && selectedPayment && (
            <PaymentDetails payment={selectedPayment} duplicate={duplicates.has(`${selectedPayment.billId}:${selectedPayment.period}`)} confirm={confirm} setConfirm={setConfirm} onClose={close}
              onUndo={() => { setPayments((old) => old.filter((p) => p.id !== selectedPayment.id)); done(`Payment removed. ${selectedPayment.name} for ${monthName(selectedPayment.period!)} is due again.`); }} />
          )}
        </div>
      </BottomSheet>
    </main>
  );
}

// ── Sheet parts ─────────────────────────────────────────────────────────────

function PayForm({ occurrence, payments, occurrences, cutoff, accounts: options, error, onSubmit, onChange, onEdit, onSkip }: {
  occurrence: Occurrence; payments: Payment[]; occurrences: Occurrence[]; cutoff: string; accounts: typeof accounts; error: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void; onChange: () => void; onEdit: () => void; onSkip: () => void;
}) {
  const [amount, setAmount] = useState(String(occurrence.amount));
  const category = categoryOf(occurrence.categoryId)!;
  const available = availableFor(category, payments);
  // The impact on other bills leaves out this bill's own reservation.
  const others = occurrences
    .filter((o) => o.key !== occurrence.key && isUnpaid(o) && o.categoryId === category.id && o.due <= cutoff)
    .reduce((s, o) => s + o.amount, 0);
  const paying = Number(amount) || 0;
  const after = available - paying;
  const defaultAccount = options.some((a) => a.id === occurrence.bill.meta.account) ? occurrence.bill.meta.account : options[0]?.id;

  return (
    <form onSubmit={onSubmit} style={formStyle} onChange={onChange}>
      <Field label="Paid amount (MAD)">
        <input name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} />
      </Field>
      <div style={pairStyle}>
        <Field label="Paid on"><input name="date" type="date" required defaultValue={TODAY} max={TODAY} style={inputStyle} /></Field>
        <Field label="From">
          <select name="account" defaultValue={defaultAccount} style={inputStyle}>{options.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </Field>
      </div>
      <div style={noteStyle}>
        Releases the <Money value={occurrence.amount} /> set aside. {category.name} would have <Money value={after} /> left
        {others > 0 && <>, with <Money value={others} /> still set aside for other bills</>}.
        {after < others && after >= 0 && <span style={{ color: "var(--danger)" }}> Those bills would be <Money value={others - after} /> short.</span>}
      </div>
      <p style={mutedStyle}>Don’t also add this payment as a normal expense, or it’ll count twice.</p>
      <ErrorText error={error} />
      <button type="submit" style={primaryButtonStyle}><CheckIcon /> Mark paid</button>
      <div style={pairStyle}>
        <button type="button" style={{ ...secondaryButtonStyle, flex: 1 }} onClick={onEdit}>Edit</button>
        <button type="button" style={{ ...secondaryButtonStyle, flex: 1 }} onClick={onSkip}>Skip {occurrence.bill.repeat === "None" ? "this bill" : `${monthName(occurrence.period)}`}</button>
      </div>
    </form>
  );
}

function SeriesActions({ occurrence, occurrences, payments, confirm, setConfirm, onStop, onDelete }: {
  occurrence: Occurrence; occurrences: Occurrence[]; payments: Payment[]; confirm: Confirm; setConfirm: (c: Confirm) => void; onStop: () => void; onDelete: () => void;
}) {
  const { bill, period } = occurrence;
  const unpaidUpTo = occurrences.filter((o) => o.bill.id === bill.id && isUnpaid(o) && o.period <= period).length;
  const horizon = period > periodOf(TODAY) ? period : periodOf(TODAY);
  const unpaidShown = occurrences.filter((o) => o.bill.id === bill.id && isUnpaid(o) && o.period <= horizon).length;
  const paidCount = payments.filter((p) => p.billId === bill.id).length;
  const stopped = bill.meta.end !== undefined && bill.meta.end <= period;

  return (
    <div style={{ display: "grid", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
      {bill.repeat !== "None" && !stopped && (
        confirm === "stop" ? (
          <ConfirmBox text={`Nothing after ${monthName(period)} will be due. ${plural(unpaidUpTo, "unpaid bill")} up to then stay payable.`} action="Stop repeating" onConfirm={onStop} onCancel={() => setConfirm(null)} />
        ) : (
          <button type="button" style={quietButtonStyle} onClick={() => setConfirm("stop")}>Stop repeating after {monthName(period)}</button>
        )
      )}
      {confirm === "delete" ? (
        <ConfirmBox danger text={`Removes ${bill.name} and ${plural(unpaidShown, "unpaid occurrence")}. ${plural(paidCount, "recorded payment")} stay as ordinary expenses.`} action="Delete bill" onConfirm={onDelete} onCancel={() => setConfirm(null)} />
      ) : (
        <button type="button" style={{ ...quietButtonStyle, color: "var(--danger)" }} onClick={() => setConfirm("delete")}>Delete bill</button>
      )}
    </div>
  );
}

function EditNote({ occurrence, occurrences, mode }: { occurrence: Occurrence; occurrences: Occurrence[]; mode: "only" | "future" }) {
  if (occurrence.bill.repeat === "None") return null;
  if (mode === "only") return <p style={mutedStyle}>Changes {monthName(occurrence.period)} only. Other months keep their amount and date.</p>;
  const earlier = occurrences.filter((o) => o.bill.id === occurrence.bill.id && isUnpaid(o) && o.period < occurrence.period);
  return (
    <p style={mutedStyle}>
      Applies from {monthName(occurrence.period)} on. Paid months don’t change.
      {earlier.length > 0 && <> {plural(earlier.length, "earlier unpaid bill")} ({earlier.map((o) => monthName(o.period)).join(", ")}) keep their current amount.</>}
    </p>
  );
}

function PaymentDetails({ payment, duplicate, confirm, setConfirm, onClose, onUndo }: {
  payment: Payment; duplicate: boolean; confirm: Confirm; setConfirm: (c: Confirm) => void; onClose: () => void; onUndo: () => void;
}) {
  const category = categoryOf(payment.categoryId);
  return (
    <>
      <SheetHeader title={payment.name} onClose={onClose} />
      <div style={amountStyle}><Money value={payment.amount} currency /></div>
      <p style={mutedStyle}>Paid {dateLabel(payment.date)} from {accountName(payment.accountId)} for {monthName(payment.period!)}<span style={{ display: "block" }}>{category?.name}</span></p>
      {duplicate && (
        <div style={{ ...noteStyle, display: "flex", gap: 8, color: "var(--danger)" }}>
          <AlertTriangleIcon style={{ flexShrink: 0 }} />
          <span>{monthName(payment.period!)} has two payments recorded, likely from two phones at once. If it was only paid once, undo one of them.</span>
        </div>
      )}
      {confirm === "undo" ? (
        <ConfirmBox danger text={`Removes ${fmt(payment.amount)} MAD of spending from ${category?.name}. ${payment.name} for ${monthName(payment.period!)} becomes due again.`} action="Undo payment" onConfirm={onUndo} onCancel={() => setConfirm(null)} />
      ) : (
        <button type="button" style={secondaryButtonStyle} onClick={() => setConfirm("undo")}><ReviveIcon /> Undo payment</button>
      )}
    </>
  );
}

// ── Small parts ─────────────────────────────────────────────────────────────

function BillRow({ icon, title, detail, status, amount, danger, onClick }: {
  icon?: string; title: string; detail: ReactNode; status: string; amount: number; danger?: boolean; onClick: () => void;
}) {
  return (
    <li style={{ borderBottom: "1px solid var(--border)" }}>
      <button type="button" onClick={onClick} style={rowButtonStyle}>
        <span aria-hidden="true" style={emojiStyle}>{icon}</span>
        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
          <strong style={{ fontSize: 15, fontWeight: 600 }}>{title}</strong>
          <span style={captionStyle}>{detail}</span>
          <span style={{ ...captionStyle, color: danger ? "var(--danger)" : "var(--text2)" }}>{status}</span>
        </span>
        <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}><Money value={amount} /></span>
        <ChevronRightIcon size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
      </button>
    </li>
  );
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h2>
      <button type="button" aria-label="Close" onClick={onClose} style={iconButtonStyle}><XIcon size={20} /></button>
    </header>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={fieldStyle}>{label}{children}</label>;
}

function ErrorText({ error }: { error: string }) {
  return error ? <p role="alert" style={{ ...mutedStyle, color: "var(--danger)" }}>{error}</p> : null;
}

function ConfirmBox({ text, action, danger, onConfirm, onCancel }: { text: string; action: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ ...noteStyle, display: "grid", gap: 12 }}>
      <span>{text}</span>
      <div style={pairStyle}>
        <button type="button" style={{ ...secondaryButtonStyle, flex: 1, background: "var(--surface)" }} onClick={onCancel}>Cancel</button>
        <button type="button" style={{ ...secondaryButtonStyle, flex: 1, background: "var(--surface)", color: danger ? "var(--danger)" : "var(--text)" }} onClick={onConfirm}>{action}</button>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  display: "grid", gap: 20, maxWidth: 560, margin: "0 auto", padding: "calc(var(--safe-top, 0px) + 12px) 16px calc(64px + env(safe-area-inset-bottom))",
  boxSizing: "border-box", minHeight: "100dvh", background: "var(--bg)", color: "var(--text)",
};
const topBarStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const mutedStyle: CSSProperties = { margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 };
const labelStyle: CSSProperties = { fontSize: 13, color: "var(--text2)" };
const captionStyle: CSSProperties = { fontSize: 13, color: "var(--text2)", fontVariantNumeric: "tabular-nums" };
const chipsStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const chipStyle = (on: boolean): CSSProperties => ({
  minHeight: 44, padding: "0 14px", border: 0, borderRadius: 999, font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
  background: on ? "var(--select-wash)" : "var(--surface2)", color: on ? "var(--select-ink)" : "var(--text2)",
});
const iconButtonStyle: CSSProperties = {
  width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: "var(--radius-control)",
  background: "transparent", color: "var(--text2)", cursor: "pointer",
};
const buttonBase: CSSProperties = {
  minHeight: 48, padding: "0 16px", border: 0, borderRadius: "var(--radius-control)", font: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
};
const primaryButtonStyle: CSSProperties = { ...buttonBase, background: "var(--accent)", color: "var(--accent-ink)" };
const secondaryButtonStyle: CSSProperties = { ...buttonBase, background: "var(--surface2)", color: "var(--text)" };
const quietButtonStyle: CSSProperties = { ...buttonBase, minHeight: 44, background: "transparent", color: "var(--text2)", fontWeight: 500 };
const listStyle: CSSProperties = { listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--border)" };
const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "10px 0" };
const rowButtonStyle: CSSProperties = { ...rowStyle, width: "100%", border: 0, background: "transparent", color: "var(--text)", font: "inherit", textAlign: "left", cursor: "pointer" };
const emojiStyle: CSSProperties = { width: 32, display: "inline-flex", justifyContent: "center", fontSize: 22, flexShrink: 0 };
const sheetContentStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 16, padding: "16px 20px max(20px, env(safe-area-inset-bottom))", boxSizing: "border-box" };
const formStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 14 };
const pairStyle: CSSProperties = { display: "flex", gap: 12 };
const fieldStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--text2)", flex: 1, minWidth: 0 };
const inputStyle: CSSProperties = {
  width: "100%", minHeight: 48, boxSizing: "border-box", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-control)",
  padding: "0 12px", color: "var(--text)", font: "inherit", fontSize: 16,
};
const noteStyle: CSSProperties = { padding: 14, background: "var(--surface2)", borderRadius: "var(--radius-control)", fontSize: 13, lineHeight: 1.6, color: "var(--text2)" };
const amountStyle: CSSProperties = { fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" };
