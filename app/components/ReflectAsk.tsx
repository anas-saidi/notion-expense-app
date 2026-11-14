"use client";
import { useEffect, useRef, useState } from "react";
import type { Account, BudgetScope, Category, Transaction } from "./app-types";
import { fmt, fmtDate, today, transactionMatchesScope } from "./app-utils";
import { fetchApiJson, historyReadUrls } from "@/lib/app-data";
import { answerLedger, lookupSpan, type LedgerAnswer, type LedgerLookup, type MonthRange } from "@/lib/ledger";
import { Banner } from "./ui/Banner";
import { Fact, Summary } from "./ui/Summary";
import "./finance-ai.css";

const monthLabel = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString("en", { month: "short", year: "numeric" });
const rangeLabel = (range: MonthRange) => range.start === range.end
  ? range.start === today().slice(0, 7) ? "this month" : monthLabel(range.start)
  : `${monthLabel(range.start)} to ${monthLabel(range.end)}`;
/** "this month" or "in Nov 2026", so sentences read naturally either way. */
const when = (range: MonthRange) => { const label = rangeLabel(range); return label === "this month" ? label : `in ${label}`; };
const previousMonth = (month: string) => { const d = new Date(`${month}-01T12:00:00`); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };

/** Pills for the empty search: the biggest category against the month before, and over three months. */
export const askSuggestions = (viewing: MonthRange, topCategoryName?: string) =>
  viewing.start === viewing.end && topCategoryName ? [`${topCategoryName} vs ${monthLabel(previousMonth(viewing.start))}`, `${topCategoryName} over 3 months`] : [];

/**
 * Ask your ledger. Gemini only turns the question into a lookup; this fetches the months the lookup needs,
 * counts the answer from the scope's own transactions and writes the sentence. The model never sees transactions.
 */
export function useLedgerAsk({ categories, accounts, scope, viewing }: { categories: Category[]; accounts: Account[]; scope: BudgetScope; viewing: MonthRange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clarify, setClarify] = useState("");
  const [answer, setAnswer] = useState<LedgerAnswer | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const clear = () => { abort.current?.abort(); abort.current = null; setBusy(false); setAnswer(null); setClarify(""); setError(""); };
  useEffect(clear, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async (text: string) => {
    if (!text.trim()) return;
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    setBusy(true); setError(""); setClarify(""); setAnswer(null);
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ action: "ask", text, viewing, categories: categories.filter(c => !c.archived).map(c => ({ id: c.id, name: c.name })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't read that question.");
      if (data.question) { setClarify(data.question); return; }
      const lookup = data.lookup as LedgerLookup;
      const span = lookupSpan(lookup);
      const { transactions = [] } = await fetchApiJson<{ transactions?: Transaction[] }>(historyReadUrls(span.start, span.end).transactions);
      if (controller.signal.aborted) return;
      setAnswer(answerLedger(lookup, transactions.filter(t => transactionMatchesScope(t, categories, scope, accounts)), categories));
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Couldn't answer that. Try again.");
    } finally { if (abort.current === controller) setBusy(false); }
  };
  return { ask, clear, busy, error, clarify, answer, active: busy || !!error || !!clarify || !!answer };
}

/** The thinking line, a clarifying question, or the app's own answer with what it counted. */
export function LedgerAnswerView({ state, categories, viewing }: { state: ReturnType<typeof useLedgerAsk>; categories: Category[]; viewing: MonthRange }) {
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setShowAll(false), [state.answer]);
  const { busy, error, clarify, answer } = state;
  if (!state.active) return null;
  const counted = answer ? (showAll ? answer.counted : answer.counted.slice(0, 5)) : [];
  return <section className="reflect-ask" aria-label="Answer">
    {busy && <div className="typed-line" data-reading><p className="realloc-thinking"><span className="typed-reading">Looking through your entries</span></p></div>}
    {error && <Banner tone="danger" compact role="alert">{error}</Banner>}
    {clarify && <p className="reflect-ask-clarify" role="status">{clarify}</p>}
    {answer && <div className="reflect-ask-answer" role="status">
      <Summary className="reflect-ask-sentence">{sentence(answer, categories)}</Summary>
      {/* A "where did it go" answer for the period on screen is already the Spending breakdown, so only another period lists rows. */}
      {answer.lookup.kind === "top" ? answer.byCategory.length > 0 && (answer.lookup.period.start !== viewing.start || answer.lookup.period.end !== viewing.end) && <ul className="reflect-ask-rows">
        {answer.byCategory.slice(0, 5).map(row => <li key={row.id}><span>{row.name}</span><span className="typed-amount">{fmt(Math.round(row.total))}</span></li>)}
      </ul> : answer.counted.length > 0 && <>
        <p className="reflect-ask-label">What I counted</p>
        <ul className="reflect-ask-rows">
          {counted.map(t => <li key={t.id}><span>{t.name}<small>{fmtDate(t.date)}</small></span><span className="typed-amount">{fmt(Math.round(Math.abs(t.amount)))}</span></li>)}
        </ul>
        {answer.counted.length > 5 && !showAll && <button type="button" className="reflect-ask-more" onClick={() => setShowAll(true)}>{answer.counted.length - 5} more</button>}
      </>}
    </div>}
  </section>;
}

/** The answer in words, written by the app from the counted figures. */
function sentence(answer: LedgerAnswer, categories: Category[]) {
  const { lookup, total, count, compareTotal, byCategory } = answer;
  const names = lookup.categoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean) as string[];
  const subject = lookup.search ? `"${lookup.search}"` : names.length ? names.join(" and ") : lookup.type === "Income" ? "Money in" : "Spending";
  const period = when(lookup.period);
  const amount = (value: number) => <Fact>{fmt(Math.round(value))}</Fact>;
  if (count === 0 && lookup.kind !== "compare") return <>Nothing found for {subject} {period}.</>;
  if (lookup.kind === "compare" && lookup.compare) {
    const other = when(lookup.compare);
    const before = compareTotal ?? 0;
    if (Math.round(before) === Math.round(total)) return <>{subject} is {amount(total)} {period}, the same as {other}.</>;
    return <>{subject} is {amount(total)} {period}, {total > before ? "up" : "down"} from {amount(before)} {other}.</>;
  }
  if (lookup.kind === "top") {
    const top = byCategory.slice(0, 3);
    return <>Of {amount(total)} {period}, most went to {top.map((row, i) => <span key={row.id}>{i ? i === top.length - 1 ? " and " : ", " : ""}<Fact>{row.name}</Fact></span>)}.</>;
  }
  if (lookup.kind === "list") return <>{count} {count === 1 ? "entry" : "entries"} for {subject} {period}, {amount(total)} in total.</>;
  return <>{subject} came to {amount(total)} {period}{count > 1 ? `, across ${count} entries` : ""}.</>;
}
