"use client";

import { SheetBody, SheetFooter, SheetHeader } from "./ui/SheetLayout";

import { UndoSavingsDeposit } from "./UndoSavingsDeposit";
import { SkeletonRows } from "./ui/Skeleton";
import { EmptyState } from "./ui/EmptyState";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { FundIcon, FreezeIcon, XIcon, TransferIcon, ScaleIcon, EditIcon, MoreIcon, ReceiptIcon, WalletIcon, ReviveIcon, ArrowUpIcon } from "./ui/icons";
import { Banner } from "./ui/Banner";
import { Button } from "./ui/Button";
import "./sheet-components.css";
import { SavingCover, guardClose, useBlockingSave } from "./ui/SavingCover";
import type { Account, Category } from "./app-types";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { TransactionRow } from "./ui/TransactionRow";
import { MonthPicker } from "./DatePicker";
import { FundTransactionSheet, type EditableFundTransaction } from "./FundTransactionSheet";
import { CategoryAvailableSheet } from "./CategoryAvailableSheet";
import { PickerPopover } from "./PickerPopover";
import { currentMonth, isPastMonth } from "./app-utils";

type TimelineItem = {
  id: string;
  date: string;
  readOnly?: boolean;
  savingsFundingOperation?: string;
  kind: "funded" | "moved_in" | "moved_out" | "expense";
  amount: number;
  direction: "in" | "out";
  title: string;
  subtitle?: string;
  accountName?: string | null;
  accountId?: string | null;
  assignmentType?: "Monthly" | "Additional" | "Top-up" | null;
  relatedCategoryName?: string | null;
};

type CategoryActivityPayload = {
  category: {
    id: string;
    name: string;
    icon: string | null;
    planned: number | null;
    available: number | null;
    spent: number | null;
  };
  summary: {
    month: string;
    fundedTotal: number;
    movedInTotal: number;
    movedOutTotal: number;
    spentTotal: number;
    netFlow: number;
  };
  timeline: TimelineItem[];
};

type CategoryDetailsSheetProps = {
  open: boolean;
  category: Category | null;
  month: string;
  accounts: Account[];
  onClose: () => void;
  onOpenAdd: () => void;
  onOpenFund: () => void;
  /** Savings category: actions become "Add" and "Take out" instead of expense and fund. */
  onTakeOut?: () => void;
  onEdit?: () => void;
  onFreeze?: () => void;
  onUnfreeze?: () => void;
  onTransactionsChanged?: () => void | Promise<void>;
};

