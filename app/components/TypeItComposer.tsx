"use client";
import { useOnline } from "./useOnline";
import "./finance-ai.css";
import "./ui/prompt-input.css";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { parseTransactionLines, reconcileTypedChoices, saveTypedBatch, type TypedTransactionDraft } from "@/lib/typed-transactions";
import { createCategorySuggester } from "@/lib/category-suggest";
import type { Account, Category } from "./app-types";
import { expenseBudgetGate, fmt, fmtDate, shiftDate, today } from "./app-utils";
import { Money } from "./Money";
import { PickerPopover } from "./PickerPopover";
import { SwipeToDelete } from "./ui/SwipeToDelete";
import { DateCalendar } from "./DatePicker";
import { AccountOptionList, CategoryOptionList, filterCategories } from "./TransactionPickers";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import { CameraIcon, CheckIcon, XIcon } from "./ui/icons";
import { deleteReceipt, loadReceipt, saveReceipt, shrinkPhoto } from "@/lib/receipt-store";
import { useAppHaptics } from "./ui/useAppHaptics";
import { validateParsing, type AIDraft } from "@/lib/finance-ai";

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
  /** The batch save's progress for the host sheet's saving cover ("Saving 2 of 5"), or null when no save runs. */
  onSavingChange?: (label: string | null) => void;
  /** Move one line into the form for all its fields; the line leaves the written list. */
  onOpenInForm?: (source: string, row: { type: "Expense" | "Income"; name: string; amount: number; date: string; categoryId?: string; accountId?: string }) => void;
  /** A line coming back from the form unsaved: appended to what's written. */
  restoreLine?: { source: string; id: number } | null;
  /** Example lines shown as pills above an empty canvas (prompt-kit's Prompt Suggestion); tapping fills the line. */
  suggestions?: string[];
};

type Choice = { categoryId?: string; accountId?: string; date?: string; transaction?: AIDraft };

