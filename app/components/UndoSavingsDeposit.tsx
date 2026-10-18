"use client";
import { useRef, useState } from "react";
import { useAppHaptics } from "./ui/useAppHaptics";
import { Banner } from "./ui/Banner";

export function UndoSavingsDeposit({ operationId, transactionId, onUndone }: { operationId?: string; transactionId?: string; onUndone: () => void | Promise<void> }) {
  const label = operationId ? "Undo deposit" : "Delete transfer";
  const { haptic } = useAppHaptics();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const undo = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(operationId ? "/api/savings-funding" : "/api/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operationId ? { operationId } : { id: transactionId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not undo the deposit. Retry to finish.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not undo the deposit. Retry to finish.");
      locked.current = false; setBusy(false); return;
    }
    await onUndone();
  };
  const style = { minHeight: 48, borderRadius: "var(--radius-control)", padding: "8px 16px", border: "1px solid var(--border2)", background: "var(--surface)", color: "var(--danger)", fontWeight: 600, cursor: "pointer" };
  return <div style={{ display: "grid", gap: 12 }}>
    {confirming && <p style={{ margin: 0, color: "var(--text2)", fontSize: 14 }}>{operationId ? "Undo this deposit and its linked transfer?" : "Delete this transfer? Category assignments stay unchanged."}</p>}
    {error && <Banner role="alert" tone="danger" compact>{error}</Banner>}
    <div style={{ display: "flex", gap: 8 }}>
      {confirming && <button type="button" disabled={busy} style={{ ...style, flex: 1, color: "var(--text)" }} onClick={() => { setConfirming(false); setError(""); }}>{operationId ? "Keep deposit" : "Keep transfer"}</button>}
      <button type="button" disabled={busy} style={{ ...style, flex: 1, opacity: busy ? 0.5 : 1 }} onClick={() => { if (confirming) { haptic("warning"); void undo(); } else setConfirming(true); }}>{busy ? "Removing…" : label}</button>
    </div>
  </div>;
}
