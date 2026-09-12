"use client";

import { useState, useEffect, useRef, type CSSProperties, type RefObject } from "react";
import type { Account, Category } from "./app-types";
import { evalExpr, fmt, isExpression, shiftDate, today } from "./app-utils";
import { BottomSheet } from "./ui/BottomSheet";
import { Money } from "./Money";
import { PickerPopover } from "./PickerPopover";
import { Banner } from "./ui/Banner";
import { DateCalendar, DatePickerTrigger } from "./DatePicker";
import { ArrowDownIcon, ArrowUpIcon, AlertTriangleIcon, ChevronDownIcon, CheckIcon, DeleteIcon, XIcon } from "./ui/icons";

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
  lastUsedCatId: string;
  displayedBalance: number | null;
  amountAfterBalance: number | null;
  parsedAmount: number;
  categoryUnfunded: boolean;
  categoryOverBudget: boolean;
  canSubmit: boolean;
  allCategories?: Category[];
  modeVariant?: "create" | "edit";
  transactionType: "Expense" | "Income";
  onTransactionTypeChange: (type: "Expense" | "Income") => void;
  onClose: () => void;
  onOpenRebalance?: () => void;
  onQuickFund?: (sourceCategoryId: string, amount: number) => Promise<void>;
  onAmountChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onToggleDatePicker: () => void;
  onToggleCatPicker: () => void;
  onToggleAccountPicker: () => void;
  onSelectDate: (value: string) => void;
  onSelectCategory: (category: Category) => void;
  onSelectAccount: (id: string) => void;
  onCatSearchChange: (value: string) => void;
  onSubmit: () => void;
  dateRef: RefObject<HTMLDivElement>;
  catRef: RefObject<HTMLDivElement>;
  accountRef: RefObject<HTMLDivElement>;
};