export function CategoryDetailsSheet({
  open,
  category,
  month,
  accounts,
  onClose,
  onOpenAdd,
  onOpenFund,
  onTakeOut,
  onEdit,
  onFreeze,
  onUnfreeze,
  onTransactionsChanged,
}: CategoryDetailsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CategoryActivityPayload | null>(null);
  const [activeMonth, setActiveMonth] = useState<string>(month);
  const [refreshKey, setRefreshKey] = useState(0);
  const [undoingDeposit, setUndoingDeposit] = useState<TimelineItem | null>(null);
  useEffect(() => { setUndoingDeposit(null); }, [open, category?.id]);
  const [editingFund, setEditingFund] = useState<EditableFundTransaction | null>(null);
  const [adjustingAvailable, setAdjustingAvailable] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [confirmingFreeze, setConfirmingFreeze] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);
  // Savings goal due date, edited here and kept locally so the change shows before the list refreshes.
  const [goalDate, setGoalDate] = useState<string | null>(category?.goalDate ?? null);
  // One blocking save for every write made from this sheet (goal month, freeze, unfreeze).
  const save = useBlockingSave();
  // The undo-deposit editor owns its delete; it reports busy so its sheet and this one stay blocked.
  const [depositBusy, setDepositBusy] = useState(false);
  const busy = save.saving || depositBusy;
  const [goalError, setGoalError] = useState<string | null>(null);
  useEffect(() => { setGoalDate(category?.goalDate ?? null); setGoalError(null); }, [open, category?.id, category?.goalDate]);
  const changeGoalMonth = async (monthValue: string) => {
    if (!category || !/^\d{4}-\d{2}$/.test(monthValue)) return;
    const [year, monthNumber] = monthValue.split("-").map(Number);
    // A goal is due by the end of its month.
    const next = `${monthValue}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0")}`;
    const previous = goalDate;
    setGoalDate(next);
    setGoalError(null);
    try {
      await save.run(async () => {
        const res = await fetch("/api/categories", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: category.id, goalDate: next }) });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || "Could not change the due date");
      });
      await onTransactionsChanged?.();
    } catch (err) {
      setGoalDate(previous);
      setGoalError(err instanceof Error ? err.message : "Could not change the due date");
    }
  };

  // When the sheet opens or the external month changes, reset to that month
  useEffect(() => {
    if (open) setActiveMonth(month);
  }, [open, month]);

  useEffect(() => {
    if (!open || !category?.id || !activeMonth) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null); // clear stale data from previous category

    fetch(`/api/categories/${category.id}/activity?month=${activeMonth}&limit=100`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Could not load category details");
        return payload as CategoryActivityPayload;
      })
      .then((activity) => {
        if (cancelled) return;
        setData(activity);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, category?.id, activeMonth, refreshKey]);

  const details = data?.category;

  // The category's Spent/Available properties are Notion formulas relative to
  // today; use the selected month's own expenses, and 0 Available for past months.
  const spent = data?.summary?.spentTotal ?? details?.spent ?? 0;
  const planned = details?.planned ?? 0;
  const available = isPastMonth(activeMonth) ? 0 : details?.available ?? category?.available ?? 0;

  const spentPct = useMemo(() => {
    const safePlanned = Math.max(1, planned || 0);
    return Math.max(0, Math.min(100, (Math.max(0, spent || 0) / safePlanned) * 100));
  }, [planned, spent]);

  if (!open || !category) return null;
  const close = guardClose(busy, onClose);
  // The parent owns freeze and unfreeze; the sheet stays blocked until its write settles.
  const runParentWrite = (write?: () => void | Promise<void>) => {
    if (!write) return;
    void save.run(async () => { await write(); }).catch(() => undefined);
  };
  const closeDeposit = guardClose(depositBusy, () => setUndoingDeposit(null));

  return (
    <BottomSheet
      open={open}
      onClose={close}
      label={`${category.name} details`}
      size="standard" desktopHeight="fill"
      // Standard main sheet: from under the header to the bottom edge, like Accounts
      // and Settings. A shorter custom height left the page exposed (and scrollable) below it.
      detent="default"
      desktopInspector
      panelStyle={sheetStyle}
      contentStyle={{ paddingTop: 0 }}
    >
      <SheetBody style={sheetInnerStyle}>

        {/* ── Header ── */}
        <SheetHeader style={topBarStyle}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <CategoryIcon icon={category.icon} categoryName={category.name} size={24} style={{ flexShrink: 0 }} />
            <h2 style={titleStyle}>{details?.name ?? category.name}</h2>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button type="button" className="sheet-close-button" onClick={close} aria-label="Close category details">
              <XIcon size={20} />
            </button>
          </div>
        </SheetHeader>

        {/* ── Budget summary ── */}
        <section style={statsWrapStyle}>
          <div style={availableStyle}>
            <span style={statLabelStyle}>Available</span>
            <span style={availableValueStyle}><Money value={available} currency /></span>
          </div>
          <div style={supportingStatsStyle}>
            <div style={supportingStatStyle}>
              <span style={supportingLabelStyle}>Planned</span>
              <span style={supportingValueStyle}><Money value={planned} /></span>
            </div>
            <div style={supportingStatStyle}>
              <span style={supportingLabelStyle}>Spent</span>
              <span style={supportingValueStyle}>
                <Money value={spent} />
              </span>
            </div>
          </div>
          {planned > 0 && spent > 0 && (
            <div style={progressGroupStyle}>
              <div style={progressRailStyle} role="progressbar" aria-label="Budget spent" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(spentPct)} aria-valuetext={`${Math.round(spentPct)}% of plan used`}>
                <div style={{ ...progressFillStyle, transform: `scaleX(${spentPct / 100})` }} />
              </div>
            </div>
          )}
        </section>

        {onTakeOut && ((category.goal ?? 0) > 0 || goalDate) && (() => {
          const goal = Math.max(0, category.goal ?? 0);
          const reached = goal > 0 && available >= goal;
          const past = !reached && !!goalDate && goalDate.slice(0, 7) < new Date().toISOString().slice(0, 7);
          return <section aria-label="Savings goal" style={goalRowStyle}>
            {goal > 0 && <span style={supportingStatStyle}>
              <span style={supportingLabelStyle}>Goal</span>
              <span style={supportingValueStyle}><Money value={goal} /></span>
            </span>}
            <span style={{ ...supportingStatStyle, alignItems: "center" }}>
              <span style={{ ...supportingLabelStyle, ...(past ? { color: "var(--danger)" } : {}) }}>{reached ? "Reached" : past ? "Past due" : "Due"}</span>
              <MonthPicker value={goalDate?.slice(0, 7) ?? ""} onChange={(event) => void changeGoalMonth(event.target.value)} aria-label={goalDate ? "Change goal due month" : "Set goal due month"} />
            </span>
            {goalError && <div style={{ flexBasis: "100%" }}><Banner tone="danger" role="alert" compact>{goalError}</Banner></div>}
          </section>;
        })()}

        {/* ── Actions ── */}
        <div style={{ ...actionsRowStyle, ...(onTakeOut ? { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" } : {}) }}>
          {onTakeOut ? <>
            {/* Savings keeps deposits, purchases, and deliberate releases together. */}
            <Button variant="primary" size="compact" icon={<FundIcon size={16} />} aria-label="Add to savings" onClick={onOpenFund} style={actionBtnStyle}>Add</Button>
            <Button variant="secondary" size="compact" icon={<ReceiptIcon size={16} />} aria-label="Spend from savings" onClick={onOpenAdd} style={actionBtnStyle}>Spend</Button>
            <Button variant="secondary" size="compact" icon={<TransferIcon size={16} />} aria-label="Take money out of savings" onClick={onTakeOut} style={actionBtnStyle}>Take out</Button>
          </> : <>
          <Button variant="primary" size="compact" icon={<ArrowUpIcon size={16} />} aria-label="Add expense" onClick={onOpenAdd} style={actionBtnStyle}>Expense</Button>
          <Button variant="secondary" size="compact" icon={<WalletIcon size={16} />} aria-label="Fund category" onClick={onOpenFund} style={actionBtnStyle}>Fund</Button>
          </>}
          <div ref={moreActionsRef} style={{ position: "relative", minWidth: 0 }}>
            <Button variant="quiet" size="compact" icon={<MoreIcon size={16} />} aria-label="More category actions" aria-haspopup="dialog" aria-expanded={showMoreActions} onClick={() => setShowMoreActions(true)} style={actionBtnStyle}>More</Button>
            <PickerPopover open={showMoreActions} anchorRef={moreActionsRef} title="Category actions" onClose={() => setShowMoreActions(false)} align="right" zIndex={130} size="menu">
              <div className="picker-options">
                {onEdit && <button type="button" className="picker-option" onClick={() => { setShowMoreActions(false); onEdit(); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}><EditIcon size={20} aria-hidden="true" />Edit</span></button>}
                <button type="button" className="picker-option" disabled={loading || isPastMonth(activeMonth)} onClick={() => { setShowMoreActions(false); setAdjustingAvailable(true); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}><ScaleIcon size={20} aria-hidden="true" />Adjust available</span></button>
                {onFreeze && <button type="button" className="picker-option" onClick={() => { setShowMoreActions(false); setConfirmingFreeze(true); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}><FreezeIcon size={20} aria-hidden="true" />Freeze</span></button>}
                {onUnfreeze && <button type="button" className="picker-option" onClick={() => { setShowMoreActions(false); runParentWrite(onUnfreeze); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}><ReviveIcon size={20} aria-hidden="true" />Unfreeze</span></button>}
              </div>
            </PickerPopover>
          </div>
        </div>

        {/* ── Activity ── */}
        <section style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={sectionLabelStyle}>Activity</span>
            <MonthPicker value={activeMonth} max={currentMonth()} aria-label="Filter activity by month" onChange={(event) => event.target.value && setActiveMonth(event.target.value)} align="right" variant="chip" />
          </div>

          {loading && <SkeletonRows label="Loading category activity" />}
          {error && !loading && <Banner tone="danger" role="alert" compact action={<Button variant="quiet" size="compact" onClick={() => setRefreshKey((value) => value + 1)}>Retry</Button>}>{error}</Banner>}
          {!loading && !error && (data?.timeline?.length ?? 0) === 0 && (
            <EmptyState>No activity in {formatMonth(activeMonth)}.</EmptyState>
          )}

          {!loading && !error && (data?.timeline?.length ?? 0) > 0 && (
            <div className="row-list">
              {data!.timeline.map((item) => {
                // The row's icon already marks an expense; only funding and transfers get a label.
                const meta = [
                  item.kind === "expense" ? null : eventKindLabel(item.kind),
                  item.relatedCategoryName,
                  item.subtitle,
                ].filter(Boolean);

                return (
                  <TransactionRow
                    key={item.id}
                    title={item.title}
                    subtitle={<span style={{ display: "grid", gap: 2 }}>{meta.map((value, index) => <span key={index}>{value}</span>)}</span>}
                    amount={item.amount}
                    tone={item.kind === "funded" ? "income" : item.kind === "expense" ? "expense" : "transfer"}
                    prefix={item.direction === "in" ? "+" : "−"}
                    date={formatDay(item.date)}
                    icon={item.kind === "funded"
                      ? <FundIcon size={16} />
                      : item.kind === "expense"
                        ? <CategoryIcon icon={category.icon} categoryName={category.name} size={20} />
                        : <TransferIcon size={16} />}
                    onClick={item.kind === "funded" ? item.savingsFundingOperation ? () => setUndoingDeposit(item) : !item.readOnly ? () => setEditingFund({ ...item, categoryAvailable: available }) : undefined : undefined}
                  />
                );
              })}
            </div>
          )}
        </section>
      </SheetBody>
      <SavingCover saving={save.saving} />
      <BottomSheet open={undoingDeposit !== null} onClose={closeDeposit} label="Savings deposit" detent="content" layered size="compact" zIndex={150} panelStyle={{ background: "var(--surface)", borderRadius: "var(--radius-sheet)" }}>
        {undoingDeposit && <SheetBody style={confirmWrapStyle}>
          <SheetHeader style={topBarStyle}><h2 style={confirmTitleStyle}>{undoingDeposit.title}</h2><button type="button" aria-label="Close deposit details" onClick={closeDeposit} className="sheet-close-button"><XIcon size={20} /></button></SheetHeader>
          <span style={depositAmountStyle}><Money value={undoingDeposit.amount} currency /></span>
          <UndoSavingsDeposit key={undoingDeposit.savingsFundingOperation} operationId={undoingDeposit.savingsFundingOperation!} onBusyChange={setDepositBusy} onUndone={async () => { setUndoingDeposit(null); setRefreshKey(value => value + 1); try { await onTransactionsChanged?.(); } catch { setError("Deposit undone. Refresh to update balances."); } }} />
        </SheetBody>}
        <SavingCover saving={depositBusy} label="Deleting" />
      </BottomSheet>
      <FundTransactionSheet
        transaction={editingFund}
        accounts={accounts}
        onClose={() => setEditingFund(null)}
        onChanged={async () => {
          setRefreshKey((value) => value + 1);
          await onTransactionsChanged?.();
        }}
      />
      <CategoryAvailableSheet
        open={adjustingAvailable}
        category={category}
        currentAvailable={available}
        month={activeMonth}
        accounts={accounts}
        onClose={() => setAdjustingAvailable(false)}
        onChanged={async () => { setRefreshKey((value) => value + 1); await onTransactionsChanged?.(); }}
      />
      <BottomSheet open={confirmingFreeze} onClose={() => setConfirmingFreeze(false)} label="Confirm freeze category" detent="content" layered size="compact" zIndex={150} panelStyle={{ background: "var(--surface)", borderRadius: "var(--radius-sheet)" }}>
        <SheetBody style={confirmWrapStyle}>
          <span style={confirmIconStyle}><FreezeIcon size={20} /></span>
          <div style={{ display: "grid", gap: 4 }}><h2 style={confirmTitleStyle}>Freeze {category.name}?</h2><p style={confirmCopyStyle}>Moves to Frozen. Balance and activity are kept.</p></div>
          <SheetFooter style={confirmActionsStyle}>
            <Button variant="secondary" onClick={() => setConfirmingFreeze(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setConfirmingFreeze(false); runParentWrite(onFreeze); }}>Freeze category</Button>
          </SheetFooter>
        </SheetBody>
      </BottomSheet>
    </BottomSheet>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function formatDay(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function eventKindLabel(kind: TimelineItem["kind"]) {
  if (kind === "funded") return "Funding";
  if (kind === "moved_in") return "Transfer in";
  if (kind === "moved_out") return "Transfer out";
  return "Expense";
}

// ── Styles ───────────────────────────────────────────────────────────────────

const sheetStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background: "var(--surface)",
  display: "flex",
  flexDirection: "column",
  borderRadius: "var(--radius-sheet)",
};

const sheetInnerStyle: CSSProperties = {
  padding: "16px 24px calc(32px + env(safe-area-inset-bottom, 0px))",
  display: "grid",
  gap: 16,
};

const topBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const titleStyle: CSSProperties = {
  fontSize: 20,
  lineHeight: "24px",
  fontWeight: 600,
  color: "var(--text)",
  margin: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

/* Stats row */

const statsWrapStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 12,
  padding: "4px 0",
};

const availableStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 4,
};

const availableValueStyle: CSSProperties = {
  fontSize: 34,
  fontWeight: 500,
  lineHeight: 1,
  color: "var(--text)",
  fontVariantNumeric: "tabular-nums",
};

const goalRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "8px 24px",
};

const supportingStatsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "8px 24px",
};

const supportingStatStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 8,
};

const supportingLabelStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: "16px",
  fontWeight: 600,
  color: "var(--muted)",
};

const supportingValueStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
};

const progressGroupStyle: CSSProperties = {
  width: "min(100%, 320px)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const statLabelStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: "16px",
  fontWeight: 600,
  color: "var(--muted)",
};

const progressRailStyle: CSSProperties = {
  width: "100%",
  height: 4,
  borderRadius: 999,
  background: "var(--surface2)",
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: 999,
  background: "var(--select-color)",
  transformOrigin: "left center",
  transition: "transform var(--motion-standard) var(--ease-standard)",
};

/* Actions */

const actionsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  alignItems: "center",
  gap: 8,
};

// Toolbar buttons fill their grid cell so the three (or four) actions keep equal width.
const actionBtnStyle: CSSProperties = { width: "100%", minWidth: 0 };
const confirmWrapStyle: CSSProperties = { padding: "16px 24px calc(24px + env(safe-area-inset-bottom, 0px))", display: "grid", gap: 16 };
const confirmIconStyle: CSSProperties = { width: 44, height: 44, borderRadius: "var(--radius-control)", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface2)", color: "var(--text2)" };
const confirmTitleStyle: CSSProperties = { margin: 0, color: "var(--text)", fontSize: 20, lineHeight: "24px", fontWeight: 600 };
const confirmCopyStyle: CSSProperties = { margin: 0, color: "var(--muted)", fontSize: 15, lineHeight: "22px" };
const confirmActionsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8 };
const depositAmountStyle: CSSProperties = { fontSize: 34, lineHeight: 1, fontWeight: 500, color: "var(--text)", fontVariantNumeric: "tabular-nums" };

/* Activity */

const sectionLabelStyle: CSSProperties = {
  fontSize: "var(--type-label)",
  lineHeight: "16px",
  fontWeight: 600,
  color: "var(--muted)",
};
