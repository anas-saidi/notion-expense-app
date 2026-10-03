"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Account, BudgetScope, Category } from "./app-types";
import { deriveOccurrences, earmarkedByCategory, normalizedId, type BillsData, type BillOccurrence, type BillRepeat } from "@/lib/bills";
import { categoryMatchesScope, expenseBudgetGate, fmtDate, monthBounds, parseAmount } from "./app-utils";
import { BottomSheet } from "./ui/BottomSheet";
import { TransactionRow } from "./ui/TransactionRow";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { Money } from "./Money";
import { Banner } from "./ui/Banner";
import { CategoryIcon } from "./ui/CategoryIcon";
import { ChevronRightIcon, ChevronLeftIcon, PlusIcon, XIcon, ReceiptIcon, EditIcon, MoreIcon } from "./ui/icons";
import { SkeletonRows } from "./ui/Skeleton";
import { DatePicker, MonthPicker } from "./DatePicker";
import { PickerPopover } from "./PickerPopover";
import { AccountOptionList, CategoryOptionList } from "./TransactionPickers";
import { useAppHaptics } from "./ui/useAppHaptics";
import "./bills.css";

type Props = { data: BillsData | null; loading: boolean; error: string | null; categories: Category[]; accounts: Account[]; scope: BudgetScope; onRetry: () => void; onChanged: () => Promise<void> };
type View = "list" | "add" | "detail" | "pay" | "edit";
export function BillsSection({ data, loading, error, categories, accounts, scope, onRetry, onChanged }: Props) {
  const { haptic } = useAppHaptics();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [month, setMonth] = useState("");
  const [filter, setFilter] = useState<"Due" | "Paid" | "Skipped">("Due");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(""); const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(""); const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(""); const [repeat, setRepeat] = useState<BillRepeat>("None");
  const [target, setTarget] = useState<"occurrence" | "future">("occurrence");
  const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState("");
  const [savedPendingRefresh, setSavedPendingRefresh] = useState(false);
  const busy = useRef(false);
  const [confirm, setConfirm] = useState<"skip" | "stop" | "delete" | string | null>(null);
  const [picker, setPicker] = useState<"category" | "account" | null>(null);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");
  const categoryRef = useRef<HTMLButtonElement>(null); const accountRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (busy.current) return;
    setShowMore(false); setView("list"); setSelectedId(null); setPicker(null); setConfirm(null); setSaveError("");
  }, [scope]);
  const currentMonth = data?.today.slice(0, 7) ?? "";
  const activeMonth = month || currentMonth;
  const allOccurrences = useMemo(() => data ? deriveOccurrences(data.schedules, data.payments, data.today, activeMonth > currentMonth ? activeMonth : currentMonth) : [], [data, activeMonth, currentMonth]);
  const scoped = allOccurrences.filter(o => categories.some(c => normalizedId(c.id) === normalizedId(o.categoryId) && categoryMatchesScope(c, scope, accounts)));
  const selected = scoped.find(o => o.id === selectedId);
  const cutoff = activeMonth ? monthBounds(`${activeMonth}-01`).end : "";
  const currentCutoff = currentMonth ? monthBounds(`${currentMonth}-01`).end : "";
  const currentDue = scoped.filter(o => (o.state === "Due" || o.state === "Overdue") && o.dueDate <= currentCutoff);
  const shown = scoped.filter(o => filter === "Paid" ? o.state === "Paid" && o.payments.some(p => p.date.slice(0, 7) === activeMonth)
    : filter === "Skipped" ? o.state === "Skipped" && o.period === activeMonth
    : (o.state === "Due" || o.state === "Overdue") && (activeMonth === currentMonth ? o.dueDate <= cutoff : o.dueDate.slice(0, 7) === activeMonth));
  const reservations = earmarkedByCategory(scoped, currentCutoff);
  const category = categories.find(c => normalizedId(c.id) === normalizedId(categoryId));
  const selectedCategory = categories.find(c => selected && normalizedId(c.id) === normalizedId(selected.categoryId));
  const expected = parseAmount(amount) ?? 0;
  const gate = expenseBudgetGate({ available: selectedCategory?.available ?? null, amount: expected });
  const enabled = !saving && !savedPendingRefresh && !loading && !error;

  function move(next: View) { setShowMore(false); setView(next); setSaveError(""); setConfirm(null); setPicker(null); haptic("selection"); }
  function add() {
    setName(""); setAmount(""); setCategoryId(""); setAccountId(""); setDate(data?.today ?? ""); setRepeat("None");
    setSelectedId(null); setSavedPendingRefresh(false); setOpen(true); move("add");
  }
  function details(bill: BillOccurrence) { setSelectedId(bill.id); setSavedPendingRefresh(false); setOpen(true); move("detail"); }
  function prepare(next: "pay" | "edit", bill = selected) {
    if (!bill) return;
    setSelectedId(bill.id); setOpen(true); setSavedPendingRefresh(false);
    setName(bill.name); setAmount(String(bill.amount)); setCategoryId(bill.categoryId); setAccountId(bill.accountId ?? "");
    setDate(next === "pay" ? data!.today : bill.dueDate); setRepeat(bill.repeat); setTarget("occurrence"); move(next);
  }
  async function mutate(method: string, body: object) {
    if (busy.current || !enabled) return;
    busy.current = true; setSaving(true); setSaveError("");
    let written = false;
    try {
      const response = await fetch("/api/bills", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not save bill");
      written = true;
      // Keep the reservation visible until all actual balances and payments have refreshed.
      await onChanged(); haptic("success"); move("list");
    } catch (err) {
      setSavedPendingRefresh(written);
      setSaveError(written ? "Saved, but balances could not refresh. Refresh before making another change." : err instanceof Error ? err.message : "Could not save bill"); haptic("error");
    } finally { busy.current = false; setSaving(false); }
  }
  async function retrySaved() {
    if (busy.current) return;
    busy.current = true; setSaving(true);
    try { await onChanged(); setSavedPendingRefresh(false); setSaveError(""); move("list"); }
    catch { setSaveError("Balances could not refresh. Try refreshing again."); }
    finally { busy.current = false; setSaving(false); }
  }
  const paymentOtherReserved = selected ? Math.max(0, (reservations[normalizedId(selected.categoryId)] ?? 0) - (selected.dueDate <= currentCutoff ? selected.amount : 0)) : 0;
  const draftReservation = view === "add" && date <= currentCutoff ? expected : 0;
  const draftFree = category?.available == null ? null : category.available - (reservations[normalizedId(category.id)] ?? 0) - draftReservation;
  const formReady = expected > 0 && date && (view === "pay" ? !!selected && !!accountId && !gate.unfunded && !gate.overBudget : !!name.trim() && !!category && !category.snoozed && !category.archived && categoryMatchesScope(category, scope, accounts));

  return <section className="bills-section" aria-label="Due bills">
    <div className="bills-section-heading"><h2 className="section-label">Due bills</h2><div className="bills-heading-actions"><button type="button" className="bills-quiet-action" disabled={!enabled} onClick={() => { setOpen(true); move("list"); }}>All bills <ChevronRightIcon size={16} /></button></div></div>
    {loading ? <SkeletonRows count={2} /> : error ? <Banner role="alert" tone="danger" compact action={<button type="button" onClick={onRetry}>Retry</button>}>{error}</Banner>
      : <>
        {currentDue.length ? <>
          {currentDue.slice(0, 3).map(bill => <BillRow key={bill.id} bill={bill} category={categories.find(c => normalizedId(c.id) === normalizedId(bill.categoryId))} onClick={() => details(bill)} onPay={() => prepare("pay", bill)} onEdit={() => prepare("edit", bill)} disabled={!enabled} compact />)}
        </> : <p className="bills-muted">No bills due.</p>}
      </>}
    <BottomSheet open={open} onClose={() => { if (!saving) { setOpen(false); setPicker(null); setShowMore(false); } }} label={view === "list" ? "Bills" : view === "add" ? "Add bill" : view === "pay" ? "Pay due" : view === "edit" ? "Edit bill" : selected?.name ?? "Bill"} maxWidth="520px" contentStyle={{ paddingTop: 0 }}>
      <div className={`bills-sheet${view === "detail" ? " bills-sheet-detail" : ""}`}>
        <header className="bills-sheet-header">
          <div className="bills-header-title">{(view === "pay" || view === "edit") && <button type="button" className="bills-icon-action" aria-label="Back to bill" disabled={saving || savedPendingRefresh} onClick={() => move("detail")}><ChevronLeftIcon size={20} /></button>}<h2>{view === "list" ? "Bills" : view === "add" ? "Add bill" : view === "pay" ? "Pay due" : view === "edit" ? "Edit bill" : selected?.name ?? "Bill"}</h2></div>
          <button type="button" aria-label="Close bills" disabled={saving} className="bills-icon-action sheet-close-button" onClick={() => { setOpen(false); setPicker(null); setShowMore(false); }}><XIcon size={20} /></button>
        </header>
        {saveError && <Banner role="alert" tone="danger" compact>{saveError}{savedPendingRefresh && <button type="button" className="bills-quiet-action" disabled={saving} onClick={retrySaved}>Refresh balances</button>}</Banner>}
        {loading ? <SkeletonRows /> : error ? <Banner role="alert" tone="danger" compact action={<button type="button" onClick={onRetry}>Retry</button>}>{error}</Banner> : <>
        {view === "list" && <>
          <div className="bills-list-controls"><MonthPicker value={activeMonth} onChange={e => setMonth(e.target.value)} aria-label="Bill month" /><button type="button" className="bills-quiet-action" onClick={add}><PlusIcon size={16} /> Add bill</button></div>
          <div className="bills-filters" role="group" aria-label="Bill state">{(["Due", "Paid", "Skipped"] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); haptic("selection"); }}>{value}</button>)}</div>
          {filter === "Due" && activeMonth === currentMonth && <div className="bills-category-context">
            <p className="bills-muted">Bills due through {fmtDate(cutoff)}, including overdue bills.</p>
            {categories.filter(c => categoryMatchesScope(c, scope, accounts) && reservations[normalizedId(c.id)]).map(c => {
              const reserved = reservations[normalizedId(c.id)]; const free = c.available == null ? null : c.available - reserved;
              return <div key={c.id} className="bills-category-summary"><strong>{c.name}</strong><dl><div><dt>Available</dt><dd>{c.available == null ? "Unavailable" : <Money value={c.available} />}</dd></div><div><dt>Earmarked</dt><dd><Money value={reserved} /></dd></div><div><dt>Free after bills</dt><dd style={{ color: free != null && free < 0 ? "var(--danger)" : undefined }}>{free == null ? "Unavailable" : <Money value={free} />}</dd></div></dl>{free != null && free < 0 && <p className="bills-muted">Fund <Money value={-free} /> to cover these bills.</p>}</div>;
            })}
          </div>}
          {shown.length ? shown.map(bill => <BillRow key={bill.id} bill={bill} category={categories.find(c => normalizedId(c.id) === normalizedId(bill.categoryId))} onClick={() => details(bill)} onPay={() => prepare("pay", bill)} onEdit={() => prepare("edit", bill)} disabled={!enabled} paidMonth={filter === "Paid" ? activeMonth : undefined} />) : <p className="bills-empty">No {filter.toLowerCase()} bills for this month.</p>}
        </>}
        {view === "detail" && selected && <>
          <section className="bills-detail-summary"><div className="bills-detail-amount"><Money value={selected.amount} currency /></div>
          <p className="bills-muted">{selected.state === "Due" ? "Due" : selected.state === "Overdue" ? "Overdue since" : "Scheduled for"} {fmtDate(selected.dueDate)}</p></section>
          <div className="bills-detail-actions">
            {selected.state === "Due" || selected.state === "Overdue" ? <><button type="button" className="pressable bills-toolbar-action bills-toolbar-primary" disabled={!enabled} onClick={() => prepare("pay")}><ReceiptIcon size={17} />Pay due</button><button type="button" className="pressable bills-toolbar-action bills-toolbar-secondary" disabled={!enabled} onClick={() => prepare("edit")}><EditIcon size={17} />Edit</button></> : selected.state === "Skipped" ? <button type="button" className="pressable bills-toolbar-action bills-toolbar-primary" disabled={!enabled} onClick={() => mutate("PATCH", { action: "restore", billId: selected.billId, period: selected.period })}>Restore</button> : null}
            <button type="button" ref={moreRef} className="pressable bills-toolbar-action bills-toolbar-more" aria-label="More bill actions" aria-haspopup="dialog" aria-expanded={showMore} disabled={!enabled} onClick={() => setShowMore(!showMore)}><MoreIcon size={18} />More</button>
          </div>
          <dl className="bills-detail-context"><div><dt>Category</dt><dd className="bills-category-value"><CategoryIcon icon={selectedCategory?.icon ?? null} size={22} /><span>{selectedCategory?.name ?? "Unavailable"}</span></dd></div>{selected.repeat !== "None" && <div><dt>Repeats</dt><dd>{selected.repeat}</dd></div>}{selected.state === "Paid" || selected.state === "Skipped" ? <div><dt>Status</dt><dd>{selected.state}</dd></div> : null}</dl>
          {selected.payments.length > 1 && <Banner tone="danger">Payment recorded twice. Review each expense below.</Banner>}
          {selected.state === "Paid" ? selected.payments.map(payment => <div key={payment.id} className="bills-payment"><p><Money value={payment.amount} /></p><p className="bills-muted">Paid {fmtDate(payment.date)}</p><a href={`https://www.notion.so/${normalizedId(payment.id)}`} target="_blank" rel="noreferrer">View expense in Notion</a><button type="button" className="bills-quiet-action" disabled={!enabled} onClick={() => setConfirm(payment.id)}>Undo payment</button></div>)
            : null}
          {confirm && <Banner tone="warning"><p>{confirm === "delete" ? "Delete this schedule? All its unpaid bills disappear. Recorded payment expenses remain." : confirm === "skip" ? "Skip this occurrence? It releases its earmarked money without recording spending. You can restore it." : confirm === "stop" ? `Stop after ${selected.period}? Later bills disappear; earlier unpaid bills remain payable.` : "Undo this payment? This removes the expense from spending and makes the bill due again."}</p><div className="bills-confirm-actions"><button type="button" className="bills-secondary" disabled={!enabled} onClick={() => setConfirm(null)}>Cancel</button><button type="button" className="bills-primary" disabled={!enabled} onClick={() => mutate(confirm === "skip" || confirm === "stop" ? "PATCH" : "DELETE", confirm === "skip" || confirm === "stop" ? { action: confirm, billId: selected.billId, period: selected.period } : confirm === "delete" ? { billId: selected.billId } : { paymentId: confirm })}>Confirm {confirm === "skip" || confirm === "stop" || confirm === "delete" ? confirm : "undo"}</button></div></Banner>}
        </>}
        {view === "detail" && !selected && <p className="bills-empty">This occurrence is no longer available. Close and reopen bills to choose another occurrence.</p>}
        {(view === "add" || view === "pay" || view === "edit") && <form className="bills-form" onSubmit={event => { event.preventDefault(); if (!enabled || !formReady) return;
          mutate(view === "edit" ? "PATCH" : "POST", view === "pay" ? { action: "pay", billId: selected?.billId, period: selected?.period, amount: expected, accountId, date }
            : { action: view === "edit" ? "edit" : "create", billId: selected?.billId, period: selected?.period, target, name, amount: expected, categoryId, accountId, dueDate: date, repeat });
        }}>
          <fieldset disabled={!enabled}>
          {view === "edit" && selected?.repeat !== "None" && <label>Apply to<select value={target} onChange={e => setTarget(e.target.value as typeof target)}><option value="occurrence">This occurrence</option><option value="future">This and future occurrences</option></select></label>}
          {view !== "pay" && (view === "add" || target === "future") && <label>Bill name<input value={name} onChange={e => setName(e.target.value)} maxLength={200} required autoComplete="off" /></label>}
          <label>{view === "pay" ? "Paid amount (MAD)" : "Expected amount (MAD)"}<input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0" required /></label>
          {view !== "pay" && <div className="bills-field"><span id="bill-category-label">Category</span><button type="button" ref={categoryRef} className="bills-choice" aria-labelledby="bill-category-label" aria-haspopup="dialog" aria-expanded={picker === "category"} onClick={() => { setSearch(""); setPicker(picker === "category" ? null : "category"); }}>{category?.name ?? "Choose category"}</button></div>}
          {(view === "add" || view === "pay" || target === "future") && <div className="bills-field"><span id="bill-account-label">{view === "pay" ? "Payment account" : "Suggested account (optional)"}</span><button type="button" ref={accountRef} className="bills-choice" aria-labelledby="bill-account-label" aria-haspopup="dialog" aria-expanded={picker === "account"} onClick={() => setPicker(picker === "account" ? null : "account")}>{accounts.find(a => a.id === accountId)?.label ?? "Choose account"}</button></div>}
          <div className="bills-field"><span>{view === "pay" ? "Payment date" : view === "add" ? "First due date" : "Due date"}</span>{view === "edit" && target === "future" ? <span>{fmtDate(date)}</span> : <DatePicker value={date} onChange={e => setDate(e.target.value)} aria-label={view === "pay" ? "Payment date" : "Due date"} />}</div>
          {view === "add" && <label>Repeat<select value={repeat} onChange={e => setRepeat(e.target.value as BillRepeat)}><option>None</option><option>Monthly</option><option>Yearly</option></select></label>}
          </fieldset>
          {view === "edit" && target === "future" && <p className="bills-muted">Earlier unpaid bills keep their amounts. Recurrence stays {repeat.toLowerCase()}.</p>}
          {view === "add" && draftFree != null && draftFree < 0 && <Banner tone="warning">Short by <Money value={-draftFree} /> after bills. You can add this bill before funding its category.</Banner>}
          {view === "pay" && <><p className="bills-muted">Records an expense; it does not send a bank payment. Don’t add the same payment separately.</p>{gate.unfunded || gate.overBudget ? <Banner tone="warning">{gate.unfunded ? "Category availability is missing or unfunded." : <>Short by <Money value={gate.shortfall} />.</>} Fund the category before recording payment.</Banner> : <div className="bills-payment-preview"><span>Available after payment</span><Money value={(selectedCategory?.available ?? 0) - expected} /><span>Earmarked for other bills</span><Money value={paymentOtherReserved} /><span>Free after bills</span><Money value={(selectedCategory?.available ?? 0) - expected - paymentOtherReserved} /></div>}
          {!gate.unfunded && !gate.overBudget && (selectedCategory?.available ?? 0) - expected < paymentOtherReserved && <Banner tone="warning">This payment uses money earmarked for other bills. Recording payment confirms you want to continue.</Banner>}</>}
          <button type="submit" className="bills-primary" disabled={!enabled || !formReady}>{saving ? "Saving…" : view === "pay" ? "Pay due" : view === "edit" ? "Save changes" : "Add bill"}</button>
        </form>}
        </>}
      </div>
    </BottomSheet>
    <PickerPopover open={showMore && open && view === "detail"} anchorRef={moreRef} title="Bill actions" onClose={() => setShowMore(false)} align="right" zIndex={180} width="min(280px, calc(100vw - 32px))">
      <div className="picker-options">
        {selected && (selected.state === "Due" || selected.state === "Overdue") && <button type="button" className="picker-option" disabled={!enabled} onClick={() => { setShowMore(false); setConfirm("skip"); }}>Skip occurrence</button>}
        {selected && selected.repeat !== "None" && !data?.schedules.find(s => s.id === selected.billId)?.metadata.end && <button type="button" className="picker-option" disabled={!enabled} onClick={() => { setShowMore(false); setConfirm("stop"); }}>Stop repeating</button>}
        {selected && data?.schedules.some(s => s.id === selected.billId) && <button type="button" className="picker-option" style={{ color: "var(--danger)" }} disabled={!enabled} onClick={() => { setShowMore(false); setConfirm("delete"); }}>Delete schedule</button>}
      </div>
    </PickerPopover>
    <PickerPopover open={picker === "category" && open} anchorRef={categoryRef} title="Choose category" onClose={() => setPicker(null)} zIndex={180} width="min(340px, calc(100vw - 32px))">
      <CategoryOptionList categories={categories.filter(c => !c.snoozed && !c.archived && categoryMatchesScope(c, scope, accounts) && c.name.toLowerCase().includes(search.toLowerCase()))} selectedId={categoryId} search={search} onSearchChange={setSearch} onSelect={c => { setCategoryId(c.id); setPicker(null); }} />
    </PickerPopover>
    <PickerPopover open={picker === "account" && open} anchorRef={accountRef} title="Choose account" onClose={() => setPicker(null)} zIndex={180} width="min(340px, calc(100vw - 32px))">
      {view !== "pay" && <button type="button" className="bills-quiet-action" onClick={() => { setAccountId(""); setPicker(null); }}>No suggested account</button>}
      <AccountOptionList accounts={accounts} selectedId={accountId} onSelect={id => { setAccountId(id); setPicker(null); }} />
    </PickerPopover>
  </section>;
}
function BillRow({ bill, category, onClick, onPay, onEdit, disabled, paidMonth, compact = false }: { bill: BillOccurrence; category?: Category; onClick: () => void; onPay: () => void; onEdit: () => void; disabled: boolean; paidMonth?: string; compact?: boolean }) {
  const payment = bill.payments.find(p => !paidMonth || p.date.slice(0, 7) === paidMonth);
  const subtitle = payment ? `Paid ${fmtDate(payment.date)}` : `${bill.state === "Overdue" ? "Overdue since" : bill.state === "Skipped" ? "Skipped for" : compact ? "" : "Due"} ${fmtDate(bill.dueDate)}`.trim();
  const row = <TransactionRow title={bill.name} subtitle={bill.payments.length > 1 ? <>{subtitle}<span style={{ display: "block", color: "var(--danger)" }}>Recorded twice</span></> : subtitle} amount={payment?.amount ?? bill.amount} tone="expense" prefix="" amountColor="var(--text)" icon={<CategoryIcon icon={category?.icon ?? null} size={22} />} onClick={onClick} />;
  if (bill.state !== "Due" && bill.state !== "Overdue") return row;
  return <SwipeToDelete flat surface={compact ? "var(--bg)" : "var(--surface)"} disabled={disabled} actions={[{ label: "Pay due", icon: <ReceiptIcon size={17} />, onSelect: onPay }, { label: "Edit", icon: <EditIcon size={17} />, onSelect: onEdit }]}>{row}</SwipeToDelete>;
}
