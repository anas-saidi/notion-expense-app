"use client";
import { LiquidButton } from "./ui/LiquidGlass";
import { ChoicePicker } from "./ChoicePicker";
import { sameText } from "./ui/TransactionRow";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Account, BudgetScope, Category } from "./app-types";
import { deriveOccurrences, earmarkedByCategory, normalizedId, type BillsData, type BillOccurrence, type BillRepeat } from "@/lib/bills";
import { categoryMatchesScope, expenseBudgetGate, fmt, fmtDate, monthBounds, parseAmount } from "./app-utils";
import { CardHeader, CardHeaderAction } from "./ui/CardHeader";
import { BottomSheet } from "./ui/BottomSheet";
import { ScreenChip } from "./ui/ScreenChip";
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
import { Fact, Summary, joinClauses } from "./ui/Summary";
import "./bills.css";

type Props = { data: BillsData | null; loading: boolean; error: string | null; categories: Category[]; accounts: Account[]; scope: BudgetScope; onRetry: () => void; onChanged: () => Promise<void> };
type View = "list" | "add" | "detail" | "pay" | "edit";
export function BillsSection({ data, loading, error, categories, accounts, scope, onRetry, onChanged }: Props) {
  const { haptic } = useAppHaptics();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [month, setMonth] = useState("");
  const [filter, setFilter] = useState<"Due" | "Overdue" | "Paid" | "Skipped">("Due");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(""); const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(""); const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(""); const [repeat, setRepeat] = useState<BillRepeat>("None");
  const [editingPayment, setEditingPayment] = useState(false);
  const [target, setTarget] = useState<"occurrence" | "future">("occurrence");
  const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState("");
  const [savedPendingRefresh, setSavedPendingRefresh] = useState(false);
  const busy = useRef(false);
  const [confirm, setConfirm] = useState<"skip" | "stop" | "delete" | string | null>(null);
  const [picker, setPicker] = useState<"category" | "account" | null>(null);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");
  const [day, setDay] = useState<string | null>(null);
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
  const monthBills = scoped.filter(o => o.dueDate.slice(0, 7) === activeMonth);
  const shown = day ? monthBills.filter(o => o.dueDate === day) : scoped.filter(o => filter === "Paid" ? o.state === "Paid" && o.payments.some(p => p.date.slice(0, 7) === activeMonth)
    : filter === "Overdue" ? o.state === "Overdue" && o.dueDate <= cutoff
    : filter === "Skipped" ? o.state === "Skipped" && o.period === activeMonth
    : (o.state === "Due" || o.state === "Overdue") && (activeMonth === currentMonth ? o.dueDate <= cutoff : o.dueDate.slice(0, 7) === activeMonth));
  const reservations = earmarkedByCategory(scoped, currentCutoff);
  const category = categories.find(c => normalizedId(c.id) === normalizedId(categoryId));
  const selectedCategory = categories.find(c => selected && normalizedId(c.id) === normalizedId(selected.categoryId));
  const expected = parseAmount(amount) ?? 0;
  const gate = expenseBudgetGate({ available: selectedCategory?.available ?? null, amount: expected });
  const needsFunding = (bill: BillOccurrence) => {
    const available = categories.find(c => normalizedId(c.id) === normalizedId(bill.categoryId))?.available;
    return (bill.state === "Due" || bill.state === "Overdue") && bill.dueDate <= currentCutoff && available != null && available < (reservations[normalizedId(bill.categoryId)] ?? 0);
  };
  const enabled = !saving && !savedPendingRefresh && !loading && !error;
  const categoryOf = (bill: BillOccurrence) => categories.find(c => normalizedId(c.id) === normalizedId(bill.categoryId));
  // Current month only, and only totals: the month picker names the month, and the calendar and list already show each bill and its date.
  const dueTotal = Math.round(currentDue.reduce((sum, o) => sum + o.amount, 0));
  const overdueTotal = Math.round(currentDue.filter(o => o.state === "Overdue").reduce((sum, o) => sum + o.amount, 0));
  const billsSummary = activeMonth !== currentMonth || dueTotal <= 0 ? [] : [
    <span key="due"><Fact onClick={() => { setDay(null); setSearch(""); setFilter("Due"); }} label="Show all due bills">{fmt(dueTotal)}</Fact> is still due{overdueTotal > 0 && <>, <Fact>{fmt(overdueTotal)}</Fact> of it <Fact tone="danger" onClick={() => { setDay(null); setSearch(""); setFilter("Overdue"); }} label="Show overdue bills">overdue</Fact></>}</span>,
  ];

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
    setEditingPayment(false);
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
  const paymentAccount = accounts.find(a => normalizedId(a.id) === normalizedId(accountId));
  const formReady = expected > 0 && date && (view === "pay" ? !!selected && !!paymentAccount : !!name.trim() && !!category && !category.snoozed && !category.archived && categoryMatchesScope(category, scope, accounts));

  return <section className="bills-section" aria-label="Due bills">
    <CardHeader className="bills-section-heading" title="Due bills" titleClassName="section-label" action={<CardHeaderAction className="bills-quiet-action" disabled={!enabled} onClick={() => { setOpen(true); move("list"); }}>All bills</CardHeaderAction>} />
    {loading ? <SkeletonRows count={2} /> : error ? <Banner role="alert" tone="danger" compact action={<button type="button" onClick={onRetry}>Retry</button>}>{error}</Banner>
      : <>
        {currentDue.length ? <>
          <div className="row-list">{currentDue.slice(0, 3).map(bill => <BillRow key={bill.id} bill={bill} needsFunding={needsFunding(bill)} category={categories.find(c => normalizedId(c.id) === normalizedId(bill.categoryId))} onClick={() => details(bill)} onPay={() => prepare("pay", bill)} onEdit={() => prepare("edit", bill)} disabled={!enabled} compact />)}</div>
        </> : <p className="bills-muted">No bills due.</p>}
      </>}
    <BottomSheet open={open} onClose={() => { if (!saving) { setOpen(false); setPicker(null); setShowMore(false); } }} label={view === "list" ? "Bills" : view === "add" ? "Add bill" : view === "pay" ? "Record payment" : view === "edit" ? "Edit bill" : selected?.name ?? "Bill"} size="standard" contentStyle={{ paddingTop: 0 }}>
      <div className={`sheet-body bills-sheet${view === "detail" ? " bills-sheet-detail" : ""}`}>
        <header className="sheet-header bills-sheet-header">
          <div className="bills-header-title">{(view === "pay" || view === "edit") && <button type="button" className="bills-icon-action" aria-label="Back to bill" disabled={saving || savedPendingRefresh} onClick={() => move("detail")}><ChevronLeftIcon size={20} /></button>}<h2>{view === "list" ? "Bills" : view === "add" ? "Add bill" : view === "pay" ? "Record payment" : view === "edit" ? "Edit bill" : selected?.name ?? "Bill"}</h2></div>
          <button type="button" aria-label="Close bills" disabled={saving} className="bills-icon-action sheet-close-button" onClick={() => { setOpen(false); setPicker(null); setShowMore(false); }}><XIcon size={20} /></button>
        </header>
        {saveError && <Banner role="alert" tone="danger" compact>{saveError}{savedPendingRefresh && <button type="button" className="bills-quiet-action" disabled={saving} onClick={retrySaved}>Refresh balances</button>}</Banner>}
        {loading ? <SkeletonRows /> : error ? <Banner role="alert" tone="danger" compact action={<button type="button" onClick={onRetry}>Retry</button>}>{error}</Banner> : <>
        {view === "list" && <>
          <div className="bills-list-controls"><MonthPicker triggerClassName="composer-picker-chip" value={activeMonth} onChange={e => { setMonth(e.target.value); setDay(null); }} aria-label="Bill month" /><button type="button" className="bills-quiet-action" onClick={add}><PlusIcon size={16} /> Add bill</button></div>
          {billsSummary.length > 0 && <Summary>{joinClauses(billsSummary)}.</Summary>}
          {activeMonth && <BillsCalendar month={activeMonth} today={data?.today ?? ""} bills={monthBills} categoryOf={categoryOf} selectedDay={day} onSelectDay={value => { setDay(day === value ? null : value); haptic("selection"); }} onOpenBill={details} />}
          {day ? <div className="bills-day-heading"><span>{new Date(`${day}T12:00:00`).toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })}</span><button type="button" className="bills-quiet-action" onClick={() => setDay(null)}>Show all</button></div>
            : <div className="bills-filters" role="group" aria-label="Bill state">{(["Due", ...(filter === "Overdue" ? ["Overdue" as const] : []), "Paid", "Skipped"] as const).map(value => <ScreenChip key={value} selected={filter === value} minHeight={44} onClick={() => { setFilter(value); haptic("selection"); }}>{value}</ScreenChip>)}</div>}
          {shown.length ? <div className="row-list">{shown.map(bill => <BillRow key={bill.id} bill={bill} category={categoryOf(bill)} onClick={() => details(bill)} onPay={() => prepare("pay", bill)} onEdit={() => prepare("edit", bill)} disabled={!enabled} needsFunding={activeMonth === currentMonth && needsFunding(bill)} paidMonth={!day && filter === "Paid" ? activeMonth : undefined} hideDate={!!day} />)}</div> : <p className="bills-empty">No {filter.toLowerCase()} bills for this month.</p>}
        </>}
        {view === "detail" && selected && <>
          <section className="bills-detail-summary"><div className="bills-detail-amount"><Money value={selected.amount} currency /></div>
          <p className="bills-muted">{selected.state === "Due" ? "Due" : selected.state === "Overdue" ? "Overdue since" : "Scheduled for"} {fmtDate(selected.dueDate)}</p></section>
          <div className="bills-detail-actions">
            {selected.state === "Due" || selected.state === "Overdue" ? <><button type="button" className="pressable bills-toolbar-action bills-toolbar-primary" disabled={!enabled} onClick={() => prepare("pay")}><ReceiptIcon size={17} />Pay due</button><button type="button" className="pressable bills-toolbar-action bills-toolbar-secondary" disabled={!enabled} onClick={() => prepare("edit")}><EditIcon size={17} />Edit</button></> : selected.state === "Skipped" ? <button type="button" className="pressable bills-toolbar-action bills-toolbar-primary" disabled={!enabled} onClick={() => mutate("PATCH", { action: "restore", billId: selected.billId, period: selected.period })}>Restore</button> : null}
            <LiquidButton type="button" ref={moreRef} className="pressable bills-toolbar-action bills-toolbar-more" aria-label="More bill actions" aria-haspopup="dialog" aria-expanded={showMore} disabled={!enabled} onClick={() => setShowMore(!showMore)}><MoreIcon size={18} />More</LiquidButton>
          </div>
          <dl className="bills-detail-context"><div><dt>Category</dt><dd className="bills-category-value"><CategoryIcon icon={selectedCategory?.icon ?? null} categoryName={selectedCategory?.name} size={22} /><span>{selectedCategory?.name ?? "Unavailable"}</span></dd></div>{selected.repeat !== "None" && <div><dt>Repeats</dt><dd>{selected.repeat}</dd></div>}{selected.state === "Paid" || selected.state === "Skipped" ? <div><dt>Status</dt><dd>{selected.state}</dd></div> : null}</dl>
          {selected.payments.length > 1 && <Banner tone="danger">Payment recorded twice. Review each expense below.</Banner>}
          {selected.state === "Paid" ? selected.payments.map(payment => <div key={payment.id} className="bills-payment"><p><Money value={payment.amount} /></p><p className="bills-muted">Paid {fmtDate(payment.date)}</p><a href={`https://www.notion.so/${normalizedId(payment.id)}`} target="_blank" rel="noreferrer">View expense in Notion</a><button type="button" className="bills-quiet-action" disabled={!enabled} onClick={() => setConfirm(payment.id)}>Undo payment</button></div>)
            : null}
          {confirm && <Banner desktopInline={false} tone="warning"><p>{confirm === "delete" ? "Delete this schedule? All its unpaid bills disappear. Recorded payment expenses remain." : confirm === "skip" ? "Skip this bill? Releases its reserved money without recording spending. You can restore it." : confirm === "stop" ? `Stop after ${selected.period}? Later bills disappear; earlier unpaid bills remain payable.` : "Undo this payment? This removes the expense from spending and makes the bill due again."}</p><div className="bills-confirm-actions"><button type="button" className="bills-secondary" disabled={!enabled} onClick={() => setConfirm(null)}>Cancel</button><button type="button" className="bills-primary" disabled={!enabled} onClick={() => mutate(confirm === "skip" || confirm === "stop" ? "PATCH" : "DELETE", confirm === "skip" || confirm === "stop" ? { action: confirm, billId: selected.billId, period: selected.period } : confirm === "delete" ? { billId: selected.billId } : { paymentId: confirm })}>{confirm === "delete" ? "Delete schedule" : confirm === "skip" ? "Skip bill" : confirm === "stop" ? "Stop repeating" : "Undo payment"}</button></div></Banner>}
        </>}
        {view === "detail" && !selected && <p className="bills-empty">Bill unavailable. Close and reopen Bills to choose another bill.</p>}
        {(view === "add" || view === "pay" || view === "edit") && <form className={`bills-form${view === "pay" ? " bills-pay-summary" : ""}`} onSubmit={event => { event.preventDefault(); if (!enabled || !formReady) return;
          mutate(view === "edit" ? "PATCH" : "POST", view === "pay" ? { action: "pay", billId: selected?.billId, period: selected?.period, amount: expected, accountId, date, ...(gate.unfunded || gate.overBudget ? { overspend: true } : {}) }
            : { action: view === "edit" ? "edit" : "create", billId: selected?.billId, period: selected?.period, target, name, amount: expected, categoryId, accountId, dueDate: date, repeat });
        }}>
          {view === "pay" && selected && <div className="bills-pay-overview">
            <div className="bills-pay-title-line"><h3>Record {selected.name} payment</h3><span className="bills-pay-amount"><Money value={expected} currency /></span></div>
            <p className="bills-muted">{selected.state === "Overdue" ? "Overdue since" : "Due"} {fmtDate(selected.dueDate)}{paymentAccount ? ` from ${paymentAccount.label}` : ""}</p>
            <p className="bills-muted">{selectedCategory?.name ?? "Category unavailable"}</p>
            <p className="bills-muted">Recording {fmtDate(date)}</p>
          </div>}
          <fieldset disabled={!enabled}>
          {view === "edit" && selected?.repeat !== "None" && <label>Apply to<ChoicePicker aria-label="Apply bill changes to" value={target} onChange={e => setTarget(e.target.value as typeof target)}><option value="occurrence">This bill</option><option value="future">This and future bills</option></ChoicePicker></label>}
          {view !== "pay" && (view === "add" || target === "future") && <label>Bill name<input value={name} onChange={e => setName(e.target.value)} maxLength={200} required autoComplete="off" /></label>}
          {(view !== "pay" || editingPayment) && <label>{view === "pay" ? "Paid amount (MAD)" : "Expected amount (MAD)"}<input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0" required /></label>}
          {view !== "pay" && <div className="bills-field"><span id="bill-category-label">Category</span><LiquidButton type="button" ref={categoryRef} className="bills-choice" aria-labelledby="bill-category-label" aria-haspopup="dialog" aria-expanded={picker === "category"} onClick={() => { setSearch(""); setPicker(picker === "category" ? null : "category"); }}>{category?.name ?? "Choose category"}</LiquidButton></div>}
          {(view === "add" || (view === "pay" && (editingPayment || !paymentAccount)) || (view === "edit" && target === "future")) && <div className="bills-field"><span id="bill-account-label">{view === "pay" ? "Payment account" : "Suggested account (optional)"}</span><LiquidButton type="button" ref={accountRef} className="bills-choice" aria-labelledby="bill-account-label" aria-haspopup="dialog" aria-expanded={picker === "account"} onClick={() => setPicker(picker === "account" ? null : "account")}>{accounts.find(a => a.id === accountId)?.label ?? "Choose account"}</LiquidButton></div>}
          {(view !== "pay" || editingPayment) && <div className="bills-field"><span>{view === "pay" ? "Payment date" : view === "add" ? "First due date" : "Due date"}</span>{view === "edit" && target === "future" ? <span>{fmtDate(date)}</span> : <DatePicker value={date} onChange={e => setDate(e.target.value)} aria-label={view === "pay" ? "Payment date" : "Due date"} />}</div>}
          {view === "add" && <label>Repeat<ChoicePicker aria-label="Repeat bill" value={repeat} onChange={e => setRepeat(e.target.value as BillRepeat)}><option value="None">None</option><option value="Monthly">Monthly</option><option value="Yearly">Yearly</option></ChoicePicker></label>}
          </fieldset>
          {view === "edit" && target === "future" && <p className="bills-muted">Earlier unpaid bills keep their amounts. Recurrence stays {repeat.toLowerCase()}.</p>}
          {view === "add" && draftFree != null && draftFree < 0 && <Banner tone="warning">Short by <Money value={-draftFree} /> after bills. You can add this bill before funding its category.</Banner>}
          {view === "pay" && paymentAccount?.estimatedActualBalance != null && expected > paymentAccount.estimatedActualBalance && <Banner tone="warning" role="alert">Exceeds estimated actual funds by <Money value={expected - paymentAccount.estimatedActualBalance} />.</Banner>}
          {/* A payment that doesn't fit is still real: it records once confirmed and the category goes below zero. */}
          {view === "pay" && <>{(gate.unfunded || gate.overBudget) && selectedCategory ? <Banner tone="warning"><strong>{selectedCategory.name}</strong> goes <strong>{fmt(Math.round(expected - (selectedCategory.available ?? 0)))}</strong> below zero.</Banner> : null}
          {!gate.unfunded && !gate.overBudget && (selectedCategory?.available ?? 0) - expected < paymentOtherReserved && <Banner tone="warning">Uses money set aside for other bills.</Banner>}</>}
          <div className={view === "pay" ? "bills-pay-actions" : undefined}><button type="submit" className="bills-primary" disabled={!enabled || !formReady}>{saving ? "Saving…" : view === "pay" ? (gate.unfunded || gate.overBudget ? "Record anyway" : "Record payment") : view === "edit" ? "Save changes" : "Add bill"}</button>
          {view === "pay" && <><button type="button" className="bills-pay-edit" disabled={!enabled} onClick={() => { setEditingPayment(value => !value); setPicker(null); haptic("selection"); }} aria-expanded={editingPayment}><EditIcon size={18} />{editingPayment ? "Done editing" : "Edit"}</button><button type="button" className="bills-quiet-action" disabled={!enabled} onClick={() => move("detail")}>Cancel</button></>}
          </div>
        </form>}
        </>}
      </div>
    </BottomSheet>
    <PickerPopover open={showMore && open && view === "detail"} anchorRef={moreRef} title="Bill actions" onClose={() => setShowMore(false)} align="right" zIndex={180} size="menu">
      <div className="picker-options">
        {selected && (selected.state === "Due" || selected.state === "Overdue") && <button type="button" className="picker-option" disabled={!enabled} onClick={() => { setShowMore(false); setConfirm("skip"); }}>Skip bill</button>}
        {selected && selected.repeat !== "None" && !data?.schedules.find(s => s.id === selected.billId)?.metadata.end && <button type="button" className="picker-option" disabled={!enabled} onClick={() => { setShowMore(false); setConfirm("stop"); }}>Stop repeating</button>}
        {selected && data?.schedules.some(s => s.id === selected.billId) && <button type="button" className="picker-option" style={{ color: "var(--danger)" }} disabled={!enabled} onClick={() => { setShowMore(false); setConfirm("delete"); }}>Delete schedule</button>}
      </div>
    </PickerPopover>
    <PickerPopover open={picker === "category" && open} anchorRef={categoryRef} title="Choose category" onClose={() => setPicker(null)} zIndex={180} size="choice">
      <CategoryOptionList categories={categories.filter(c => !c.snoozed && !c.archived && categoryMatchesScope(c, scope, accounts) && c.name.toLowerCase().includes(search.toLowerCase()))} selectedId={categoryId} search={search} onSearchChange={setSearch} onSelect={c => { setCategoryId(c.id); setPicker(null); }} />
    </PickerPopover>
    <PickerPopover open={picker === "account" && open} anchorRef={accountRef} title="Choose account" onClose={() => setPicker(null)} zIndex={180} size="choice">
      {view !== "pay" && <button type="button" className="bills-quiet-action" onClick={() => { setAccountId(""); setPicker(null); }}>No suggested account</button>}
      <AccountOptionList accounts={accounts} selectedId={accountId} onSelect={id => { setAccountId(id); setPicker(null); }} />
    </PickerPopover>
  </section>;
}
/** `hideDate`: the day heading above already names the date. */
function BillRow({ bill, category, onClick, onPay, onEdit, disabled, paidMonth, needsFunding = false, compact = false, hideDate = false }: { bill: BillOccurrence; category?: Category; onClick: () => void; onPay: () => void; onEdit: () => void; disabled: boolean; paidMonth?: string; needsFunding?: boolean; compact?: boolean; hideDate?: boolean }) {
  const payment = bill.payments.find(p => !paidMonth || p.date.slice(0, 7) === paidMonth);
  const dateValue = payment?.date || bill.dueDate;
  const date = new Date(`${dateValue}T12:00:00`);
  const validDate = Number.isFinite(date.getTime());
  const weekday = validDate ? date.toLocaleDateString("en", { weekday: "short" }) : "—";
  const day = validDate ? date.getDate() : "—";
  const status = bill.payments.length > 1 ? "Recorded twice" : bill.state === "Overdue" ? "Overdue" : needsFunding ? "Needs funding" : payment ? "Paid" : bill.state === "Skipped" ? "Skipped" : null;
  const showCategory = Boolean(category?.name) && !sameText(category!.name, bill.name);
  const row = <button type="button" className="bill-date-row" onClick={onClick} disabled={disabled} aria-label={`${bill.name}${category?.name ? `, ${category.name}` : ""}, ${payment ? "paid" : "due"} ${validDate ? date.toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" }) : "date unavailable"}, ${payment?.amount ?? bill.amount} MAD${status ? `, ${status}` : ""}, view bill`}>
    {!hideDate && <span className={`bill-date-tile${bill.state === "Overdue" ? " bill-date-overdue" : ""}`} aria-hidden="true"><span>{weekday}</span><strong>{day}</strong></span>}
    <span className="bill-date-copy"><span className="bill-date-title">{bill.name}</span>{(showCategory || status) && <span className="bill-date-context bill-date-metadata">{showCategory && <span>{category!.name}</span>}{status && <span className={["Overdue", "Needs funding", "Recorded twice"].includes(status) ? "bill-date-alert" : undefined}>{status}</span>}</span>}</span>
    <span className="bill-date-amount"><Money value={payment?.amount ?? bill.amount} /></span>
  </button>;
  if (bill.state !== "Due" && bill.state !== "Overdue") return row;
  return <SwipeToDelete flat surface={compact ? "var(--bill-row-surface, var(--bg))" : "var(--surface)"} disabled={disabled} actions={[{ label: "Pay due", icon: <ReceiptIcon size={17} />, onSelect: onPay }, { label: "Edit", icon: <EditIcon size={17} />, onSelect: onEdit }]}>{row}</SwipeToDelete>;
}

