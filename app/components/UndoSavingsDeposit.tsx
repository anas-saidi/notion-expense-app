"use client";
import { useEffect, useRef, useState } from "react";
import { useAppHaptics } from "./ui/useAppHaptics";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { SavingCover, useBlockingSave } from "./ui/SavingCover";

/**
 * Undo a savings deposit (or delete a plain transfer) from inside a host sheet.
 * The delete blocks the whole host: a host that passes onBusyChange renders the SavingCover and guards its close;
 * without one, this component covers the screen itself.
 */
export function UndoSavingsDeposit({ operationId, transactionId, onUndone, onBusyChange }: {
  operationId?: string;
  transactionId?: string;
  onUndone: () => void | Promise<void>;
  /** The host renders the SavingCover and guards its close while this is true. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const label = operationId ? "Undo deposit" : "Delete transfer";
  const { haptic } = useAppHaptics();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const save = useBlockingSave();
  const busyListener = useRef(onBusyChange);
  busyListener.current = onBusyChange;
  useEffect(() => { busyListener.current?.(save.saving); }, [save.saving]);
  useEffect(() => () => busyListener.current?.(false), []);
  const undo = async () => {
    setError("");
    try {
      await save.run(async () => {
        const response = await fetch(operationId ? "/api/savings-funding" : "/api/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operationId ? { operationId } : { id: transactionId }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not undo the deposit. Retry to finish.");
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not undo the deposit. Retry to finish.");
      return;
    }
    await onUndone();
  };
  return <div style={{ display: "grid", gap: 12 }}>
    {confirming && <p style={{ margin: 0, color: "var(--text2)", fontSize: 15, lineHeight: "22px" }}>{operationId ? "Undo this deposit and its linked transfer?" : "Delete this transfer? Category assignments stay unchanged."}</p>}
    {error && <Banner role="alert" tone="danger" compact>{error}</Banner>}
    <div style={{ display: "flex", gap: 8 }}>
      {confirming && <Button variant="secondary" style={{ flex: 1 }} onClick={() => { setConfirming(false); setError(""); }}>{operationId ? "Keep deposit" : "Keep transfer"}</Button>}
      <Button variant="destructive" style={{ flex: 1 }} onClick={() => { if (confirming) { haptic("warning"); void undo(); } else setConfirming(true); }}>{label}</Button>
    </div>
    {!onBusyChange && <SavingCover saving={save.saving} label="Deleting" fill="screen" />}
  </div>;
}
