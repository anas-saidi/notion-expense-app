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
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, category?.id, month]);

  const summary = data?.summary;
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
            <CategoryIcon icon={category.icon} style={iconOrbStyle} />
            <div style={{ minWidth: 0 }}>
              <div style={eyebrowStyle}>Category details</div>
              <div style={titleRowStyle}>
                <h2 style={titleStyle}>{details?.name ?? category.name}</h2>
                <span style={scopeBadgeStyle}>{getScopeLabel(category)}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close category details" style={closeButtonStyle}>
            <XIcon strokeWidth={2.2} />
          </button>
        </header>

        {/* ── Hero ── */}
        <section style={heroWrapStyle}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={eyebrowStyle}>Available now</div>
            <div style={heroValueStyle}>
              <Money value={available} />
            </div>
            <p style={heroCopyStyle}>
              {summary?.month ? `Live view for ${formatMonthLabel(summary.month)}.` : "This month at a glance."}
            </p>
          </div>

          <div style={progressRailStyle} aria-hidden="true">
            <div style={{ ...progressFillStyle, width: `${spentPct}%` }} />
          </div>

          <div style={heroStatGridStyle}>
            <StatCard label="Spent" value={spent} tone="default" />
            <StatCard label="Planned" value={planned} tone="default" />
            <StatCard label="Net flow" value={summary?.netFlow ?? 0} tone={(summary?.netFlow ?? 0) >= 0 ? "positive" : "negative"} />
          </div>
        </section>

        {/* ── Summary chips ── */}
        <section style={summarySectionStyle}>
          <SummaryChip label="Funded" value={summary?.fundedTotal ?? 0} tone="positive" />
          <SummaryChip label="Moved in" value={summary?.movedInTotal ?? 0} tone="positive" />
          <SummaryChip label="Moved out" value={summary?.movedOutTotal ?? 0} tone="negative" />
          <SummaryChip label="Expenses" value={summary?.spentTotal ?? 0} tone="negative" />
        </section>

        {/* ── Activity timeline ── */}
        <section style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={eyebrowStyle}>Recent activity</div>
              <p style={{ marginTop: 4, fontSize: 13, color: "var(--text2)", lineHeight: 1.4 }}>
                Funding, transfers, and spending in one stream.
              </p>
            </div>
            <div style={actionRowStyle}>
              <button type="button" onClick={onOpenAdd} style={secondaryActionStyle}>
                <PlusIcon size={15} strokeWidth={2.3} />
                Add
              </button>
              <button type="button" onClick={onOpenFund} style={primaryActionStyle}>
                <FundIcon size={15} strokeWidth={2.3} />
                Fund
              </button>
            </div>
          </div>

          {loading && <div style={panelMessageStyle}>Loading activity…</div>}
          {error && !loading && <div style={panelMessageStyle}>{error}</div>}
          {!loading && !error && (data?.timeline?.length ?? 0) === 0 && (
            <div style={panelMessageStyle}>No activity recorded for this month yet.</div>
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
                  <div key={item.id} style={{ display: "flex", gap: 14 }}>
                    {/* Dot + connector line */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 16 }}>
                      <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: tone.dot,
                        border: "2px solid var(--surface)",
                        boxShadow: `0 0 0 1px ${tone.dot}`,
                        flexShrink: 0,
                        marginTop: 4,
                        zIndex: 1,
                      }} />
                      {!isLast && (
                        <div style={{
                          width: 1,
                          flex: 1,
                          background: "var(--card-border)",
                          minHeight: 16,
                          marginTop: 3,
                          marginBottom: 3,
                        }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 14 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--text)",
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {item.title}
                        </div>
                        <div style={{ ...amountTextStyle, color: tone.amount, flexShrink: 0 }}>
                          {item.direction === "in" ? "+" : "−"}<Money value={Math.abs(item.amount)} />
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 3 }}>
                        <div style={metaTextStyle}>{meta}</div>
                        <div style={{ ...metaTextStyle, flexShrink: 0 }}>{formatDay(item.date)}</div>
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

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, tone }: { label: string; value: number | null; tone: "default" | "positive" | "negative" }) {
  const color =
    tone === "positive" ? "var(--success)"
    : tone === "negative" ? "var(--danger)"
    : "var(--text)";
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={{ ...statValueStyle, color }}><Money value={value ?? 0} /></div>
    </div>
  );
}

