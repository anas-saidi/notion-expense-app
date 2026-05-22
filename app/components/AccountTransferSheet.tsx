"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Account } from "./app-types";
import { today } from "./app-utils";
import { BottomSheet } from "./ui/BottomSheet";
import { Money } from "./Money";
import { CheckIcon, TransferIcon, XIcon } from "./ui/icons";

type AccountTransferSheetProps = {
  open: boolean;
  account: Account | null;
  accounts: Account[];
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export function AccountTransferSheet({ open, account, accounts, onClose, onSuccess }: AccountTransferSheetProps) {
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("Account transfer");
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFromAccountId(account?.id ?? accounts[0]?.id ?? "");
    setToAccountId(accounts.find((entry) => entry.id !== account?.id)?.id ?? "");
    setAmount("");
    setNote("Account transfer");
    setDate(today());
    setStatus("idle");
    setError("");
  }, [account?.id, accounts, open]);

  const fromAccount = useMemo(
    () => accounts.find((entry) => entry.id === fromAccountId) ?? null,
    [accounts, fromAccountId],
  );
  const toAccount = useMemo(
    () => accounts.find((entry) => entry.id === toAccountId) ?? null,
    [accounts, toAccountId],
  );

  const destinationAccounts = accounts.filter((entry) => entry.id !== fromAccountId);
  const parsedAmount = amount ? Number(amount) : 0;
  const canSubmit = Boolean(
    fromAccountId
    && toAccountId
    && fromAccountId !== toAccountId
    && Number.isFinite(parsedAmount)
    && parsedAmount > 0
    && status === "idle",
  );

  const submit = async () => {
    if (!canSubmit) return;
    setStatus("saving");
    setError("");

    try {
      const res = await fetch("/api/account-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount: parsedAmount,
          date,
          note: note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to move money");

      setStatus("success");
      onSuccess(`Moved to ${toAccount?.label ?? "account"}`);
      onClose();
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to move money");
    }
  };

  if (!open) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="Move money between accounts"
      maxWidth="520px"
      detent="content"
      maxHeight="calc(100dvh - 20px)"
      panelStyle={sheetStyle}
      contentStyle={{ paddingTop: 0 }}
    >
      <div style={innerStyle}>
        <header style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>Account transfer</div>
            <h2 style={titleStyle}>Move money</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={closeStyle}>
            <XIcon size={18} />
          </button>
        </header>

        <section style={balanceGridStyle}>
          <BalanceTile label="From" account={fromAccount} nextBalance={fromAccount?.balance != null && parsedAmount > 0 ? fromAccount.balance - parsedAmount : null} />
          <BalanceTile label="To" account={toAccount} nextBalance={toAccount?.balance != null && parsedAmount > 0 ? toAccount.balance + parsedAmount : null} />
        </section>

        <section style={formStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>From account</span>
            <select
              value={fromAccountId}
              onChange={(event) => {
                const nextFrom = event.target.value;
                setFromAccountId(nextFrom);
                if (toAccountId === nextFrom) {
                  setToAccountId(accounts.find((entry) => entry.id !== nextFrom)?.id ?? "");
                }
              }}
              style={inputStyle}
            >
              <option value="" disabled>Choose source</option>
              {accounts.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.icon} {entry.label}</option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>To account</span>
            <select value={toAccountId} onChange={(event) => setToAccountId(event.target.value)} style={inputStyle}>
              <option value="" disabled>Choose destination</option>
              {destinationAccounts.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.icon} {entry.label}</option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Amount</span>
            <div style={amountWrapStyle}>
              <input
                value={amount}
                onChange={(event) => {
                  const cleaned = event.target.value.replace(/[^0-9.]/g, "");
                  if ((cleaned.match(/\./g) || []).length <= 1) setAmount(cleaned);
                }}
                inputMode="decimal"
                placeholder="0"
                style={amountInputStyle}
              />
              <span style={currencyStyle}>MAD</span>
            </div>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Note</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} style={inputStyle} />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={inputStyle} />
          </label>
        </section>

        {error && <div style={errorStyle}>{error}</div>}

        <button type="button" onClick={submit} disabled={!canSubmit} style={{ ...submitStyle, opacity: canSubmit ? 1 : 0.48 }}>
          {status === "success" && <CheckIcon size={16} />}
          {status === "idle" && <TransferIcon size={16} strokeWidth={2.3} />}
          {status === "saving" ? "Moving..." : status === "success" ? "Moved" : "Move money"}
        </button>
      </div>
    </BottomSheet>
  );
}

function BalanceTile({ label, account, nextBalance }: { label: string; account: Account | null; nextBalance: number | null }) {
  return (
    <div style={balanceTileStyle}>
      <span style={eyebrowStyle}>{label}</span>
      <strong style={balanceAccountStyle}>{account ? `${account.icon} ${account.label}` : "Choose account"}</strong>
      <span style={balanceAmountStyle}>
        {nextBalance !== null ? <Money value={nextBalance} /> : account?.balance != null ? <Money value={account.balance} /> : "TBD"}
      </span>
    </div>
  );
}

const sheetStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--surface) 98%, white)",
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

const eyebrowStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
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
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border2) 70%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 70%, transparent)",
  color: "var(--text)",
  cursor: "pointer",
};

const balanceGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const balanceTileStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: 16,
  background: "color-mix(in srgb, var(--accent) 7%, white)",
  padding: 13,
  display: "grid",
  gap: 7,
};

const balanceAccountStyle: CSSProperties = {
  minHeight: 18,
  fontSize: 13,
  color: "var(--text2)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const balanceAmountStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 13,
  color: "var(--text)",
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
  border: "1px solid var(--card-border)",
  background: "color-mix(in srgb, var(--surface2) 34%, white)",
  color: "var(--text)",
  padding: "0 13px",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

const amountWrapStyle: CSSProperties = {
  minHeight: 56,
  borderRadius: 16,
  border: "1px solid var(--card-border)",
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
  color: "var(--text)",
  fontFamily: "var(--font-display)",
  fontSize: 28,
  fontWeight: 800,
};

const currencyStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 12,
  color: "var(--muted)",
};

const errorStyle: CSSProperties = {
  borderRadius: 14,
  background: "color-mix(in srgb, var(--danger) 9%, white)",
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
