"use client";
import { accountIconSource } from "../../lib/category-icons";
import { ChoicePicker } from "./ChoicePicker";
import { LiquidSegments } from "./ui/LiquidGlass";
import { Button } from "./ui/Button";
import { ScreenChip } from "./ui/ScreenChip";
import { SavingCover, guardClose, useBlockingSave } from "./ui/SavingCover";

import { SheetBody, SheetFooter, SheetHeader } from "./ui/SheetLayout";

import { IncomeUseControl } from "./IncomeUseControl";
import { isJointIncomeAccount, type IncomeUse } from "@/lib/joint-income";
import { useState, useEffect, useRef, type CSSProperties, type RefObject } from "react";
import type { Account, Category, Transaction } from "./app-types";
import { evalExpr, fmt, fmtDate, isExpression, shiftDate, today } from "./app-utils";
import { AutoscaleAmountInput } from "./ui/AutoscaleAmountInput";
import { BottomSheet } from "./ui/BottomSheet";
import { TypeItComposer } from "./TypeItComposer";
import type { TypedTransactionDraft } from "@/lib/typed-transactions";
import { anchoredDate, isCalendarDate, nextPeriod, type BillRepeat } from "@/lib/bills";
import { Money } from "./Money";
import { TransactionRow } from "./ui/TransactionRow";
import { CategoryIcon } from "./ui/CategoryIcon";
import { PickerPopover } from "./PickerPopover";
import { Banner } from "./ui/Banner";
import { DateCalendar } from "./DatePicker";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, AlertTriangleIcon, CalendarIcon, BanknoteIcon, ChevronDownIcon, DeleteIcon, XIcon } from "./ui/icons";
import { AccountOptionList, CategoryOptionList, pickerIconStyle } from "./TransactionPickers";
import "./sheet-components.css";
import { useAppHaptics } from "./ui/useAppHaptics";

type AddTransactionSheetProps = {
  open: boolean;
  mode: "wife" | "husband";
  amount: string;
  name: string;
  date: string;
  catSearch: string;
  showDatePicker: boolean;
  showCatPicker: boolean;
  showAccountPicker: boolean;
  status: "idle" | "saving" | "success" | "error";
  errorMsg: string;
  selectedDateLabel: string;
  selectedCat?: Category;
  suggestedCategory?: Category;
  selectedAccount: Account | null;
  filteredCats: Category[];
  filteredAccounts: Account[];
  recentTransactions: Transaction[];
  lastUsedCatId: string;
  displayedBalance: number | null;
  amountAfterBalance: number | null;
  actualAfterSpending?: number | null;
  balanceCheckUnavailable?: boolean;
  /** Unavailable until the server is reconfigured; refreshing won't help. */
  balanceCheckPaused?: boolean;
  balanceCheckedAt?: string;
  parsedAmount: number;
  categoryUnfunded: boolean;
  categoryOverBudget: boolean;
  /** Budget this expense still needs in its category (0 when covered). */
  categoryShortfall: number;
  /** Set when this expense saves as an advance: how far below zero its joint category goes. */
  advanceBelowZero?: number;
  /** Set when this expense doesn't fit its category: it saves once confirmed and the category goes this far below zero. */
  overspendBelowZero?: number;
  billShortfall?: number;
  billsUnavailable?: boolean;
  canSubmit: boolean;
  allCategories?: Category[];
  modeVariant?: "create" | "edit";
  transactionType: "Expense" | "Income";
  incomeUse: IncomeUse;
  onIncomeUseChange: (value: IncomeUse) => void;
  onTransactionTypeChange: (type: "Expense" | "Income") => void;
  onClose: () => void;
  onOpenRebalance?: () => void;
  onQuickFund?: (sourceCategoryId: string, amount: number) => Promise<void>;
  onAmountChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onToggleDatePicker: () => void;
  onToggleCatPicker: () => void;
  onToggleAccountPicker: () => void;
  onCloseDatePicker: () => void;
  onCloseCatPicker: () => void;
  onCloseAccountPicker: () => void;
  onSelectDate: (value: string) => void;
  onSelectCategory: (category: Category) => void;
  onSelectAccount: (id: string) => void;
  /** Fill the form from a recent transaction (amount, description, category, account). */
  onUseRecent?: (transaction: Transaction) => void;
  /** Open on the form instead of writing (e.g. arriving with a category already chosen). */
  startInForm?: boolean;
  /** A line to add to the writing view on open (Activity's swipe-right "log again"). */
  seedLine?: { source: string; id: number } | null;
  onCatSearchChange: (value: string) => void;
  repeat?: BillRepeat;
  onRepeatChange?: (repeat: BillRepeat) => void;
  onSubmit: (repeat?: BillRepeat) => void;
  onDelete?: () => Promise<boolean>;
  typedCategories?: Category[];
  typedHistory?: { description: string; categoryId: string }[];
  typedTypeHistory?: { income: string[]; expense: string[] };
  /** Habit pills for an empty writing view (lib/suggestions.ts). */
  typedSuggestions?: string[];
  typedDraftKey?: string;
  onSaveTyped?: (transaction: TypedTransactionDraft) => Promise<void>;
  onTypedComplete?: (count: number) => void;
  dateRef: RefObject<HTMLDivElement>;
  catRef: RefObject<HTMLDivElement>;
  accountRef: RefObject<HTMLDivElement>;
};

