"use client";
import { SheetBody, SheetHeader } from "./ui/SheetLayout";

import { IncomeUseControl } from "./IncomeUseControl";
import { isJointIncomeAccount, type IncomeUse } from "@/lib/joint-income";
import { DatePicker } from "./DatePicker";

import { useEffect, useState, type CSSProperties } from "react";
import type { Account } from "./app-types";
import { BottomSheet } from "./ui/BottomSheet";
import { Money, Currency } from "./Money";
import { BanknoteIcon, ChevronDownIcon, XIcon } from "./ui/icons";
import { Button } from "./ui/Button";
import { SavingCover, guardClose, useBlockingSave } from "./ui/SavingCover";
import { CategoryIcon } from "./ui/CategoryIcon";
import { accountIconSource } from "../../lib/category-icons";
import { Banner } from "./ui/Banner";
import { fmtDate, parseAmount, today } from "./app-utils";

type AccountIncomeSheetProps = {
  open: boolean;
  account: Account | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export function AccountIncomeSheet({ open, account, onClose, onSuccess }: AccountIncomeSheetProps) {
  const [incomeUse, setIncomeUse] = useState<IncomeUse>("contributions");
  const [name, setName] = useState("Income");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const save = useBlockingSave();
  const [error, setError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIncomeUse("contributions");
    setName("Income");
    setAmount("");
    setDate(today());
    setError("");
    setDetailsOpen(false);
  }, [open, account?.id]);

  const parsedAmount = parseAmount(amount) ?? 0;
  const showDetails = detailsOpen || name.trim() === "";
  const dateLabel = date === today() ? "Today" : fmtDate(date);
  const canSubmit = Boolean(account?.id && name.trim() && Number.isFinite(parsedAmount) && parsedAmount > 0);

  const submit = async () => {
    if (!account || !canSubmit) return;
    setError("");
    try {
      await save.run(async () => {
      const res = await fetch("/api/monthly-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amount: parsedAmount,
          date,
          accountId: account.id,
          incomeUse: isJointIncomeAccount(account.label) ? incomeUse : "contributions",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add income");
      });
      onSuccess(`Income added to ${account.label}`);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add income");
    }
  };

  const close = guardClose(save.saving, onClose);

  if (!open || !account) return null;

  return (
    <BottomSheet
      open={open}
      onClose={close}
      label={`Add income to ${account.label}`}
      size="standard"
      detent="content"
      maxHeight="calc(100dvh - 20px)"
      panelStyle={sheetStyle}
      contentStyle={{ paddingTop: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <SheetBody style={innerStyle}>
        <SheetHeader style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={accountIconStyle}><CategoryIcon icon={accountIconSource(account.type)} size={24} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={eyebrowStyle}>Add income</div>
              <h2 style={titleStyle}>{account.label}</h2>
            </div>
          </div>
          <button type="button" className="sheet-close-button" onClick={close} aria-label="Close">
            <XIcon size={20} />
          </button>
        </SheetHeader>

        <div style={{ minHeight: 0, overflowY: "auto", display: "grid", gap: 16 }}>
        {account.balance != null && <section style={balanceCardStyle}>
          <span>{parsedAmount > 0 ? "Balance after" : "Current balance"}</span>
          <strong><Money value={parsedAmount > 0 ? account.balance + parsedAmount : account.balance} /></strong>
        </section>}

        <section style={formStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Amount</span>
            <div style={amountWrapStyle}>
              <input
                value={amount}
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="0"
                style={amountInputStyle}
              />
              <Currency />
            </div>
          </label>

          {showDetails ? <>
            <label style={fieldStyle}>
              <span style={labelStyle}>Description</span>
              <input className="field-input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>Date</span>
              <DatePicker value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          </> : (
            <button type="button" aria-expanded={false} aria-label={`Edit description and date: ${name.trim()}, ${dateLabel}`} onClick={() => setDetailsOpen(true)} style={summaryRowStyle}>
              <span style={summaryTextStyle}>{name.trim()}, {dateLabel}</span>
              <ChevronDownIcon size={16} aria-hidden="true" />
            </button>
          )}
        </section>

        {isJointIncomeAccount(account.label) && <IncomeUseControl value={incomeUse} onChange={setIncomeUse} />}

        {error && <Banner role="alert" tone="danger" compact>{error}</Banner>}

        </div>

        <Button variant="primary" block onClick={submit} disabled={!canSubmit} icon={<BanknoteIcon />} style={{ flexShrink: 0 }}>
          Add income
        </Button>
      </SheetBody>
      <SavingCover saving={save.saving} />
    </BottomSheet>
  );
}

const summaryRowStyle: CSSProperties = {
  width: "100%",
  minHeight: 44,
  border: "none",
  borderRadius: 12,
  background: "transparent",
  color: "var(--text2)",
  padding: "0 4px",
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  cursor: "pointer",
  textAlign: "left",
};

const summaryTextStyle: CSSProperties = {
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const sheetStyle: CSSProperties = {
  borderRadius: "var(--radius-sheet)",
  overflow: "hidden",
};

const innerStyle: CSSProperties = {
  padding: "16px 24px 24px",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  overflow: "hidden",
  gap: 24,
};

const headerStyle: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const accountIconStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "var(--radius-control)",
  background: "color-mix(in srgb, var(--accent) 10%, var(--surface2))",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,

  color: "var(--muted)",
};

const titleStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 20,
  lineHeight: 1.2,
  fontWeight: 600,
  color: "var(--text)",
};

const balanceCardStyle: CSSProperties = {
  minHeight: 56,
  borderRadius: "var(--radius-card)",
  background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
  color: "var(--text2)",
  padding: "0 12px",
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
  gap: 8,
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: "16px",
  fontWeight: 600,
  color: "var(--text2)",
};

const amountWrapStyle: CSSProperties = {
  minHeight: 56,
  borderRadius: "var(--radius-control)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 16px",
};

const amountInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  background: "transparent",
  color: "var(--text)",
  fontSize: 28,
  fontWeight: 500,
  fontVariantNumeric: "tabular-nums",
};

