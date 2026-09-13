"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Account, Category } from "./app-types";
import type { EditableFundTransaction } from "./FundTransactionSheet";
import { Money } from "./Money";
import { Banner } from "./ui/Banner";
import { BottomSheet } from "./ui/BottomSheet";
import { ScaleIcon, XIcon } from "./ui/icons";
import { SteppedAmountSlider } from "./ui/SteppedAmountSlider";

type FundItem = EditableFundTransaction & { assignmentType?: "Monthly" | "Additional" | "Top-up" | null };

type Props = {
  open: boolean;
  category: Category;
  currentAvailable: number;
  month: string;
  accounts: Account[];
  funds: FundItem[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
};

const norm = (value: string) => value.replace(/-/g, "").toLowerCase();

export function CategoryAvailableSheet({ open, category, currentAvailable, month, accounts, funds, onClose, onChanged }: Props) {
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const source = useMemo(() => accounts.find((account) => category.defaultAccount && norm(account.id) === norm(category.defaultAccount)) ?? null, [accounts, category.defaultAccount]);
  const sourceCapacity = Math.max(0, source?.readyToAssign ?? source?.balance ?? 0);
  const parsed = Number(target);
  const delta = Number.isFinite(parsed) ? parsed - currentAvailable : 0;
  const valid = Number.isFinite(parsed) && parsed >= 0 && delta <= sourceCapacity && -delta <= currentAvailable && delta !== 0 && Boolean(source);
  const minimum = 0;
  const maximum = currentAvailable + sourceCapacity;

  useEffect(() => {
    if (!open) return;
    setTarget(String(Math.max(0, currentAvailable)));
    setSaving(false);
    setError(null);
  }, [currentAvailable, open]);

  const submit = async () => {
    if (!valid || !source || saving) return;
    setSaving(true);
    setError(null);
    try {
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
      onClose();
      window.setTimeout(() => { void Promise.resolve(onChanged()).catch(() => undefined); }, 600);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not adjust available funds");
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <BottomSheet open onClose={onClose} label="Adjust available" layered maxWidth="520px" zIndex={120} panelStyle={{ background: "var(--surface)", borderRadius: "var(--radius-sheet)" }}>
      <div style={wrapStyle}>
        <header style={headerStyle}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={iconStyle}><ScaleIcon size={18} /></span><h2 style={titleStyle}>Adjust available</h2></div><button type="button" className="sheet-close-button" onClick={onClose} aria-label="Close available editor"><XIcon /></button></header>
        <div style={{ textAlign: "center" }}>
          <span style={labelStyle}>Target available</span>
          <div style={heroStyle}>
            <input className="display-amount-input" autoFocus inputMode="decimal" aria-label="Target available" value={target} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setTarget(event.target.value.replace(/[^0-9.]/g, ""))} style={{ ...heroInputStyle, width: `${Math.max(1, target.length)}ch` }} />
            <span aria-hidden="true" style={currencyStyle}>MAD</span>
          </div>
        </div>
        <SteppedAmountSlider min={minimum} max={maximum} value={Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : currentAvailable} onChange={(value) => setTarget(String(value))} label={`Adjust available for ${category.name}`} />
        <div style={sourceStyle}><span>Default account</span><strong>{source ? `${source.icon} ${source.label}` : "Not configured"}</strong><span>Available to assign</span><strong><Money value={sourceCapacity} /></strong></div>
        {delta !== 0 && valid && (
          <p role="status" style={adjustmentSummaryStyle}>
            {delta > 0
              ? <><strong>{Math.abs(delta).toLocaleString("en-US")} MAD</strong> will be added to this category.</>
              : <><strong>{Math.abs(delta).toLocaleString("en-US")} MAD</strong> will return to {source?.label ?? "the default account"}.</>}
          </p>
        )}
        {delta !== 0 && !valid && <Banner tone="danger" compact>The requested adjustment is outside the available balance.</Banner>}
        {error && <Banner tone="danger" role="alert" compact>{error}</Banner>}
        <button type="button" disabled={!valid || saving} onClick={submit} style={{ ...saveStyle, opacity: valid && !saving ? 1 : .45 }}>{saving ? "Applying…" : "Apply adjustment"}</button>
      </div>
    </BottomSheet>
  );
}

const wrapStyle: CSSProperties = { minHeight: "100%", boxSizing: "border-box", padding: "8px 20px 24px", display: "flex", flexDirection: "column", gap: 20 };
const headerStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 };
const iconStyle: CSSProperties = { width: 36, height: 36, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--accent-foreground)", background: "color-mix(in srgb, var(--accent) 18%, var(--surface))" };
const titleStyle: CSSProperties = { margin: 0, fontSize: 22, lineHeight: 1.2 };
const labelStyle: CSSProperties = { color: "var(--muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" };
const heroStyle: CSSProperties = { position: "relative", minHeight: 112, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 };
const heroInputStyle: CSSProperties = { minWidth: "1ch", maxWidth: "calc(100% - 52px)", height: 88, padding: 0, border: 0, outline: 0, background: "transparent", color: "var(--text)", caretColor: "var(--text)", textAlign: "right", fontFamily: "inherit", fontSize: "clamp(48px, 15vw, 72px)", lineHeight: 1, fontWeight: 500, letterSpacing: "-.03em", fontVariantNumeric: "tabular-nums", boxSizing: "content-box" };
const currencyStyle: CSSProperties = { color: "var(--muted)", fontSize: 16, lineHeight: 1, fontWeight: 500, letterSpacing: 0 };
const sourceStyle: CSSProperties = { padding: 16, borderRadius: "var(--radius-card)", background: "var(--surface2)", display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 16px", color: "var(--muted)", fontSize: 13 };
const adjustmentSummaryStyle: CSSProperties = { margin: "-4px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.45, textAlign: "center" };
const saveStyle: CSSProperties = { marginTop: "auto", minHeight: 52, border: 0, borderRadius: "var(--radius-control)", background: "var(--accent)", color: "var(--accent-ink)", font: "inherit", fontWeight: 750 };