export function AddTransactionSheet(props: AddTransactionSheetProps) {
  const [fundingSourceId, setFundingSourceId] = useState<string | null>(null);
  const [showFundPicker, setShowFundPicker] = useState(false);
  const fundPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.open) {
      setShowFundPicker(false);
      setFundingSourceId(null);
    }
  }, [props.open]);

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

  if (!props.open) return null;

  const deficit = props.categoryUnfunded
    ? props.parsedAmount
    : Math.max(0, props.parsedAmount - (props.selectedCat?.available ?? 0));

  const sourceCandidates = (props.allCategories ?? [])
    .filter(c => c.id !== props.selectedCat?.id && (c.available ?? 0) > 0)
    .sort((a, b) => (b.available ?? 0) - (a.available ?? 0))
    .slice(0, 8);

  const isEditMode = props.modeVariant === "edit";
  const isIncome = props.transactionType === "Income";
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

  const keypadKeys = [
    { value: "7", label: "7" }, { value: "8", label: "8" }, { value: "9", label: "9" }, { value: "/", label: "÷", ariaLabel: "Divide" },
    { value: "4", label: "4" }, { value: "5", label: "5" }, { value: "6", label: "6" }, { value: "*", label: "×", ariaLabel: "Multiply" },
    { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "-", label: "−", ariaLabel: "Subtract" },
    { value: ".", label: ".", ariaLabel: "Decimal point" }, { value: "0", label: "0" }, { value: "delete", label: "delete", ariaLabel: "Delete last digit" }, { value: "+", label: "+", ariaLabel: "Add" },
  ];

  return (
    <BottomSheet
      open={props.open}
      onClose={props.onClose}
      label={isEditMode ? "Edit transaction" : "Add transaction"}
      maxWidth="500px"
      detent="default"
      snapPoints={[0, 0.88, 1]}
      initialSnap={2}
      backdropStrength={0.12}
      panelStyle={panelStyle}
      contentStyle={{ paddingTop: 0, overflow: "hidden" }}
    >
      <div style={sheetInnerStyle}>

        {/* ── Header ── */}
        <header style={topBarStyle}>
          <div style={eyebrowStyle}>{isEditMode ? "Edit expense" : "New transaction"}</div>
          <button onClick={props.onClose} aria-label="Close" style={closeButtonStyle}>
            <XIcon strokeWidth={2.2} />
          </button>
        </header>

        {!isEditMode && (
          <div role="tablist" aria-label="Transaction type" style={typeSwitcherStyle}>
            <button type="button" role="tab" aria-selected={!isIncome} className="transaction-type transaction-type--expense" onClick={() => props.onTransactionTypeChange("Expense")}><ArrowUpIcon size={16} aria-hidden="true" /><span>Expense</span></button>
            <button type="button" role="tab" aria-selected={isIncome} className="transaction-type transaction-type--income" onClick={() => props.onTransactionTypeChange("Income")}><ArrowDownIcon size={16} aria-hidden="true" /><span>Income</span></button>
          </div>
        )}

        {/* ── Amount hero ── */}
        <section style={heroWrapStyle}>
          <span style={currencyLabelStyle}>MAD</span>
          <div className="amount-hero-sizer" data-value={props.amount || "0"} style={{ width: "100%" }}>
            <input
              type="text"
              value={props.amount}
              onChange={(e) => props.onAmountChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && props.canSubmit && props.onSubmit()}
              placeholder="0"
              aria-label="Amount"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              className="amount-hero-input"
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                margin: 0,
                color: "var(--text2)",
                WebkitAppearance: "none",
                appearance: "none",
                fontSize: "clamp(68px, 20vw, 104px)",
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
                lineHeight: 0.88,
                letterSpacing: "-0.03em",
                textAlign: "center",
              }}
            />
          </div>
          {isExpression(props.amount) && (
            <p style={exprPreviewStyle}>
              = {fmt(evalExpr(props.amount))} MAD
            </p>
          )}
          {visibleBalance !== null && props.amount.trim() !== "" && (
            <p style={{ ...heroCopyStyle, color: visibleBalance >= 0 ? "var(--success)" : "var(--danger)" }}>
              Balance after: <Money value={visibleBalance} />
            </p>
          )}
        </section>

        {/* ── Form fields ── */}
        <section style={formSectionStyle}>
          <input
            id="transaction-description"
            className="composer-text-input"
            type="text"
            aria-label="Transaction description"
            value={props.name}
            onChange={(e) => props.onNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.canSubmit && props.onSubmit()}
            placeholder={isIncome ? "Where did it come from?" : "What was it for?"}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              padding: "8px 0 14px",
              color: "var(--text2)",
              fontSize: 16,
              lineHeight: 1.25,
              fontWeight: 400,
              textAlign: "center",
            }}
          />

          {/* Pickers row */}
          <div style={pickerBarStyle}>
            <div style={pickerContextGroupStyle}>

            {/* Account picker */}
            <div style={pickerSlotStyle} ref={props.accountRef}>
              <button
                onClick={props.onToggleAccountPicker}
                aria-haspopup="dialog"
                aria-expanded={props.showAccountPicker}
                aria-controls="account-picker"
                style={{
                  ...chipStyle,
                  color: props.showAccountPicker ? "var(--text2)" : "var(--muted)",
                }}
              >
                <span style={chipIconStyle}>{props.selectedAccount?.icon ?? "$"}</span>
                <span style={chipLabelStyle}>{props.selectedAccount?.label ?? ""}</span>
              </button>

              <PickerPopover open={props.showAccountPicker} title="Account" onClose={props.onToggleAccountPicker} align="left" placement="top" width="min(292px, calc(100vw - 28px))" zIndex={140} anchorRef={props.accountRef}>
                <div id="account-picker" style={{ maxHeight: 236, overflowY: "auto", overflowX: "hidden", padding: 8, boxSizing: "border-box" }}>
                  <div style={{ display: "grid", gap: 2 }}>
                    {props.filteredAccounts.map((acct) => (
                      <button className="picker-option" aria-pressed={acct.id === props.selectedAccount?.id} key={acct.id} onClick={() => props.onSelectAccount(acct.id)} style={{ ...pickerRowStyle, background: acct.id === props.selectedAccount?.id ? "color-mix(in srgb, var(--accent) 11%, var(--surface))" : "transparent", boxShadow: acct.id === props.selectedAccount?.id ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)" : "none" }}>
                        <div style={pickerIconStyle}>
                          {acct.icon ?? "$"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: acct.id === props.selectedAccount?.id ? 600 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acct.label}</div>
                          {acct.type && <div style={pickerMetaStyle}>{acct.type}</div>}
                        </div>
                        {acct.balance !== null && (
                          <span style={{ ...monoSmallStyle, color: acct.balance < 0 ? "var(--danger)" : "var(--muted)", paddingLeft: 8 }}>
                            <Money value={acct.balance} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </PickerPopover>
            </div>

            {/* Category picker */}
            {!isIncome && <div style={pickerSlotStyle} ref={props.catRef}>
              <button
                onClick={props.onToggleCatPicker}
                aria-haspopup="dialog"
                aria-expanded={props.showCatPicker}
                aria-controls="category-picker"
                style={{
                  ...chipStyle,
                  color: props.selectedCat || props.showCatPicker ? "var(--text2)" : "var(--muted)",
                }}
              >
                <span style={chipIconStyle}>{props.selectedCat?.icon ?? "#"}</span>
                <span style={chipLabelStyle}>{props.selectedCat?.name ?? "Category"}</span>
              </button>

              <PickerPopover open={props.showCatPicker} title="Category" onClose={props.onToggleCatPicker} align="left" placement="top" width="min(300px, calc(100vw - 28px))" zIndex={140} anchorRef={props.catRef}>
                <div id="category-picker" style={{ width: "100%", boxSizing: "border-box" }}>
                  <div style={{ maxHeight: 164, overflowY: "auto", overflowX: "hidden", padding: 8, boxSizing: "border-box" }}>
                    <div style={{ display: "grid", gap: 2 }}>
                      {props.filteredCats.map((cat) => {
                        const meta = [cat.type[0] ?? null, cat.id === props.lastUsedCatId ? "Last used" : null].filter(Boolean).join(" / ");
                        return (
                          <button className="picker-option" aria-pressed={cat.id === props.selectedCat?.id} key={cat.id} onClick={() => props.onSelectCategory(cat)} style={{ ...pickerRowStyle, background: cat.id === props.selectedCat?.id ? "color-mix(in srgb, var(--accent) 11%, var(--surface))" : "transparent", boxShadow: cat.id === props.selectedCat?.id ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)" : "none" }}>
                            <div style={pickerIconStyle}>
                              {cat.icon ?? "#"}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: cat.id === props.selectedCat?.id ? 600 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</div>
                              {meta && <div style={pickerMetaStyle}>{meta}</div>}
                            </div>
                            {cat.available !== null && (
                              <span style={{ ...monoSmallStyle, color: cat.available > 0 ? "var(--success)" : "var(--danger)", paddingLeft: 8 }}>
                                {cat.available > 0 ? "+" : ""}<Money value={cat.available} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {props.filteredCats.length === 0 && (
                        <p style={{ padding: 18, color: "var(--muted)", fontSize: 14, textAlign: "center" }}>No categories found</p>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: "10px 10px 11px", borderTop: "1px solid color-mix(in srgb, var(--border) 36%, transparent)", background: "color-mix(in srgb, var(--surface2) 10%, var(--surface))" }}>
                    <div style={{ minHeight: 44, borderRadius: 12, border: "1px solid transparent", background: "color-mix(in srgb, var(--surface2) 42%, var(--surface))", display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
                      <span aria-hidden="true" style={{ fontSize: 12, color: "var(--muted)" }}>/</span>
                      <input type="text" aria-label="Search categories" value={props.catSearch} onChange={(e) => props.onCatSearchChange(e.target.value)} placeholder="Search categories" autoFocus style={{ width: "100%", background: "transparent", border: "none", padding: 0, color: "var(--text2)", outline: "none", fontSize: 15 }} />
                    </div>
                  </div>
                </div>
              </PickerPopover>
            </div>}
            </div>

            {/* Date picker */}
            <div style={datePickerSlotStyle} ref={props.dateRef}>
              <DatePickerTrigger label={props.selectedDateLabel} open={props.showDatePicker} ariaLabel="Choose date" onClick={props.onToggleDatePicker} style={chipStyle} className="composer-picker-chip" showChevron={false} />

              <PickerPopover open={props.showDatePicker} title="Date" onClose={props.onToggleDatePicker} align="right" placement="top" width="min(304px, calc(100vw - 32px))" zIndex={140} anchorRef={props.dateRef}>
                <div id="date-picker"><DateCalendar value={props.date} onChange={props.onSelectDate} /></div>
              </PickerPopover>
            </div>
          </div>

          <div aria-label="Amount keypad" style={keypadStyle}>
            {keypadKeys.map(key => (
              <button
                key={key.value}
                type="button"
                aria-label={key.ariaLabel ?? key.label}
                onClick={() => enterAmount(key.value)}
                style={keypadButtonStyle}
              >
                {key.value === "delete" ? <DeleteIcon size={19} aria-hidden="true" /> : key.label}
              </button>
            ))}
          </div>

          {/* Budget warnings */}
          {!isIncome && (props.suggestedCategory || props.categoryUnfunded || props.categoryOverBudget) && (
            <div style={{ display: "grid", gap: 10 }}>
              {props.suggestedCategory && props.suggestedCategory.id !== props.selectedCat?.id && (
                <button onClick={() => props.onSelectCategory(props.suggestedCategory!)} style={{ minHeight: 44, padding: "0 2px", border: "none", background: "transparent", color: "var(--text2)", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, justifySelf: "start" }}>
                  <span style={{ fontSize: 14, opacity: 0.85 }}>{props.suggestedCategory.icon ?? "#"}</span>
                  <span>Suggested: <strong style={{ fontWeight: 600 }}>{props.suggestedCategory.name}</strong></span>
                </button>
              )}
              {(props.categoryUnfunded || props.categoryOverBudget) && props.selectedCat && (
                <Banner
                  role="alert"
                  tone="danger"
                  compact
                  icon={<AlertTriangleIcon size={15} />}
                  action={(
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    {/* Fund from dropdown — only shown once amount is entered */}
                    {props.onQuickFund && sourceCandidates.length > 0 && deficit > 0 && (
                      <div style={{ position: "relative", flexShrink: 0 }} ref={fundPickerRef}>
                        <button
                          type="button"
                          disabled={!!fundingSourceId}
                          onClick={() => setShowFundPicker(v => !v)}
                          aria-label="Move funds from another category"
                          aria-expanded={showFundPicker}
                          aria-haspopup="listbox"
                          style={fundTriggerStyle(!!fundingSourceId)}
                        >
                          {fundingSourceId
                            ? <><span style={{ width: 11, height: 11, border: "1.5px solid color-mix(in srgb, currentColor 30%, transparent)", borderTopColor: "currentColor", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} /> Moving…</>
                            : <>Move from <ChevronDownIcon size={10} style={{ flexShrink: 0, color: "var(--muted)", transition: "transform 0.15s", transform: showFundPicker ? "rotate(180deg)" : "none" }} /></>
                          }
                        </button>

                        <PickerPopover open={showFundPicker} title="Source category" onClose={() => setShowFundPicker(false)} align="left" placement="top" width="min(260px, calc(100vw - 28px))" zIndex={150} anchorRef={fundPickerRef}>
                          <div role="listbox" aria-label="Source categories" style={{ maxHeight: 220, overflowY: "auto", padding: 6, boxSizing: "border-box" }}>
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
                                      setFundingSourceId(cat.id);
                                      try {
                                        await props.onQuickFund!(cat.id, moveAmount);
                                      } finally {
                                        setFundingSourceId(null);
                                      }
                                    }}
                                    className="picker-option"
                                    style={fundPickerRowStyle}
                                  >
                                    <div style={{ ...pickerIconStyle, fontSize: 13, width: 28, height: 28, borderRadius: 8 }}>{cat.icon ?? "#"}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</div>
                                      {isPartial && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>partial</div>}
                                    </div>
                                    <span style={{ fontSize: 12, color: isPartial ? "var(--warning)" : "var(--success)", fontVariantNumeric: "tabular-nums", flexShrink: 0, paddingLeft: 8 }}>
                                      {fmt(moveAmount)} MAD
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
                      <button type="button" onClick={() => props.onOpenRebalance!()} style={rebalanceLinkStyle}>
                        Rebalance
                      </button>
                    )}
                    </div>
                  )}
                >
                  {props.categoryUnfunded
                    ? <>No budget in <strong>{props.selectedCat.name}</strong></>
                    : <>Short <strong>{fmt(deficit)} MAD</strong> in <strong>{props.selectedCat.name}</strong></>
                  }
                </Banner>
              )}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={props.onSubmit}
            disabled={!props.canSubmit}
            aria-label={
              props.status === "saving" ? (isEditMode ? "Updating expense" : isIncome ? "Adding income" : "Adding expense")
              : props.status === "success" ? (isEditMode ? "Expense updated" : isIncome ? "Income added" : "Expense added")
              : props.status === "error" ? `Save failed: ${props.errorMsg}`
              : isEditMode ? "Update expense" : isIncome ? "Add income" : "Add expense"
            }
            className="pressable cta-save"
            style={{
              width: "100%",
              minHeight: 52,
              borderRadius: 14,
              border: "none",
              background:
                props.status === "success" ? "color-mix(in srgb, var(--success) 12%, var(--surface))"
                : props.status === "error" ? "color-mix(in srgb, var(--danger) 10%, var(--surface))"
                : !props.canSubmit && props.status === "idle" ? "var(--surface2)" : "var(--accent)",
              color:
                props.status === "success" ? "var(--success)"
                : props.status === "error" ? "var(--danger)"
                : !props.canSubmit && props.status === "idle" ? "var(--muted)" : "var(--accent-ink)",
              fontWeight: 700,
              fontSize: 15,
              cursor: props.canSubmit ? "pointer" : "not-allowed",
              opacity: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {props.status === "saving" ? (
              <><span style={{ width: 15, height: 15, border: "2px solid color-mix(in srgb, currentColor 26%, transparent)", borderTopColor: "currentColor", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />{isEditMode ? "Updating..." : "Saving..."}</>
            ) : props.status === "success" ? (
              <><CheckIcon size={16} />{isEditMode ? "Updated" : "Saved"}</>
            ) : props.status === "error" ? (
              <><XIcon size={16} />Error</>
            ) : (
              isEditMode ? "Update expense" : isIncome ? "Add income" : "Add expense"
            )}
          </button>

        </section>
      </div>
    </BottomSheet>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--surface) 97%, var(--surface))",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  borderRadius: "var(--radius-sheet)",
};

const sheetInnerStyle: CSSProperties = {
  padding: "8px 18px 12px",
  height: "100%",
  boxSizing: "border-box",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  overflowY: "auto",
  scrollbarWidth: "none",
};

const formSectionStyle: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

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
  gap: 2,
  height: 44,
  width: "fit-content",
  margin: "0 auto",
  padding: 3,
  boxSizing: "border-box",
  borderRadius: 999,
  background: "var(--surface2)",
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const closeButtonStyle: CSSProperties = {
  width: 44,
  height: 44,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const heroWrapStyle: CSSProperties = {
  position: "relative",
  flex: 1,
  minHeight: 96,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  justifyContent: "center",
  padding: "0 0 8px",
};

const currencyLabelStyle: CSSProperties = {
  position: "absolute",
  right: 4,
  bottom: 14,
  fontFamily: "var(--font-body)",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: "var(--muted)",
  opacity: 0.6,
};

const heroCopyStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-body)",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--text2)",
  textAlign: "center",
  animation: "fadeUp 0.18s ease both",
};

const keypadStyle: CSSProperties = {
  height: 188,
  flexShrink: 0,
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gridTemplateRows: "repeat(4, 44px)",
  gap: 4,
};

const keypadButtonStyle: CSSProperties = {
  minHeight: 44,
  border: "none",
  borderRadius: "var(--radius-control)",
  background: "var(--surface2)",
  color: "var(--text)",
  fontSize: 20,
  fontWeight: 650,
  fontVariantNumeric: "tabular-nums",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const pickerBarStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const pickerContextGroupStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: "0 1 auto" };
const pickerSlotStyle: CSSProperties = { position: "relative", minWidth: 0 };
const datePickerSlotStyle: CSSProperties = { position: "relative", minWidth: 0, marginLeft: "auto" };

const chipStyle: CSSProperties = {
  minHeight: 44,
  minWidth: 0,
  maxWidth: "100%",
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border) 44%, transparent)",
  background: "var(--surface)",
  color: "var(--text2)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  boxSizing: "border-box",
};

const chipIconStyle: CSSProperties = {
  width: 18,
  height: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  flexShrink: 0,
};

const chipLabelStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: 128,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const pickerRowStyle: CSSProperties = {
  width: "100%",
  minHeight: 54,
  padding: "12px 14px",
  background: "transparent",
  border: "none",
  borderRadius: 16,
  color: "var(--text2)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  fontSize: 13,
  textAlign: "left",
  boxSizing: "border-box",
};

const pickerIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  fontSize: 15,
};

const pickerMetaStyle: CSSProperties = {
  marginTop: 3,
  fontFamily: "var(--font-body)",
  fontSize: 12,
  color: "var(--muted)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const monoSmallStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  flexShrink: 0,
};

const rebalanceLinkStyle: CSSProperties = {
  padding: 0,
  border: "none",
  background: "transparent",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--muted)",
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 2,
  flexShrink: 0,
};

const fundTriggerStyle = (loading: boolean): CSSProperties => ({
  padding: 0,
  border: "none",
  background: "transparent",
  fontFamily: "var(--font-body)",
  color: loading ? "var(--muted)" : "var(--text2)",
  fontSize: 12,
  fontWeight: 600,
  cursor: loading ? "wait" : "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  flexShrink: 0,
  transition: "color 0.15s ease",
});

const fundPickerRowStyle: CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "8px 10px",
  background: "transparent",
  border: "none",
  borderRadius: 10,
  color: "var(--text2)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  textAlign: "left",
  boxSizing: "border-box",
};

const exprPreviewStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--accent-ink)",
  letterSpacing: 0.2,
  opacity: 0.8,
  animation: "fadeUp 0.15s ease both",
};