export function TypeItComposer(props: Props) {
  const [text, setText] = useState("");
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const parseAbort = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState(0);
  // Lines being read right now (by their text); each settles when its own answer comes back.
  const [readingLines, setReadingLines] = useState<Set<string>>(new Set());
  // Receipt photos wait on this device (IndexedDB) until Read; only their ids live with the text draft.
  const receiptsKey = `${props.draftKey}:receipts`;
  const [receipts, setReceipts] = useState<{ id: string; takenAt: string }[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const online = useOnline();
  const camera = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let list: { id: string; takenAt: string }[] = [];
    try { const saved = JSON.parse(localStorage.getItem(receiptsKey) ?? "[]"); if (Array.isArray(saved)) list = saved.filter(r => typeof r?.id === "string"); } catch {}
    setReceipts(list);
    setThumbs({});
    list.forEach(r => { void loadReceipt(r.id).then(photo => { if (photo) setThumbs(t => ({ ...t, [r.id]: `data:${photo.mimeType};base64,${photo.data}` })); }).catch(() => {}); });
  }, [receiptsKey]);
  const storeReceipts = (next: { id: string; takenAt: string }[]) => {
    setReceipts(next);
    try { if (next.length) localStorage.setItem(receiptsKey, JSON.stringify(next)); else localStorage.removeItem(receiptsKey); } catch {}
  };
  const receiptsRef = useRef(receipts);
  receiptsRef.current = receipts;
  const addReceipt = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = await shrinkPhoto(file);
      const id = crypto.randomUUID();
      await saveReceipt({ id, mimeType: "image/jpeg", data, takenAt: new Date().toISOString() });
      storeReceipts([...receiptsRef.current, { id, takenAt: new Date().toISOString() }]);
      setThumbs(t => ({ ...t, [id]: `data:image/jpeg;base64,${data}` }));
      haptic("selection");
    } catch { setFeedback({ error: true, message: "Couldn't keep that photo. Try taking it again." }); }
  };
  const removeReceipt = (id: string) => {
    storeReceipts(receiptsRef.current.filter(r => r.id !== id));
    setThumbs(t => { const next = { ...t }; delete next[id]; return next; });
    void deleteReceipt(id).catch(() => {});
  };
  const textRef = useRef(text);
  const choicesRef = useRef(choices);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const lock = useRef(false);
  const inputs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [focusedLine, setFocusedLine] = useState<number | null>(0);
  // The line being worked on: it also shows its account chip.
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [picker, setPicker] = useState<{ line: number; kind: "category" | "account" | "date" } | null>(null);
  const pickerAnchor = useRef<HTMLElement | null>(null);
  const [catSearch, setCatSearch] = useState("");
  const nextFocus = useRef<number | null>(null);
  // Where the caret lands after a join (the old end of the line above).
  const caretAt = useRef<number | null>(null);
  const remainingBudgets = useRef<Record<string, number>>({});
  const { haptic } = useAppHaptics();
  useEffect(() => () => { parseAbort.current?.abort(); }, []);
  useEffect(() => { props.onBusyChange(busy || parsing); }, [busy, parsing, props.onBusyChange]);
  // The host sheet shows one saving cover for the whole batch; this keeps its label on the line being saved.
  const savingTotal = useRef(0);
  useEffect(() => {
    props.onSavingChange?.(busy ? `Saving ${Math.min(progress + 1, savingTotal.current)} of ${savingTotal.current}` : null);
  }, [busy, progress, props.onSavingChange]);

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
  useEffect(() => {
    if (!props.restoreLine) return;
    const restored = text.trim() ? `${text.replace(/\n+$/, "")}\n${props.restoreLine.source}` : props.restoreLine.source;
    updateDraft(restored, reconcileTypedChoices(text, restored, choices));
  }, [props.restoreLine?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDraft = (value: string, nextChoices: Record<number, Choice>) => {
    textRef.current = value;
    choicesRef.current = nextChoices;
    setText(value);
    setChoices(nextChoices);
    try {
      if (value.trim()) localStorage.setItem(props.draftKey, JSON.stringify({ text: value, choices: nextChoices }));
      else localStorage.removeItem(props.draftKey);
    } catch { /* The in-memory draft remains usable if storage is unavailable. */ }
  };

  useLayoutEffect(() => {
    inputs.current.forEach(input => { if (input) { input.style.height = "auto"; input.style.height = `${input.scrollHeight}px`; } });
    if (nextFocus.current !== null) {
      const input = inputs.current[nextFocus.current];
      input?.focus();
      if (input && caretAt.current !== null) input.setSelectionRange(caretAt.current, caretAt.current);
      nextFocus.current = null; caretAt.current = null;
    }
  }, [text, props.active]);

  useEffect(() => {
    const resize = () => inputs.current.forEach(input => { if (input) { input.style.height = "auto"; input.style.height = `${input.scrollHeight}px`; } });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const suggest = useMemo(() => createCategorySuggester(props.history), [props.history]);
  const parsed = parseTransactionLines(text, new Date(), props.defaultDate);
  const rows = parsed.map(localRow => {
    let row = localRow;
    const draft = choices[row.line]?.transaction;
    if (draft) {
      try {
        const validated = validateParsing({ transactions: [draft], questions: [] }, props.categories.map(c => ({ id: c.id, name: c.name })), props.accounts.map(a => ({ id: a.id, name: a.label })));
        row = { line: row.line, source: row.source, transaction: validated.transactions[0] };
      } catch { /* Stale/corrupt drafts fall back to the local parser. */ }
    }
    // An explicit choice wins, then the category learned from past transactions. With neither,
    // the line waits for a pick rather than silently landing in the form's category.
    const dateChoice = choices[row.line]?.date;
    if (dateChoice && row.transaction) row = { ...row, transaction: { ...row.transaction, date: dateChoice } };
    const categoryId = choices[row.line]?.categoryId || (row.transaction ? suggest(row.transaction.name, props.categories) : null) || "";
    const category = props.categories.find(item => item.id === categoryId);
    const categoryDefault = props.accounts.find(a => a.id.replaceAll("-", "") === category?.defaultAccount?.replaceAll("-", ""))?.id;
    const accountId = choices[row.line]?.accountId ?? categoryDefault ?? props.defaultAccountId;
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
    return gate.shortfall > 0 ? [{ category, belowZero: amount - (available ?? 0) }] : [];
  });
  // Lines that don't fit are still real spending: they save once confirmed and the category goes below zero.
  const overspentIds = new Set(budgetErrors.map(({ category }) => category.id));
  // A line is ready once it has an amount, an account and (for spending) a category. Ready lines save on their own;
  // the rest stay written until their tags are picked.
  const isReady = (row: (typeof rows)[number]) => !!row.transaction && !!row.account && (row.transaction.type === "Income" || !!row.category);
  const readyRows = rows.filter(isReady);
  const waitingCount = rows.length - readyRows.length;
  const ready = readyRows.length > 0 && readyRows.length <= 50;
  const total = rows.reduce((sum, row) => sum + ((row.transaction?.amount ?? 0) * (row.transaction?.type === "Income" ? 1 : -1)), 0);

  // Save with nothing ready: instead of a dead button, open the first tag still to pick.
  const showWhatsMissing = () => {
    const first = rows.find(row => !isReady(row));
    if (!first?.transaction) { inputs.current[(first?.line ?? 1) - 1]?.focus(); return; }
    const index = first.line - 1;
    const kind = first.transaction.type === "Expense" && !first.category ? "category" : "account";
    const tag = document.querySelector<HTMLElement>(`[aria-label^="${kind === "category" ? "Category" : "Account"} for line ${first.line}:"]`);
    setActiveLine(index);
    haptic("warning");
    if (tag) { pickerAnchor.current = tag; setCatSearch(""); setPicker({ line: index, kind }); tag.focus(); }
  };

  const save = async () => {
    if (!ready || lock.current) return;
    lock.current = true;
    setBusy(true);
    props.onBusyChange(true);
    setFeedback(null);
    setProgress(0);
    let confirmed = 0;
    const toSave = readyRows;
    savingTotal.current = toSave.length;
    // What stays written after `count` of the ready lines are saved: every other line, in its original order.
    const keptAfter = (count: number) => {
      const saved = new Set(toSave.slice(0, count).map(row => row.line));
      return rows.filter(row => !saved.has(row.line));
    };
    const keptChoices = (kept: typeof rows) => {
      const next: Record<number, Choice> = {};
      kept.forEach((item, index) => { next[index + 1] = { ...choices[item.line], categoryId: item.category?.id, accountId: item.account?.id }; });
      return next;
    };
    const result = await saveTypedBatch(toSave, async row => {
      await props.onSave({ ...row.transaction!, accountId: row.account!.id, categoryId: row.transaction!.type === "Expense" ? row.category!.id : "", ...(row.category && overspentIds.has(row.category.id) ? { overspend: true } : {}) });
    }, row => {
      if (row.transaction?.type === "Expense" && row.category) {
        const current = remainingBudgets.current[row.category.id] ?? row.category.available;
        if (current !== null) remainingBudgets.current[row.category.id] = current - row.transaction!.amount;
      }
      confirmed++;
      const pending = keptAfter(confirmed);
      const pendingChoices = keptChoices(pending);
      try {
        if (pending.length) localStorage.setItem(props.draftKey, JSON.stringify({ text: pending.map(item => item.source).join("\n"), choices: pendingChoices }));
        else localStorage.removeItem(props.draftKey);
      } catch {}
      setProgress(confirmed);
    });
    // Confirmed saves leave the draft immediately. Failed and unattempted rows retain their choices.
    const remaining = keptAfter(result.saved);
    updateDraft(remaining.map(row => row.source).join("\n"), keptChoices(remaining));
    // A clean save is confirmed by the page's toast (onComplete); only a failure stays on the sheet as a Banner.
    if (result.error) setFeedback({ error: true, message: `${result.saved ? `${result.saved} saved. ` : ""}${result.error} Remaining lines are kept. Check History before retrying if the connection was interrupted.` });
    haptic(result.error ? "error" : "success");
    setBusy(false);
    props.onBusyChange(false);
    lock.current = false;
    if (result.saved) props.onComplete(result.saved);
  };

  const lines = text.split(/\r?\n/);
  // Only lines nothing has read yet: the phone couldn't parse them and no AI draft is attached.
  const unread = lines.flatMap((source, index) => source.trim() && !rows.find(row => row.line === index + 1)?.transaction ? [source] : []);
  const unreadCount = unread.length + receipts.length;
  const readLine = async (source: string, signal: AbortSignal) => {
    const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, signal,
      body: JSON.stringify({ action: "parse", text: source, defaultDate: props.defaultDate, categories: props.categories.map(c => ({ id: c.id, name: c.name, defaultAccountId: c.defaultAccount })), accounts: props.accounts.map(a => ({ id: a.id, name: a.label })), defaultAccountId: props.defaultAccountId }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not read this line.");
    return validateParsing(data, props.categories.map(c => ({ id: c.id, name: c.name })), props.accounts.map(a => ({ id: a.id, name: a.label })));
  };
  const readReceipt = async (id: string, signal: AbortSignal) => {
    const photo = await loadReceipt(id);
    if (!photo) throw new Error("That receipt photo is gone. Take it again.");
    const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, signal,
      body: JSON.stringify({ action: "receipt", image: { mimeType: photo.mimeType, data: photo.data }, defaultDate: props.defaultDate, categories: props.categories.map(c => ({ id: c.id, name: c.name, defaultAccountId: c.defaultAccount })), accounts: props.accounts.map(a => ({ id: a.id, name: a.label })), defaultAccountId: props.defaultAccountId }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not read this receipt.");
    return validateParsing(data, props.categories.map(c => ({ id: c.id, name: c.name })), props.accounts.map(a => ({ id: a.id, name: a.label })));
  };
  // Drafts are only sent when you press Read: unread lines and receipt photos, never while offline.
  const parseWithGemini = async () => {
    const targets = [...new Set(unread)];
    const photos = receipts.map(r => r.id);
    if ((!targets.length && !photos.length) || !online || lock.current || !props.accounts.length || !props.categories.length) return;
    lock.current = true;
    setParsing(true);
    setPicker(null);
    setFeedback(null);
    setReadingLines(new Set([...targets, ...photos.map(id => `receipt:${id}`)]));
    const controller = new AbortController();
    parseAbort.current = controller;
    const problems: string[] = [];
    // A few lines at a time; each one is replaced in place as soon as its answer arrives.
    const queue = [...targets];
    const worker = async () => {
      for (let source = queue.shift(); source !== undefined; source = queue.shift()) {
        try {
          const result = await readLine(source, controller.signal);
          if (result.questions.length) problems.push(result.questions.join(" "));
          else if (result.transactions.length) {
            const current = textRef.current.split(/\r?\n/);
            const at = current.indexOf(source);
            if (at >= 0) {
              const replacement = result.transactions.map(t => [t.name, `${t.type === "Income" ? "+" : ""}${t.amount}`, writtenDate(t.date, props.defaultDate)].filter(Boolean).join(" "));
              const nextText = [...current.slice(0, at), ...replacement, ...current.slice(at + 1)].join("\n");
              const nextChoices = reconcileTypedChoices(textRef.current, nextText, choicesRef.current);
              result.transactions.forEach((transaction, offset) => { nextChoices[at + offset + 1] = { transaction, categoryId: transaction.categoryId ?? suggest(transaction.name, props.categories) ?? undefined, accountId: transaction.accountId ?? undefined }; });
              updateDraft(nextText, nextChoices);
            }
          }
        } catch (error) {
          if (!controller.signal.aborted) problems.push(error instanceof Error ? error.message : "Could not reach Gemini. Your text is kept.");
        }
        setReadingLines(current => { const next = new Set(current); next.delete(source!); return next; });
      }
    };
    const photoQueue = [...photos];
    // Receipts add their lines at the end of what's written, then the photo is deleted from the phone.
    const photoWorker = async () => {
      for (let id = photoQueue.shift(); id !== undefined; id = photoQueue.shift()) {
        try {
          const result = await readReceipt(id, controller.signal);
          if (result.questions.length) problems.push(result.questions.join(" "));
          else if (result.transactions.length) {
            const current = textRef.current.split(/\r?\n/);
            while (current.length && !current[current.length - 1].trim()) current.pop();
            const at = current.length;
            const added = result.transactions.map(t => [t.name, `${t.type === "Income" ? "+" : ""}${t.amount}`, writtenDate(t.date, props.defaultDate)].filter(Boolean).join(" "));
            const nextText = [...current, ...added].join("\n");
            const nextChoices = reconcileTypedChoices(textRef.current, nextText, choicesRef.current);
            result.transactions.forEach((transaction, offset) => { nextChoices[at + offset + 1] = { transaction, categoryId: transaction.categoryId ?? suggest(transaction.name, props.categories) ?? undefined, accountId: transaction.accountId ?? undefined }; });
            updateDraft(nextText, nextChoices);
            removeReceipt(id);
          }
        } catch (error) {
          if (!controller.signal.aborted) problems.push(error instanceof Error ? error.message : "Could not reach Gemini. The photo is kept.");
        }
        setReadingLines(current => { const next = new Set(current); next.delete(`receipt:${id}`); return next; });
      }
    };
    await Promise.all([...Array.from({ length: Math.min(3, targets.length) }, worker), ...Array.from({ length: Math.min(2, photos.length) }, photoWorker)]);
    if (!controller.signal.aborted && problems.length) setFeedback({ error: true, message: [...new Set(problems)].join(" ") });
    setReadingLines(new Set());
    setParsing(false);
    lock.current = false;
  };
  const removeLine = (index: number) => {
    const nextText = lines.length > 1 ? lines.filter((_, line) => line !== index).join("\n") : "";
    updateDraft(nextText, reconcileTypedChoices(text, nextText, choices));
    haptic("selection");
  };
  const editLine = (index: number, value: string) => {
    const updated = [...lines];
    updated.splice(index, 1, ...value.split(/\r?\n/));
    const nextText = updated.join("\n");
    if (nextText.length > 10000) return;
    if (value.includes("\n")) nextFocus.current = index + value.split(/\r?\n/).length - 1;
    updateDraft(nextText, reconcileTypedChoices(text, nextText, choices));
    setFeedback(null);
  };
  const openPicker = (event: MouseEvent<HTMLElement>, line: number, kind: "category" | "account" | "date") => {
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

  const settled = (row: (typeof rows)[number] | undefined) => !!row?.transaction && !!row.account && (row.transaction.type === "Income" || !!row.category);
  return <div className="typed composer-pane" style={{ display: props.active ? "flex" : "none" }}>
    <p id="typed-help" className="sr-only">Write in MAD, one transaction per line, then choose Read. Use salary, received, or + for income. Use today, yesterday, a weekday, or YYYY-MM-DD for dates. Review categories and accounts before saving.</p>
    <div className="typed-scroll">
      {/* Outside the writing lines, like prompt-kit: only while nothing is written. */}
      {!text.trim() && (props.suggestions?.length ?? 0) > 0 && <div className="prompt-suggestions typed-suggestions" role="group" aria-label="Suggestions">
        {props.suggestions!.map(suggestion => <button key={suggestion} type="button" className="prompt-suggestion" onClick={() => {
          haptic("selection");
          updateDraft(suggestion, {});
          nextFocus.current = 0;
          caretAt.current = suggestion.length;
        }}>{suggestion}</button>)}
      </div>}
      {receipts.length > 0 && <ul className="typed-receipts" aria-label="Receipt photos">
        {receipts.map(r => {
          const reading = readingLines.has(`receipt:${r.id}`);
          return <li key={r.id}><SwipeToDelete flat disabled={reading} deleteLabel="Remove receipt photo" surface="var(--surface)" onDelete={() => { removeReceipt(r.id); return true; }}>
            <div className="typed-line typed-receipt" data-reading={reading || undefined}>
            {thumbs[r.id] ? <img src={thumbs[r.id]} alt="" /> : <span className="typed-receipt-thumb" aria-hidden="true" />}
            <span className="typed-receipt-text"><span className="typed-reading-target">Receipt</span><small className={reading ? "typed-reading" : undefined}>{reading ? "reading" : online ? "waiting for Read" : "kept, offline"}</small></span>
            {!reading && <button type="button" className="typed-receipt-remove" aria-label="Remove receipt photo" disabled={busy || parsing} onClick={() => removeReceipt(r.id)}><XIcon size={16} aria-hidden="true" /></button>}
            </div></SwipeToDelete>
          </li>;
        })}
      </ul>}
      <div role="group" aria-label="Write transactions" className="typed-lines">
        {lines.map((source, index) => {
          const row = rows.find(item => item.line === index + 1);
          const transaction = row?.transaction;
          const income = transaction?.type === "Income";
          // Thinking: a line shimmers while the AI reads it, and settles when its own answer comes back.
          const reading = !!source.trim() && readingLines.has(source);
          const waiting = !!source.trim() && (!transaction || !settled(row));
          const otherAccount = !!row?.account && row.account.id !== props.defaultAccountId;
          // Swipe a line left to remove it. Rows are keyed by position, so the row resets for the line that moves up.
          return <SwipeToDelete key={index} flat resetAfterDelete disabled={busy || reading || (!source.trim() && lines.length === 1)} deleteLabel={`Remove line ${index + 1}`} surface="var(--surface)"
            onDelete={() => { removeLine(index); return true; }}>
          <div className="typed-line" data-reading={reading || undefined} onFocus={() => setActiveLine(index)}>
            <div className="typed-line-main">
              {/* Your words stay as written; the words that move an entry are marked where you wrote them. */}
              <div className="typed-input-wrap">
                <div className="typed-marks" aria-hidden="true">{markWords(source, props.accounts)}{"\u200b"}</div>
                <textarea className="typed-entry-line" ref={element => { inputs.current[index] = element; }} aria-label={`Transaction line ${index + 1}`} aria-describedby="typed-help" rows={1} disabled={busy || reading} value={source}
                  placeholder={index === 0 ? "coffee 25 yesterday" : ""}
                  onFocus={() => setFocusedLine(index)} onBlur={() => setFocusedLine(null)}
                  onChange={event => editLine(index, event.target.value)}
                  onKeyDown={event => {
                    if (event.nativeEvent.isComposing) return;
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const element = event.currentTarget;
                      editLine(index, `${source.slice(0, element.selectionStart)}\n${source.slice(element.selectionEnd)}`);
                    } else if (event.key === "Backspace" && index > 0 && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0) {
                      // At the start of a line, Backspace joins it to the line above (an empty line just goes).
                      event.preventDefault();
                      const previous = lines[index - 1];
                      const joined = [...lines.slice(0, index - 1), previous + source, ...lines.slice(index + 1)].join("\n");
                      nextFocus.current = index - 1;
                      caretAt.current = previous.length;
                      updateDraft(joined, reconcileTypedChoices(text, joined, choices));
                    } else if ((event.key === "ArrowUp" && index > 0 && event.currentTarget.selectionStart === 0) || (event.key === "ArrowDown" && index < lines.length - 1 && event.currentTarget.selectionEnd === source.length)) {
                      // Arrows move between lines from a line's edges, like one text field.
                      event.preventDefault();
                      const target = inputs.current[index + (event.key === "ArrowUp" ? -1 : 1)];
                      target?.focus();
                      const end = event.key === "ArrowUp" ? target?.value.length ?? 0 : 0;
                      target?.setSelectionRange(end, end);
                    }
                  }} />
              </div>
              {/* The margin: the amount, then a dot. Solid = settled, hollow amber = waiting on you. */}
              <span className="typed-margin">
                {reading ? <span className="typed-hint typed-reading">reading</span>
                  : transaction
                  ? <button type="button" className="typed-amount" data-income={income || undefined} disabled={busy || parsing || !props.onOpenInForm} aria-label={`${income ? "Income" : "Expense"} ${transaction.amount} MAD. Open all fields`}
                      onClick={() => {
                        const remaining = lines.filter((_, line) => line !== index).join("\n");
                        props.onOpenInForm?.(source, { type: transaction.type, name: transaction.name, amount: transaction.amount, date: transaction.date, categoryId: row?.category?.id, accountId: row?.account?.id });
                        updateDraft(remaining, reconcileTypedChoices(text, remaining, choices));
                      }}>{income ? "+" : "−"}{fmt(transaction.amount)}</button>
                  : focusedLine === index && source.trim() ? <span className="typed-hint">return</span> : null}
                {source.trim() && !reading && <span className="typed-dot" data-waiting={waiting || undefined} aria-label={waiting ? "Needs your input" : "Ready"} />}
              </span>
            </div>
            {transaction && !reading && <div className="typed-tags">
              {!income && <button type="button" className="typed-tag" data-empty={!row?.category || undefined} disabled={busy || reading} aria-haspopup="dialog" aria-expanded={picker?.line === index && picker.kind === "category"} aria-label={`Category for line ${index + 1}: ${row?.category?.name ?? "none"}`} onClick={event => openPicker(event, index, "category")}>
                {row?.category?.name ?? "category?"}
              </button>}
              {(activeLine === index || otherAccount || !row?.account) && <button type="button" className="typed-tag" data-empty={!row?.account || undefined} data-kind={otherAccount ? "account" : undefined} disabled={busy || reading} aria-haspopup="dialog" aria-expanded={picker?.line === index && picker.kind === "account"} aria-label={`Account for line ${index + 1}: ${row?.account?.label ?? "none"}`} onClick={event => openPicker(event, index, "account")}>
                {row?.account?.label ?? "account?"}
              </button>}
              {(activeLine === index || transaction.date !== props.defaultDate) && <button type="button" className="typed-tag" data-kind={transaction.date !== props.defaultDate ? "day" : undefined} disabled={busy || reading} aria-haspopup="dialog" aria-expanded={picker?.line === index && picker.kind === "date"} aria-label={`Date for line ${index + 1}: ${dayLabel(transaction.date)}`} onClick={event => openPicker(event, index, "date")}>
                {dayLabel(transaction.date).toLowerCase()}
              </button>}
            </div>}
            {row?.error && focusedLine !== index && !parsing && <p className="typed-note">{row.error}</p>}
          </div></SwipeToDelete>;
        })}
      </div>
      {rows.some(row => row.transaction) && <p className="typed-hint-line">Tap a tag to fix it, tap the amount for all fields</p>}
      <div onClick={focusEnd} aria-hidden="true" style={{ flex: "1 0 80px", cursor: "text" }} />

      {rows.length > 50 && <Banner tone="danger" role="alert" compact>Add up to 50 transactions at a time.</Banner>}
      {budgetErrors.map(({ category, belowZero }) => <Banner key={category.id} tone="warning" compact style={{ marginTop: 12 }}><strong>{category.name}</strong> goes <strong><Money value={Math.round(belowZero)} /></strong> below zero.</Banner>)}
      {props.accounts.filter(account => account.estimatedActualBalance != null).map(account => {
        const spending = rows.filter(row => row.account?.id === account.id && row.transaction?.type === "Expense").reduce((sum, row) => sum + (row.transaction?.amount ?? 0), 0);
        return spending > account.estimatedActualBalance! ? <Banner key={account.id} tone="warning" role="alert" compact style={{ marginTop: 12 }}>
          {account.label}: exceeds actual funds by <Money value={spending - account.estimatedActualBalance!} />
        </Banner> : null;
      })}
      {feedback?.error && <Banner tone="danger" role="alert" compact style={{ marginTop: 12 }}>{feedback.message}</Banner>}
    </div>
    {/* One action: Read while any line still needs reading, then Save. */}
    <div className="typed-footer">
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={event => { void addReceipt(event.target.files?.[0]); event.target.value = ""; }} />
      <button type="button" className="typed-camera" aria-label="Add a receipt photo" disabled={busy || parsing} onClick={() => camera.current?.click()}><CameraIcon size={20} aria-hidden="true" /></button>
      <span className="typed-total">{!online ? <span>Offline, kept as draft</span> : rows.length > 0 && waitingCount > 0 && readyRows.length > 0 && !parsing ? <span>{waitingCount} waiting</span> : rows.length > 0 ? <>{total < 0 ? "−" : total > 0 ? "+" : ""}{fmt(Math.abs(Math.round(total)))} <span>total</span></> : null}</span>
      {/* Read only while some line hasn't been read; after that it's Save, waiting on any tag still to pick. */}
      {unreadCount > 0 || parsing || !rows.length
        ? <Button variant={!unreadCount || !online ? "secondary" : "primary"} aria-busy={parsing} disabled={!unreadCount || !online || busy || parsing || !props.accounts.length || !props.categories.length} onClick={parseWithGemini}>{parsing ? `Reading ${readingLines.size}…` : unreadCount ? `Read ${unreadCount}` : "Read"}</Button>
        : <Button variant={!ready || !online ? "secondary" : "primary"} icon={<CheckIcon />} disabled={!online} onClick={ready ? save : showWhatsMissing}>{budgetErrors.length ? "Save anyway" : `Save ${readyRows.length}`}</Button>}
    </div>
    <PickerPopover open={picker !== null} title={picker?.kind === "account" ? "Account" : picker?.kind === "date" ? "Date" : "Category"} onClose={() => setPicker(null)} align="left" placement="bottom" size={picker?.kind === "date" ? "calendar" : "choice"} zIndex={140} anchorRef={pickerAnchor}>
      {picker?.kind === "date" && <DateCalendar value={pickerRow?.transaction?.date ?? props.defaultDate} onChange={date => choose(picker.line, { date })} />}
      {picker?.kind === "account" && <AccountOptionList accounts={props.accounts} selectedId={pickerRow?.account?.id} onSelect={accountId => choose(picker.line, { accountId })} />}
      {picker?.kind === "category" && <CategoryOptionList categories={filterCategories(props.categories, catSearch)} selectedId={pickerRow?.category?.id} onSelect={category => choose(picker.line, { categoryId: category.id })} search={catSearch} onSearchChange={setCatSearch} />}
    </PickerPopover>
    <span role="status" className="sr-only">{parsing ? "Reading your transactions" : ""}</span>
  </div>;
}

/** Day and account words, marked in place with their colour. Amounts, merchants and categories stay plain. */
const DAY_WORDS = /\b(?:day before yesterday|today|yesterday|tomorrow|\d+ days? ago|(?:last |on )?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|\d{4}-\d{2}-\d{2})\b/gi;
function markWords(source: string, accounts: Account[]) {
  const names = accounts.map(account => account.label.split(/\s+/)[0]).filter(word => word.length >= 3).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`${DAY_WORDS.source}${names.length ? `|\\b(?:(?:from|on|with) )?(?:${names.join("|")})\\b` : ""}`, "gi");
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(source.slice(last, start));
    parts.push(<mark key={start} data-kind={new RegExp(`^${DAY_WORDS.source}$`, "i").test(match[0]) ? "day" : "account"}>{match[0]}</mark>);
    last = start + match[0].length;
  }
  if (last < source.length) parts.push(source.slice(last));
  return parts;
}

/** A date the way you'd write it, so it can be edited by typing: left out on the default day, then today,
 * yesterday or a weekday within the last week, and only further back as YYYY-MM-DD. */
function writtenDate(date: string, defaultDate: string) {
  if (date === defaultDate) return "";
  const now = today();
  if (date === now) return "today";
  if (date === shiftDate(now, -1)) return "yesterday";
  for (let back = 2; back <= 6; back++) {
    if (date === shiftDate(now, -back)) return new Date(`${date}T12:00:00`).toLocaleDateString("en", { weekday: "long" }).toLowerCase();
  }
  return date;
}

const dayLabel = (date: string) =>
  date === today() ? "Today" : date === shiftDate(today(), -1) ? "Yesterday" : date === shiftDate(today(), 1) ? "Tomorrow" : fmtDate(date);
