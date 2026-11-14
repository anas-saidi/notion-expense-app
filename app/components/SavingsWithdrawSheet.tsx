"use client";
import { categoryIconSource } from "../../lib/category-icons";

import { SheetBody, SheetFooter, SheetHeader } from "./ui/SheetLayout";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Category } from "./app-types";
import { fmt, today } from "./app-utils";
import { ChoicePicker } from "./ChoicePicker";
import { Currency, Money } from "./Money";
import { Banner } from "./ui/Banner";
import { BottomSheet } from "./ui/BottomSheet";
import { CategoryIcon } from "./ui/CategoryIcon";
import { XIcon } from "./ui/icons";
import { Button } from "./ui/Button";
import { SavingCover, guardClose, useBlockingSave } from "./ui/SavingCover";

type Props = {
  /** The savings category money comes out of; null keeps the sheet closed. */
  savings: Category | null;
  /** Spending categories it can go to (same scope, no savings). */
  destinations: Category[];
  onClose: () => void;
  onSuccess: (message: string) => void;
};

/**
 * Taking money out of savings is deliberate: pick where it goes, then confirm.
 * It moves into a spending category as a budget transfer, so this month's
 * spendable money grows by exactly what savings shrinks.
 */
export function SavingsWithdrawSheet({ savings, destinations, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [toId, setToId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const save = useBlockingSave();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!savings) return;
    setAmount("");
    setToId("");
    setConfirming(false);
    setError("");
  }, [savings]);

  const available = Math.max(0, Math.round(savings?.available ?? 0));
  const parsed = parseFloat(amount);
  const value = Number.isFinite(parsed) ? Math.round(parsed) : 0;
  const tooMuch = value > available;
  const destination = useMemo(() => destinations.find((c) => c.id === toId) ?? null, [destinations, toId]);
  const canSubmit = !!savings && !!destination && value > 0 && !tooMuch;

  // Any edit means the confirmation no longer describes what would happen.
  useEffect(() => { setConfirming(false); }, [amount, toId]);

  const submit = async () => {
    if (!canSubmit || !savings || !destination) return;
    if (!confirming) { setConfirming(true); return; }
    setError("");
    try {
      await save.run(async () => {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCategoryId: savings.id,
          toCategoryId: destination.id,
          amount: value,
          date: today(),
          note: `From ${savings.name}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not take money out of savings");
      });
      onSuccess(`${fmt(value)} moved to ${destination.name}`);
      onClose();
    } catch (err: unknown) {
      setConfirming(false);
      setError(err instanceof Error ? err.message : "Could not take money out of savings");
    }
  };

  const close = guardClose(save.saving, onClose);

  return (
    <BottomSheet open={!!savings} onClose={close} label="Take out of savings" size="standard" panelStyle={sheetStyle} zIndex={120}>
      <SheetBody style={innerStyle}>
        <SheetHeader style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <CategoryIcon icon={savings?.icon} categoryName={savings?.name} style={{ fontSize: 28, flexShrink: 0 }} />
            <h2 style={titleStyle}>Take from {savings?.name ?? "savings"}</h2>
          </div>
          <button type="button" className="sheet-close-button" onClick={close} aria-label="Close">
            <XIcon size={20} />
          </button>
        </SheetHeader>

        <div style={hintStyle}>
          <span>In savings</span>
          <strong><Money value={available} /></strong>
        </div>

        <label style={fieldStyle}>
          <span style={labelStyle}>Amount</span>
          <div style={amountWrapStyle}>
            <input
              className="display-amount-input"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="0"
              aria-label="Amount to take out"
              aria-invalid={tooMuch}
              style={amountInputStyle}
            />
            <Currency />
          </div>
        </label>
        {tooMuch && <Banner tone="danger" role="alert" compact>More than in savings</Banner>}

        <label style={fieldStyle}>
          <span style={labelStyle}>Move it to</span>
          <ChoicePicker aria-label="Category to move the money to" value={toId} onChange={(event) => setToId(event.target.value)}>
            <option value="" disabled>Choose a category</option>
            {destinations.map((category) => (
              <option key={category.id} value={category.id} data-icon={categoryIconSource(category.icon, category.name)}>{category.name}</option>
            ))}
          </ChoicePicker>
        </label>

        {confirming && destination && (
          <Banner tone="neutral" role="status" compact title={`Move ${fmt(value)} out of ${savings?.name ?? "savings"}?`}>
            It becomes spendable in {destination.name}; {fmt(available - value)} stays in savings.
          </Banner>
        )}

        {error && <Banner role="alert" tone="danger" compact>{error}</Banner>}

        <SheetFooter>
          <Button variant="primary" block onClick={submit} disabled={!canSubmit}>
            {confirming ? "Confirm" : "Take out"}
          </Button>
        </SheetFooter>
      </SheetBody>
      <SavingCover saving={save.saving} />
    </BottomSheet>
  );
}

const sheetStyle: CSSProperties = { background: "var(--surface)", borderRadius: "var(--radius-sheet)", overflow: "hidden" };
const innerStyle: CSSProperties = { padding: "16px 24px calc(24px + env(safe-area-inset-bottom, 0px))", display: "grid", gap: 16, width: "100%", boxSizing: "border-box" };
const headerStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 20, lineHeight: "24px", fontWeight: 600, color: "var(--text)" };
// A read-only figure is a plain label/value row, never boxed like an input.
const hintStyle: CSSProperties = { minHeight: 44, color: "var(--text2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 13, lineHeight: "16px" };
const fieldStyle: CSSProperties = { display: "grid", gap: 8 };
const labelStyle: CSSProperties = { fontSize: 13, lineHeight: "16px", fontWeight: 600, color: "var(--muted)" };
const amountWrapStyle: CSSProperties = { minHeight: 112, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const amountInputStyle: CSSProperties = { width: "min(260px, 68vw)", height: 88, padding: 0, border: "none", outline: "none", background: "transparent", color: "var(--text)", textAlign: "right", fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" };
