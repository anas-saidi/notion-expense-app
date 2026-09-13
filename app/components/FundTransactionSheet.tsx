"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Account } from "./app-types";
import { ChoicePicker } from "./ChoicePicker";
import { DatePicker } from "./DatePicker";
import { Banner } from "./ui/Banner";
import { BottomSheet } from "./ui/BottomSheet";
import { DeleteIcon, FundIcon, XIcon } from "./ui/icons";

export type EditableFundTransaction = {
  id: string;
  amount: number;
  date: string;
  accountId?: string | null;
  accountName?: string | null;
  categoryAvailable: number;
};

type Props = {
  transaction: EditableFundTransaction | null;
  accounts: Account[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
};

export function FundTransactionSheet({ transaction, accounts, onClose, onChanged }: Props) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    setAmount(String(transaction.amount));
    setDate(transaction.date);
    setAccountId(transaction.accountId ?? "");
    setStatus("idle");
    setError(null);
    setConfirmDelete(false);
  }, [transaction]);

  if (!transaction) return null;
  const parsedAmount = Number(amount);
  const minimumAmount = Math.max(0, transaction.amount - Math.max(0, transaction.categoryAvailable));
  const reductionTooLarge = Number.isFinite(parsedAmount) && parsedAmount < minimumAmount;
  const valid = Number.isFinite(parsedAmount) && parsedAmount > 0 && !reductionTooLarge && Boolean(date && accountId);

  const save = async () => {
    if (!valid || status !== "idle") return;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/monthly-planning/funds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transaction.id, planned: parsedAmount, date, accountId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update funding transaction");
      onClose();
      window.setTimeout(() => { void Promise.resolve(onChanged()).catch(() => undefined); }, 600);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update funding transaction");
      setStatus("idle");
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setStatus("deleting");
    setError(null);
    try {
      const response = await fetch("/api/monthly-planning/funds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transaction.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete funding transaction");
      onClose();
      window.setTimeout(() => { void Promise.resolve(onChanged()).catch(() => undefined); }, 600);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete funding transaction");
      setStatus("idle");
    }
  };

  return (
    <BottomSheet open onClose={onClose} label="Edit funding transaction" layered maxWidth="520px" zIndex={120} panelStyle={{ background: "var(--surface)", borderRadius: "var(--radius-sheet)" }}>
      <div style={wrapStyle}>
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={iconStyle}><FundIcon size={18} /></span>
            <h2 style={titleStyle}>Edit fund</h2>
          </div>
          <button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close funding editor"><XIcon /></button>
        </header>

        <label style={fieldStyle}>
          <span style={labelStyle}>Amount</span>
          <span style={amountFieldStyle}><input className="display-amount-input" autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))} aria-label="Funding amount" style={amountInputStyle} /><span style={currencyStyle}>MAD</span></span>
          <span style={{ fontSize: 12, color: reductionTooLarge ? "var(--danger)" : "var(--muted)" }}>
            {reductionTooLarge
              ? `This fund cannot go below ${minimumAmount.toLocaleString("en-US")} MAD because the rest has already been used.`
              : transaction.amount > transaction.categoryAvailable
                ? `${transaction.categoryAvailable.toLocaleString("en-US")} MAD is available to remove. Delete is unavailable because part of this fund has been used.`
                : `${transaction.categoryAvailable.toLocaleString("en-US")} MAD from this category is currently available to remove.`}
          </span>
        </label>
        <div style={fieldStyle}>
          <span style={labelStyle}>Date</span>
          <DatePicker value={date} onChange={(event) => setDate(event.target.value)} aria-label="Funding date" style={controlStyle} />
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>Funding source</span>
          <ChoicePicker value={accountId} onChange={(event) => setAccountId(event.target.value)} aria-label="Funding source" style={controlStyle}>
            <option value="" disabled>Choose account</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.icon ? `${account.icon} ` : ""}{account.label}</option>)}
          </ChoicePicker>
        </div>

        {error && <Banner tone="danger" role="alert" compact>{error}</Banner>}
        {confirmDelete && <Banner tone="danger" role="alert" compact>Delete this funding transaction? Budget totals will be recalculated.</Banner>}

        <div style={actionsStyle}>
          <button type="button" onClick={remove} disabled={status !== "idle" || transaction.amount > transaction.categoryAvailable} title={transaction.amount > transaction.categoryAvailable ? "This fund has already been partially used and cannot be deleted" : undefined} style={{ ...secondaryButtonStyle, color: "var(--danger)" }}>
            <DeleteIcon size={17} />{status === "deleting" ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete"}
          </button>
          <button type="button" onClick={save} disabled={!valid || status !== "idle"} style={primaryButtonStyle}>{status === "saving" ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </BottomSheet>
  );
}

const wrapStyle: CSSProperties = { minHeight: "100%", boxSizing: "border-box", padding: "8px 20px 24px", display: "flex", flexDirection: "column", gap: 16 };
const headerStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 };
const iconStyle: CSSProperties = { width: 36, height: 36, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--action-income)", background: "color-mix(in srgb, var(--action-income) 12%, var(--surface))" };
const titleStyle: CSSProperties = { margin: "3px 0 0", fontSize: 20, lineHeight: 1.2 };
const fieldStyle: CSSProperties = { display: "grid", gap: 7 };
const labelStyle: CSSProperties = { color: "var(--muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" };
const controlStyle: CSSProperties = { width: "100%", minHeight: 48, padding: "0 14px", border: 0, borderRadius: "var(--radius-control)", background: "var(--surface2)", color: "var(--text)", font: "inherit" };
const amountFieldStyle: CSSProperties = { minHeight: 112, padding: "0 4px", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 };
const amountInputStyle: CSSProperties = { width: "min(260px, 68vw)", height: 88, padding: 0, border: 0, outline: 0, background: "transparent", color: "var(--text)", textAlign: "right", font: "700 clamp(48px, 15vw, 72px)/1 var(--font, inherit)", fontVariantNumeric: "tabular-nums", boxSizing: "border-box" };
const currencyStyle: CSSProperties = { color: "var(--muted)", fontSize: 14, fontWeight: 700 };
const actionsStyle: CSSProperties = { marginTop: "auto", display: "grid", gridTemplateColumns: "minmax(0, .8fr) minmax(0, 1.2fr)", gap: 8 };
const secondaryButtonStyle: CSSProperties = { minHeight: 48, border: 0, borderRadius: "var(--radius-control)", background: "var(--surface2)", font: "inherit", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 };
const primaryButtonStyle: CSSProperties = { minHeight: 48, border: 0, borderRadius: "var(--radius-control)", background: "var(--accent)", color: "var(--accent-ink)", font: "inherit", fontWeight: 750 };
