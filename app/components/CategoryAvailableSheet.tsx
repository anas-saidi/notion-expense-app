"use client";

import { SheetBody, SheetFooter, SheetHeader } from "./ui/SheetLayout";

import { assignableOf, fmt } from "./app-utils";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Account, Category } from "./app-types";
import { Money, Currency } from "./Money";
import { Banner } from "./ui/Banner";
import { BottomSheet } from "./ui/BottomSheet";
import { XIcon } from "./ui/icons";
import { Button } from "./ui/Button";
import { SavingCover, guardClose, useBlockingSave } from "./ui/SavingCover";
import { CategoryIcon } from "./ui/CategoryIcon";
import { accountIconSource } from "../../lib/category-icons";
import { SteppedAmountSlider } from "./ui/SteppedAmountSlider";

type Props = {
  open: boolean;
  category: Category;
  currentAvailable: number;
  month: string;
  accounts: Account[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
};

const norm = (value: string) => value.replace(/-/g, "").toLowerCase();

export function CategoryAvailableSheet({ open, category, currentAvailable, month, accounts, onClose, onChanged }: Props) {
  const [target, setTarget] = useState("");
  const save = useBlockingSave();
  const [error, setError] = useState<string | null>(null);
  const source = useMemo(() => accounts.find((account) => category.defaultAccount && norm(account.id) === norm(category.defaultAccount)) ?? null, [accounts, category.defaultAccount]);
  // Joint dues are kept back, so a slider can't hand out a partner's Joint contribution.
  const sourceCapacity = Math.max(0, (source ? assignableOf(source) : null) ?? source?.balance ?? 0);
  const parsed = Number(target);
  const delta = Number.isFinite(parsed) ? parsed - currentAvailable : 0;
  const valid = target.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && delta <= sourceCapacity && -delta <= currentAvailable && delta !== 0 && Boolean(source);
  const minimum = 0;
  const maximum = Math.max(0, currentAvailable + sourceCapacity);

  useEffect(() => {
    if (!open) return;
    setTarget(String(Math.max(0, currentAvailable)));
    setError(null);
  }, [currentAvailable, open]);

  const submit = async () => {
    if (!valid || !source) return;
    setError(null);
    try {
      await save.run(async () => {
      if (delta > 0) {
        const response = await fetch("/api/monthly-planning/funds", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, categoryId: category.id, planned: delta, accountId: source.id, mode: "add" }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not increase available funds");
      } else {
        const response = await fetch("/api/monthly-planning/funds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, categoryId: category.id, planned: Math.abs(delta), accountId: source.id, mode: "release" }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not release available funds");
      }
      });
      onClose();
      void Promise.resolve(onChanged()).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not adjust available funds");
    }
  };

  if (!open) return null;
  const close = guardClose(save.saving, onClose);
  return (
    <BottomSheet open onClose={close} label={`${category.name} available`} detent="content" layered size="standard" zIndex={120} panelStyle={{ background: "var(--surface)", borderRadius: "var(--radius-sheet)" }}>
      <SheetBody style={wrapStyle}>
        <SheetHeader style={headerStyle}><h2 style={titleStyle}>{category.name} available</h2><button type="button" className="sheet-close-button" onClick={close} aria-label="Close available editor"><XIcon size={20} /></button></SheetHeader>
        <div style={{ textAlign: "center" }}>
          <span style={labelStyle}>Target available</span>
          <div style={heroStyle}>
            <input className="display-amount-input" autoFocus inputMode="decimal" aria-label="Target available in MAD" value={target} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setTarget(event.target.value.replace(/[^0-9.]/g, ""))} style={{ ...heroInputStyle, width: `${Math.max(1, target.length)}ch` }} />
            <span aria-hidden="true"><Currency /></span>
          </div>
        </div>
        <SteppedAmountSlider min={minimum} max={maximum} value={Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : currentAvailable} onChange={(value) => setTarget(String(value))} label={`Adjust available for ${category.name}`} />
        {source && <p style={sourceStyle}><CategoryIcon icon={accountIconSource(source.type)} size={18} /><span>Unassigned in {source.label}: <strong style={sourceAmountStyle}><Money value={sourceCapacity} /></strong></span></p>}
        {delta !== 0 && valid && (
          <p role="status" style={adjustmentSummaryStyle}>
            {delta > 0
              ? <><strong>{fmt(Math.round(Math.abs(delta)))}</strong> will be added to this category.</>
              : <><strong>{fmt(Math.round(Math.abs(delta)))}</strong> will return to {source?.label ?? "the default account"}.</>}
          </p>
        )}
        {!source ? <Banner tone="warning" compact>Choose a default account in category settings first.</Banner> : target.trim() !== "" && delta !== 0 && !valid && <Banner tone="danger" compact>Only {fmt(Math.round(sourceCapacity))} unassigned in {source.label}</Banner>}
        {error && <Banner tone="danger" role="alert" compact>{error}</Banner>}
        <SheetFooter style={footerStyle}>
          <Button variant="primary" block disabled={!valid} onClick={submit}>{delta > 0 ? `Add ${fmt(Math.round(Math.abs(delta)))}` : delta < 0 ? `Return ${fmt(Math.round(Math.abs(delta)))} to ${source?.label ?? "account"}` : "Apply adjustment"}</Button>
        </SheetFooter>
      </SheetBody>
      <SavingCover saving={save.saving} />
    </BottomSheet>
  );
}

const wrapStyle: CSSProperties = { minHeight: "100%", boxSizing: "border-box", padding: "8px 24px 24px", display: "flex", flexDirection: "column", gap: 24 };
const headerStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 20, lineHeight: "24px", fontWeight: 600 };
const labelStyle: CSSProperties = { color: "var(--muted)", fontSize: 13, lineHeight: "16px", fontWeight: 600 };
const heroStyle: CSSProperties = { position: "relative", minHeight: 112, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const heroInputStyle: CSSProperties = { minWidth: "1ch", maxWidth: "calc(100% - 52px)", height: 88, minHeight: 44, padding: 0, border: 0, outline: 0, background: "transparent", color: "var(--text)", caretColor: "var(--text)", textAlign: "right", fontFamily: "var(--font-body)", fontSize: "clamp(48px, 15vw, 72px)", lineHeight: 1, fontWeight: 500, letterSpacing: "-.03em", fontVariantNumeric: "tabular-nums", boxSizing: "content-box" };
const sourceStyle: CSSProperties = { margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text2)", fontSize: 13, lineHeight: 1.45 };
const sourceAmountStyle: CSSProperties = { color: "var(--text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" };
const adjustmentSummaryStyle: CSSProperties = { margin: "-4px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.45, textAlign: "center" };
const footerStyle: CSSProperties = { marginTop: "auto" };
