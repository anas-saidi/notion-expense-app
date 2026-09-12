"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { FundIcon, PlusIcon, FreezeIcon, XIcon, TransferIcon } from "./ui/icons";
import type { Category } from "./app-types";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { TransactionRow } from "./ui/TransactionRow";
import { MonthPicker } from "./DatePicker";

type TimelineItem = {
  id: string;
  date: string;
  kind: "funded" | "moved_in" | "moved_out" | "expense";
  amount: number;
  direction: "in" | "out";
  title: string;
  subtitle?: string;
  accountName?: string | null;
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
  onClose: () => void;
  onOpenAdd: () => void;
  onOpenFund: () => void;
  onFreeze?: () => void;
};

export function CategoryDetailsSheet({
  open,
  category,
  month,
  onClose,
  onOpenAdd,
  onOpenFund,
  onFreeze,
}: CategoryDetailsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CategoryActivityPayload | null>(null);
  const [activeMonth, setActiveMonth] = useState<string>(month);

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
  }, [open, category?.id, activeMonth]);

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
            {onFreeze && (
              <button onClick={onFreeze} aria-label="Freeze category" style={headerIconBtnStyle}>
                <FreezeIcon size={16} strokeWidth={2} />
              </button>
            )}
            <button className="sheet-close-button" onClick={onClose} aria-label="Close category details" style={closeButtonStyle}>
              <XIcon strokeWidth={2.2} />
            </button>
          </div>
        </header>

        {/* ── Stats + bar ── */}
        <section style={statsWrapStyle}>
          <div style={spotlightStyle}>
            <div style={statItemStyle}>
              <span style={statLabelStyle}>Available</span>
              <span style={statValueStyle}><Money value={available} /></span>
            </div>
            <div style={statDividerStyle} />
            <div style={statItemStyle}>
              <span style={statLabelStyle}>Planned</span>
              <span style={statValueStyle}><Money value={planned} /></span>
            </div>
            <div style={statDividerStyle} />
            <div style={statItemStyle}>
              <span style={statLabelStyle}>Spent</span>
              <span style={{ ...statValueStyle, color: spentPct >= 100 ? "var(--danger)" : spentPct >= 85 ? "var(--warning)" : "var(--text2)" }}>
                <Money value={spent} />
              </span>
            </div>
          </div>
          {planned > 0 && (
            <div style={progressRailStyle} role="progressbar" aria-label="Budget spent" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(spentPct)}>
              <div style={{ ...progressFillStyle, transform: `scaleX(${spentPct / 100})` }} />
            </div>
          )}
        </section>

        {/* ── Actions ── */}
        <div style={actionsRowStyle}>
          <ActionBtn
            icon={<PlusIcon size={18} strokeWidth={2.2} />}
            label="Add expense"
            ariaLabel="Add expense"
            bg="var(--text)"
            ink="var(--bg)"
            onClick={onOpenAdd}
          />
          <ActionBtn
            icon={<FundIcon size={18} strokeWidth={2.2} />}
            label="Fund"
            ariaLabel="Fund category"
            bg="var(--surface2)"
            ink="var(--text2)"
            onClick={onOpenFund}
          />
        </div>

        {/* ── Activity ── */}
        <section style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={sectionLabelStyle}>Activity</span>
            <MonthPicker value={activeMonth} max={todayMonth()} aria-label="Filter activity by month" onChange={(event) => event.target.value && setActiveMonth(event.target.value)} style={monthFilterStyle} />
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
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
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
}: {
  icon: React.ReactNode;
  label: string;
  ariaLabel: string;
  onClick: () => void;
  bg?: string;
  ink?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{ ...actionBtnStyle, background: bg, color: ink }}
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
  gap: 10,
};

const spotlightStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  padding: "4px 0",
};

const statItemStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 3,
  padding: "0 8px",
};

const statDividerStyle: CSSProperties = {
  width: 1,
  background: "var(--border)",
  flexShrink: 0,
  margin: "4px 0",
};

const statLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const statValueStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  lineHeight: 1,
  color: "var(--text2)",
  fontVariantNumeric: "tabular-nums",
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
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const actionBtnStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  borderRadius: "var(--radius-control)",
  border: "none",
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

const actionIconStyle: CSSProperties = {
  width: 22,
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const headerIconBtnStyle: CSSProperties = {
  width: 44,
  height: 44,
  border: "none",
  borderRadius: "50%",
  background: "var(--surface2)",
  color: "var(--muted)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
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

/* Month nav */

const monthFilterStyle: CSSProperties = {
  position: "relative",
  minHeight: 44,
  padding: "0 10px",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--surface2)",
  borderRadius: "var(--radius-control)",
  color: "var(--text2)",
  cursor: "pointer",
};
