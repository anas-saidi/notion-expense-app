"use client";
import { useEffect, useRef, useState } from "react";
import type { BudgetScope } from "./app-types";
import type { ReallocationSuggestion } from "@/lib/finance-ai";
import { fmt } from "./app-utils";
import { Banner } from "./ui/Banner";
import { PromptInput } from "./ui/PromptInput";
import "./finance-ai.css";

type Props = {
  scope: BudgetScope;
  month: string;
  /** This scope's spending categories as the app has them; `reserved` is what unpaid bills this month still need. */
  categories: { id: string; name: string; available: number; reserved?: number }[];
  onUse: (suggestion: ReallocationSuggestion) => void;
  /** Pills from lib/suggestions.ts rebalance rules: each points at a real shortfall, bill or unassigned money. */
  suggestions?: string[];
};

/**
 * Suggest moves, in the composer's language: you write what you need on one borderless line, the line shimmers
 * while it's read, and each move comes back as a row with the amount in the margin and its reason underneath.
 */
export function ReallocationAssistant({ scope, month, categories, onUse, suggestions = [] }: Props) {
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
  const stop = () => { abort.current?.abort(); abort.current = null; locked.current = false; setBusy(false); };

  const suggest = async () => {
    if (locked.current || !text.trim()) return;
    locked.current = true; setBusy(true); setError(""); setSuggestion(null);
    const controller = new AbortController(); abort.current = controller;
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        // The app's own numbers (the server trims them to what this ask needs); Apply re-checks them live.
        body: JSON.stringify({ action: "reallocate", text, scope, month, categories: categories.map(c => ({ id: c.id, name: c.name, available: c.available, reserved: Math.max(0, c.reserved ?? 0) })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not suggest moves.");
      setSuggestion(data);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not reach Gemini. Try again."); }
    finally { if (abort.current === controller) { locked.current = false; setBusy(false); } }
  };
  const name = (id: string) => categories.find(c => c.id === id)?.name ?? "Category";

  return <section className="realloc" aria-label="Suggest moves">
    <PromptInput id="reallocation-request" label="What do you need to cover?" value={text} placeholder="900 for a repair, keep groceries"
      onValueChange={value => { setText(value); setSuggestion(null); setError(""); }} onSubmit={() => void suggest()} onStop={stop}
      loading={busy} disabled={categories.length < 2} suggestions={suggestions} hint="Gemini reads this" />
    {busy && <div className="typed-line" data-reading><p className="realloc-thinking"><span className="typed-reading">Finding moves across your categories</span></p></div>}

    {error && <Banner tone="danger" compact role="alert">{error}</Banner>}

    {suggestion && <div className="realloc-result" role="status">
      {suggestion.explanation && <p className="realloc-explanation">{suggestion.explanation}</p>}
      {suggestion.moves.length > 0 && <ul className="realloc-moves">
        {suggestion.moves.map((move, index) => <li key={index}>
          <div className="typed-line-main">
            <span className="realloc-move">{name(move.fromId)} <span aria-hidden="true">→</span><span className="sr-only">to</span> {name(move.toId)}</span>
            <span className="typed-margin"><span className="typed-amount" aria-label={`${move.amount} MAD`}>{fmt(Math.round(move.amount))}</span></span>
          </div>
          {move.reason && <p className="typed-note">{move.reason}</p>}
        </li>)}
      </ul>}
    </div>}

    {suggestion && suggestion.moves.length > 0 && <div className="realloc-footer">
      <span className="typed-hint">Apply saves them</span>
      <button type="button" className="typed-primary" onClick={() => { onUse(suggestion); setSuggestion(null); }}>Use moves</button>
    </div>}
    <span className="sr-only" role="status">{busy ? "Preparing reallocation suggestions" : ""}</span>
  </section>;
}
