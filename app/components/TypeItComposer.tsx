"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { parseTransactionLines, reconcileTypedChoices, saveTypedBatch, type TypedTransactionDraft } from "@/lib/typed-transactions";
import { createCategorySuggester } from "@/lib/category-suggest";
import type { Account, Category } from "./app-types";
import { expenseBudgetGate, fmtDate, shiftDate, today } from "./app-utils";
import { Money } from "./Money";
import { PickerPopover } from "./PickerPopover";
import { AccountOptionList, CategoryOptionList, filterCategories, pickerChipIconStyle, pickerChipLabelStyle, pickerChipStyle } from "./TransactionPickers";
import { Banner } from "./ui/Banner";
import { signedAmountColor } from "./ui/TransactionRow";
import { CheckIcon } from "./ui/icons";
import { useAppHaptics } from "./ui/useAppHaptics";

type Props = {
  active: boolean;
  draftKey: string;
  categories: Category[];
  accounts: Account[];
  history: { description: string; categoryId: string }[];
  defaultAccountId: string;
  defaultDate: string;
  onSave: (transaction: TypedTransactionDraft) => Promise<void>;
  onComplete: (count: number) => void;
  onBusyChange: (busy: boolean) => void;
};

type Choice = { categoryId?: string; accountId?: string };

