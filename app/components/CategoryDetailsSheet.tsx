"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { FundIcon, PlusIcon, XIcon } from "./ui/icons";
import type { Category } from "./app-types";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";

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
};

export function CategoryDetailsSheet({
  open,
  category,
  month,
  onClose,
  onOpenAdd,
  onOpenFund,
}: CategoryDetailsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CategoryActivityPayload | null>(null);

  useEffect(() => {
    if (!open || !category?.id || !month) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/categories/${category.id}/activity?month=${month}&limit=20`)
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
  }, [open, category?.id, month]);

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
          <button onClick={onClose} aria-label="Close category details" style={closeButtonStyle}>
            <XIcon strokeWidth={2.2} />
          </button>
        </header>

        {/* ── Stats + bar ── */}
        <section style={statsWrapStyle}>
          <div style={spotlightStyle}>
            <div style={statItemStyle}>
              <span style={statLabelStyle}>Available</span>
              <span style={statValueStyle}><Money value={available} /></span>
              <span style={statCurrencyStyle}>MAD</span>
            </div>
            <div style={statDividerStyle} />
            <div style={statItemStyle}>
              <span style={statLabelStyle}>Planned</span>
              <span style={statValueStyle}><Money value={planned} /></span>
              <span style={statCurrencyStyle}>MAD</span>
            </div>
            <div style={statDividerStyle} />
            <div style={statItemStyle}>
              <span style={statLabelStyle}>Spent</span>
              <span style={{ ...statValueStyle, color: spentPct >= 100 ? "var(--danger)" : spentPct >= 85 ? "var(--warning)" : "var(--text2)" }}>
                <Money value={spent} />
              </span>
              <span style={statCurrencyStyle}>MAD</span>
            </div>
          </div>
          {planned > 0 && (
            <div style={progressRailStyle} aria-hidden="true">
              <div style={{ ...progressFillStyle, width: `${spentPct}%` }} />
            </div>
          )}
        </section>

        {/* ── Actions ── */}
        <div style={actionRowStyle}>
          <button type="button" onClick={onOpenAdd} style={secondaryActionStyle}>
            <PlusIcon size={14} strokeWidth={2.3} />
            Add
          </button>
          <button type="button" onClick={onOpenFund} style={primaryActionStyle}>
            <FundIcon size={14} strokeWidth={2.3} />
            Fund
          </button>
        </div>

        {/* ── Activity ── */}
        <section style={{ display: "grid", gap: 12 }}>
          <span style={sectionLabelStyle}>Activity</span>

          {loading && <div style={panelMessageStyle}>Loading…</div>}
          {error && !loading && <div style={panelMessageStyle}>{error}</div>}
          {!loading && !error && (data?.timeline?.length ?? 0) === 0 && (
            <div style={panelMessageStyle}>No activity this month.</div>
          )}

          {!loading && !error && (data?.timeline?.length ?? 0) > 0 && (
            <div>
              {data!.timeline.map((item, i) => {
                const isLast = i === data!.timeline.length - 1;
                const tone = kindTone(item.kind);
                const meta = [
                  eventKindLabel(item.kind),
                  item.relatedCategoryName,
                  item.subtitle,
                ].filter(Boolean).join(" · ");

                return (
                  <div key={item.id} style={{ display: "flex", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 14 }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: tone.dot,
                        flexShrink: 0,
                        marginTop: 5,
                      }} />
                      {!isLast && (
                        <div style={{ width: 1, flex: 1, background: "var(--border)", minHeight: 12, marginTop: 3, marginBottom: 3 }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 12 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <span style={txTitleStyle}>{item.title}</span>
                        <span style={{ ...amountTextStyle, color: tone.amount, flexShrink: 0 }}>
                          {item.direction === "in" ? "+" : "−"}<Money value={Math.abs(item.amount)} />
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                        <span style={metaTextStyle}>{meta}</span>
                        <span style={{ ...metaTextStyle, flexShrink: 0 }}>{formatDay(item.date)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </BottomSheet>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function kindTone(kind: TimelineItem["kind"]): { dot: string; amount: string } {
  if (kind === "funded" || kind === "moved_in") {
    return { dot: "var(--success)", amount: "var(--success)" };
  }
  if (kind === "moved_out") {
    return { dot: "var(--danger)", amount: "var(--danger)" };
  }
  // expense — neutral, expected spending
  return { dot: "var(--muted)", amount: "var(--text2)" };
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
  background: "color-mix(in srgb, var(--surface) 97%, white)",
  display: "flex",
  flexDirection: "column",
  borderRadius: 20,
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
  width: 40,
  height: 40,
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
  background: "var(--surface2)",
  borderRadius: 14,
  padding: "12px 0",
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
  fontSize: 10,
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

const statCurrencyStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 400,
  color: "var(--muted)",
  letterSpacing: 0.3,
};

const progressRailStyle: CSSProperties = {
  width: "100%",
  height: 4,
  borderRadius: 999,
  background: "var(--surface2)",
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "color-mix(in srgb, var(--accent) 65%, #d8f3c9)",
  transition: "width 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
};

/* Actions */

const actionRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
};

const primaryActionStyle: CSSProperties = {
  flex: 1,
  minHeight: 42,
  padding: "0 12px",
  borderRadius: 12,
  border: "none",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const secondaryActionStyle: CSSProperties = {
  ...primaryActionStyle,
  flex: "0 0 auto",
  background: "var(--surface2)",
  color: "var(--text2)",
};

/* Activity */

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
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

const txTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text2)",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const amountTextStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};

const metaTextStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  letterSpacing: 0.1,
};
