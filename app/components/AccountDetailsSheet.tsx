"use client";
import { accountIconSource, categoryIconSource } from "../../lib/category-icons";

import { SheetHeader } from "./ui/SheetLayout";

import { changeBalanceCheck } from "../../lib/balance-check-actions";
import { money, type BalanceCheckView } from "../../lib/balance-checks";
import { Skeleton, SkeletonRegion } from "./ui/Skeleton";
import { DatePicker, MonthPicker } from "./DatePicker";
import { ChoicePicker } from "./ChoicePicker";

import { useState, useMemo, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BottomSheet } from "./ui/BottomSheet";
import { CategoryIcon } from "./ui/CategoryIcon";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import "./sheet-components.css";
import { ScreenChip } from "./ui/ScreenChip";
import { EmptyState } from "./ui/EmptyState";
import { LiquidSegments } from "./ui/LiquidGlass";
import { SavingCover, useBlockingSave } from "./ui/SavingCover";
import { TransactionRow } from "./ui/TransactionRow";
import { Money, Currency } from "./Money";
import type { Account, Category, Transaction } from "./app-types";
import { fmt, fmtDate, monthBounds, parseAmount, assignableOf } from "./app-utils";
import {
  BanknoteIcon,
  TransferIcon,
  ScaleIcon,
  XIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  PlusIcon,
  TrendingUpIcon,
} from "./ui/icons";

type AccountDetailsSheetProps = {
  contributions?: ReactNode;
  open: boolean;
  savedCountForReview?: number;
  startBalanceCheck?: boolean;
  balanceCheck?: BalanceCheckView;
  onBalanceCheckChanged?: () => Promise<void>;
  onBalanceCheckSaved?: (accountId: string, check: BalanceCheckView | null) => void;
  account: Account | null;
  transactions: Transaction[];
  categories: Category[];
  homeMonth: string;
  onClose: () => void;
  onMove: (account: Account) => void;
  onIncome: (account: Account) => void;
  onReconcileSuccess: (message: string) => void;
  onTransactionsChanged?: () => void;
  /** Desktop Accounts panel: render into this pane instead of opening a dialog. */
  embedIn?: HTMLElement | null;
};

type AddedTxn = {
  id: string;
  name: string;
  amount: number;
  type: "Expense" | "Income";
  date: string;
};

const CURRENT_MONTH = () => new Date().toISOString().slice(0, 7);

function fmtMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function AccountDetailsSheet({
  contributions,
  open,
  savedCountForReview,
  startBalanceCheck = false,
  balanceCheck,
  onBalanceCheckChanged,
  onBalanceCheckSaved,
  account,
  transactions,
  categories,
  homeMonth,
  onClose,
  onMove,
  onIncome,
  onReconcileSuccess,
  onTransactionsChanged,
  embedIn,
}: AccountDetailsSheetProps) {
  const reducedMotion = useReducedMotion();
  const [showReconcile, setShowReconcile] = useState(false);
  const [checkVersion, setCheckVersion] = useState<string | null>(null);
  // Every write here (check save or resolve, reconcile, missed transaction, undo) blocks the sheet with one cover.
  const save = useBlockingSave();
  const [saveLabel, setSaveLabel] = useState("Saving");
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [actualBalance, setActualBalance] = useState("");
  const [reconcileError, setReconcileError] = useState("");
  const [liveBalance, setLiveBalance] = useState(0);
  const [addedTxns, setAddedTxns] = useState<AddedTxn[]>([]);
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [txnType, setTxnType] = useState<"Expense" | "Income">("Expense");
  const [txnAmount, setTxnAmount] = useState("");
  const [txnName, setTxnName] = useState("");
  const [txnCategoryId, setTxnCategoryId] = useState("");
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [txnError, setTxnError] = useState("");

  // Balance history chart
  const [showChart, setShowChart] = useState(false);
  const [chartMonth, setChartMonth] = useState(homeMonth);
  const [chartTxns, setChartTxns] = useState<Transaction[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Reset when sheet opens for a (possibly different) account
  useEffect(() => {
    if (open) {
      setChartMonth(homeMonth);
      setShowChart(false);
      setChartTxns([]);
      setLiveBalance(account?.balance ?? 0);
      setShowReconcile(startBalanceCheck);
      setCheckVersion(balanceCheck?.version ?? null);
      setCheckMessage(null);
      setActualBalance(balanceCheck ? String(balanceCheck.estimatedActual) : savedCountForReview != null ? String(savedCountForReview) : "");
      setReconcileError("");
      setAddedTxns([]);
      setShowAddTxn(false);
      setTxnType("Expense");
      setTxnAmount("");
      setTxnName("");
      setTxnCategoryId("");
      setTxnDate(new Date().toISOString().slice(0, 10));
      setTxnError("");
    }
  }, [open, homeMonth, account?.id]);

  // Fetch transactions for the chart month
  useEffect(() => {
    if (!showChart || !account || !chartMonth) return;
    let cancelled = false;
    setChartLoading(true);
    const { start, end } = monthBounds(`${chartMonth}-01`);
    fetch(`/api/transactions?start=${start}&end=${end}&page_size=200`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const id = account.id;
        const acctTxns = (data.transactions ?? []).filter((t: Transaction) =>
          t.type === "Transfer"
            ? t.fromAccountId === id || t.toAccountId === id
            : t.accountId === id,
        );
        setChartTxns(acctTxns);
        setChartLoading(false);
      })
      .catch(() => { if (!cancelled) setChartLoading(false); });
    return () => { cancelled = true; };
  }, [showChart, chartMonth, account]);

  const chartData = useMemo(() => {
    if (!chartMonth) return { points: [], daysInMonth: 30, todayDay: 30, netChange: 0 };
    const [y, m] = chartMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const todayDay = chartMonth === CURRENT_MONTH() ? new Date().getDate() : daysInMonth;

    const incomeByDay = new Array(daysInMonth + 1).fill(0);
    const expenseByDay = new Array(daysInMonth + 1).fill(0);
    const id = account?.id;
    for (const t of chartTxns) {
      if (!t.date) continue;
      const day = parseInt(t.date.split("-")[2], 10);
      if (day < 1 || day > daysInMonth) continue;
      if (t.type === "Transfer") {
        // transfer in → balance goes up; transfer out → balance goes down
        if (t.toAccountId === id) incomeByDay[day] += t.amount;
        else expenseByDay[day] += t.amount;
      } else if (t.type === "Income") {
        incomeByDay[day] += t.amount;
      } else {
        expenseByDay[day] += t.amount;
      }
    }

    // For current month derive the actual start balance; for past months start from 0 (net movement)
    const totalIn  = incomeByDay.reduce((s, v) => s + v, 0);
    const totalOut = expenseByDay.reduce((s, v) => s + v, 0);
    const isNow = chartMonth === CURRENT_MONTH();
    const startBalance = isNow ? (account?.balance ?? 0) + totalOut - totalIn : 0;

    let balance = startBalance;
    const points = Array.from({ length: todayDay + 1 }, (_, d) => {
      if (d > 0) balance = balance + incomeByDay[d] - expenseByDay[d];
      return { day: d, balance: Math.round(balance) };
    });
    const netChange = Math.round((points[points.length - 1]?.balance ?? 0) - startBalance);
    return { points, daysInMonth, todayDay, netChange };
  }, [chartTxns, chartMonth, account]);

  const xTicks = [1, Math.round(chartData.daysInMonth / 2), chartData.daysInMonth]
    .filter(t => t <= chartData.todayDay);

  const handleClose = () => {
    if (save.saving) return;
    setShowReconcile(false);
    setActualBalance("");
    setReconcileError("");
    setShowChart(false);
    setChartTxns([]);
    setShowAddTxn(false);
    setAddedTxns([]);
    setTxnError("");
    onClose();
  };

  const reconcileBackRef = useRef<HTMLButtonElement>(null);
  const checkButtonRef = useRef<HTMLButtonElement>(null);
  const closeReconcile = () => {
    if (save.saving) return;
    setShowReconcile(false);
    setActualBalance("");
    setReconcileError("");
    setShowAddTxn(false);
    setAddedTxns([]);
    setTxnError("");
    // Back to the account: focus returns to the action that opened the step.
    requestAnimationFrame(() => checkButtonRef.current?.focus({ preventScroll: true }));
  };

  // homeMonth transactions involving this account — expenses/income by accountId,
  // transfers by fromAccountId or toAccountId
  const monthTxns = useMemo(() => {
    if (!account) return [];
    const id = account.id;
    return transactions.filter(t => {
      if (!t.date?.startsWith(homeMonth)) return false;
      if (t.type === "Transfer") return t.fromAccountId === id || t.toAccountId === id;
      return t.accountId === id;
    });
  }, [account, transactions, homeMonth]);

  // Category spend breakdown — expenses only (transfers have no category)
  const catBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTxns) {
      if (!t.category || (t.type && t.type !== "Expense")) continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([catId, total]) => ({ cat: categories.find(c => c.id === catId) ?? null, total }))
      .filter(({ cat }) => cat !== null)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [monthTxns, categories]);

  const maxCatSpend = catBreakdown[0]?.total ?? 1;

  // Out = expenses + transfers out; In = income + transfers in
  const totalSpentFromAcct = useMemo(
    () => monthTxns
      .filter(t =>
        (!t.type || t.type === "Expense") ||
        (t.type === "Transfer" && t.fromAccountId === account?.id),
      )
      .reduce((s, t) => s + t.amount, 0),
    [monthTxns, account],
  );
  const totalIncomeToAcct = useMemo(
    () => monthTxns
      .filter(t =>
        t.type === "Income" ||
        (t.type === "Transfer" && t.toAccountId === account?.id),
      )
      .reduce((s, t) => s + t.amount, 0),
    [monthTxns, account],
  );

  // All activity for this month, sorted newest first
  const allActivityTxns = useMemo(() => {
    return [...monthTxns].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  }, [monthTxns]);

  // Reconcile
  const parsedActual = parseAmount(actualBalance) ?? NaN;
  const difference = Number.isFinite(parsedActual) ? parsedActual - liveBalance : null;
  const isFullyReconciled = difference !== null && Math.abs(difference) < 0.01;

  const activeCategories = useMemo(
    () => categories.filter(c => !c.snoozed && !c.archived),
    [categories],
  );
  // A missed expense found by counting was really spent: when its category can't cover it, it still
  // saves once confirmed and the category goes below zero (design.md, "Overspending").
  const txnCategory = txnType === "Expense" ? activeCategories.find(c => c.id === txnCategoryId) : undefined;
  const txnParsed = parseAmount(txnAmount) ?? 0;
  const txnBelowZero = txnCategory?.available != null && txnParsed > txnCategory.available + 0.005 ? txnParsed - txnCategory.available : 0;

  const changeCheck = async (action: "save" | "close") => {
    if (!account || save.saving) return;
    setReconcileError(""); setCheckMessage(null); setSaveLabel("Saving");
    try {
      await save.run(() => changeBalanceCheck({ action, accountId: account.id, actualBalance: parsedActual, expectedVersion: checkVersion }, {
        committed: check => {
          setCheckVersion(check?.version ?? null);
          onBalanceCheckSaved?.(account.id, check);
          setCheckMessage(action === "save" ? "Balance check saved. Transactions unchanged." : "Balance check resolved.");
        },
        refresh: onBalanceCheckChanged,
        refreshFailed: () => setCheckMessage(action === "save" ? "Balance check saved. Refresh to update other checks." : "Balance check resolved. Refresh to update other checks."),
      }));
    } catch (error) { setReconcileError(error instanceof Error ? error.message : "Could not save the check."); }
  };

  const submitReconcile = async () => {
    if (!account || !Number.isFinite(parsedActual)) return;
    setReconcileError(""); setSaveLabel("Saving");
    try {
      await save.run(async () => {
      const res = await fetch("/api/reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          actualBalance: parsedActual,
          currentBalance: liveBalance,
          date: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not reconcile");
      // The reconciliation is saved; a failed refresh of other checks must not read as a failed save.
      try { await onBalanceCheckChanged?.(); } catch { /* the page refresh reports its own errors */ }
      });
      // The page's toast is the only confirmation; the step closes straight away.
      onReconcileSuccess(`${account.label} reconciled`);
      setShowReconcile(false);
      setActualBalance("");
      setAddedTxns([]);
      setShowAddTxn(false);
      requestAnimationFrame(() => checkButtonRef.current?.focus({ preventScroll: true }));
    } catch (e: unknown) {
      setReconcileError(e instanceof Error ? e.message : "Could not reconcile. The balance is unchanged.");
    }
  };

  const submitAddTxn = async () => {
    if (!account) return;
    const amt = parseAmount(txnAmount) ?? NaN;
    if (!Number.isFinite(amt) || amt <= 0) {
      setTxnError("Enter a valid amount");
      return;
    }
    if (txnType === "Expense" && !txnCategoryId) {
      setTxnError("Choose a category");
      return;
    }
    setTxnError(""); setSaveLabel("Saving");
    const name = txnName.trim() || (txnType === "Expense" ? "Missed expense" : "Missed income");
    try {
      await save.run(async () => {
      const res = await fetch(txnType === "Expense" ? "/api/expense" : "/api/monthly-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          txnType === "Expense"
            ? { name, amount: amt, accountId: account.id, categoryId: txnCategoryId, date: txnDate, ...(txnBelowZero > 0 ? { overspend: true } : {}) }
            : { name, amount: amt, accountId: account.id, date: txnDate },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add transaction");
      const id = txnType === "Expense" ? data.id : data.income?.id;
      setAddedTxns(prev => [...prev, { id, name, amount: amt, type: txnType, date: txnDate }]);
      setLiveBalance(prev => prev + (txnType === "Income" ? amt : -amt));
      setTxnAmount("");
      setTxnName("");
      if (checkVersion) {
        // This is a missing transaction already reflected in the physical count.
        try {
        const response = await fetch("/api/balance-checks", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "include", accountId: account.id, expectedVersion: checkVersion, transactionId: id }) });
        const result = await response.json();
        if (response.ok) setCheckVersion(result.check.version);
        else setTxnError(`Transaction saved. ${result.error ?? "Update the actual count before relying on this check."}`);
        } catch { setTxnError("Transaction saved. Update the actual balance before relying on this check."); }
        await onBalanceCheckChanged?.();
      }
      onTransactionsChanged?.();
      });
    } catch (e: unknown) {
      setTxnError(e instanceof Error ? e.message : "Could not add transaction");
    }
  };

  const undoAddedTxn = async (id: string) => {
    const removed = addedTxns.find(t => t.id === id);
    if (!removed || save.saving) return;
    setTxnError(""); setSaveLabel("Deleting");
    try {
      await save.run(async () => {
      const response = await fetch("/api/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not undo the transaction.");
      setAddedTxns(prev => prev.filter(t => t.id !== id));
      setLiveBalance(prev => prev - (removed.type === "Income" ? removed.amount : -removed.amount));
      onTransactionsChanged?.();
      await onBalanceCheckChanged?.();
      });
    } catch (error) { setTxnError(error instanceof Error ? error.message : "Could not undo the transaction."); }
  };

  if (!account) return null;

  const isNegative = liveBalance < 0;

  const body = (
      <div className="account-desktop-layout" data-embedded={embedIn ? "" : undefined} style={innerStyle}>

        {/* Header */}
        <SheetHeader className="account-desktop-header" style={headerStyle}>
          <div style={acctIdentityStyle}>
            <div style={iconCircleStyle}><CategoryIcon icon={accountIconSource(account.type)} size={24} /></div>
            <div>
              <h2 style={acctNameStyle}>{account.label}</h2>
              {account.type && <p style={acctTypeStyle}>{account.type}</p>}
            </div>
          </div>
          {!embedIn && <button type="button" className="sheet-close-button" onClick={handleClose} aria-label="Close">
            <XIcon size={20} />
          </button>}
        </SheetHeader>

        <div className="account-desktop-overview">
        {showReconcile ? (
          // Check balance is a step inside this sheet, not a second dialog: it takes the balance panel's place,
          // so the month's activity stays in view to spot a missing transaction.
          <motion.section key="check" aria-label="Check balance" style={reconcilePanelStyle}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 16 }} animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
            <div style={reconcileHeaderStyle}>
              <button type="button" ref={reconcileBackRef} onClick={closeReconcile} aria-label={`Back to ${account.label}`} className="sheet-icon-button"><ChevronLeftIcon size={20} /></button>
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <h3 style={reconcileTitleStyle}>Check balance</h3>
                {balanceCheck && <p style={reconcileHintStyle}>Checked {new Date(balanceCheck.checkedAt).toLocaleDateString("en-GB", { timeZone: "Africa/Casablanca", day: "numeric", month: "short" })}</p>}
              </div>
            </div>
            {/* While a save runs, SavingCover makes the whole sheet read-only: a changed number would no longer match what is being saved. */}
            <div style={reconcileRowStyle}>
              <label style={reconcileFieldStyle}>
                <span style={reconcileLabelStyle}>App balance</span>
                <div style={reconcileReadonlyStyle}>
                  <Money value={liveBalance} />
                </div>
              </label>
              <label style={reconcileFieldStyle}>
                <span style={reconcileLabelStyle}>Actual balance</span>
                <div style={reconcileInputWrapStyle}>
                  <input
                    type="text"
                    value={actualBalance}
                    onChange={e => setActualBalance(e.target.value)}
                    placeholder="0"
                    aria-label="Actual balance"
                    inputMode="decimal"
                    style={reconcileInputStyle}
                    autoFocus
                  />
                  <Currency style={reconcileCurrencyStyle} />
                </div>
              </label>
            </div>

            {difference !== null && (
              <div style={differenceBandStyle(difference)}>
                <span style={differenceLabelStyle}>Difference</span>
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                  {difference > 0 ? "+" : ""}{fmt(Math.round(difference * 100) / 100)}
                </strong>
              </div>
            )}

            {/* Add missed transaction — shrinks the difference above instead of reconciling it away */}
            {((difference !== null && difference !== 0) || showAddTxn || addedTxns.length > 0) && <div style={addTxnSectionStyle}>
              <div style={addTxnHeaderRowStyle}>
                <p style={addTxnHintStyle}>Missing a transaction before this count?</p>
                <Button variant="quiet" size="compact" icon={showAddTxn ? undefined : <PlusIcon />} onClick={() => { setShowAddTxn(v => !v); setTxnError(""); }} style={{ flexShrink: 0 }}>
                  {showAddTxn ? "Cancel" : "Add"}
                </Button>
              </div>

              {showAddTxn && (
                <div style={addTxnFormStyle}>
                  {/* The composer's transaction type control, so the choice is exposed as a selection. */}
                  <LiquidSegments aria-label="Transaction type" value={txnType}
                    onValueChange={value => { if (value === "Expense" || value === "Income") setTxnType(value); }}
                    items={[{ value: "Expense", label: "Expense" }, { value: "Income", label: "Income" }]} />

                  <div style={reconcileInputWrapStyle}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={txnAmount}
                      onChange={e => setTxnAmount(e.target.value)}
                      placeholder="Amount"
                      aria-label="Amount"
                      style={reconcileInputStyle}
                    />
                    <Currency style={reconcileCurrencyStyle} />
                  </div>

                  <input
                    type="text"
                    value={txnName}
                    onChange={e => setTxnName(e.target.value)}
                    placeholder={txnType === "Expense" ? "What was it? (optional)" : "Source (optional)"}
                    aria-label="Description"
                    className="field-input"
                  />

                  {txnType === "Expense" && (
                    <ChoicePicker aria-label="Category"
                      value={txnCategoryId}
                      onChange={e => setTxnCategoryId(e.target.value)}
                    >
                      <option value="">Category…</option>
                      {activeCategories.map(c => (
                        <option key={c.id} value={c.id} data-icon={categoryIconSource(c.icon, c.name)}>{c.name}</option>
                      ))}
                    </ChoicePicker>
                  )}

                  <DatePicker
                    value={txnDate}
                    onChange={e => setTxnDate(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                  />

                  {txnBelowZero > 0 && txnCategory && <Banner tone="warning" compact><strong>{txnCategory.name}</strong> goes <strong>{fmt(Math.round(txnBelowZero))}</strong> below zero.</Banner>}
                  {txnError && <Banner role="alert" tone="danger" compact>{txnError}</Banner>}

                  <Button variant="secondary" block onClick={() => void submitAddTxn()}>
                    {txnBelowZero > 0 ? "Save anyway" : `Add ${txnType.toLowerCase()}`}
                  </Button>
                </div>
              )}

              {addedTxns.length > 0 && (
                <div style={addedListStyle}>
                  {addedTxns.map(t => (
                    <div key={t.id} style={addedRowStyle}>
                      <span style={addedNameStyle}>{t.name}</span>
                      <span style={{
                        ...addedAmtStyle,
                        color: "var(--text2)",
                      }}>
                        {t.type === "Income" ? "+" : "−"}{fmt(t.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => undoAddedTxn(t.id)}
                        aria-label={`Remove ${t.name}`}
                        className="sheet-icon-button sheet-icon-button--muted"
                      >
                        <XIcon size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>}

            {checkMessage && <Banner tone="success" compact role="status">{checkMessage}</Banner>}
            {reconcileError && (
              <Banner role="alert" tone="danger" compact>{reconcileError}</Banner>
            )}
            {(() => {
              // One main button that follows the difference; saving the count for later stays a quiet action.
              const canResolve = Boolean(checkVersion && isFullyReconciled && balanceCheck && money(parsedActual - balanceCheck.estimatedActual) === 0);
              const showSaveLink = Number.isFinite(parsedActual) && !isFullyReconciled;
              return <>
                {canResolve ? (
                  <Button variant="primary" block onClick={() => void changeCheck("close")} style={{ marginTop: 8 }}>Mark resolved</Button>
                ) : (
                  <Button variant="primary" block onClick={() => void submitReconcile()} disabled={!Number.isFinite(parsedActual)} style={{ marginTop: 8 }}>
                    {isFullyReconciled ? "Mark as reconciled" : "Reconcile difference"}
                  </Button>
                )}
                {showSaveLink && (
                  <Button variant="quiet" size="compact" onClick={() => void changeCheck("save")} style={{ alignSelf: "center" }}>
                    {checkVersion ? "Update actual balance" : savedCountForReview != null ? "Confirm balance" : "Save for later"}
                  </Button>
                )}
              </>;
            })()}
          </motion.section>
        ) : (<>
        {/* Balance hero */}
        <div style={heroStyle}>
          <div style={heroTopRowStyle}>
            <p style={heroLabelStyle}>Current balance</p>
            <ScreenChip mode="filter" selected={showChart} onClick={() => setShowChart(v => !v)}
              ariaLabel={showChart ? "Hide balance history" : "Show balance history"} icon={<TrendingUpIcon size={16} />}>
              History
            </ScreenChip>
          </div>
          <p style={{ ...heroValueStyle, color: isNegative ? "var(--danger)" : "var(--text)" }}>
            <Money value={liveBalance} absolute={isNegative} currency animated />
          </p>
          {assignableOf(account) != null && (
            <p style={heroSubStyle}>
              {fmt(assignableOf(account) ?? 0)} unassigned
            </p>
          )}
        </div>

        {contributions}
        {/* Balance history chart */}
        {showChart && (
          <div style={chartPanelStyle}>
            {/* Period filter inside a detail sheet: the shared month chip, not steppers. */}
            <div style={chartNavStyle}>
              <MonthPicker value={chartMonth} max={CURRENT_MONTH()} onChange={event => event.target.value && setChartMonth(event.target.value)} aria-label="Balance history month" variant="chip" />
            </div>

            {chartLoading ? (
              <SkeletonRegion label="Loading account chart">
                <Skeleton style={{ height: 148, borderRadius: 12 }} />
              </SkeletonRegion>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={148}>
                  <ComposedChart data={chartData.points} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="acctBalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--select-color)" stopOpacity={0.20} />
                        <stop offset="95%" stopColor="var(--select-color)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} strokeOpacity={0.55} />
                    <XAxis
                      dataKey="day"
                      ticks={xTicks}
                      tick={{ fontSize: 12, fill: "var(--muted)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "var(--muted)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                      width={34}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "none",
                        borderRadius: "var(--radius-control)",
                        fontSize: 12,
                        color: "var(--text2)",
                        boxShadow: "var(--elevation-float)",
                      }}
                      formatter={(value) => [fmt(Number(value)), "Balance"]}
                      labelFormatter={day => `Day ${day}`}
                      cursor={{ stroke: "var(--border2)", strokeWidth: 1 }}
                    />
                    <Area
                      isAnimationActive={!reducedMotion}
                      animationBegin={0}
                      animationDuration={360}
                      animationEasing="ease-out"
                      type="monotone"
                      dataKey="balance"
                      stroke="var(--select-color)"
                      strokeWidth={2}
                      fill="url(#acctBalGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: "var(--select-color)", strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>

                {/* Net change footer */}
                {chartData.netChange !== 0 && (
                  <div style={chartFooterStyle}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
                      {chartData.netChange > 0 ? "+" : ""}{fmt(chartData.netChange)} this month
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Month totals: passive figures, so plain label and value (not pills). Only with the chart open. */}
        {showChart && (totalSpentFromAcct > 0 || totalIncomeToAcct > 0) && (
          <dl style={statsRowStyle}>
            {totalSpentFromAcct > 0 && (
              <div style={statItemStyle}>
                <dt style={statLabelStyle}>Out</dt>
                <dd style={statValueStyle}><Money value={totalSpentFromAcct} /></dd>
              </div>
            )}
            {totalIncomeToAcct > 0 && (
              <div style={statItemStyle}>
                <dt style={statLabelStyle}>In</dt>
                <dd style={statValueStyle}><Money value={totalIncomeToAcct} /></dd>
              </div>
            )}
          </dl>
        )}

        {/* Category breakdown, history panel only */}
        {showChart && catBreakdown.length > 0 && (
          <div style={sectionStyle}>
            <p style={sectionLabelStyle}>Top categories</p>
            <div style={{ display: "grid", gap: 12 }}>
              {catBreakdown.map(({ cat, total }) => {
                if (!cat) return null;
                const pct = Math.round((total / maxCatSpend) * 100);
                return (
                  <div key={cat.id} style={catRowStyle}>
                    <div style={catIconWrapStyle}>
                      <CategoryIcon icon={cat.icon} categoryName={cat.name} size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={catNameStyle}>{cat.name}</span>
                        <span style={catAmtStyle}><Money value={total} /></span>
                      </div>
                      <div style={barTrackStyle}>
                        <div style={{ ...barFillStyle, width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={actionsRowStyle}>
          <ActionBtn
            icon={<TransferIcon size={20} />}
            label="Move"
            ariaLabel="Move money"
            onClick={() => { handleClose(); onMove(account); }}
          />
          <ActionBtn
            icon={<BanknoteIcon size={20} />}
            label="Add income"
            ariaLabel="Add income"
            onClick={() => { handleClose(); onIncome(account); }}
          />
          <ActionBtn
            icon={<ScaleIcon size={20} />}
            label="Check balance"
            ariaLabel="Check balance"
            buttonRef={checkButtonRef}
            onClick={() => { setCheckVersion(balanceCheck?.version ?? null); setActualBalance(balanceCheck ? String(balanceCheck.estimatedActual) : savedCountForReview != null ? String(savedCountForReview) : ""); setCheckMessage(null); setShowReconcile(true); }}
          />
        </div>


        </>)}
        </div>
        <div className="account-desktop-activity">
        {/* Activity list */}
        {(() => {
          // One list for the month: expenses, income and transfers in or out of this account.
          const shownTxns = allActivityTxns;
          const acctId = account.id;
          return (
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <p style={sectionLabelStyle}>Activity in {fmtMonth(homeMonth)}</p>
              </div>
              {shownTxns.length === 0 ? (
                <EmptyState>No activity in {fmtMonth(homeMonth)}.</EmptyState>
              ) : (
                <div className="row-list" style={{ display: "grid", gap: 8 }}>
                  {shownTxns.map(t => {
                    const cat = t.category ? categories.find(c => c.id === t.category) : null;
                    const isIncome = t.type === "Income";
                    const isTransferIn = t.type === "Transfer" && t.toAccountId === acctId;
                    const isTransferOut = t.type === "Transfer" && t.fromAccountId === acctId;
                    const isPositive = isIncome || isTransferIn;
                    const prefix = isPositive ? "+" : "−";
                    return (
                      <TransactionRow
                        key={t.id}
                        title={t.name}
                        subtitle={!isIncome && !isTransferIn && !isTransferOut ? cat?.name : undefined}
                        amount={t.amount}
                        tone={isIncome ? "income" : isTransferIn || isTransferOut ? "transfer" : "expense"}
                        prefix={prefix}
                        date={t.date ? fmtDate(t.date) : undefined}
                        icon={isIncome ? <BanknoteIcon size={16} /> : isTransferIn || isTransferOut ? <TransferIcon size={16} /> : <CategoryIcon icon={cat?.icon ?? null} categoryName={cat?.name} size={20} />}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
        </div>

      </div>
  );

  // On desktop the Accounts panel shows this account beside the list: same content, no dialog of its own.
  // Embedded, the cover takes the whole screen so the Accounts list beside it is blocked too.
  if (embedIn) return createPortal(<>{body}<SavingCover saving={save.saving} label={saveLabel} fill="screen" /></>, embedIn);

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      label={`${account.label} details`}
      detent="content"
      size="account"
      desktopViewportCentered
      snapPoints={[0, 0.88]}
      initialSnap={1}
      maxHeight="calc(100dvh - 20px)"
      panelStyle={panelStyle}
      contentStyle={{ paddingTop: 0 }}
    >
      {body}
      <SavingCover saving={save.saving} label={saveLabel} />
    </BottomSheet>
  );
}

function ActionBtn({
  icon,
  label,
  ariaLabel,
  onClick,
  buttonRef,
}: {
  buttonRef?: React.Ref<HTMLButtonElement>;
  icon: React.ReactNode;
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="account-action-tile"
    >
      <span style={actionIconStyle} aria-hidden="true">{icon}</span>
      <span style={actionLabelStyle}>{label}</span>
    </button>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  borderRadius: "var(--radius-sheet)",
  overflow: "hidden",
};

const innerStyle: CSSProperties = {
  padding: "16px 24px calc(24px + env(safe-area-inset-bottom, 0px))",
  display: "grid",
  gap: 24,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const acctIdentityStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const iconCircleStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "var(--radius-control)",
  background: "var(--surface2)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const acctNameStyle: CSSProperties = {
  margin: 0,
  fontSize: 20,
  lineHeight: "24px",
  fontWeight: 600,
  color: "var(--text)",
};

const acctTypeStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 13,
  lineHeight: "16px",
  color: "var(--muted)",
};


const heroStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  paddingBottom: 4,
  borderBottom: "1px solid color-mix(in srgb, var(--border) 28%, transparent)",
};

const heroTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};


const chartPanelStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "2px 0 0",
};

const chartNavStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
};




const chartFooterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const heroLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: "16px",
  fontWeight: 600,
  color: "var(--muted)",
};

/** The sheet's main number, set like every sheet's (category Available, bill amount): 34px, medium weight, body font. */
const heroValueStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
  fontWeight: 500,
  lineHeight: 1,
  color: "var(--text)",
  fontVariantNumeric: "tabular-nums",
};

const heroSubStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  lineHeight: "16px",
  color: "var(--muted)",
  fontVariantNumeric: "tabular-nums",
};

const statsRowStyle: CSSProperties = {
  display: "flex",
  gap: 24,
  margin: 0,
};

const statItemStyle: CSSProperties = {
  display: "grid",
  gap: 4,
};

const statLabelStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: "16px",
  color: "var(--muted)",
};

const statValueStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: "22px",
  fontWeight: 600,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
};

const actionsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 8,
};


const actionLabelStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: "16px",
  fontWeight: 600,
  textAlign: "center",
};

const actionIconStyle: CSSProperties = {
  width: 20,
  height: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

// Reconcile panel
const reconcilePanelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  minWidth: 0,
};

const reconcileHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  marginLeft: -12,
};


const reconcileTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: "22px",
  fontWeight: 600,
  color: "var(--text)",
  overflowWrap: "anywhere",
};

const reconcileHintStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--muted)",
  lineHeight: "16px",
  margin: 0,
};

const reconcileRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 12,
  minWidth: 0,
};

const reconcileFieldStyle: CSSProperties = {
  display: "grid",
  minWidth: 0,
  gap: 8,
};

const reconcileLabelStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: "16px",
  fontWeight: 600,
  color: "var(--muted)",
};

/** A read-only figure: plain text on the sheet, never boxed like an input it isn't. Same height as the input beside it. */
const reconcileReadonlyStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
  minHeight: 48,
  display: "flex",
  alignItems: "center",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
};

/** Same look as .field-input (border, radius, surface), with the currency inside. */
const reconcileInputWrapStyle: CSSProperties = {
  minWidth: 0,
  width: "100%",
  minHeight: 48,
  borderRadius: "var(--radius-control)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "0 12px",
};

const reconcileInputStyle: CSSProperties = {
  flex: "1 1 0%",
  width: 0,
  minWidth: 0,
  background: "transparent",
  border: "none",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--text)",
  padding: 0,
};

const reconcileCurrencyStyle: CSSProperties = { flexShrink: 0 };

/** Flat on the sheet like any notice: the colour of the number carries the state, not a tinted band. */
const differenceBandStyle = (diff: number): CSSProperties => ({
  minHeight: 40,
  color: diff < 0 ? "var(--danger)" : "var(--text2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderTop: "1px solid color-mix(in srgb, var(--border) 28%, transparent)",
  fontSize: 13,
  fontWeight: 600,
});

const differenceLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--muted)",
};

// Add-transaction (inline, inside reconcile panel)
const addTxnSectionStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const addTxnHeaderRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const addTxnHintStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--muted)",
  lineHeight: "20px",
};


const addTxnFormStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};






const addedListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const addedRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 44,
  padding: "0 4px 0 12px",
  borderRadius: "var(--radius-control)",
  background: "var(--surface2)",
};

const addedNameStyle: CSSProperties = {
  flex: 1,
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text2)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const addedAmtStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
};




// Sections
const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const sectionLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: "16px",
  fontWeight: 600,
  color: "var(--muted)",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};


// Category breakdown
const catRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const catIconWrapStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "var(--radius-control)",
  background: "var(--surface2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const catNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text2)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
};

const catAmtStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text2)",
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
};

const barTrackStyle: CSSProperties = {
  width: "100%",
  height: 3,
  borderRadius: 999,
  background: "var(--surface2)",
  overflow: "hidden",
};

const barFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "var(--select-color)",
  transition: "width var(--motion-standard) var(--ease-standard)",
};

// Transactions