export function TypeItComposer(props: Props) {
  const [text, setText] = useState("");
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const lock = useRef(false);
  const inputs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [focusedLine, setFocusedLine] = useState<number | null>(0);
  // The line being worked on: it also shows its account chip.
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [picker, setPicker] = useState<{ line: number; kind: "category" | "account" } | null>(null);
  const pickerAnchor = useRef<HTMLElement | null>(null);
  const [catSearch, setCatSearch] = useState("");
  const nextFocus = useRef<number | null>(null);
  const remainingBudgets = useRef<Record<string, number>>({});
  const { haptic } = useAppHaptics();

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(props.draftKey) ?? "null");
      setText(typeof draft?.text === "string" ? draft.text : "");
      setChoices(draft?.choices && typeof draft.choices === "object" ? draft.choices : {});
    } catch { setText(""); setChoices({}); }
    setFeedback(null);
    remainingBudgets.current = {};
  }, [props.draftKey]);

  useEffect(() => { if (props.active) inputs.current[0]?.focus(); }, [props.active]);

  const updateDraft = (value: string, nextChoices: Record<number, Choice>) => {
    setText(value);
    setChoices(nextChoices);
    try {
      if (value.trim()) localStorage.setItem(props.draftKey, JSON.stringify({ text: value, choices: nextChoices }));
      else localStorage.removeItem(props.draftKey);
    } catch { /* The in-memory draft remains usable if storage is unavailable. */ }
  };

  useLayoutEffect(() => {
    inputs.current.forEach(input => { if (input) { input.style.height = "auto"; input.style.height = `${input.scrollHeight}px`; } });
    if (nextFocus.current !== null) { inputs.current[nextFocus.current]?.focus(); nextFocus.current = null; }
  }, [text, props.active]);

  useEffect(() => {
    const resize = () => inputs.current.forEach(input => { if (input) { input.style.height = "auto"; input.style.height = `${input.scrollHeight}px`; } });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const suggest = useMemo(() => createCategorySuggester(props.history), [props.history]);
  const parsed = parseTransactionLines(text, new Date(), props.defaultDate);
  const rows = parsed.map(row => {
    // An explicit choice wins, then the category learned from past transactions. With neither,
    // the line waits for a pick rather than silently landing in the form's category.
    const categoryId = choices[row.line]?.categoryId ?? (row.transaction ? suggest(row.transaction.name, props.categories) : null) ?? "";
    const category = props.categories.find(item => item.id === categoryId);
    const accountId = choices[row.line]?.accountId ?? props.defaultAccountId;
    const account = props.accounts.find(item => item.id === accountId);
    return { ...row, category, account };
  });
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.transaction?.type === "Expense" && row.category) totals.set(row.category.id, (totals.get(row.category.id) ?? 0) + row.transaction.amount);
  }
  const budgetErrors = [...totals].flatMap(([id, amount]) => {
    const category = props.categories.find(item => item.id === id)!;
    const cap = remainingBudgets.current[id];
    const available = cap === undefined ? category.available : Math.min(cap, category.available ?? cap);
    const gate = expenseBudgetGate({ available, amount });
    return gate.shortfall > 0 ? [{ category, shortfall: gate.shortfall }] : [];
  });
  const ready = rows.length > 0 && rows.length <= 50 && rows.every(row => row.transaction && row.account && (row.transaction.type === "Income" || row.category)) && !budgetErrors.length;
  const total = rows.reduce((sum, row) => sum + ((row.transaction?.amount ?? 0) * (row.transaction?.type === "Income" ? 1 : -1)), 0);

  const save = async () => {
    if (!ready || lock.current) return;
    lock.current = true;
    setBusy(true);
    props.onBusyChange(true);
    setFeedback(null);
    setProgress(0);
    let confirmed = 0;
    const result = await saveTypedBatch(rows, async row => {
      await props.onSave({ ...row.transaction!, accountId: row.account!.id, categoryId: row.transaction!.type === "Expense" ? row.category!.id : "" });
    }, row => {
      if (row.transaction?.type === "Expense" && row.category) {
        const current = remainingBudgets.current[row.category.id] ?? row.category.available;
        if (current !== null) remainingBudgets.current[row.category.id] = current - row.transaction!.amount;
      }
      confirmed++;
      const pending = rows.slice(confirmed);
      const pendingChoices: Record<number, Choice> = {};
      pending.forEach((item, index) => { pendingChoices[index + 1] = { categoryId: item.category?.id, accountId: item.account?.id }; });
      try {
        if (pending.length) localStorage.setItem(props.draftKey, JSON.stringify({ text: pending.map(item => item.source).join("\n"), choices: pendingChoices }));
        else localStorage.removeItem(props.draftKey);
      } catch {}
      setProgress(confirmed);
    });
    // Confirmed saves leave the draft immediately. Failed and unattempted rows retain their choices.
    const remaining = rows.slice(result.saved);
    const nextChoices: Record<number, Choice> = {};
    remaining.forEach((row, index) => { nextChoices[index + 1] = { categoryId: row.category?.id, accountId: row.account?.id }; });
    updateDraft(remaining.map(row => row.source).join("\n"), nextChoices);
    setFeedback({ error: Boolean(result.error), message: result.error
      ? `${result.saved ? `${result.saved} saved. ` : ""}${result.error} Remaining lines are kept. Check History before retrying if the connection was interrupted.`
      : `${result.saved} ${result.saved === 1 ? "transaction" : "transactions"} saved.` });
    haptic(result.error ? "error" : "success");
    setBusy(false);
    props.onBusyChange(false);
    lock.current = false;
    if (result.saved) props.onComplete(result.saved);
  };

  const lines = text.split(/\r?\n/);
  const editLine = (index: number, value: string) => {
    const updated = [...lines];
    updated.splice(index, 1, ...value.split(/\r?\n/));
    const nextText = updated.join("\n");
    if (nextText.length > 10000) return;
    if (value.includes("\n")) nextFocus.current = index + value.split(/\r?\n/).length - 1;
    updateDraft(nextText, reconcileTypedChoices(text, nextText, choices));
    setFeedback(null);
  };
  const openPicker = (event: MouseEvent<HTMLElement>, line: number, kind: "category" | "account") => {
    pickerAnchor.current = event.currentTarget;
    setCatSearch("");
    setPicker(current => current?.line === line && current.kind === kind ? null : { line, kind });
  };
  const choose = (line: number, choice: Choice) => {
    updateDraft(text, { ...choices, [line + 1]: { ...choices[line + 1], ...choice } });
    setPicker(null);
  };
  const pickerRow = picker ? rows.find(item => item.line === picker.line + 1) : undefined;

  const focusEnd = () => {
    const last = lines.length - 1;
    const input = inputs.current[last];
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  };

  return <div style={{ display: props.active ? "flex" : "none", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}>
    <p id="typed-help" className="sr-only">One transaction per line. Press Enter for a new line. Amounts are in MAD. Purchases are expenses; use salary, received, or a plus sign for income. Dates can be today, yesterday, a weekday, or YYYY-MM-DD. Tap a line's category or account to change it.</p>
    <div style={{ flex: "1 1 auto", overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", paddingTop: 24 }}>
      <div role="group" aria-label="Write transactions" style={{ display: "grid", gap: 28 }}>
        {lines.map((source, index) => {
          const row = rows.find(item => item.line === index + 1);
          const transaction = row?.transaction;
          const income = transaction?.type === "Income";
          return <div key={index} onFocus={() => setActiveLine(index)}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <textarea className="typed-entry-line" ref={element => { inputs.current[index] = element; }} aria-label={`Transaction line ${index + 1}`} aria-describedby="typed-help" rows={1} disabled={busy} value={source}
                placeholder={index === 0 ? "pizza 19 yesterday" : "Another transaction…"}
                onFocus={() => setFocusedLine(index)} onBlur={() => setFocusedLine(null)}
                onChange={event => editLine(index, event.target.value)}
                onKeyDown={event => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === "Enter") {
                    event.preventDefault();
                    const element = event.currentTarget;
                    editLine(index, `${source.slice(0, element.selectionStart)}\n${source.slice(element.selectionEnd)}`);
                  } else if (event.key === "Backspace" && !source && index > 0) {
                    event.preventDefault();
                    const nextText = lines.filter((_, line) => line !== index).join("\n");
                    nextFocus.current = index - 1;
                    updateDraft(nextText, reconcileTypedChoices(text, nextText, choices));
                  }
                }}
                style={{ display: "block", flex: "1 1 auto", width: "100%", minWidth: 0, background: "transparent", border: 0, borderRadius: 0, padding: "4px 0", margin: 0, resize: "none", overflow: "hidden", color: "var(--text2)", font: "inherit", fontSize: 22, lineHeight: 1.4, outline: "none", caretColor: "var(--accent-foreground)" }} />
              {transaction && <span aria-label={`${income ? "Income" : "Expense"} ${transaction.amount} MAD`} style={{ flexShrink: 0, paddingTop: 6, fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: signedAmountColor(income ? "income" : "expense") }}>{income ? "+" : "−"}<Money value={transaction.amount} /></span>}
            </div>
            {transaction && <div style={metaRowStyle}>
              {!income && <button type="button" disabled={busy} aria-haspopup="dialog" aria-expanded={picker?.line === index && picker.kind === "category"} aria-label={`Category for line ${index + 1}: ${row?.category?.name ?? "none"}`} onClick={event => openPicker(event, index, "category")} style={{ ...pickerChipStyle, color: row?.category ? "var(--text2)" : "var(--muted)" }}>
                <span style={pickerChipIconStyle}>{row?.category?.icon ?? "#"}</span>
                <span style={pickerChipLabelStyle}>{row?.category?.name ?? "Category"}</span>
              </button>}
              {(activeLine === index || row?.account?.id !== props.defaultAccountId) && <button type="button" disabled={busy} aria-haspopup="dialog" aria-expanded={picker?.line === index && picker.kind === "account"} aria-label={`Account for line ${index + 1}: ${row?.account?.label ?? "none"}`} onClick={event => openPicker(event, index, "account")} style={{ ...pickerChipStyle, color: "var(--muted)" }}>
                <span style={pickerChipIconStyle}>{row?.account?.icon ?? "$"}</span>
                <span style={pickerChipLabelStyle}>{row?.account?.label ?? "Account"}</span>
              </button>}
              {transaction.date !== props.defaultDate && <span style={dateNoteStyle}>{dayLabel(transaction.date)}</span>}
            </div>}
            {row?.error && focusedLine !== index && <p style={{ ...helperStyle, color: "var(--danger)" }}>{row.error}</p>}
          </div>;
        })}
      </div>
      <div onClick={focusEnd} aria-hidden="true" style={{ flex: "1 0 80px", cursor: "text" }} />
      {rows.length === 0 && <p style={helperStyle}>One line at a time. Try “pizza 19” or “salary +5000”.</p>}
      {rows.length > 50 && <Banner tone="danger" role="alert" compact>Add up to 50 transactions at a time.</Banner>}
      {budgetErrors.map(({ category, shortfall }) => <Banner key={category.id} tone="warning" compact style={{ marginTop: 12 }}>{category.name} needs <Money value={shortfall} /> more to cover these lines. Fund it in Budget or change the line’s category.</Banner>)}
      {feedback && <Banner tone={feedback.error ? "danger" : "success"} role={feedback.error ? "alert" : "status"} compact style={{ marginTop: 12 }}>{feedback.message}</Banner>}
    </div>
    {rows.length > 0 && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 0 0" }}>
      <div style={{ color: "var(--text2)", fontSize: 16, fontVariantNumeric: "tabular-nums" }}><Money value={total} currency /><span style={{ ...helperStyle, marginLeft: 8 }}>net</span></div>
      <button type="button" disabled={!ready || busy} onClick={save} style={{ minHeight: 44, padding: "0 16px", display: "inline-flex", alignItems: "center", gap: 8, border: 0, borderRadius: "var(--radius-control)", background: ready && !busy ? "var(--accent)" : "var(--surface2)", color: ready && !busy ? "var(--accent-ink)" : "var(--muted)", font: "inherit", fontSize: 14, fontWeight: 600, cursor: ready && !busy ? "pointer" : "not-allowed" }}>
        {busy ? `Saving ${progress}/${rows.length}…` : <><CheckIcon size={16} />Save {rows.length}</>}
      </button>
    </div>}
    <PickerPopover open={picker !== null} title={picker?.kind === "account" ? "Account" : "Category"} onClose={() => setPicker(null)} align="left" placement="bottom" width={picker?.kind === "account" ? "min(292px, calc(100vw - 28px))" : "min(300px, calc(100vw - 28px))"} zIndex={140} anchorRef={pickerAnchor}>
      {picker?.kind === "account" && <AccountOptionList accounts={props.accounts} selectedId={pickerRow?.account?.id} onSelect={accountId => choose(picker.line, { accountId })} />}
      {picker?.kind === "category" && <CategoryOptionList categories={filterCategories(props.categories, catSearch)} selectedId={pickerRow?.category?.id} onSelect={category => choose(picker.line, { categoryId: category.id })} search={catSearch} onSearchChange={setCatSearch} />}
    </PickerPopover>
    <span role="status" className="sr-only">{busy ? `${progress} transactions saved` : ""}</span>
  </div>;
}
const helperStyle: CSSProperties = { color: "var(--muted)", fontSize: 13, lineHeight: 1.5, margin: "8px 0 12px" };
const metaRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 };
const dateNoteStyle: CSSProperties = { fontSize: 13, color: "var(--muted)", padding: "0 4px" };

const dayLabel = (date: string) =>
  date === today() ? "Today" : date === shiftDate(today(), -1) ? "Yesterday" : date === shiftDate(today(), 1) ? "Tomorrow" : fmtDate(date);
