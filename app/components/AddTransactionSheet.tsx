"use client";

import type { CSSProperties, RefObject } from "react";
import type { Account, Category } from "./app-types";
import { fmt, fmtDate, shiftDate, today } from "./app-utils";
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
  background: "color-mix(in srgb, var(--surface) 97%, white)",
  border: "1px solid color-mix(in srgb, var(--border) 62%, transparent)",
  borderRadius: 28,
};

const chipButtonStyle: CSSProperties = {
  minHeight: 40,
  padding: "0 13px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border2) 42%, transparent)",
  background: "color-mix(in srgb, var(--surface) 92%, white)",
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

  const dateOptions = [
    {
      label: "Today",
      value: todayValue,
      hint: "Use today's date",
    },
    {
      label: "Yesterday",
      value: yesterdayValue,
      hint: "Backdate by one day",
    },
    {
      label: "Tomorrow",
      value: tomorrowValue,
      hint: "Plan it for tomorrow",
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
        background: "rgba(39, 24, 19, 0.12)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "20px 14px calc(88px + env(safe-area-inset-bottom, 0px))",
        overflow: "hidden",
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
          borderRadius: 32,
          background: "var(--bg)",
          border: "1px solid color-mix(in srgb, var(--border) 82%, transparent)",
          boxShadow: "0 18px 38px rgba(48, 36, 23, 0.10)",
          padding: 0,
          animation: "fadeUp 0.24s ease both",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            width: 44,
            height: 5,
            borderRadius: 999,
            background: "color-mix(in srgb, var(--accent) 22%, white)",
            margin: "16px auto 12px auto",
          }}
        />
        <button
          onClick={props.onClose}
          aria-label="Close add transaction"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "1px solid color-mix(in srgb, var(--border) 78%, transparent)",
            background: "color-mix(in srgb, var(--surface) 96%, white)",
            color: "var(--text2)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div style={{ flex: 1, minHeight: 0, maxHeight: "calc(100dvh - 160px)", overflowY: "auto", overflowX: "hidden", padding: "0 20px 18px", paddingTop: 0, paddingRight: 8 }}>
          <header style={{ marginBottom: 18, paddingRight: 56, animation: "fadeUp 0.4s ease both" }}>
            <h1
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontSize: "clamp(2rem, 5vw, 3rem)",
                lineHeight: 0.96,
                color: "var(--text)",
                letterSpacing: -0.6,
              }}
            >
              Add Transaction
            </h1>
          </header>

          <div
            style={{
              ...shellSurface,
              padding: "18px 18px 16px",
              marginBottom: 14,
              animation: "fadeUp 0.4s 0.05s ease both",
              position: "relative",
              zIndex: props.showAccountPicker ? 12 : 1,
              overflow: "visible",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <p style={{ fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: "color-mix(in srgb, var(--accent) 70%, var(--muted))", fontWeight: 800 }}>
                Amount
              </p>
              <div style={{ position: "relative", zIndex: props.showAccountPicker ? 20 : 2 }} ref={props.accountRef}>
                <button
                  onClick={props.onToggleAccountPicker}
                  aria-haspopup="dialog"
                  aria-expanded={props.showAccountPicker}
                  aria-controls="account-picker"
                  style={{
                    ...chipButtonStyle,
                    minHeight: 40,
                    maxWidth: 220,
                    padding: "0 13px",
                    borderColor: props.showAccountPicker
                      ? "color-mix(in srgb, var(--accent) 22%, transparent)"
                      : "color-mix(in srgb, var(--border2) 48%, transparent)",
                    boxShadow: props.showAccountPicker ? "0 6px 14px color-mix(in srgb, var(--accent) 10%, transparent)" : "none",
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
                    {props.selectedAccount?.label ?? "Account"}
                  </span>
                  <span style={{ color: "var(--muted)", marginLeft: 2, display: "inline-flex", alignItems: "center" }}>
                    <ChevronDownIcon open={props.showAccountPicker} />
                  </span>
                </button>

                <PickerPopover open={props.showAccountPicker} align="right" width="min(304px, calc(100vw - 40px))" zIndex={120}>
                  <div id="account-picker" style={{ maxHeight: 256, overflowY: "auto", padding: 10 }}>
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
                                {fmt(acct.balance)}
                              </span>
                            )}
                        </button>
                      ))}
                    </div>
                  </div>
                </PickerPopover>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
              <input
                type="number"
                inputMode="decimal"
                value={props.amount}
                onChange={(e) => props.onAmountChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && props.canSubmit && props.onSubmit()}
                placeholder="0.00"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  color: "var(--text)",
                  outline: "none",
                  fontSize: "clamp(3rem, 9vw, 4.4rem)",
                  fontWeight: 700,
                  lineHeight: 0.95,
                  letterSpacing: -1.4,
                }}
              />
              <span
                style={{
                  paddingBottom: 10,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  letterSpacing: 0.6,
                  color: "var(--muted)",
                }}
              >
                MAD
              </span>
            </div>

            {(props.displayedBalance !== null || props.amountAfterBalance !== null) && (
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {props.displayedBalance !== null && (
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color: props.displayedBalance < 500 ? "var(--danger)" : "var(--muted)",
                      letterSpacing: 0.4,
                      padding: "7px 10px",
                      borderRadius: 999,
                      background: "color-mix(in srgb, var(--surface2) 32%, white)",
                    }}
                  >
                    Balance {fmt(props.displayedBalance)}
                  </span>
                )}
                {props.amountAfterBalance !== null && (
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color:
                        props.amountAfterBalance < 0
                          ? "var(--danger)"
                          : props.amountAfterBalance < 500
                            ? "var(--danger)"
                            : "var(--success)",
                      letterSpacing: 0.4,
                      padding: "7px 10px",
                      borderRadius: 999,
                      background:
                        props.amountAfterBalance < 0
                          ? "color-mix(in srgb, var(--danger) 10%, white)"
                          : "color-mix(in srgb, var(--success) 10%, white)",
                    }}
                  >
                    After {fmt(props.amountAfterBalance)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              marginBottom: 10,
              animation: "fadeUp 0.4s 0.08s ease both",
              position: "relative",
              zIndex: props.showCatPicker || props.showDatePicker ? 16 : 2,
            }}
          >
            <div style={{ ...shellSurface, padding: "18px 18px 16px", position: "relative", overflow: "visible" }}>
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
                  lineHeight: 1.3,
                  fontWeight: 500,
                }}
              />

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative" }} ref={props.catRef}>
                  <button
                    onClick={props.onToggleCatPicker}
                    aria-haspopup="dialog"
                    aria-expanded={props.showCatPicker}
                    aria-controls="category-picker"
                    style={{
                      ...chipButtonStyle,
                      minHeight: 40,
                      padding: "0 13px",
                      borderRadius: 999,
                      border: `1px solid ${props.showCatPicker ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "color-mix(in srgb, var(--border) 28%, transparent)"}`,
                      background: "color-mix(in srgb, var(--surface2) 10%, transparent)",
                      color: props.selectedCat ? "var(--text2)" : "var(--muted)",
                      maxWidth: "100%",
                      boxShadow: props.showCatPicker ? "0 6px 14px color-mix(in srgb, var(--accent) 8%, transparent)" : "none",
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

                  <PickerPopover open={props.showCatPicker} align="left" placement="top" width="min(320px, calc(100vw - 40px))" zIndex={100}>
                    <div id="category-picker">
                      <div style={{ maxHeight: 232, overflowY: "auto", padding: 10 }}>
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
                                      color: cat.available >= 0 ? "var(--success)" : "var(--danger)",
                                      flexShrink: 0,
                                      paddingLeft: 8,
                                    }}
                                  >
                                    {cat.available >= 0 ? "+" : ""}
                                    {fmt(cat.available)}
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
                          padding: "12px 12px 13px",
                          borderTop: "1px solid color-mix(in srgb, var(--border) 76%, transparent)",
                          background: "color-mix(in srgb, var(--surface2) 10%, white)",
                        }}
                      >
                        <div
                          style={{
                            minHeight: 40,
                            borderRadius: 12,
                            border: "1px solid color-mix(in srgb, var(--border2) 40%, transparent)",
                            background: "color-mix(in srgb, var(--surface) 90%, white)",
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
                <div style={{ position: "relative" }} ref={props.dateRef}>
                  <button
                    onClick={props.onToggleDatePicker}
                    aria-haspopup="dialog"
                    aria-expanded={props.showDatePicker}
                    aria-controls="date-picker"
                    style={{
                      ...chipButtonStyle,
                      minHeight: 40,
                      padding: "0 13px",
                      border: `1px solid ${props.showDatePicker ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "color-mix(in srgb, var(--border) 28%, transparent)"}`,
                      background: props.showDatePicker
                        ? "color-mix(in srgb, var(--accent) 8%, white)"
                        : "color-mix(in srgb, var(--surface2) 10%, transparent)",
                      color: props.showDatePicker ? "color-mix(in srgb, var(--accent) 80%, var(--text2))" : "var(--text2)",
                      fontSize: 12,
                      fontWeight: 600,
                      gap: 7,
                      opacity: 1,
                      boxShadow: props.showDatePicker ? "0 6px 14px color-mix(in srgb, var(--accent) 8%, transparent)" : "none",
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: props.showDatePicker
                          ? "color-mix(in srgb, var(--accent) 8%, white)"
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

                  <PickerPopover open={props.showDatePicker} align="left" placement="top" width="min(252px, calc(100vw - 40px))">
                    <div id="date-picker">
                      <div style={{ display: "grid", gap: 2, padding: 10 }}>
                        {dateOptions.map((option) => {
                          const selected = option.value === props.date;
                          return (
                            <button
                              key={option.value}
                              onClick={() => props.onSelectDate(option.value)}
                              style={{
                                width: "100%",
                                minHeight: 50,
                                padding: "12px 13px",
                                background: selected ? "color-mix(in srgb, var(--accent) 10%, white)" : "color-mix(in srgb, var(--surface) 72%, transparent)",
                                border: "none",
                                borderRadius: 16,
                                color: selected ? "color-mix(in srgb, var(--accent) 76%, var(--text2))" : "var(--text)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                cursor: "pointer",
                                fontSize: 14,
                                textAlign: "left",
                                boxShadow: selected
                                  ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)"
                                  : "inset 0 0 0 1px color-mix(in srgb, var(--border) 22%, transparent)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                                <span
                                  aria-hidden="true"
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 999,
                                    flexShrink: 0,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: selected
                                      ? "1px solid color-mix(in srgb, var(--accent) 18%, transparent)"
                                      : "1px solid color-mix(in srgb, var(--border2) 44%, transparent)",
                                    background: selected ? "color-mix(in srgb, var(--accent) 10%, white)" : "transparent",
                                    color: selected ? "color-mix(in srgb, var(--accent) 76%, var(--text2))" : "transparent",
                                  }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 6 9 17l-5-5" />
                                  </svg>
                                </span>
                                <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                                  <span style={{ fontWeight: selected ? 650 : 600 }}>{option.label}</span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: selected ? "color-mix(in srgb, var(--accent) 62%, var(--text2))" : "var(--muted)",
                                    }}
                                  >
                                    {option.hint}
                                  </span>
                                </div>
                              </div>
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
                          padding: "12px 12px 13px",
                          borderTop: "1px solid color-mix(in srgb, var(--border) 76%, transparent)",
                          background: "color-mix(in srgb, var(--surface2) 10%, white)",
                        }}
                      >
                        <div
                          style={{
                            minHeight: 40,
                            borderRadius: 12,
                            border: "1px solid color-mix(in srgb, var(--border2) 40%, transparent)",
                            background: "color-mix(in srgb, var(--surface) 90%, white)",
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
                        Over budget by <strong>{fmt(props.parsedAmount - (props.selectedCat.available ?? 0))} MAD</strong>. Only{" "}
                        <strong>{fmt(props.selectedCat.available ?? 0)} MAD</strong> left in <strong>{props.selectedCat.name}</strong>.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div
          style={{
            position: "relative",
            padding: "16px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
            borderTop: "1px solid color-mix(in srgb, var(--border) 72%, transparent)",
            background: "linear-gradient(180deg, color-mix(in srgb, var(--bg) 84%, transparent) 0%, var(--bg) 18%, var(--bg) 100%)",
          }}
        >
          {props.showSaveBurst && (
            <>
              {[
                { x: "-46px", y: "-30px", d: "0ms" },
                { x: "-12px", y: "-38px", d: "20ms" },
                { x: "22px", y: "-32px", d: "40ms" },
                { x: "48px", y: "-18px", d: "60ms" },
                { x: "-44px", y: "16px", d: "80ms" },
                { x: "-8px", y: "22px", d: "100ms" },
                { x: "26px", y: "18px", d: "120ms" },
                { x: "42px", y: "8px", d: "140ms" },
              ].map((sparkle, index) => (
                <span
                  key={index}
                  className="save-burst"
                  style={{
                    ["--x" as never]: sparkle.x,
                    ["--y" as never]: sparkle.y,
                    ["--d" as never]: sparkle.d,
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "color-mix(in srgb, var(--accent) 70%, white)",
                  }}
                />
              ))}
            </>
          )}
          <button
            onClick={props.onSubmit}
            disabled={!props.canSubmit}
            className="pressable cta-save"
            style={{
              width: "100%",
              minHeight: 68,
              padding: "18px 20px",
              borderRadius: 22,
              border: "1px solid color-mix(in srgb, var(--accent) 38%, transparent)",
              background:
                props.status === "success"
                  ? "var(--success)"
                  : props.status === "error"
                    ? "var(--danger)"
                    : props.mode === "wife"
                      ? "color-mix(in srgb, var(--accent) 82%, white)"
                      : "var(--accent)",
              color: props.mode === "wife" ? "#1f0612" : "#0d1117",
              fontWeight: 780,
              fontSize: 17,
              letterSpacing: 0,
              cursor: props.canSubmit ? "pointer" : "not-allowed",
              opacity: props.canSubmit || props.status !== "idle" ? 1 : 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              transition: "all 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
              boxShadow: props.status === "idle" ? "0 14px 24px color-mix(in srgb, var(--accent) 20%, transparent)" : "none",
              animation: "fadeUp 0.4s 0.19s ease both",
            }}
          >
            {props.status === "saving" && (
              <div
                style={{
                  width: 17,
                  height: 17,
                  border: "2px solid color-mix(in srgb, var(--ink-strong) 25%, transparent)",
                  borderTopColor: "var(--ink-strong)",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                }}
              />
            )}
            {props.status === "success" ? (
              "Saved to Notion"
            ) : props.status === "error" ? (
              `Error - ${props.errorMsg}`
            ) : props.status === "saving" ? (
              "Saving..."
            ) : (
              <>
                <span>Save {props.amount ? `${fmt(parseFloat(props.amount))} MAD` : "expense"}</span>
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, marginLeft: 2 }}>
                  -{">"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
