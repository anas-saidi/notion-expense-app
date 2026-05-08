"use client";

import { type CSSProperties, type RefObject } from "react";
import type { Account, Category } from "./app-types";
import { fmtDate, shiftDate, today } from "./app-utils";
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
  onClose: () => void;
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

  const todayValue = today();
  const yesterdayValue = shiftDate(todayValue, -1);
  const tomorrowValue = shiftDate(todayValue, 1);
  const visibleBalance = props.amountAfterBalance ?? props.displayedBalance;
  const amountInputWidth = `${Math.max((props.amount || "0.00").length, 4) * 0.7 + 0.8}ch`;

  const dateOptions = [
    { label: "Today", value: todayValue },
    { label: "Yesterday", value: yesterdayValue },
    { label: "Tomorrow", value: tomorrowValue },
  ];

  return (
    <BottomSheet
      open={props.open}
      onClose={props.onClose}
      label="Add transaction"
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
          <div>
            <div style={eyebrowStyle}>New transaction</div>
            <h2 style={titleStyle}>Add</h2>
          </div>
          <button onClick={props.onClose} aria-label="Close" style={closeButtonStyle}>
            <XIcon strokeWidth={2.2} />
          </button>
        </header>

        {/* ── Amount hero ── */}
        <section style={heroWrapStyle}>
          <div style={eyebrowStyle}>MAD</div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "flex-end" }}>
            <input
              type="number"
              inputMode="decimal"
              value={props.amount}
              onChange={(e) => props.onAmountChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && props.canSubmit && props.onSubmit()}
              placeholder="0.00"
              aria-label="Amount"
              style={{
                width: amountInputWidth,
                minWidth: "3.8ch",
                maxWidth: "100%",
                background: "transparent",
                border: "none",
                padding: 0,
                color: "var(--text)",
                outline: "none",
                fontSize: "clamp(2.8rem, 8vw, 4rem)",
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
                lineHeight: 0.95,
                letterSpacing: -1.1,
              }}
            />
          </div>
          {visibleBalance !== null && (
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
              color: "var(--text)",
              outline: "none",
              fontSize: 18,
              lineHeight: 1.25,
              fontWeight: 450,
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
                  borderColor: props.showAccountPicker
                    ? "color-mix(in srgb, var(--border2) 50%, transparent)"
                    : "color-mix(in srgb, var(--border) 28%, transparent)",
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
                        <div style={{ ...pickerIconStyle, background: acct.id === props.selectedAccount?.id ? "color-mix(in srgb, var(--accent) 12%, white)" : "color-mix(in srgb, var(--surface2) 72%, transparent)" }}>
                          {acct.icon ?? "$"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: acct.id === props.selectedAccount?.id ? 650 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acct.label}</div>
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
                  borderColor: props.showCatPicker
                    ? "color-mix(in srgb, var(--border2) 50%, transparent)"
                    : "color-mix(in srgb, var(--border) 28%, transparent)",
                  color: props.selectedCat ? "var(--text2)" : "var(--muted)",
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
                            <div style={{ ...pickerIconStyle, background: cat.id === props.selectedCat?.id ? "color-mix(in srgb, var(--accent) 12%, white)" : "color-mix(in srgb, var(--surface2) 72%, transparent)" }}>
                              {cat.icon ?? "#"}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: cat.id === props.selectedCat?.id ? 650 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</div>
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
                      <input type="text" aria-label="Search categories" value={props.catSearch} onChange={(e) => props.onCatSearchChange(e.target.value)} placeholder="Search categories" autoFocus style={{ width: "100%", background: "transparent", border: "none", padding: 0, color: "var(--text)", outline: "none", fontSize: 15 }} />
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
                  borderColor: props.showDatePicker
                    ? "color-mix(in srgb, var(--border2) 50%, transparent)"
                    : "color-mix(in srgb, var(--border) 28%, transparent)",
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
                        <button key={option.value} onClick={() => props.onSelectDate(option.value)} style={{ width: "100%", minHeight: 42, padding: "9px 12px", background: selected ? "color-mix(in srgb, var(--accent) 10%, white)" : "transparent", border: "none", borderRadius: 10, color: selected ? "color-mix(in srgb, var(--accent) 76%, var(--text2))" : "var(--text)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", fontSize: 14, textAlign: "left", boxShadow: selected ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)" : "none" }}>
                          <span style={{ fontWeight: selected ? 650 : 600 }}>{option.label}</span>
                          <span style={{ ...monoSmallStyle, color: selected ? "color-mix(in srgb, var(--accent) 62%, var(--text2))" : "var(--muted)" }}>{fmtDate(option.value)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ padding: "10px 10px 11px", borderTop: "1px solid color-mix(in srgb, var(--border) 36%, transparent)", background: "color-mix(in srgb, var(--surface2) 10%, white)" }}>
                    <div style={{ minHeight: 44, borderRadius: 12, border: "1px solid transparent", background: "color-mix(in srgb, var(--surface2) 42%, white)", display: "flex", alignItems: "center", padding: "0 12px" }}>
                      <input type="date" aria-label="Transaction date" value={props.date} onChange={(e) => props.onSelectDate(e.target.value)} style={{ width: "100%", background: "transparent", border: "none", padding: 0, colorScheme: "light", color: "var(--text)", outline: "none", fontSize: 15 }} />
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
                  <span style={warnTextStyle}><strong>{props.selectedCat?.name}</strong> has no available budget. Fund it in Notion first.</span>
                </div>
              )}
              {props.categoryOverBudget && props.selectedCat && (
                <div style={warnStyle}>
                  <span style={{ fontSize: 12, opacity: 0.75, marginTop: 1 }}>!</span>
                  <span style={warnTextStyle}>
                    Over budget by <strong><Money value={props.parsedAmount - (props.selectedCat.available ?? 0)} /></strong>. Only{" "}
                    <strong><Money value={props.selectedCat.available ?? 0} /></strong> left in <strong>{props.selectedCat.name}</strong>.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={props.onSubmit}
            disabled={!props.canSubmit}
            aria-label={
              props.status === "saving" ? "Saving transaction"
              : props.status === "success" ? "Transaction saved"
              : props.status === "error" ? `Save failed: ${props.errorMsg}`
              : "Save transaction"
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
              <><span style={{ width: 15, height: 15, border: "2px solid color-mix(in srgb, currentColor 26%, transparent)", borderTopColor: "currentColor", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />Saving...</>
            ) : props.status === "success" ? (
              <><CheckIcon size={16} />Saved</>
            ) : props.status === "error" ? (
              <><XIcon size={16} />Error</>
            ) : (
              "Save"
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
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 28,
  lineHeight: 0.95,
  fontWeight: 800,
  color: "var(--text)",
  margin: "4px 0 0",
};

const closeButtonStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border2) 70%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 70%, transparent)",
  color: "var(--text)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const heroWrapStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  paddingBottom: 18,
  borderBottom: "1px solid color-mix(in srgb, var(--border) 28%, transparent)",
};

const heroCopyStyle: CSSProperties = {
  margin: 0,
  fontFamily: "'DM Mono', monospace",
  fontSize: 12,
  color: "var(--text2)",
};

const chipStyle: CSSProperties = {
  minHeight: 36,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid",
  background: "color-mix(in srgb, var(--surface2) 38%, white)",
  color: "var(--text2)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const chipIconStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 30%, white)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10,
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
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  fontSize: 14,
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
  fontFamily: "'DM Mono', monospace",
  fontSize: 11,
  color: "var(--muted)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const monoSmallStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
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
