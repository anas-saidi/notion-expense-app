"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Account } from "./app-types";
import { BottomSheet } from "./ui/BottomSheet";
import { Money } from "./Money";
import { BanknoteIcon, CheckIcon, XIcon } from "./ui/icons";
import { today } from "./app-utils";

type AccountIncomeSheetProps = {
  open: boolean;
  account: Account | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export function AccountIncomeSheet({ open, account, onClose, onSuccess }: AccountIncomeSheetProps) {
  const [name, setName] = useState("Income");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("Income");
    setAmount("");
    setDate(today());
    setStatus("idle");
    setError("");
  }, [open]);

  const parsedAmount = amount ? Number(amount) : 0;
  const canSubmit = Boolean(account?.id && name.trim() && Number.isFinite(parsedAmount) && parsedAmount > 0 && status === "idle");

  const submit = async () => {
    if (!account || !canSubmit) return;
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/monthly-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amount: parsedAmount,
          date,
          accountId: account.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add income");
      setStatus("success");
      onSuccess(`${account.label} funded`);
      onClose();
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to add income");
    }
  };

  if (!open || !account) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={`Add income to ${account.label}`}
      maxWidth="520px"
      detent="content"
      maxHeight="calc(100dvh - 20px)"
      panelStyle={sheetStyle}
      contentStyle={{ paddingTop: 0 }}
    >
      <div style={innerStyle}>
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={accountIconStyle}>{account.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={eyebrowStyle}>Account income</div>
              <h2 style={titleStyle}>{account.label}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={closeStyle}>
            <XIcon size={18} />
          </button>
        </header>

        <section style={balanceCardStyle}>
          <span>Current balance</span>
          <strong><Money value={account.balance ?? 0} /></strong>
        </section>

        <section style={formStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Description</span>
            <input value={name} onChange={(event) => setName(event.target.value)} style={inputStyle} />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Amount</span>
            <div style={amountWrapStyle}>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                style={amountInputStyle}
              />
              <span style={currencyStyle}>MAD</span>
            </div>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={inputStyle} />
          </label>
        </section>

        {error && <div style={errorStyle}>{error}</div>}

        <button type="button" onClick={submit} disabled={!canSubmit} style={{ ...submitStyle, opacity: canSubmit ? 1 : 0.48 }}>
          {status === "success" && <CheckIcon size={16} />}
          {status === "idle" && <BanknoteIcon size={16} strokeWidth={2.3} />}
          {status === "saving" ? "Adding..." : status === "success" ? "Added" : "Add income"}
        </button>
      </div>
    </BottomSheet>
  );
}

const sheetStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--surface) 98%, var(--surface))",
  borderRadius: 20,
  overflow: "hidden",
};

const innerStyle: CSSProperties = {
  padding: "18px 18px 22px",
  display: "grid",
  gap: 18,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const accountIconStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: "color-mix(in srgb, var(--accent) 10%, var(--surface2))",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const titleStyle: CSSProperties = {
  margin: "4px 0 0",
  fontFamily: "var(--font-display)",
  fontSize: 26,
  lineHeight: 1,
  color: "var(--text)",
};

const closeStyle: CSSProperties = {
  width: 44,
  height: 44,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const balanceCardStyle: CSSProperties = {
  minHeight: 54,
  borderRadius: 16,
  background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
  color: "var(--text2)",
  padding: "0 13px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 13,
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 7,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text2)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 14,
  border: "1px solid transparent",
  boxShadow: "inset 0 0 0 1.5px var(--border2)",
  background: "color-mix(in srgb, var(--surface2) 34%, var(--surface))",
  color: "var(--text2)",
  padding: "0 13px",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

const amountWrapStyle: CSSProperties = {
  minHeight: 56,
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 14px",
};

const amountInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "var(--text2)",
  fontFamily: "var(--font-display)",
  fontSize: 28,
  fontWeight: 800,
};

const currencyStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  color: "var(--muted)",
};

const errorStyle: CSSProperties = {
  borderRadius: 14,
  background: "color-mix(in srgb, var(--danger) 9%, var(--surface))",
  color: "color-mix(in srgb, var(--danger) 54%, var(--text))",
  padding: "11px 12px",
  fontSize: 12,
};

const submitStyle: CSSProperties = {
  width: "100%",
  minHeight: 52,
  borderRadius: 14,
  border: "none",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};
