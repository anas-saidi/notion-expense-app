"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { FullScreenDelightIcon } from "./ui/FullScreenDelightIcon";
import { CloseIcon } from "./ui/DelightIcons";
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
};

export function CategoryDetailsSheet({
  open,
  category,
  month,
  onClose,
  onOpenAdd,
}: CategoryDetailsSheetProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CategoryActivityPayload | null>(null);

  useEffect(() => {
    if (!open) {
      setIsFullscreen(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !category?.id || !month) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/categories/${category.id}/activity?month=${month}&limit=${isFullscreen ? 24 : 8}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Failed to load category details");
        }
        if (!cancelled) setData(payload);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load category details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, category?.id, month, isFullscreen]);

  const summary = data?.summary;
  const details = data?.category;

  const spent = details?.spent ?? category?.planned ?? 0;
  const planned = details?.planned ?? category?.planned ?? 0;
  const available = details?.available ?? category?.available ?? 0;

  const spentPct = useMemo(() => {
    const safePlanned = Math.max(1, planned || 0);
    return Math.max(0, Math.min(100, (Math.max(0, spent || 0) / safePlanned) * 100));
  }, [planned, spent]);

  if (!open || !category) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${category.name} details`}
      style={sheetWrapStyle}
    >
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }} />
      <div
        style={{
          ...sheetStyle,
          width: isFullscreen ? "min(100%, 820px)" : "min(100%, 520px)",
          maxHeight: isFullscreen
            ? "calc(100dvh - 8px)"
            : "calc(100dvh - 20px - 88px - env(safe-area-inset-bottom, 0px))",
          borderRadius: isFullscreen ? 28 : "var(--card-radius)",
        }}
      >
        <div style={sheetInnerStyle}>
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
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => setIsFullscreen((value) => !value)}
                style={{
                  ...topActionStyle,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  background: isFullscreen ? "#e0f2fe" : undefined,
                  transition: "background 0.2s",
                }}
                aria-label={isFullscreen ? "Exit full screen" : "Go big mode!"}
                title={isFullscreen ? "Back to cozy view" : "Go big mode!"}
              >
                <FullScreenDelightIcon expanded={isFullscreen} />
              </button>
              <button onClick={onClose} aria-label="Close category details" style={closeButtonStyle}>
                <CloseIcon />
              </button>
            </div>
          </header>

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

          <section style={summarySectionStyle}>
            <SummaryChip label="Funded" value={summary?.fundedTotal ?? 0} tone="positive" />
            <SummaryChip label="Moved in" value={summary?.movedInTotal ?? 0} tone="positive" />
            <SummaryChip label="Moved out" value={summary?.movedOutTotal ?? 0} tone="negative" />
            <SummaryChip label="Expenses" value={summary?.spentTotal ?? 0} tone="negative" />
          </section>

          <section style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={eyebrowStyle}>Recent activity</div>
                <p style={{ marginTop: 6, fontSize: 13, color: "var(--text2)" }}>
                  Funding, transfers, and spending in one stream.
                </p>
              </div>
              <button type="button" onClick={onOpenAdd} style={primaryActionStyle}>
                Add transaction
              </button>
            </div>

            {loading && <div style={panelMessageStyle}>Loading category activity...</div>}
            {error && !loading && <div style={panelMessageStyle}>{error}</div>}
            {!loading && !error && (data?.timeline?.length ?? 0) === 0 && (
              <div style={panelMessageStyle}>No activity recorded for this month yet.</div>
            )}

            {!loading && !error && (data?.timeline?.length ?? 0) > 0 && (
              <div style={timelineListStyle}>
                {data?.timeline.map((item) => (
                  <article key={item.id} style={timelineRowStyle}>
                    <div style={{ ...timelineDotStyle, color: timelineTone(item.direction).color, background: timelineTone(item.direction).background }}>
                      {item.kind === "expense" ? "-" : item.direction === "in" ? "+" : "-"}
                    </div>
                    <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 650, color: "var(--text)", minWidth: 0 }}>{item.title}</div>
                        <div style={{ ...amountTextStyle, color: timelineTone(item.direction).color }}>
                          {item.direction === "in" ? "+" : "-"}
                          <Money value={Math.abs(item.amount)} />
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div style={metaTextStyle}>
                          {[item.subtitle, item.relatedCategoryName].filter(Boolean).join(" · ") || eventKindLabel(item.kind)}
                        </div>
                        <div style={metaTextStyle}>{formatDay(item.date)}</div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: "default" | "positive" | "negative";
}) {
  const palette =
    tone === "positive"
      ? { background: "color-mix(in srgb, var(--success) 10%, white)", color: "var(--success)" }
      : tone === "negative"
        ? { background: "color-mix(in srgb, var(--danger) 10%, white)", color: "var(--danger)" }
        : { background: "color-mix(in srgb, var(--surface2) 42%, white)", color: "var(--text)" };

  return (
    <div style={{ ...statCardStyle, background: palette.background }}>
      <div style={statLabelStyle}>{label}</div>
      <div style={{ ...statValueStyle, color: palette.color }}>
        <Money value={value ?? 0} />
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative";
}) {
  const palette = tone === "positive"
    ? { color: "var(--success)", background: "color-mix(in srgb, var(--success) 10%, white)" }
    : { color: "var(--danger)", background: "color-mix(in srgb, var(--danger) 10%, white)" };

  return (
    <div style={{ ...summaryChipStyle, background: palette.background }}>
      <span style={summaryChipLabelStyle}>{label}</span>
      <span style={{ ...summaryChipValueStyle, color: palette.color }}>
        <Money value={value} />
      </span>
    </div>
  );
}

function getScopeLabel(category: Category) {
  const typeHints = category.type.map((value) => value.toLowerCase());
  if (typeHints.some((value) => value.includes("saving") || value.includes("goal") || value.includes("sinking"))) {
    return "Savings";
  }
  if (category.isTeamFund) return "Household";
  if (category.owner?.toLowerCase().includes("salma")) return "Wife";
  if (category.owner?.toLowerCase().includes("anas")) return "Husband";
  return category.type[0] ?? "Category";
}

function formatMonthLabel(month: string) {
  const [year, monthValue] = month.split("-").map(Number);
  const date = new Date(year, (monthValue || 1) - 1, 1);
  return date.toLocaleDateString("en", { month: "long", year: "numeric" });
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

function timelineTone(direction: "in" | "out") {
  return direction === "in"
    ? {
        color: "var(--success)",
        background: "color-mix(in srgb, var(--success) 10%, white)",
      }
    : {
        color: "var(--danger)",
        background: "color-mix(in srgb, var(--danger) 10%, white)",
      };
}

const sheetWrapStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 76,
  background: "rgba(18, 16, 22, 0.24)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: "20px 14px calc(88px + env(safe-area-inset-bottom, 0px))",
};

const sheetStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background: "color-mix(in srgb, var(--surface) 97%, white)",
  border: "1px solid var(--card-border)",
  boxShadow: "var(--card-shadow)",
  animation: "fadeUp 0.24s ease both",
  display: "flex",
  flexDirection: "column",
};

const sheetInnerStyle: CSSProperties = {
  padding: "18px 18px 16px",
  overflowY: "auto",
  display: "grid",
  gap: 16,
};

const topBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const topActionStyle: CSSProperties = {
  minHeight: 36,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border2) 70%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 62%, white)",
  color: "var(--text2)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};

const closeButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border2) 70%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 70%, transparent)",
  color: "var(--text)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const iconOrbStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 16,
  background: "linear-gradient(180deg, color-mix(in srgb, var(--accent-dim) 58%, white) 0%, color-mix(in srgb, var(--surface2) 75%, white) 100%)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
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
  gap: 14,
  padding: "16px",
  borderRadius: 24,
  background: "linear-gradient(180deg, color-mix(in srgb, var(--accent-dim) 26%, white) 0%, color-mix(in srgb, var(--surface2) 48%, white) 100%)",
  border: "1px solid color-mix(in srgb, var(--border2) 62%, transparent)",
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
  gap: 10,
};

const statCardStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "12px 12px 11px",
  borderRadius: 18,
};

const statLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const statValueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
};

const summarySectionStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const summaryChipStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minHeight: 72,
  padding: "14px 14px 12px",
  borderRadius: 18,
};

const summaryChipLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.35,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const summaryChipValueStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
};

const primaryActionStyle: CSSProperties = {
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--accent) 38%, transparent)",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontWeight: 700,
  cursor: "pointer",
};

const panelMessageStyle: CSSProperties = {
  padding: "18px 0",
  color: "var(--muted)",
  fontSize: 14,
};

const timelineListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const timelineRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "36px minmax(0, 1fr)",
  gap: 12,
  alignItems: "start",
  padding: "12px 0",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 28%, transparent)",
};

const timelineDotStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 800,
};

const amountTextStyle: CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 12,
  fontWeight: 700,
  flexShrink: 0,
};

const metaTextStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
};