function SummaryChip({ label, value, tone }: { label: string; value: number; tone: "positive" | "negative" }) {
  const color = tone === "positive" ? "var(--success)" : "var(--danger)";
  return (
    <div style={summaryChipStyle}>
      <span style={summaryChipLabelStyle}>{label}</span>
      <span style={{ ...summaryChipValueStyle, color }}><Money value={value} /></span>
    </div>
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

function getScopeLabel(category: Category) {
  const typeHints = category.type.map((v) => v.toLowerCase());
  if (typeHints.some((v) => v.includes("saving") || v.includes("goal") || v.includes("sinking"))) return "Savings";
  if (category.isTeamFund) return "Household";
  if (category.owner?.toLowerCase().includes("salma")) return "Wife";
  if (category.owner?.toLowerCase().includes("anas")) return "Husband";
  return category.type[0] ?? "Category";
}

function formatMonthLabel(month: string) {
  const [year, monthValue] = month.split("-").map(Number);
  return new Date(year, (monthValue || 1) - 1, 1).toLocaleDateString("en", { month: "long", year: "numeric" });
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
  gap: 18,
};

const topBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const closeButtonStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border2) 70%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 70%, transparent)",
  color: "var(--text)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const iconOrbStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 16,
  background: "linear-gradient(180deg, color-mix(in srgb, var(--accent-dim) 58%, white) 0%, color-mix(in srgb, var(--surface2) 75%, white) 100%)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  flexShrink: 0,
};

const titleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 4,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 28,
  lineHeight: 0.95,
  fontWeight: 800,
  color: "var(--text)",
  margin: 0,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const scopeBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "0 8px",
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 55%, white)",
  color: "var(--text2)",
  fontSize: 11,
  fontWeight: 700,
};

const heroWrapStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  padding: "4px 0 16px",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 28%, transparent)",
};

const heroValueStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(2.3rem, 7vw, 3.8rem)",
  lineHeight: 0.92,
  fontWeight: 800,
  color: "var(--text)",
};

const heroCopyStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "var(--text2)",
};

const progressRailStyle: CSSProperties = {
  width: "100%",
  height: 10,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 70%, white)",
  overflow: "hidden",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--border) 45%, transparent)",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, color-mix(in srgb, #d97706 82%, white) 0%, color-mix(in srgb, #ef4444 74%, white) 100%)",
  transition: "width 0.3s ease",
};

const heroStatGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const statCardStyle: CSSProperties = { display: "grid", gap: 6 };

const statLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const statValueStyle: CSSProperties = { fontSize: 14, fontWeight: 700 };

const summarySectionStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  paddingBottom: 2,
};

const summaryChipStyle: CSSProperties = { display: "grid", gap: 4 };

const summaryChipLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.35,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const summaryChipValueStyle: CSSProperties = { fontSize: 16, fontWeight: 700 };

const primaryActionStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 13px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--accent) 38%, transparent)",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  whiteSpace: "nowrap",
};

const secondaryActionStyle: CSSProperties = {
  ...primaryActionStyle,
  border: "1px solid color-mix(in srgb, var(--border2) 66%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 56%, white)",
  color: "var(--text2)",
};

const actionRowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
};

const panelMessageStyle: CSSProperties = {
  padding: "14px 0",
  color: "var(--muted)",
  fontSize: 14,
};

const amountTextStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 12,
  fontWeight: 700,
};

const metaTextStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  fontFamily: "'DM Mono', monospace",
  letterSpacing: 0.1,
};