/** Month grid with each bill's category artwork on its due day (design.md, "Bills calendar"). Only inside All bills. */
function BillsCalendar({ month, today, bills, categoryOf, selectedDay, onSelectDay, onOpenBill }: {
  month: string; today: string; bills: BillOccurrence[]; categoryOf: (bill: BillOccurrence) => Category | undefined;
  selectedDay: string | null; onSelectDay: (day: string) => void; onOpenBill: (bill: BillOccurrence) => void;
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  const lead = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7; // Monday first
  const label = new Date(year, monthNumber - 1, 1).toLocaleDateString("en", { month: "long" });
  return <div className="bills-calendar" role="group" aria-label={`${label} bills by due day`}>
    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="bills-calendar-weekday" aria-hidden="true">{d}</span>)}
    {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} aria-hidden="true" />)}
    {Array.from({ length: days }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, "0")}`;
      const onDay = bills.filter(b => b.dueDate === date);
      if (!onDay.length) return <span key={date} className="bills-calendar-day" data-today={date === today || undefined} aria-hidden="true"><span className="bills-calendar-date">{i + 1}</span></span>;
      // The day's most pressing state colours the cell: overdue, then due, then settled.
      const state = onDay.some(b => b.state === "Overdue") ? "overdue" : onDay.some(b => b.state === "Due") ? "due" : "settled";
      const first = onDay[0];
      return <button key={date} type="button" className="bills-calendar-day" data-state={state} data-today={date === today || undefined} aria-pressed={selectedDay === date}
        aria-label={`${new Date(`${date}T12:00:00`).toLocaleDateString("en", { day: "numeric", month: "long" })}: ${onDay.map(b => `${b.name}, ${b.amount} MAD, ${b.state.toLowerCase()}`).join("; ")}`}
        onClick={() => onDay.length === 1 ? onOpenBill(first) : onSelectDay(date)}>
        <span className="bills-calendar-art"><CategoryIcon icon={categoryOf(first)?.icon ?? null} categoryName={categoryOf(first)?.name} size={24} />{onDay.length > 1 && <span className="bills-calendar-more">+{onDay.length - 1}</span>}</span>
        <span className="bills-calendar-date">{i + 1}</span>
      </button>;
    })}
  </div>;
}
