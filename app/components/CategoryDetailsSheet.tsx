"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { FundIcon, FreezeIcon, XIcon, TransferIcon, CalendarRangeIcon, ScaleIcon, MoreIcon, ReceiptIcon, WalletIcon, ReviveIcon } from "./ui/icons";
import type { Account, Category } from "./app-types";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { TransactionRow } from "./ui/TransactionRow";
import { MonthPicker } from "./DatePicker";
import { FundTransactionSheet, type EditableFundTransaction } from "./FundTransactionSheet";
import { CategoryAvailableSheet } from "./CategoryAvailableSheet";
import { PickerPopover } from "./PickerPopover";

type TimelineItem = {
  id: string;
  date: string;
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
  onFreeze,
  onUnfreeze,
  onTransactionsChanged,
}: CategoryDetailsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CategoryActivityPayload | null>(null);
  const [activeMonth, setActiveMonth] = useState<string>(month);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingFund, setEditingFund] = useState<EditableFundTransaction | null>(null);
  const [adjustingAvailable, setAdjustingAvailable] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [confirmingFreeze, setConfirmingFreeze] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);

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
        if (!res.ok) throw new Error(payload.error || "Failed to load category details");
        return payload as CategoryActivityPayload;
      })
      .then((activity) => {
        if (cancelled) return;
        setData(activity);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, category?.id, activeMonth, refreshKey]);

  const details = data?.category;

  const spent = details?.spent ?? 0;
  const planned = details?.planned ?? 0;
  const available = details?.available ?? category?.available ?? 0;

  const spentPct = useMemo(() => {
    const safePlanned = Math.max(1, planned || 0);
    return Math.max(0, Math.min(100, (Math.max(0, spent || 0) / safePlanned) * 100));
  }, [planned, spent]);

  if (!open || !category) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={`${category.name} details`}
      maxWidth="520px"
      maxHeight="calc(100dvh - 20px - 88px - env(safe-area-inset-bottom, 0px))"
      detent="default"
      snapPoints={[0, 0.82, 1]}
      initialSnap={1}
      panelStyle={sheetStyle}
      contentStyle={{ paddingTop: 0 }}
    >
      <div style={sheetInnerStyle}>

        {/* ── Header ── */}
        <header style={topBarStyle}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <CategoryIcon icon={category.icon} style={{ fontSize: 26, flexShrink: 0 }} />
            <h2 style={titleStyle}>{details?.name ?? category.name}</h2>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button className="sheet-close-button" onClick={onClose} aria-label="Close category details" style={closeButtonStyle}>
              <XIcon strokeWidth={2.2} />
            </button>
          </div>
        </header>

        {/* ── Budget summary ── */}
        <section style={statsWrapStyle}>
          <div style={availableStyle}>
            <span style={statLabelStyle}>Available</span>
            <span style={availableValueStyle}><Money value={available} /></span>
          </div>
          <div style={supportingStatsStyle}>
            <div style={supportingStatStyle}>
              <span style={supportingLabelStyle}>Planned</span>
              <span style={supportingValueStyle}><Money value={planned} /></span>
            </div>
            <div style={supportingStatStyle}>
              <span style={supportingLabelStyle}>Spent</span>
              <span style={{ ...supportingValueStyle, color: "var(--danger)" }}>
                <Money value={spent} />
              </span>
            </div>
          </div>
          {planned > 0 && spent > 0 && (
            <div style={progressGroupStyle}>
              <span style={progressLabelStyle}>{Math.round(spentPct)}% of plan used</span>
              <div style={progressRailStyle} role="progressbar" aria-label="Budget spent" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(spentPct)}>
                <div style={{ ...progressFillStyle, transform: `scaleX(${spentPct / 100})` }} />
              </div>
            </div>
          )}
        </section>

        {/* ── Actions ── */}
        <div style={actionsRowStyle}>
          <ActionBtn
            icon={<ReceiptIcon size={17} strokeWidth={2} />}
            label="Expense"
            ariaLabel="Add expense"
            bg="var(--text)"
            ink="var(--bg)"
            border="1px solid transparent"
            onClick={onOpenAdd}
          />
          <ActionBtn
            icon={<WalletIcon size={18} strokeWidth={2} />}
            label="Fund"
            ariaLabel="Fund category"
            bg="var(--surface)"
            ink="var(--text2)"
            border="1px solid color-mix(in srgb, var(--border) 54%, transparent)"
            onClick={onOpenFund}
          />
          <div ref={moreActionsRef} style={{ position: "relative", minWidth: 0 }}>
            <ActionBtn icon={<MoreIcon size={18} />} label="More" ariaLabel="More category actions" bg="transparent" ink="var(--muted)" border="1px solid transparent" onClick={() => setShowMoreActions(true)} />
            <PickerPopover open={showMoreActions} anchorRef={moreActionsRef} title="Category actions" onClose={() => setShowMoreActions(false)} align="right" zIndex={130} width="min(280px, calc(100vw - 32px))">
              <div className="picker-options">
                <button type="button" className="picker-option" onClick={() => { setShowMoreActions(false); setAdjustingAvailable(true); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><ScaleIcon size={17} />Adjust available</span></button>
                {onFreeze && <button type="button" className="picker-option" onClick={() => { setShowMoreActions(false); setConfirmingFreeze(true); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><FreezeIcon size={17} />Freeze category</span></button>}
                {onUnfreeze && <button type="button" className="picker-option" onClick={() => { setShowMoreActions(false); onUnfreeze(); }}><span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><ReviveIcon size={17} />Unfreeze category</span></button>}
              </div>
            </PickerPopover>
          </div>
        </div>

        {/* ── Activity ── */}
        <section style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={sectionLabelStyle}>Activity</span>
            <MonthPicker value={activeMonth} max={todayMonth()} aria-label="Filter activity by month" onChange={(event) => event.target.value && setActiveMonth(event.target.value)} align="right" triggerIcon={<CalendarRangeIcon size={16} aria-hidden="true" />} triggerClassName="composer-picker-chip" showChevron={false} />
          </div>

          {loading && (
            <div style={{ display: "grid", gap: 12 }}>
              {[72, 56, 64].map((w, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div className="skeleton" style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1, display: "grid", gap: 6 }}>
                    <div className="skeleton" style={{ height: 13, width: `${w}%`, borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 10, width: "40%", borderRadius: 4 }} />
                  </div>
                  <div className="skeleton" style={{ height: 13, width: 48, borderRadius: 4, flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}
          {error && !loading && <div style={panelMessageStyle}>{error}</div>}
          {!loading && !error && (data?.timeline?.length ?? 0) === 0 && (
            <div style={panelMessageStyle}>No activity for {formatMonth(activeMonth)}.</div>
          )}

          {!loading && !error && (data?.timeline?.length ?? 0) > 0 && (
            <div>
              {data!.timeline.map((item) => {
                const meta = [
                  eventKindLabel(item.kind),
                  item.relatedCategoryName,
                  item.subtitle,
                ].filter(Boolean).join(" · ");

                return (
                  <TransactionRow
                    key={item.id}
                    title={item.title}
                    subtitle={meta}
                    amount={item.amount}
                    tone={item.kind === "funded" ? "income" : item.kind === "expense" ? "expense" : "transfer"}
                    prefix={item.direction === "in" ? "+" : "−"}
                    date={formatDay(item.date)}
                    icon={item.kind === "funded"
                      ? <FundIcon size={14} />
                      : item.kind === "expense"
                        ? <CategoryIcon icon={category.icon} size={20} />
                        : <TransferIcon size={14} />}
                    onClick={item.kind === "funded" ? () => setEditingFund({ ...item, categoryAvailable: available }) : undefined}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
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
        funds={(data?.timeline ?? []).filter((item) => item.kind === "funded").map((item) => ({ ...item, categoryAvailable: available }))}
        onClose={() => setAdjustingAvailable(false)}
        onChanged={async () => { setRefreshKey((value) => value + 1); await onTransactionsChanged?.(); }}
      />
      <BottomSheet open={confirmingFreeze} onClose={() => setConfirmingFreeze(false)} label="Confirm freeze category" detent="content" layered maxWidth="440px" zIndex={150} panelStyle={{ background: "var(--surface)", borderRadius: "var(--radius-sheet)" }}>
        <div style={confirmWrapStyle}>
          <span style={confirmIconStyle}><FreezeIcon size={20} /></span>
          <div style={{ display: "grid", gap: 6 }}><h2 style={confirmTitleStyle}>Freeze {category.name}?</h2><p style={confirmCopyStyle}>It will leave the active budget and move to Frozen. Existing activity and balances stay intact.</p></div>
          <div style={confirmActionsStyle}>
            <button type="button" onClick={() => setConfirmingFreeze(false)} style={confirmCancelStyle}>Cancel</button>
            <button type="button" onClick={() => { setConfirmingFreeze(false); onFreeze?.(); }} style={confirmFreezeStyle}>Freeze category</button>
          </div>
        </div>
      </BottomSheet>
    </BottomSheet>
  );
}

function ActionBtn({
  icon,
  label,
  ariaLabel,
  onClick,
  bg = "color-mix(in srgb, var(--surface2) 54%, var(--surface))",
  ink = "var(--text2)",
  border = "1px solid transparent",
}: {
  icon: React.ReactNode;
  label: string;
  ariaLabel: string;
  onClick: () => void;
  bg?: string;
  ink?: string;
  border?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{ ...actionBtnStyle, background: bg, color: ink, border }}
    >
      <span style={actionIconStyle}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function todayMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

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
  background: "color-mix(in srgb, var(--surface) 97%, var(--surface))",
  display: "flex",
  flexDirection: "column",
  borderRadius: "var(--radius-sheet)",
};

const sheetInnerStyle: CSSProperties = {
  padding: "18px 18px 32px",
  overflowY: "auto",
  display: "grid",
  gap: 16,
};

const topBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const closeButtonStyle: CSSProperties = {
  width: 44,
  height: 44,
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 700,
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
  gap: 14,
  padding: "4px 0 2px",
};

const availableStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 5,
};

const availableValueStyle: CSSProperties = {
  fontSize: 34,
  fontWeight: 500,
  lineHeight: 1,
  color: "var(--text)",
  fontVariantNumeric: "tabular-nums",
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
  gap: 6,
};

const supportingLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--muted)",
};

const supportingValueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
};

const progressGroupStyle: CSSProperties = {
  width: "min(100%, 320px)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const progressLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "var(--muted)",
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
};

const statLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: "uppercase",
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
  background: "color-mix(in srgb, var(--accent) 65%, var(--bar-fill))",
  transformOrigin: "left center",
  transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
};

/* Actions */

const actionsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  alignItems: "center",
  gap: 8,
};

const actionBtnStyle: CSSProperties = {
  minHeight: 44,
  width: "100%",
  minWidth: 0,
  padding: "0 8px",
  borderRadius: "var(--radius-control)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 750,
  transition: "background 0.15s ease, color 0.15s ease",
};
const confirmWrapStyle: CSSProperties = { padding: "12px 20px calc(20px + env(safe-area-inset-bottom, 0px))", display: "grid", gap: 16 };
const confirmIconStyle: CSSProperties = { width: 44, height: 44, borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface2)", color: "var(--text2)" };
const confirmTitleStyle: CSSProperties = { margin: 0, color: "var(--text)", fontSize: 20, lineHeight: 1.2 };
const confirmCopyStyle: CSSProperties = { margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.45 };
const confirmActionsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 8 };
const confirmCancelStyle: CSSProperties = { minHeight: 48, border: 0, borderRadius: "var(--radius-control)", background: "var(--surface2)", color: "var(--text2)", font: "inherit", fontWeight: 700 };
const confirmFreezeStyle: CSSProperties = { minHeight: 48, border: 0, borderRadius: "var(--radius-control)", background: "var(--text)", color: "var(--bg)", font: "inherit", fontWeight: 750 };

const actionIconStyle: CSSProperties = {
  width: 22,
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

/* Activity */

const sectionLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const panelMessageStyle: CSSProperties = {
  padding: "10px 0",
  color: "var(--muted)",
  fontSize: 13,
};
