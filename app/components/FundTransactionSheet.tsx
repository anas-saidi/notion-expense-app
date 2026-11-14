"use client";

import { SheetBody, SheetFooter, SheetHeader } from "./ui/SheetLayout";

import { useEffect, useState, type CSSProperties } from "react";
import { Currency, Money } from "./Money";
import type { Account } from "./app-types";
import { ChoicePicker } from "./ChoicePicker";
import { DatePicker } from "./DatePicker";
import { Banner } from "./ui/Banner";
import { BottomSheet } from "./ui/BottomSheet";
import { Button } from "./ui/Button";
import { SavingCover, guardClose, useBlockingSave } from "./ui/SavingCover";
import { DeleteIcon, XIcon } from "./ui/icons";

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
  const save = useBlockingSave();
  const [saveLabel, setSaveLabel] = useState<"Saving" | "Deleting">("Saving");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    setAmount(String(transaction.amount));
    setDate(transaction.date);
    setAccountId(transaction.accountId ?? "");
    setError(null);
    setConfirmDelete(false);
  }, [transaction]);

  if (!transaction) return null;
  const parsedAmount = Number(amount);
  const minimumAmount = Math.max(0, transaction.amount - Math.max(0, transaction.categoryAvailable));
  const reductionTooLarge = Number.isFinite(parsedAmount) && parsedAmount < minimumAmount;
  const deleteBlocked = transaction.amount > transaction.categoryAvailable;
  const valid = Number.isFinite(parsedAmount) && parsedAmount > 0 && !reductionTooLarge && Boolean(date && accountId);

  const close = guardClose(save.saving, onClose);

  const saveChanges = async () => {
    if (!valid) return;
    setSaveLabel("Saving");
    setError(null);
    try {
      await save.run(async () => {
        const response = await fetch("/api/monthly-planning/funds", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: transaction.id, planned: parsedAmount, date, accountId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not update funding transaction");
      });
      onClose();
      void Promise.resolve(onChanged()).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update funding transaction");
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaveLabel("Deleting");
    setError(null);
    try {
      await save.run(async () => {
        const response = await fetch("/api/monthly-planning/funds", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: transaction.id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not delete funding transaction");
      });
      onClose();
      void Promise.resolve(onChanged()).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete funding transaction");
    }
  };

  return (
    <BottomSheet open onClose={close} label="Edit funding transaction" layered size="standard" zIndex={120} panelStyle={{ background: "var(--surface)", borderRadius: "var(--radius-sheet)" }}>
      <SheetBody style={wrapStyle}>
        <SheetHeader style={headerStyle}>
          <h2 style={titleStyle}>Edit funding</h2>
          <button type="button" className="sheet-close-button" onClick={close} aria-label="Close funding editor"><XIcon size={20} /></button>
        </SheetHeader>

        <label style={fieldStyle}>
          <span style={labelStyle}>Amount</span>
          <span style={amountFieldStyle}><input className="display-amount-input" autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))} aria-label="Funding amount" style={amountInputStyle} /><Currency /></span>
          {(reductionTooLarge || deleteBlocked) && <span style={{ fontSize: 12, color: reductionTooLarge ? "var(--danger)" : "var(--muted)" }}>
            {reductionTooLarge
              ? <>Minimum <Money value={minimumAmount} />: the rest is already used</>
              : <>Up to <Money value={Math.max(0, transaction.categoryAvailable)} /> can be removed</>}
          </span>}
        </label>
        <div style={fieldStyle}>
          <span style={labelStyle}>Date</span>
          <DatePicker value={date} onChange={(event) => setDate(event.target.value)} aria-label="Funding date" />
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>Account</span>
          <ChoicePicker value={accountId} onChange={(event) => setAccountId(event.target.value)} aria-label="Account" style={controlStyle}>
            <option value="" disabled>Choose account</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
          </ChoicePicker>
        </div>

        {error && <Banner tone="danger" role="alert" compact>{error}</Banner>}
        {confirmDelete && <Banner tone="warning" role="status" compact>Delete this funding transaction? Budget totals will be recalculated.</Banner>}

        <SheetFooter style={actionsStyle}>
          <Button variant="destructive" onClick={remove} disabled={deleteBlocked} aria-describedby={deleteBlocked ? "fund-delete-blocked" : undefined} icon={<DeleteIcon size={20} />}>
            {confirmDelete ? "Delete funding" : "Delete"}
          </Button>
          <Button variant="primary" onClick={saveChanges} disabled={!valid}>Save changes</Button>
          {deleteBlocked && <span id="fund-delete-blocked" style={deleteBlockedStyle}>Used funding prevents deletion</span>}
        </SheetFooter>
      </SheetBody>
      <SavingCover saving={save.saving} label={saveLabel} />
    </BottomSheet>
  );
}

const wrapStyle: CSSProperties = { minHeight: "100%", boxSizing: "border-box", padding: "8px 24px 24px", display: "flex", flexDirection: "column", gap: 16 };
const headerStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 20, lineHeight: "24px", fontWeight: 600 };
const fieldStyle: CSSProperties = { display: "grid", gap: 8 };
const labelStyle: CSSProperties = { color: "var(--muted)", fontSize: 13, lineHeight: "16px", fontWeight: 600 };
const controlStyle: CSSProperties = { width: "100%", minHeight: 48, padding: "0 12px", border: 0, borderRadius: "var(--radius-control)", background: "var(--surface2)", color: "var(--text)", font: "inherit" };
const amountFieldStyle: CSSProperties = { minHeight: 112, padding: "0 4px", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const amountInputStyle: CSSProperties = { width: "min(260px, 68vw)", height: 88, padding: 0, border: 0, outline: 0, background: "transparent", color: "var(--text)", textAlign: "right", fontFamily: "var(--font-body)", fontSize: "clamp(48px, 15vw, 72px)", lineHeight: 1, fontWeight: 500, letterSpacing: "-.03em", fontVariantNumeric: "tabular-nums", boxSizing: "border-box" };
const actionsStyle: CSSProperties = { marginTop: "auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8 };
const deleteBlockedStyle: CSSProperties = { gridColumn: "1 / 2", fontSize: 12, lineHeight: "16px", color: "var(--muted)", textAlign: "center" };
