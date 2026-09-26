"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Category } from "./app-types";
import { fmt, today } from "./app-utils";
import { ChoicePicker } from "./ChoicePicker";
import { Currency, Money } from "./Money";
import { Banner } from "./ui/Banner";
import { BottomSheet } from "./ui/BottomSheet";
import { CategoryIcon } from "./ui/CategoryIcon";
import { XIcon } from "./ui/icons";

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
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!savings) return;
    setAmount("");
    setToId("");
    setConfirming(false);
    setStatus("idle");
    setError("");
  }, [savings]);

  const available = Math.max(0, Math.round(savings?.available ?? 0));
  const parsed = parseFloat(amount);
  const value = Number.isFinite(parsed) ? Math.round(parsed) : 0;
  const tooMuch = value > available;
  const destination = useMemo(() => destinations.find((c) => c.id === toId) ?? null, [destinations, toId]);
  const canSubmit = !!savings && !!destination && value > 0 && !tooMuch && status !== "saving";

  // Any edit means the confirmation no longer describes what would happen.
  useEffect(() => { setConfirming(false); }, [amount, toId]);

  const submit = async () => {
    if (!canSubmit || !savings || !destination) return;
    if (!confirming) { setConfirming(true); return; }
    setStatus("saving");
    setError("");
    try {
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
      if (!res.ok) throw new Error(data.error ?? "Couldn't take money out of savings");
      onSuccess(`${fmt(value)} moved to ${destination.name}`);
      onClose();
    } catch (err: unknown) {
      setStatus("error");
      setConfirming(false);
      setError(err instanceof Error ? err.message : "Couldn't take money out of savings");
    }
  };

  return (
    <BottomSheet open={!!savings} onClose={onClose} label="Take out of savings" maxWidth="480px" panelStyle={sheetStyle} zIndex={120}>
      <div style={innerStyle}>
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <CategoryIcon icon={savings?.icon} style={{ fontSize: 28, flexShrink: 0 }} />
            <h2 style={titleStyle}>Take from {savings?.name ?? "savings"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={closeStyle}>
            <XIcon strokeWidth={2.2} />
          </button>
        </header>

        <div style={hintStyle}>
          <span>In savings</span>
          <strong><Money value={available} /></strong>
        </div>

        <label style={fieldStyle}>
          <span style={labelStyle}>Amount</span>
          <div style={{ ...amountWrapStyle, borderColor: tooMuch ? "var(--danger)" : "var(--border)" }}>
            <input
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
          {tooMuch && <span role="alert" style={errorTextStyle}>Only {fmt(available)} in savings</span>}
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Move it to</span>
          <ChoicePicker aria-label="Category to move the money to" value={toId} onChange={(event) => setToId(event.target.value)}>
            <option value="" disabled>Choose a category</option>
            {destinations.map((category) => (
              <option key={category.id} value={category.id}>{category.icon} {category.name}</option>
            ))}
          </ChoicePicker>
        </label>

        {confirming && destination && (
          <div role="status" style={confirmStyle}>
            <strong style={{ display: "block", fontSize: 13 }}>Move {fmt(value)} out of {savings?.name}?</strong>
            <span style={{ display: "block", marginTop: 3, fontSize: 12, color: "var(--muted)" }}>
              It becomes spendable in {destination.name}; {fmt(available - value)} stays in savings.
            </span>
          </div>
        )}

        {error && <Banner role="alert" tone="danger" compact>{error}</Banner>}

        <button type="button" onClick={submit} disabled={!canSubmit} style={{ ...submitStyle, opacity: canSubmit ? 1 : 0.48, cursor: canSubmit ? "pointer" : "not-allowed" }}>
          {status === "saving" ? "Moving…" : confirming ? "Confirm" : "Take out"}
        </button>
      </div>
    </BottomSheet>
  );
}

const sheetStyle: CSSProperties = { background: "var(--surface)", borderRadius: "var(--radius-sheet)", overflow: "hidden" };
const innerStyle: CSSProperties = { padding: "18px 18px calc(22px + env(safe-area-inset-bottom, 0px))", display: "grid", gap: 16, width: "100%", boxSizing: "border-box" };
const headerStyle: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 };
const titleStyle: CSSProperties = { margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1.1, color: "var(--text)" };
const closeStyle: CSSProperties = { width: 44, height: 44, border: "none", background: "transparent", color: "var(--text2)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const hintStyle: CSSProperties = { minHeight: 42, borderRadius: 14, background: "var(--surface2)", color: "var(--text2)", padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12 };
const fieldStyle: CSSProperties = { display: "grid", gap: 7 };
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--text2)" };
const amountWrapStyle: CSSProperties = { minHeight: 56, borderRadius: "var(--radius-control)", border: "1px solid var(--border)", background: "var(--surface)", display: "flex", alignItems: "center", gap: 10, padding: "0 14px" };
const amountInputStyle: CSSProperties = { flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--text2)", fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800 };
const errorTextStyle: CSSProperties = { fontSize: 12, color: "var(--danger)" };
const confirmStyle: CSSProperties = { padding: "12px 14px", borderRadius: "var(--radius-control)", background: "color-mix(in srgb, var(--warning) 10%, var(--surface))", color: "var(--text2)" };
// Neutral, not the accent: taking out of savings shouldn't look like a reward.
const submitStyle: CSSProperties = { width: "100%", minHeight: 52, borderRadius: 14, border: "none", background: "var(--text)", color: "var(--bg)", fontWeight: 800, fontSize: 15, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 };
