"use client";

import { type CSSProperties, type RefObject } from "react";
import type { Account, Category } from "./app-types";
import { evalExpr, fmt, fmtDate, isExpression, shiftDate, today } from "./app-utils";
import { BottomSheet } from "./ui/BottomSheet";
import { Money } from "./Money";
import { PickerPopover } from "./PickerPopover";
import { CalendarIcon, ChevronDownIcon, CheckIcon, XIcon } from "./ui/icons";

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
  showSaveBurst: boolean;
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
  modeVariant?: "create" | "edit";
  onClose: () => void;
  onOpenRebalance?: () => void;
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
  if (!props.open) return null;

  const isEditMode = props.modeVariant === "edit";
  const todayValue = today();
  const yesterdayValue = shiftDate(todayValue, -1);
  const tomorrowValue = shiftDate(todayValue, 1);
  const visibleBalance = props.amountAfterBalance ?? props.displayedBalance;

  const dateOptions = [
    { label: "Today", value: todayValue },
    { label: "Yesterday", value: yesterdayValue },
    { label: "Tomorrow", value: tomorrowValue },
  ];

  return (
    <BottomSheet
      open={props.open}
      onClose={props.onClose}
      label={isEditMode ? "Edit transaction" : "Add transaction"}
      maxWidth="500px"
      detent="default"
      snapPoints={[0, 0.72, 1]}
      initialSnap={1}
      panelStyle={panelStyle}
      contentStyle={{ paddingTop: 0 }}
    >
      <div style={sheetInnerStyle}>

        {/* ── Header ── */}
        <header style={topBarStyle}>
          <div style={eyebrowStyle}>{isEditMode ? "Edit transaction" : "New transaction"}</div>
          <button onClick={props.onClose} aria-label="Close" style={closeButtonStyle}>
            <XIcon strokeWidth={2.2} />
          </button>
        </header>

        {/* ── Amount hero ── */}
        <section style={heroWrapStyle}>
          <span style={currencyLabelStyle}>MAD</span>
          <input
            type="text"
            inputMode="text"
            value={props.amount}
            onChange={(e) => props.onAmountChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.canSubmit && props.onSubmit()}
            placeholder="0"
            aria-label="Amount"
            autoComplete="off"
            autoFocus
            className="amount-hero-input"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              padding: 0,
              margin: 0,
              color: "var(--text2)",
              outline: "none",
              textAlign: "center",
              WebkitAppearance: "none",
              appearance: "none",
              fontSize: "clamp(96px, 26vw, 144px)",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
              fontFeatureSettings: '"tnum"',
              lineHeight: 0.88,
              letterSpacing: "-0.03em",
            }}
          />
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
        <section style={{ display: "grid", gap: 18 }}>

          <input
            type="text"
            aria-label="Transaction description"
            value={props.name}
            onChange={(e) => props.onNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.canSubmit && props.onSubmit()}
            placeholder="What was it for?"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid color-mix(in srgb, var(--border) 36%, transparent)",
              padding: "0 0 10px",
              color: "var(--text2)",
              outline: "none",
              fontSize: 16,
              lineHeight: 1.25,
              fontWeight: 400,
            }}
          />

          {/* Pickers row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>

            {/* Account picker */}
            <div style={{ position: "relative" }} ref={props.accountRef}>
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
                <ChevronDownIcon size={11} style={{ color: "var(--muted)", flexShrink: 0, transition: "transform 0.18s", transform: props.showAccountPicker ? "rotate(180deg)" : "none" }} />
              </button>

              <PickerPopover open={props.showAccountPicker} align="left" placement="top" width="min(292px, calc(100vw - 28px))" zIndex={140} anchorRef={props.accountRef}>
                <div id="account-picker" style={{ maxHeight: 236, overflowY: "auto", overflowX: "hidden", padding: 8, boxSizing: "border-box" }}>
                  <div style={{ display: "grid", gap: 2 }}>
                    {props.filteredAccounts.map((acct) => (
                      <button key={acct.id} onClick={() => props.onSelectAccount(acct.id)} style={{ ...pickerRowStyle, background: acct.id === props.selectedAccount?.id ? "color-mix(in srgb, var(--accent) 11%, white)" : "transparent", boxShadow: acct.id === props.selectedAccount?.id ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)" : "none" }}>
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
            <div style={{ position: "relative" }} ref={props.catRef}>
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
                <span style={{ ...chipLabelStyle, maxWidth: 132 }}>{props.selectedCat?.name ?? "Category"}</span>
                <ChevronDownIcon size={11} style={{ color: "var(--muted)", flexShrink: 0, transition: "transform 0.18s", transform: props.showCatPicker ? "rotate(180deg)" : "none" }} />
              </button>

              <PickerPopover open={props.showCatPicker} align="left" placement="top" width="min(300px, calc(100vw - 28px))" zIndex={140} anchorRef={props.catRef}>
                <div id="category-picker" style={{ width: "100%", boxSizing: "border-box" }}>
                  <div style={{ maxHeight: 228, overflowY: "auto", overflowX: "hidden", padding: 8, boxSizing: "border-box" }}>
                    <div style={{ display: "grid", gap: 2 }}>
                      {props.filteredCats.map((cat) => {
                        const meta = [cat.type[0] ?? null, cat.id === props.lastUsedCatId ? "Last used" : null].filter(Boolean).join(" / ");
                        return (
                          <button key={cat.id} onClick={() => props.onSelectCategory(cat)} style={{ ...pickerRowStyle, background: cat.id === props.selectedCat?.id ? "color-mix(in srgb, var(--accent) 11%, white)" : "transparent", boxShadow: cat.id === props.selectedCat?.id ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)" : "none" }}>
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
                  <div style={{ padding: "10px 10px 11px", borderTop: "1px solid color-mix(in srgb, var(--border) 36%, transparent)", background: "color-mix(in srgb, var(--surface2) 10%, white)" }}>
                    <div style={{ minHeight: 44, borderRadius: 12, border: "1px solid transparent", background: "color-mix(in srgb, var(--surface2) 42%, white)", display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
                      <span aria-hidden="true" style={{ fontSize: 12, color: "var(--muted)" }}>/</span>
                      <input type="text" aria-label="Search categories" value={props.catSearch} onChange={(e) => props.onCatSearchChange(e.target.value)} placeholder="Search categories" autoFocus style={{ width: "100%", background: "transparent", border: "none", padding: 0, color: "var(--text2)", outline: "none", fontSize: 15 }} />
                    </div>
                  </div>
                </div>
              </PickerPopover>
            </div>

            {/* Date picker */}
            <div style={{ position: "relative" }} ref={props.dateRef}>
              <button
                onClick={props.onToggleDatePicker}
                aria-haspopup="dialog"
                aria-expanded={props.showDatePicker}
                aria-controls="date-picker"
                style={{
                  ...chipStyle,
                  color: props.showDatePicker ? "var(--text2)" : "var(--muted)",
                }}
              >
                <span style={chipIconStyle}><CalendarIcon size={11} /></span>
                <span style={{ ...chipLabelStyle, whiteSpace: "nowrap" }}>{props.selectedDateLabel}</span>
                <ChevronDownIcon size={11} style={{ color: "var(--muted)", flexShrink: 0, transition: "transform 0.18s", transform: props.showDatePicker ? "rotate(180deg)" : "none" }} />
              </button>

              <PickerPopover open={props.showDatePicker} align="right" placement="top" width="min(236px, calc(100vw - 28px))" zIndex={140} anchorRef={props.dateRef}>
                <div id="date-picker" style={{ width: "100%", boxSizing: "border-box" }}>
                  <div style={{ display: "grid", gap: 2, padding: 8, boxSizing: "border-box" }}>
                    {dateOptions.map((option) => {
                      const selected = option.value === props.date;
                      return (
                        <button key={option.value} onClick={() => props.onSelectDate(option.value)} style={{ width: "100%", minHeight: 42, padding: "9px 12px", background: selected ? "color-mix(in srgb, var(--accent) 10%, white)" : "transparent", border: "none", borderRadius: 10, color: selected ? "color-mix(in srgb, var(--accent) 76%, var(--text2))" : "var(--text2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", fontSize: 13, textAlign: "left", boxShadow: selected ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)" : "none" }}>
                          <span style={{ fontWeight: selected ? 600 : 500 }}>{option.label}</span>
                          <span style={{ ...monoSmallStyle, color: selected ? "color-mix(in srgb, var(--accent) 62%, var(--text2))" : "var(--muted)" }}>{fmtDate(option.value)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ padding: "10px 10px 11px", borderTop: "1px solid color-mix(in srgb, var(--border) 36%, transparent)", background: "color-mix(in srgb, var(--surface2) 10%, white)" }}>
                    <div style={{ minHeight: 44, borderRadius: 12, border: "1px solid transparent", background: "color-mix(in srgb, var(--surface2) 42%, white)", display: "flex", alignItems: "center", padding: "0 12px" }}>
                      <input type="date" aria-label="Transaction date" value={props.date} onChange={(e) => props.onSelectDate(e.target.value)} style={{ width: "100%", background: "transparent", border: "none", padding: 0, colorScheme: "light", color: "var(--text2)", outline: "none", fontSize: 15 }} />
                    </div>
                  </div>
                </div>
              </PickerPopover>
            </div>
          </div>

          {/* Budget warnings */}
          {(props.suggestedCategory || props.categoryUnfunded || props.categoryOverBudget) && (
            <div style={{ display: "grid", gap: 10 }}>
              {props.suggestedCategory && props.suggestedCategory.id !== props.selectedCat?.id && (
                <button onClick={() => props.onSelectCategory(props.suggestedCategory!)} style={{ minHeight: 44, padding: "0 2px", border: "none", background: "transparent", color: "var(--text2)", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, justifySelf: "start" }}>
                  <span style={{ fontSize: 14, opacity: 0.85 }}>{props.suggestedCategory.icon ?? "#"}</span>
                  <span>Suggested: <strong style={{ fontWeight: 600 }}>{props.suggestedCategory.name}</strong></span>
                </button>
              )}
              {props.categoryUnfunded && (
                <div style={warnStyle}>
                  <span style={{ fontSize: 12, opacity: 0.75, marginTop: 1 }}>!</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    <span style={warnTextStyle}><strong>{props.selectedCat?.name}</strong> has no available budget.</span>
                    {props.onOpenRebalance && (
                      <button
                        type="button"
                        onClick={() => props.onOpenRebalance!()}
                        style={rebalanceLinkStyle}
                      >
                        Rebalance budget →
                      </button>
                    )}
                  </div>
                </div>
              )}
              {props.categoryOverBudget && props.selectedCat && (
                <div style={warnStyle}>
                  <span style={{ fontSize: 12, opacity: 0.75, marginTop: 1 }}>!</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    <span style={warnTextStyle}>
                      Over budget by <strong><Money value={props.parsedAmount - (props.selectedCat.available ?? 0)} /></strong>. Only{" "}
                      <strong><Money value={props.selectedCat.available ?? 0} /></strong> left in <strong>{props.selectedCat.name}</strong>.
                    </span>
                    {props.onOpenRebalance && (
                      <button
                        type="button"
                        onClick={() => props.onOpenRebalance!()}
                        style={rebalanceLinkStyle}
                      >
                        Rebalance budget →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={props.onSubmit}
            disabled={!props.canSubmit}
            aria-label={
              props.status === "saving" ? (isEditMode ? "Updating transaction" : "Saving transaction")
              : props.status === "success" ? (isEditMode ? "Transaction updated" : "Transaction saved")
              : props.status === "error" ? `Save failed: ${props.errorMsg}`
              : isEditMode ? "Update transaction" : "Save transaction"
            }
            className="pressable cta-save"
            style={{
              width: "100%",
              minHeight: 52,
              borderRadius: 14,
              border: "none",
              background:
                props.status === "success" ? "color-mix(in srgb, var(--success) 12%, white)"
                : props.status === "error" ? "color-mix(in srgb, var(--danger) 10%, white)"
                : "var(--accent)",
              color:
                props.status === "success" ? "var(--success)"
                : props.status === "error" ? "var(--danger)"
                : "var(--accent-ink)",
              fontWeight: 700,
              fontSize: 15,
              cursor: props.canSubmit ? "pointer" : "not-allowed",
              opacity: props.canSubmit || props.status !== "idle" ? 1 : 0.4,
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
              isEditMode ? "Update transaction" : "Save"
            )}
          </button>

        </section>
      </div>
    </BottomSheet>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--surface) 97%, white)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  borderRadius: 20,
};

const sheetInnerStyle: CSSProperties = {
  padding: "18px 18px 24px",
  display: "grid",
  gap: 20,
};

const topBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
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
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  padding: "12px 0 28px",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 28%, transparent)",
};

const currencyLabelStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
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

const chipStyle: CSSProperties = {
  minHeight: 36,
  padding: "0 6px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

const chipIconStyle: CSSProperties = {
  width: 16,
  height: 16,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  flexShrink: 0,
};

const chipLabelStyle: CSSProperties = {
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
  fontSize: 11,
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

const warnStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "11px 12px",
  borderRadius: 16,
  background: "color-mix(in srgb, var(--danger) 8%, white)",
};

const warnTextStyle: CSSProperties = {
  fontSize: 12,
  color: "color-mix(in srgb, var(--danger) 46%, var(--text2))",
  lineHeight: 1.5,
};

const rebalanceLinkStyle: CSSProperties = {
  alignSelf: "flex-start",
  padding: 0,
  border: "none",
  background: "transparent",
  fontSize: 12,
  fontWeight: 600,
  color: "color-mix(in srgb, var(--accent-ink) 75%, var(--text2))",
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 2,
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
