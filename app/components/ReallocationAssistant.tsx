"use client";
import { useEffect, useRef, useState } from "react";
import type { BudgetScope } from "./app-types";
import type { ReallocationSuggestion } from "@/lib/finance-ai";
import { Money } from "./Money";
import { Banner } from "./ui/Banner";

type Props = {
  scope: BudgetScope;
  month: string;
  categories: { id: string; name: string; available: number }[];
  onUse: (suggestion: ReallocationSuggestion) => void;
};

export function ReallocationAssistant({ scope, month, categories, onUse }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<ReallocationSuggestion | null>(null);
  const abort = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const signature = JSON.stringify(categories.map(c => [c.id, c.available]));
  useEffect(() => {
    abort.current?.abort(); locked.current = false;
    setBusy(false); setSuggestion(null); setError("");
    return () => { abort.current?.abort(); };
  }, [scope, month, signature]);

  const suggest = async () => {
    if (locked.current || !text.trim()) return;
    locked.current = true; setBusy(true); setError(""); setSuggestion(null);
    const controller = new AbortController(); abort.current = controller;
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ action: "reallocate", text, scope, month }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't suggest moves.");
      if (categories.some(c => data.balances?.[c.id] !== c.available) || Object.keys(data.balances ?? {}).length !== categories.length) throw new Error("Your budget changed. Close Rebalance, sync, and ask again.");
      setSuggestion(data);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Couldn't reach Gemini. Try again."); }
    finally { if (abort.current === controller) { locked.current = false; setBusy(false); } }
  };

  return <section className="ai-assistant" aria-label="Reallocation suggestions">
    <label htmlFor="reallocation-request">What do you need to cover?</label>
    <textarea id="reallocation-request" className="ai-request" rows={2} maxLength={2000} disabled={busy} value={text}
      placeholder="I need 900 for a repair. Keep grocery money intact."
      onChange={event => { setText(event.target.value); setSuggestion(null); setError(""); }} />
    <p className="ai-helper">Sends your request, category names and remaining budgets to Google. Savings and unpaid bills stay protected. Avoid sensitive details.</p>
    <button type="button" className="ai-action" disabled={busy || !text.trim() || categories.length < 2} onClick={suggest}>{busy ? "Thinking…" : "Suggest moves"}</button>
    {error && <Banner tone="danger" compact role="alert">{error}</Banner>}
    {suggestion && <div className="ai-suggestion" role="status">
      <p>{suggestion.explanation}</p>
      {suggestion.moves.map((move, index) => <div className="ai-move" key={index}>
        <div className="ai-move-heading"><span>{categories.find(c => c.id === move.fromId)?.name} → {categories.find(c => c.id === move.toId)?.name}</span><span aria-label={`${move.amount} MAD`}><Money value={move.amount} /></span></div>
        <p className="ai-helper">{move.reason}</p>
      </div>)}
      {suggestion.moves.length > 0 && <><button type="button" className="ai-action" onClick={() => { onUse(suggestion); setSuggestion(null); }}>Use suggestion</button><p className="ai-helper">Loads these amounts into Rebalance for review. Apply confirms the transfers.</p></>}
    </div>}
    <span className="sr-only" role="status">{busy ? "Preparing reallocation suggestions" : ""}</span>
  </section>;
}