export function AddTransactionSheet(props: AddTransactionSheetProps) {
  const { haptic } = useAppHaptics();
  const [entryMode, setEntryMode] = useState<"form" | "type">("form");
  // A written line opened in the form: put back if you return to writing without saving it.
  const [movedLine, setMovedLine] = useState<{ source: string; date: string; accountId: string | null } | null>(null);
  const [restoreLine, setRestoreLine] = useState<{ source: string; id: number } | null>(null);
  // Switching views: the current one fades out (--motion-fast), then the next fades in (see .composer-pane).
  const [leavingMode, setLeavingMode] = useState(false);
  const leaveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (leaveTimer.current) window.clearTimeout(leaveTimer.current); }, []);
  const switchMode = (next: "form" | "type", apply?: () => void) => {
    if (leaveTimer.current) return;
    setLeavingMode(true);
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null;
      apply?.();
      setEntryMode(next);
      setLeavingMode(false);
    }, 120);
  };
  const backToWriting = () => switchMode("type", () => {
    // An unsaved line goes back to the list, and the writing defaults it changed are put back.
    if (movedLine) {
      setRestoreLine({ source: movedLine.source, id: Date.now() });
      props.onSelectDate(movedLine.date);
      props.onSelectAccount(movedLine.accountId ?? "");
      setMovedLine(null); props.onAmountChange(""); props.onNameChange("");
    }
    setShowKeypad(false); props.onCloseDatePicker(); props.onCloseCatPicker(); props.onCloseAccountPicker();
  });
  const [typedBusy, setTypedBusy] = useState(false);
  // A typed batch save reports its progress here, so the sheet's one saving cover can say it.
  const [typedSavingLabel, setTypedSavingLabel] = useState<string | null>(null);
  const [showFundPicker, setShowFundPicker] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Every write from this sheet blocks it (design.md, Saving): the form save (status from the page),
  // the quick fund move, the typed batch and the delete confirm.
  const quickFund = useBlockingSave();
  const deletion = useBlockingSave();
  const [showRepeat, setShowRepeat] = useState(false);
  const repeat = props.repeat ?? "None";
  const setRepeat = (value: BillRepeat) => props.onRepeatChange?.(value);
  const [showKeypad, setShowKeypad] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const fundPickerRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const previousStatusRef = useRef(props.status);

  useEffect(() => {
    if (props.open) {
      // Adding starts by writing; editing and pre-chosen openers use the form.
      setEntryMode(props.modeVariant === "edit" || props.startInForm || !props.onSaveTyped ? "form" : "type");
      setMovedLine(null);
      requestAnimationFrame(() => {
        if (sheetContentRef.current) sheetContentRef.current.scrollTop = 0;
      });
    }
    if (!props.open) {
      setShowFundPicker(false);
      setConfirmingDelete(false);
      setShowKeypad(false);
      setShowRepeat(false);
      setAmountFocused(false);
    }
  }, [props.open]);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = props.status;
    if (!props.open || previousStatus === props.status) return;
    if (props.status === "success") { haptic("success"); setRepeat("None"); setShowRepeat(false); setMovedLine(null); }
    if (props.status === "error") haptic("error");
  }, [haptic, props.open, props.status]);

  useEffect(() => {
    if (!showFundPicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-picker-popover="true"]')) return;
      if (fundPickerRef.current && !fundPickerRef.current.contains(target)) {
        setShowFundPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showFundPicker]);

  useEffect(() => { if (props.transactionType !== "Expense") { setRepeat("None"); setShowRepeat(false); } }, [props.transactionType]);

  if (!props.open) return null;

  const formSaving = props.status === "saving";
  const sheetSaving = formSaving || quickFund.saving || deletion.saving || typedSavingLabel !== null;
  const closeSheet = guardClose(sheetSaving || typedBusy, props.onClose);

  const deficit = props.categoryShortfall;

  const sourceCandidates = (props.allCategories ?? [])
    .filter(c => c.id !== props.selectedCat?.id && (c.available ?? 0) > 0)
    .sort((a, b) => (b.available ?? 0) - (a.available ?? 0))
    .slice(0, 8);

  const isEditMode = props.modeVariant === "edit";
  const isIncome = props.transactionType === "Income";
  const submit = () => props.onSubmit(!isEditMode && !isIncome ? repeat : "None");
  const nextDue = repeat !== "None" && isCalendarDate(props.date) ? anchoredDate(props.date, nextPeriod(props.date.slice(0, 7), repeat === "Yearly" ? 12 : 1)) : "";
  const todayValue = today();
  const yesterdayValue = shiftDate(todayValue, -1);
  const visibleBalance = props.amountAfterBalance ?? props.displayedBalance;

  const dateOptions = [
    { label: "Today", value: todayValue },
    { label: "Yesterday", value: yesterdayValue },
  ];

  const enterAmount = (key: string) => {
    if (key === "delete") {
      props.onAmountChange(props.amount.slice(0, -1));
      return;
    }
    if (key === ".") {
      const currentNumber = props.amount.split(/[+\-*/]/).at(-1) ?? "";
      if (currentNumber.includes(".")) return;
      props.onAmountChange(`${props.amount || "0"}.`);
      return;
    }
    if (["+", "-", "*", "/"].includes(key)) {
      if (!props.amount) {
        if (key === "-") props.onAmountChange("-");
        return;
      }
      const next = /[+\-*/]$/.test(props.amount)
        ? `${props.amount.slice(0, -1)}${key}`
        : `${props.amount}${key}`;
      props.onAmountChange(next);
      return;
    }
    props.onAmountChange(props.amount === "0" ? key : `${props.amount}${key}`);
  };

  const selectTransactionType = (type: "Expense" | "Income") => {
    if (props.transactionType !== type) haptic("selection");
    props.onTransactionTypeChange(type);
  };

  const keypadKeys = [
    { value: "7", label: "7" }, { value: "8", label: "8" }, { value: "9", label: "9" }, { value: "/", label: "÷", ariaLabel: "Divide" },
    { value: "4", label: "4" }, { value: "5", label: "5" }, { value: "6", label: "6" }, { value: "*", label: "×", ariaLabel: "Multiply" },
    { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "-", label: "−", ariaLabel: "Subtract" },
    { value: ".", label: ".", ariaLabel: "Decimal point" }, { value: "0", label: "0" }, { value: "delete", label: "delete", ariaLabel: "Delete last digit" }, { value: "+", label: "+", ariaLabel: "Add" },
  ];

  return (
    <BottomSheet
      open={props.open}
      onClose={closeSheet}
      label={isEditMode ? "Edit transaction" : "Add transaction"}
      size="standard" desktopHeight="fill"
      mobileFullWidth
      detent="default"
      backdropStrength={0.12}
      backdropTop={typedBusy ? "0px" : undefined}
      panelStyle={panelStyle}
      contentStyle={{ paddingTop: 0, overflow: "hidden" }}
    >
      <div className="sheet-body" ref={sheetContentRef} data-leaving={leavingMode || undefined} style={{ ...sheetInnerStyle, ...(entryMode === "type" ? { padding: "12px max(24px, env(safe-area-inset-left)) max(24px, env(safe-area-inset-bottom))" } : {}), overflowY: entryMode !== "type" && (amountFocused || showKeypad || props.categoryUnfunded || props.categoryOverBudget || props.actualAfterSpending != null || props.balanceCheckUnavailable) ? "auto" : "hidden" }}>

        {/* ── Header ── */}
        <SheetHeader style={topBarStyle}>
          {entryMode === "type" && !isEditMode ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div ref={props.dateRef}>
              {/* Written-page header: the day as a title, the full date small underneath; tap to change the default day. */}
              <button type="button" className="typed-day" aria-label={`Default date: ${props.selectedDateLabel}. Change`} aria-haspopup="dialog" aria-expanded={props.showDatePicker} disabled={typedBusy} onClick={props.onToggleDatePicker}>
                <span className="typed-day-title">{props.selectedDateLabel}<ChevronDownIcon size={16} aria-hidden="true" data-open={props.showDatePicker || undefined} /></span>
                <span className="typed-day-date">{new Date(`${props.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
              </button>
              <PickerPopover open={props.showDatePicker} title="Date" onClose={props.onCloseDatePicker} align="left" placement="bottom" size="calendar" zIndex={140} anchorRef={props.dateRef}>
                <DateCalendar value={props.date} onChange={props.onSelectDate} />
              </PickerPopover>
            </div>
          </div> : isEditMode ? <h2 style={dialogTitleStyle}>{isIncome ? "Edit income" : "Edit expense"}</h2>
            : props.onSaveTyped ? <Button variant="secondary" size="compact" icon={<ArrowLeftIcon />} aria-label={movedLine ? "Back to writing, keeping this line" : "Back to writing"} onClick={backToWriting}>Write</Button>
            : <span aria-hidden="true" />}
          <button type="button" className="sheet-close-button" disabled={typedBusy} onClick={closeSheet} aria-label="Close">
            <XIcon size={20} />
          </button>
        </SheetHeader>

        {!isEditMode && entryMode === "form" && (
          <div className="composer-pane" style={typeSwitcherStyle}>
            {/* The shared segmented control, as in Reflect; semantic red and green stay on the selected segment's arrow. */}
            <LiquidSegments aria-label="Transaction type" value={props.transactionType}
              onValueChange={value => { if (value === "Expense" || value === "Income") selectTransactionType(value); }}
              items={[
                { value: "Expense", label: <span style={segmentLabelStyle}><ArrowUpIcon size={16} aria-hidden="true" style={{ color: !isIncome ? "var(--danger)" : undefined }} />Expense</span> },
                { value: "Income", label: <span style={segmentLabelStyle}><ArrowDownIcon size={16} aria-hidden="true" style={{ color: isIncome ? "var(--success)" : undefined }} />Income</span> },
              ]} />
          </div>
        )}

        {!isEditMode && props.onSaveTyped && <TypeItComposer
          key={props.typedDraftKey ?? props.mode}
          active={entryMode === "type"}
          draftKey={props.typedDraftKey ?? `typedDraft:v1:${props.mode}`}
          categories={props.typedCategories ?? props.allCategories ?? []}
          accounts={props.filteredAccounts}
          history={props.typedHistory ?? []}
          typeHistory={props.typedTypeHistory}
          defaultAccountId={props.selectedAccount?.id ?? ""}
          defaultDate={props.date}
          onSave={props.onSaveTyped}
          onComplete={props.onTypedComplete ?? (() => {})}
          onBusyChange={setTypedBusy}
          onSavingChange={setTypedSavingLabel}
          restoreLine={restoreLine ?? props.seedLine ?? null}
          suggestions={props.typedSuggestions}
          onOpenInForm={(line, row) => {
            // The line moves into the form with everything it already knows.
            props.onTransactionTypeChange(row.type);
            props.onUseRecent?.({ id: `typed-${Date.now()}`, name: row.name, amount: row.amount, date: row.date, category: row.categoryId ?? null, accountId: row.accountId ?? null, type: row.type });
            props.onSelectDate(row.date);
            // Remember the writing defaults so coming back doesn't inherit this line's day and account.
            setMovedLine({ source: line, date: props.date, accountId: props.selectedAccount?.id ?? null });
            switchMode("form");
          }}
        />}
        {(isEditMode || entryMode === "form") && <div className={isEditMode ? undefined : "composer-pane"} style={formPaneStyle}>
        {/* ── Amount hero ── */}
        <section style={{ ...heroWrapStyle, minHeight: showKeypad ? 96 : 120 }}>
          <AutoscaleAmountInput
            type="text"
            value={props.amount}
            onChange={(e) => props.onAmountChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.canSubmit && submit()}
            placeholder="0"
            aria-label="Amount"
            inputMode="decimal"
            autoComplete="off"
            ref={amountInputRef}
            onFocus={() => setAmountFocused(true)}
            onBlur={() => setAmountFocused(false)}
          />
          {isExpression(props.amount) && (
            <p style={{ ...exprPreviewStyle, color: "var(--text2)" }}>
              = {fmt(evalExpr(props.amount))}
            </p>
          )}
          {visibleBalance !== null && props.amount.trim() !== "" && (
            <p style={{ ...heroCopyStyle, color: visibleBalance < 0 ? "var(--danger)" : "var(--text2)" }}>
              Balance after <Money value={visibleBalance} />
            </p>
          )}
        </section>

        {props.actualAfterSpending != null && props.actualAfterSpending < 0 && <Banner tone="warning" role="alert" compact icon={<AlertTriangleIcon size={16} />}>
          Exceeds actual funds by <Money value={Math.abs(props.actualAfterSpending)} />
          {props.balanceCheckedAt && <span style={{ display: "block", marginTop: 4 }}>Checked {fmtDate(props.balanceCheckedAt.slice(0, 10))}</span>}
        </Banner>}
        {props.actualAfterSpending != null && props.actualAfterSpending >= 0 && props.balanceCheckedAt && <p style={{ ...heroCopyStyle, margin: "8px 0" }}>
          Actual funds after <Money value={props.actualAfterSpending} />
        </p>}
        {props.balanceCheckUnavailable && <Banner tone="warning" compact>{props.balanceCheckPaused ? "Actual-funds checks are paused while the shared database is off." : "Actual-funds checks unavailable. Refresh before spending."}</Banner>}

        {/* ── Form fields ── */}
        <section style={formSectionStyle}>
          <input
            id="transaction-description"
            className="composer-text-input"
            type="text"
            aria-label="Transaction description"
            value={props.name}
            onChange={(e) => props.onNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.canSubmit && submit()}
            placeholder={isIncome ? "Income source" : "Description"}
            style={descriptionInputStyle}
          />

          {/* Pickers row */}
          <div style={pickerBarStyle}>
            <div style={pickerContextGroupStyle}>

            {/* Account picker */}
            <div style={pickerSlotStyle} ref={props.accountRef}>
              <ScreenChip mode="action" onClick={props.onToggleAccountPicker} ariaHasPopup="dialog" ariaExpanded={props.showAccountPicker} ariaControls="account-picker"
                ariaLabel={`Account: ${props.selectedAccount?.label ?? "none"}`}
                icon={<CategoryIcon icon={accountIconSource(props.selectedAccount?.type)} size={24} />}>
                {props.selectedAccount?.label ?? "Account"}
              </ScreenChip>

              <PickerPopover open={props.showAccountPicker} title="Account" onClose={props.onCloseAccountPicker} align="left" placement="top" size="choice" zIndex={140} anchorRef={props.accountRef}>
                <AccountOptionList id="account-picker" accounts={props.filteredAccounts} selectedId={props.selectedAccount?.id} onSelect={props.onSelectAccount} />
              </PickerPopover>
            </div>

            {isIncome && props.selectedAccount && isJointIncomeAccount(props.selectedAccount.label) && <IncomeUseControl value={props.incomeUse} onChange={props.onIncomeUseChange} dismiss={props.showAccountPicker || props.showDatePicker || props.showCatPicker} onOpen={() => { props.onCloseAccountPicker(); props.onCloseDatePicker(); props.onCloseCatPicker(); }} />}

            {/* Category picker */}
            {!isIncome && <div style={pickerSlotStyle} ref={props.catRef}>
              <ScreenChip mode="action" onClick={props.onToggleCatPicker} ariaHasPopup="dialog" ariaExpanded={props.showCatPicker} ariaControls="category-picker"
                ariaLabel={`Category: ${props.selectedCat?.name ?? "none"}`}
                icon={<CategoryIcon icon={props.selectedCat?.icon} categoryName={props.selectedCat?.name} size={24} />}>
                {props.selectedCat?.name ?? "Category"}
              </ScreenChip>

              <PickerPopover open={props.showCatPicker} title="Category" onClose={props.onCloseCatPicker} align="left" placement="top" size="choice" zIndex={140} anchorRef={props.catRef}>
                <CategoryOptionList id="category-picker" categories={props.filteredCats} selectedId={props.selectedCat?.id} lastUsedId={props.lastUsedCatId} onSelect={props.onSelectCategory} search={props.catSearch} onSearchChange={props.onCatSearchChange} />
              </PickerPopover>
            </div>}
            </div>

            {/* Date picker: the same chip as account and category */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            <div style={datePickerSlotStyle} ref={props.dateRef}>
              <ScreenChip mode="action" onClick={props.onToggleDatePicker} ariaHasPopup="dialog" ariaExpanded={props.showDatePicker} ariaControls="date-picker" ariaLabel={`Date: ${props.selectedDateLabel}`}
                icon={<CalendarIcon size={16} />}>
                {props.selectedDateLabel}
              </ScreenChip>

              <PickerPopover open={props.showDatePicker} title="Date" onClose={props.onCloseDatePicker} align="right" placement="top" size="calendar" zIndex={140} anchorRef={props.dateRef}>
                <div id="date-picker"><DateCalendar value={props.date} onChange={props.onSelectDate} /></div>
              </PickerPopover>
            </div>

            </div>
          </div>

          {!isIncome && !props.categoryUnfunded && !props.categoryOverBudget && (props.billShortfall ?? 0) > 0 && <Banner tone="warning" compact>Uses <strong><Money value={props.billShortfall!} /></strong> set aside for bills.</Banner>}
          {!isIncome && props.billsUnavailable && <Banner tone="warning" compact>Bill reservations unavailable.</Banner>}
          {/* Budget warnings */}
          {!isIncome && (props.suggestedCategory || props.categoryUnfunded || props.categoryOverBudget) && (
            <div style={{ display: "grid", gap: 8 }}>
              {props.suggestedCategory && props.suggestedCategory.id !== props.selectedCat?.id && (
                <Button variant="quiet" size="compact" style={{ justifySelf: "start", fontWeight: 400 }} onClick={() => props.onSelectCategory(props.suggestedCategory!)}
                  icon={<CategoryIcon icon={props.suggestedCategory.icon} categoryName={props.suggestedCategory.name} size={20} />}>
                  Suggested: <strong style={{ fontWeight: 600 }}>{props.suggestedCategory.name}</strong>
                </Button>
              )}
              {props.advanceBelowZero != null && props.selectedCat && (
                <Banner tone="warning" compact>Couple owes you this. <strong>{props.selectedCat.name}</strong> goes <strong><Money value={Math.round(props.advanceBelowZero)} /></strong> below zero.</Banner>
              )}
              {props.advanceBelowZero == null && (props.categoryUnfunded || props.categoryOverBudget) && props.selectedCat && (
                <Banner
                  role="alert"
                  tone="warning"
                  compact
                  icon={<AlertTriangleIcon size={16} />}
                  action={(
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    {/* Fund from dropdown — only shown once amount is entered */}
                    {props.onQuickFund && sourceCandidates.length > 0 && deficit > 0 && (
                      <div style={{ position: "relative", flexShrink: 0, minWidth: 0 }} ref={fundPickerRef}>
                        <ScreenChip mode="action" onClick={() => setShowFundPicker(v => !v)} ariaLabel="Move funds from another category" ariaExpanded={showFundPicker} ariaHasPopup="listbox">
                          Move from
                        </ScreenChip>

                        <PickerPopover open={showFundPicker} title="Source category" onClose={() => setShowFundPicker(false)} align="left" placement="top" size="choice" zIndex={150} anchorRef={fundPickerRef}>
                          <div role="listbox" aria-label="Source categories" style={{ maxHeight: 220, overflowY: "auto", padding: 8, boxSizing: "border-box" }}>
                            <div style={{ display: "grid", gap: 2 }}>
                              {sourceCandidates.map(cat => {
                                const moveAmount = Math.min(cat.available!, deficit);
                                const isPartial = moveAmount < deficit;
                                return (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    role="option"
                                    aria-label={`${cat.name}, ${fmt(moveAmount)} MAD${isPartial ? ", partial" : ""}`}
                                    onClick={async () => {
                                      setShowFundPicker(false);
                                      await quickFund.run(() => props.onQuickFund!(cat.id, moveAmount)).catch(() => haptic("error"));
                                    }}
                                    className="picker-option composer-option"
                                  >
                                    <div style={pickerIconStyle}><CategoryIcon icon={cat.icon} categoryName={cat.name} size={24} /></div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</div>
                                      {isPartial && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>partial</div>}
                                    </div>
                                    <span style={{ fontSize: 12, color: "var(--text2)", fontVariantNumeric: "tabular-nums", flexShrink: 0, paddingLeft: 8 }}>
                                      {fmt(moveAmount)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </PickerPopover>
                      </div>
                    )}

                    {props.onOpenRebalance && (
                      <Button variant="secondary" size="compact" onClick={() => props.onOpenRebalance!()}>
                        Rebalance
                      </Button>
                    )}
                    </div>
                  )}
                >
                  <strong>{props.selectedCat.name}</strong> goes <strong><Money value={Math.round(props.overspendBelowZero ?? deficit)} /></strong> below zero.
                </Banner>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
          {!isEditMode && !isIncome && <Button variant="quiet" size="compact" aria-expanded={showRepeat} aria-controls="transaction-repeat" onClick={() => { haptic("selection"); setShowRepeat(!showRepeat); }}>{repeat === "None" ? "Repeat" : `Repeat ${repeat.toLowerCase()}`}<ChevronDownIcon size={16} aria-hidden="true" style={{ ...chevronStyle, transform: showRepeat ? "rotate(180deg)" : "none" }} /></Button>}
          <Button
            variant="quiet"
            size="compact"
            aria-expanded={showKeypad}
            aria-controls="amount-keypad"
            onClick={() => {
              haptic("selection");
              setShowKeypad((visible) => {
                const next = !visible;
                if (next) amountInputRef.current?.blur();
                else requestAnimationFrame(() => amountInputRef.current?.focus());
                return next;
              });
            }}
          >
            {showKeypad ? "Hide keypad" : "Show keypad"}
            <ChevronDownIcon size={16} aria-hidden="true" style={{ ...chevronStyle, transform: showKeypad ? "rotate(180deg)" : "none" }} />
          </Button>
          </div>
          {showRepeat && !isEditMode && !isIncome && <div id="transaction-repeat" style={{ display: "grid", gap: 8, padding: "0 16px" }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, fontSize: 13, color: "var(--text2)" }}>Repeat<ChoicePicker aria-label="Repeat expense" value={repeat} onChange={event => { setRepeat(event.target.value as BillRepeat); haptic("selection"); }}><option value="None">Off</option><option value="Monthly">Monthly</option><option value="Yearly">Yearly</option></ChoicePicker></label>
            {nextDue && <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--muted)" }}>Next bill due {fmtDate(nextDue)}. Future bills use this amount and category.</p>}
          </div>}

          {showKeypad && (
            <div id="amount-keypad" aria-label="Amount keypad" style={keypadStyle}>
              {keypadKeys.map(key => (
                <button
                  key={key.value}
                  type="button"
                  aria-label={key.ariaLabel ?? key.label}
                  onClick={() => {
                    haptic("rigid");
                    enterAmount(key.value);
                  }}
                  className="composer-keypad-key"
                >
                  {key.value === "delete" ? <DeleteIcon size={20} aria-hidden="true" /> : key.label}
                </button>
              ))}
            </div>
          )}

          {!showKeypad && !isEditMode && props.recentTransactions.length > 0 && (
            <section aria-label="Recent transactions" style={recentSectionStyle}>
              <h3 className="section-label" style={recentHeaderStyle}>Recent</h3>
              <div className="row-list" style={recentListStyle}>
                {props.recentTransactions.map((transaction) => {
                  const recentCategory = props.allCategories?.find((category) => category.id === transaction.category);
                  const isRecentIncome = transaction.type === "Income";
                  return (
                    <TransactionRow
                      key={transaction.id}
                      className="home-txn-row"
                      title={transaction.name || recentCategory?.name || (isRecentIncome ? "Income" : "Expense")}
                      subtitle={recentCategory?.name}
                      amount={transaction.amount}
                      tone={isRecentIncome ? "income" : "expense"}
                      prefix={isRecentIncome ? "+" : "−"}
                      date={transaction.date ? fmtDate(transaction.date) : undefined}
                      icon={isRecentIncome ? <BanknoteIcon size={16} /> : <CategoryIcon icon={recentCategory?.icon ?? null} categoryName={recentCategory?.name} size={22} />}
                      onClick={props.onUseRecent ? () => {
                        haptic("selection");
                        props.onUseRecent?.(transaction);
                        sheetContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                      } : undefined}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {props.errorMsg && !formSaving && <Banner tone="danger" role="alert" compact>{props.errorMsg}</Banner>}

          {/* Edit actions / Save button */}
          <SheetFooter style={footerActionsStyle}>
          {isEditMode && props.onDelete && (
            <Button variant="destructive" icon={<DeleteIcon />} style={{ flex: "0.85 1 0" }} onClick={() => { haptic("warning"); setConfirmingDelete(true); }}>
              Delete
            </Button>
          )}
          <Button variant="primary" block onClick={submit} disabled={!props.canSubmit} style={isEditMode ? { flex: "1.5 1 0" } : undefined}>
            {!isIncome && props.advanceBelowZero != null ? "Save as advance" : !isIncome && (props.overspendBelowZero != null || (props.billShortfall ?? 0) > 0) ? "Save anyway" : isEditMode ? (isIncome ? "Update income" : "Update expense") : isIncome ? "Add income" : "Add expense"}
          </Button>
          </SheetFooter>

        </section>
        </div>}
      </div>
      <SavingCover saving={sheetSaving && !deletion.saving} label={typedSavingLabel ?? "Saving"} />

      {confirmingDelete && props.onDelete && (
        <BottomSheet
          open
          onClose={guardClose(deletion.saving, () => setConfirmingDelete(false))}
          label={isIncome ? "Confirm delete income" : "Confirm delete expense"}
          detent="content"
          layered
          size="compact"
          zIndex={150}
          panelStyle={confirmPanelStyle}
        >
          <SheetBody style={confirmContentStyle}>
            <div style={confirmIconStyle}><DeleteIcon size={20} /></div>
            <div style={{ display: "grid", gap: 8 }}>
              <h2 style={confirmTitleStyle}>{isIncome ? "Delete this income?" : "Delete this expense?"}</h2>
              <p style={confirmCopyStyle}>Removes this {isIncome ? "income" : "expense"} from activity and budget totals. Undo is available afterward.</p>
            </div>
            <SheetFooter style={confirmActionsStyle}>
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  const deleted = await deletion.run(() => props.onDelete!());
                  if (deleted) {
                    haptic("success");
                    props.onClose();
                  } else {
                    haptic("error");
                  }
                }}
              >
                {isIncome ? "Delete income" : "Delete expense"}
              </Button>
            </SheetFooter>
          </SheetBody>
          <SavingCover saving={deletion.saving} label="Deleting" />
        </BottomSheet>
      )}
    </BottomSheet>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: "var(--surface)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  borderRadius: "var(--radius-sheet)",
};

/** The form's own column inside the sheet body: grows with its content, the sheet body scrolls. */
const formPaneStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, flex: "1 0 auto", minHeight: 0 };

const sheetInnerStyle: CSSProperties = {
  padding: "4px max(16px, env(safe-area-inset-left)) max(12px, env(safe-area-inset-bottom))",
  height: "100%",
  boxSizing: "border-box",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  overflowY: "hidden",
  scrollbarWidth: "none",
};

const formSectionStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const footerActionsStyle: CSSProperties = {
  marginTop: "auto",
  position: "relative",
  flexShrink: 0,
  paddingTop: 4,
  background: "transparent",
  display: "flex",
  alignItems: "stretch",
  gap: 12,
};

const confirmPanelStyle: CSSProperties = {
  borderRadius: "var(--radius-sheet)",
  background: "var(--surface)",
};

const confirmContentStyle: CSSProperties = {
  padding: "12px 24px 24px",
  display: "grid",
  gap: 16,
};

const confirmIconStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "var(--radius-control)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "color-mix(in srgb, var(--danger) 10%, var(--surface))",
  color: "var(--danger)",
};

const confirmTitleStyle: CSSProperties = { margin: 0, fontSize: 20, lineHeight: "24px", fontWeight: 600, color: "var(--text)" };
const confirmCopyStyle: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text2)" };
const confirmActionsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 12 };

const topBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const typeSwitcherStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  width: "fit-content",
  margin: "0 auto 16px",
  boxSizing: "border-box",
};

const segmentLabelStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8 };

const chevronStyle: CSSProperties = { flexShrink: 0, transition: "transform var(--motion-fast) var(--ease-standard)" };

/** Sheet title (Typography: Title 20/24). */
const dialogTitleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-body)",
  fontSize: 20,
  lineHeight: "24px",
  fontWeight: 600,
  color: "var(--text)",
};

/** The description is a typed value: --text at Body size (15; phones force 16 on inputs), centred under the amount. */
const descriptionInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 56,
  boxSizing: "border-box",
  marginTop: 16,
  background: "transparent",
  border: "none",
  padding: "0 16px",
  color: "var(--text)",
  fontSize: 15,
  lineHeight: "24px",
  fontWeight: 400,
  textAlign: "center",
};

const heroWrapStyle: CSSProperties = {
  position: "relative",
  flex: "0 0 auto",
  minHeight: 120,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  justifyContent: "center",
  padding: 0,
};

const recentSectionStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  display: "grid",
  alignContent: "start",
  gap: 8,
  padding: "4px 0 0",
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarWidth: "none",
};

/** Section heading: 12px, sentence case, muted, normal weight. */
const recentHeaderStyle: CSSProperties = {
  margin: 0,
  padding: "0 4px",
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: "16px",
  fontWeight: 500,
};

const recentListStyle: CSSProperties = {
  display: "grid",
  gap: 0,
};

const heroCopyStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text2)",
  textAlign: "center",
  animation: "fadeUp var(--motion-standard) var(--ease-standard) both",
};

const keypadStyle: CSSProperties = {
  height: 188,
  flexShrink: 0,
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gridTemplateRows: "repeat(4, 44px)",
  gap: 4,
};


const pickerBarStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const pickerContextGroupStyle: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, minWidth: 0, flex: "0 1 auto" };
const pickerSlotStyle: CSSProperties = { position: "relative", minWidth: 0 };
const datePickerSlotStyle: CSSProperties = { position: "relative", minWidth: 0, marginLeft: "auto" };

const exprPreviewStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 500,
  animation: "fadeUp var(--motion-fast) var(--ease-standard) both",
};

