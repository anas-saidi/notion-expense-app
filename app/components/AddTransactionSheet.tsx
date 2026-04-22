"use client";

import type { CSSProperties, RefObject } from "react";
import type { Account, Category } from "./app-types";
import { fmtDate, shiftDate, today } from "./app-utils";
import { Money } from "./Money";
import { PickerPopover } from "./PickerPopover";

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

const shellSurface: CSSProperties = {
  background: "color-mix(in srgb, var(--surface) 96%, white)",
  border: "1px solid var(--card-border)",
  borderRadius: "var(--card-radius)",
  boxShadow: "var(--card-shadow)",
};

const chipButtonStyle: CSSProperties = {
  minHeight: 40,
  padding: "0 8px",
  borderRadius: 999,
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--text2)",
  fontSize: 12,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
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
  transition: "background 0.18s ease, transform 0.18s ease",
  boxSizing: "border-box",
};

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.18s ease",
        flexShrink: 0,
      }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function AddTransactionSheet(props: AddTransactionSheetProps) {
  if (!props.open) return null;

  const todayValue = today();
  const yesterdayValue = shiftDate(todayValue, -1);
  const tomorrowValue = shiftDate(todayValue, 1);
  const anyPickerOpen = props.showAccountPicker || props.showCatPicker || props.showDatePicker;
  const visibleBalance = props.amountAfterBalance ?? props.displayedBalance;
  const amountInputWidth = `${Math.max((props.amount || "0.00").length, 4) * 0.7 + 0.8}ch`;
  const balanceTone =
    visibleBalance !== null && visibleBalance > 0
      ? {
          color: "var(--success)",
          background: "color-mix(in srgb, var(--success) 10%, white)",
        }
      : {
          color: "var(--danger)",
          background: "color-mix(in srgb, var(--danger) 10%, white)",
        };

  const dateOptions = [
    {
      label: "Today",
      value: todayValue,
    },
    {
      label: "Yesterday",
      value: yesterdayValue,
    },
    {
      label: "Tomorrow",
      value: tomorrowValue,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add transaction"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(14, 15, 12, 0.12)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "20px 14px calc(88px + env(safe-area-inset-bottom, 0px))",
        overflow: "visible",
      }}
    >
      <div onClick={props.onClose} style={{ position: "absolute", inset: 0 }} />
      <div
        style={{
          position: "relative",
          width: "min(100%, 500px)",
          maxHeight: "calc(100dvh - 20px)",
          overflow: "visible",
          overflowX: "clip",
          borderRadius: 0,
          background: "transparent",
          border: "none",
          boxShadow: "none",
          padding: 0,
          animation: "fadeUp 0.24s ease both",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: "visible",
            overflowX: "hidden",
            padding: "0 10px 10px",
            paddingTop: 0,
          }}
        >
          <div
            style={{
              ...shellSurface,
              padding: "18px 18px 18px",
              marginBottom: 8,
              animation: "fadeUp 0.4s 0.05s ease both",
              position: "relative",
              zIndex: anyPickerOpen ? 16 : 1,
              overflow: "visible",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
              <button
                onClick={props.onClose}
                aria-label="Close add transaction"
                style={{
                  width: 44,
                  height: 44,
                  padding: 10,
                  borderRadius: 999,
                  border: "none",
                  background: "color-mix(in srgb, var(--surface2) 52%, white)",
                  color: "var(--text2)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ minHeight: 24, display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      letterSpacing: 0.5,
                      color: "var(--muted)",
                    }}
                  >
                    MAD
                  </span>
                </div>
              </div>

              {visibleBalance !== null && (
                <div style={{ minHeight: 24, display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color: balanceTone.color,
                      letterSpacing: 0.4,
                      padding: "6px 9px",
                      borderRadius: 999,
                      background: balanceTone.background,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Balance <Money value={visibleBalance} />
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "flex-end", gap: 10, minWidth: 0, maxWidth: "100%" }}>
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
                    fontFeatureSettings: "\"tnum\"",
                    lineHeight: 0.95,
                    letterSpacing: -1.1,
                    minWidth: "3.8ch",
                    flex: "0 1 auto",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                marginTop: 20,
                display: "grid",
                gap: 12,
              }}
            >
              <input
                type="text"
                value={props.name}
                onChange={(e) => props.onNameChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && props.canSubmit && props.onSubmit()}
                placeholder="What was it for?"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  color: "var(--text)",
                  outline: "none",
                    fontSize: 18,
                    lineHeight: 1.25,
                    fontWeight: 450,
                  }}
                />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative", zIndex: props.showAccountPicker ? 24 : 1 }} ref={props.accountRef}>
                  <button
                    onClick={props.onToggleAccountPicker}
                    aria-haspopup="dialog"
                    aria-expanded={props.showAccountPicker}
                    aria-controls="account-picker"
                    style={{
                      ...chipButtonStyle,
                      minHeight: 40,
                      maxWidth: 188,
                      padding: "0 8px",
                      borderColor: props.showAccountPicker
                        ? "color-mix(in srgb, var(--border) 24%, transparent)"
                        : "transparent",
                      boxShadow: "none",
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: "color-mix(in srgb, var(--surface2) 24%, white)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        lineHeight: 1,
                        opacity: 0.96,
                        flexShrink: 0,
                      }}
                    >
                      {props.selectedAccount?.icon ?? "$"}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {props.selectedAccount?.label ?? ""}
                    </span>
                    <span style={{ color: "var(--muted)", marginLeft: 2, display: "inline-flex", alignItems: "center" }}>
                      <ChevronDownIcon open={props.showAccountPicker} />
                    </span>
                  </button>

                  <PickerPopover open={props.showAccountPicker} align="left" placement="top" width="min(292px, calc(100vw - 28px))" zIndex={140} anchorRef={props.accountRef}>
                    <div id="account-picker" style={{ maxHeight: 236, overflowY: "auto", overflowX: "hidden", padding: 8, boxSizing: "border-box" }}>
                      <div style={{ display: "grid", gap: 2 }}>
                        {props.filteredAccounts.map((acct) => (
                          <button
                            key={acct.id}
                            onClick={() => props.onSelectAccount(acct.id)}
                            style={{
                              ...pickerRowStyle,
                              background: acct.id === props.selectedAccount?.id ? "color-mix(in srgb, var(--accent) 11%, white)" : "transparent",
                              boxShadow: acct.id === props.selectedAccount?.id ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)" : "none",
                            }}
                          >
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 12,
                                background: acct.id === props.selectedAccount?.id
                                  ? "color-mix(in srgb, var(--accent) 12%, white)"
                                  : "color-mix(in srgb, var(--surface2) 72%, transparent)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                fontSize: 15,
                              }}
                            >
                              {acct.icon ?? "$"}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: acct.id === props.selectedAccount?.id ? 650 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {acct.label}
                              </div>
                              {acct.type && (
                                <div
                                  style={{
                                    marginTop: 3,
                                    fontFamily: "'DM Mono', monospace",
                                    fontSize: 11,
                                    color: "var(--muted)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {acct.type}
                                </div>
                              )}
                            </div>
                            {acct.balance !== null && (
                              <span
                                style={{
                                  fontFamily: "'DM Mono', monospace",
                                  fontSize: 12,
                                  color: acct.balance < 0 ? "var(--danger)" : "var(--muted)",
                                  flexShrink: 0,
                                  paddingLeft: 8,
                                }}
                              >
                                <Money value={acct.balance} />
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </PickerPopover>
                </div>
                <div style={{ position: "relative", zIndex: props.showCatPicker ? 24 : 1 }} ref={props.catRef}>
                  <button
                    onClick={props.onToggleCatPicker}
                    aria-haspopup="dialog"
                    aria-expanded={props.showCatPicker}
                    aria-controls="category-picker"
                    style={{
                      ...chipButtonStyle,
                      minHeight: 40,
                      padding: "0 8px",
                      border: `1px solid ${props.showCatPicker ? "color-mix(in srgb, var(--border) 24%, transparent)" : "transparent"}`,
                      background: "transparent",
                      color: props.selectedCat ? "var(--text2)" : "var(--muted)",
                      maxWidth: "100%",
                      boxShadow: "none",
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: "color-mix(in srgb, var(--surface2) 22%, white)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        lineHeight: 1,
                        opacity: 0.96,
                        flexShrink: 0,
                      }}
                    >
                      {props.selectedCat?.icon ?? "#"}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 132 }}>
                      {props.selectedCat?.name ?? "Category"}
                    </span>
                    <span style={{ color: "var(--muted)", marginLeft: 2, display: "inline-flex", alignItems: "center" }}>
                      <ChevronDownIcon open={props.showCatPicker} />
                    </span>
                  </button>

                  <PickerPopover open={props.showCatPicker} align="left" placement="top" width="min(300px, calc(100vw - 28px))" zIndex={140} anchorRef={props.catRef}>
                    <div id="category-picker" style={{ width: "100%", boxSizing: "border-box" }}>
                      <div style={{ maxHeight: 228, overflowY: "auto", overflowX: "hidden", padding: 8, boxSizing: "border-box" }}>
                        <div style={{ display: "grid", gap: 2 }}>
                          {props.filteredCats.map((cat) => {
                            const meta = [cat.type[0] ?? null, cat.id === props.lastUsedCatId ? "Last used" : null].filter(Boolean).join(" / ");
                            return (
                              <button
                                key={cat.id}
                                onClick={() => props.onSelectCategory(cat)}
                                style={{
                                  ...pickerRowStyle,
                                  background: cat.id === props.selectedCat?.id ? "color-mix(in srgb, var(--accent) 11%, white)" : "transparent",
                                  boxShadow: cat.id === props.selectedCat?.id ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)" : "none",
                                }}
                              >
                                <div
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 12,
                                    background: cat.id === props.selectedCat?.id
                                      ? "color-mix(in srgb, var(--accent) 12%, white)"
                                      : "color-mix(in srgb, var(--surface2) 72%, transparent)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    fontSize: 15,
                                  }}
                                >
                                  {cat.icon ?? "#"}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: cat.id === props.selectedCat?.id ? 650 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {cat.name}
                                  </div>
                                  {meta && (
                                    <div
                                      style={{
                                        marginTop: 3,
                                        fontFamily: "'DM Mono', monospace",
                                        fontSize: 11,
                                        color: "var(--muted)",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {meta}
                                    </div>
                                  )}
                                </div>
                                {cat.available !== null && (
                                  <span
                                    style={{
                                      fontFamily: "'DM Mono', monospace",
                                      fontSize: 12,
                                      color: cat.available > 0 ? "var(--success)" : "var(--danger)",
                                      flexShrink: 0,
                                      paddingLeft: 8,
                                    }}
                                  >
                                    {cat.available > 0 ? "+" : ""}
                                    <Money value={cat.available} />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {props.filteredCats.length === 0 && (
                            <p style={{ padding: 18, color: "var(--muted)", fontSize: 14, textAlign: "center" }}>
                              No categories found
                            </p>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: "10px 10px 11px",
                          borderTop: "1px solid color-mix(in srgb, var(--border) 36%, transparent)",
                          background: "color-mix(in srgb, var(--surface2) 10%, white)",
                        }}
                      >
                      <div
                        style={{
                          minHeight: 40,
                          borderRadius: 12,
                          border: "1px solid transparent",
                          background: "color-mix(in srgb, var(--surface2) 42%, white)",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "0 12px",
                        }}
                        >
                          <span aria-hidden="true" style={{ fontSize: 12, color: "var(--muted)" }}>
                            /
                          </span>
                          <input
                            type="text"
                            value={props.catSearch}
                            onChange={(e) => props.onCatSearchChange(e.target.value)}
                            placeholder="Search categories"
                            autoFocus
                            style={{
                              width: "100%",
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              color: "var(--text)",
                              outline: "none",
                              fontSize: 15,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </PickerPopover>
                </div>
                <div style={{ position: "relative", zIndex: props.showDatePicker ? 24 : 1 }} ref={props.dateRef}>
                  <button
                    onClick={props.onToggleDatePicker}
                    aria-haspopup="dialog"
                    aria-expanded={props.showDatePicker}
                    aria-controls="date-picker"
                    style={{
                      ...chipButtonStyle,
                      minHeight: 40,
                      padding: "0 8px",
                      border: `1px solid ${props.showDatePicker ? "color-mix(in srgb, var(--border) 24%, transparent)" : "transparent"}`,
                      background: props.showDatePicker
                        ? "color-mix(in srgb, var(--surface2) 10%, white)"
                        : "transparent",
                      color: "var(--text2)",
                      fontSize: 12,
                      fontWeight: 600,
                      gap: 7,
                      opacity: 1,
                      boxShadow: "none",
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: props.showDatePicker
                          ? "color-mix(in srgb, var(--surface2) 18%, white)"
                          : "color-mix(in srgb, var(--surface2) 22%, white)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="3" />
                        <path d="M8 2v4M16 2v4M3 10h18" />
                      </svg>
                    </span>
                    <span style={{ whiteSpace: "nowrap" }}>{props.selectedDateLabel}</span>
                    <span style={{ color: "var(--muted)", display: "inline-flex", alignItems: "center" }}>
                      <ChevronDownIcon open={props.showDatePicker} />
                    </span>
                  </button>

                  <PickerPopover open={props.showDatePicker} align="right" placement="top" width="min(236px, calc(100vw - 28px))" zIndex={140} anchorRef={props.dateRef}>
                    <div id="date-picker" style={{ width: "100%", boxSizing: "border-box" }}>
                      <div style={{ display: "grid", gap: 2, padding: 8, boxSizing: "border-box" }}>
                        {dateOptions.map((option) => {
                          const selected = option.value === props.date;
                          return (
                            <button
                              key={option.value}
                              onClick={() => props.onSelectDate(option.value)}
                              style={{
                                width: "100%",
                                minHeight: 42,
                                padding: "9px 12px",
                                background: selected ? "color-mix(in srgb, var(--accent) 10%, white)" : "transparent",
                                border: "none",
                                borderRadius: 10,
                                color: selected ? "color-mix(in srgb, var(--accent) 76%, var(--text2))" : "var(--text)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                                cursor: "pointer",
                                fontSize: 14,
                                textAlign: "left",
                                boxShadow: selected
                                  ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)"
                                  : "none",
                              }}
                            >
                              <span style={{ fontWeight: selected ? 650 : 600, minWidth: 0, flex: 1 }}>
                                {option.label}
                              </span>
                              <span
                                style={{
                                  fontFamily: "'DM Mono', monospace",
                                  fontSize: 11,
                                  color: selected ? "color-mix(in srgb, var(--accent) 62%, var(--text2))" : "var(--muted)",
                                  flexShrink: 0,
                                }}
                              >
                                {fmtDate(option.value)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div
                        style={{
                          padding: "10px 10px 11px",
                          borderTop: "1px solid color-mix(in srgb, var(--border) 36%, transparent)",
                          background: "color-mix(in srgb, var(--surface2) 10%, white)",
                        }}
                      >
                      <div
                        style={{
                          minHeight: 40,
                          borderRadius: 12,
                          border: "1px solid transparent",
                          background: "color-mix(in srgb, var(--surface2) 42%, white)",
                          display: "flex",
                          alignItems: "center",
                          padding: "0 12px",
                        }}
                        >
                          <input
                            type="date"
                            value={props.date}
                            onChange={(e) => props.onSelectDate(e.target.value)}
                            style={{
                              width: "100%",
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              colorScheme: "light",
                              color: "var(--text)",
                              outline: "none",
                              fontSize: 15,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </PickerPopover>
                </div>
              </div>

              {(props.suggestedCategory || props.categoryUnfunded || props.categoryOverBudget) && (
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {props.suggestedCategory && props.suggestedCategory.id !== props.selectedCat?.id && (
                    <button
                      onClick={() => props.onSelectCategory(props.suggestedCategory!)}
                      style={{
                        minHeight: 34,
                        padding: "0 2px",
                        border: "none",
                        background: "transparent",
                        color: "var(--text2)",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        justifySelf: "start",
                      }}
                    >
                      <span style={{ fontSize: 14, opacity: 0.85 }}>{props.suggestedCategory.icon ?? "#"}</span>
                      <span>
                        Suggested: <strong style={{ fontWeight: 600 }}>{props.suggestedCategory.name}</strong>
                      </span>
                    </button>
                  )}

                  {props.categoryUnfunded && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 12px", borderRadius: 16, background: "color-mix(in srgb, var(--danger) 8%, white)" }}>
                      <span style={{ fontSize: 12, opacity: 0.75, marginTop: 1 }}>!</span>
                      <span
                        style={{
                          fontSize: 12,
                          color: "color-mix(in srgb, var(--danger) 46%, var(--text2))",
                          lineHeight: 1.5,
                        }}
                      >
                        <strong>{props.selectedCat?.name}</strong> has no available budget. Fund it in Notion first.
                      </span>
                    </div>
                  )}

                  {props.categoryOverBudget && props.selectedCat && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 12px", borderRadius: 16, background: "color-mix(in srgb, var(--danger) 8%, white)" }}>
                      <span style={{ fontSize: 12, opacity: 0.75, marginTop: 1 }}>!</span>
                      <span
                        style={{
                          fontSize: 12,
                          color: "color-mix(in srgb, var(--danger) 46%, var(--text2))",
                          lineHeight: 1.5,
                        }}
                      >
                        Over budget by <strong><Money value={props.parsedAmount - (props.selectedCat.available ?? 0)} /></strong>. Only{" "}
                        <strong><Money value={props.selectedCat.available ?? 0} /></strong> left in <strong>{props.selectedCat.name}</strong>.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={props.onSubmit}
                disabled={!props.canSubmit}
                aria-label={
                  props.status === "saving"
                    ? "Saving transaction"
                    : props.status === "success"
                      ? "Transaction saved"
                      : props.status === "error"
                        ? `Save failed: ${props.errorMsg}`
                        : "Save transaction"
                }
                className="pressable cta-save"
                style={{
                  width: "100%",
                  minHeight: 52,
                  borderRadius: 14,
                  border: "none",
                  background:
                    props.status === "success"
                      ? "color-mix(in srgb, var(--success) 12%, white)"
                      : props.status === "error"
                        ? "color-mix(in srgb, var(--danger) 10%, white)"
                        : "var(--accent)",
                  color:
                    props.status === "success"
                      ? "var(--success)"
                      : props.status === "error"
                        ? "var(--danger)"
                        : "var(--accent-ink)",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: props.canSubmit ? "pointer" : "not-allowed",
                  opacity: props.canSubmit || props.status !== "idle" ? 1 : 0.4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 4,
                  transition: "all 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                {props.status === "saving" ? (
                  <>
                    <span
                      style={{
                        width: 15,
                        height: 15,
                        border: "2px solid color-mix(in srgb, currentColor 26%, transparent)",
                        borderTopColor: "currentColor",
                        borderRadius: "50%",
                        animation: "spin 0.6s linear infinite",
                        flexShrink: 0,
                      }}
                    />
                    Saving...
                  </>
                ) : props.status === "success" ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Saved
                  </>
                ) : props.status === "error" ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                    Error
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
