"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { BottomSheet } from "./ui/BottomSheet";
import { FundIcon, PlusIcon, XIcon } from "./ui/icons";
import type { Category } from "./app-types";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";

type MonthBar = {
  month: string;
  spent: number;
  planned: number;
};

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
  const [historyBars, setHistoryBars] = useState<MonthBar[] | null>(null);

  const [activePanel, setActivePanel] = useState<0 | 1>(0);

  useEffect(() => {
    if (!open || !category?.id || !month) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/categories/${category.id}/activity?month=${month}&limit=20`).then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Failed to load category details");
        return payload as CategoryActivityPayload;
      }),
      fetch(`/api/categories/${category.id}/history?months=6`).then(async (res) => {
        const payload = await res.json();
        return res.ok ? (payload.history as MonthBar[]) : null;
      }).catch(() => null),
    ])
      .then(([activity, history]) => {
        if (cancelled) return;
        setData(activity);
        setHistoryBars(history);
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
            <CategoryIcon icon={category.icon} style={{ fontSize: 28, flexShrink: 0 }} />
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

        {/* ── Inline tab + content ── */}
        <section style={panelSectionStyle}>
          <div style={panelTabsStyle}>
            <button type="button" style={panelTabStyle(activePanel === 0)} onClick={() => setActivePanel(0)}>
              Overview
            </button>
            <button type="button" style={panelTabStyle(activePanel === 1)} onClick={() => setActivePanel(1)}>
              History
            </button>
          </div>

          <div key={activePanel} style={{ animation: "fadeUp 0.18s ease both" }}>
            {activePanel === 0 ? (
              <section style={heroWrapStyle}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={eyebrowStyle}>Available now</div>
                  <div style={heroValueStyle}>
                    <Money value={available} />
                  </div>
                </div>
                <div style={progressRailStyle} aria-hidden="true">
                  <div style={{ ...progressFillStyle, width: `${spentPct}%` }} />
                </div>
                <div style={heroStatGridStyle}>
                  <StatCard label="Planned" value={planned} />
                  <StatCard label="Spent" value={spent} tone={spentPct >= 100 ? "negative" : spentPct >= 85 ? "warn" : "default"} />
                </div>
              </section>
            ) : loading ? (
              <div style={panelMessageStyle}>Loading history…</div>
            ) : !historyBars || !historyBars.some((b) => b.spent > 0) ? (
              <div style={panelMessageStyle}>No spending history yet.</div>
            ) : (
              <SpendingBarChart bars={historyBars} categoryPlanned={planned} height={150} />
            )}
          </div>
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
                          background: "var(--border)",
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
                          color: "var(--text2)",
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

function SpendingBarChart({ bars, categoryPlanned, height = 108 }: { bars: MonthBar[]; categoryPlanned: number; height?: number }) {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const monthLabel = (month: string) => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en", { month: "short" });
  };

  return (
    <div style={{ paddingTop: 4 }}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={bars} barCategoryGap="32%" margin={{ top: 10, right: 2, bottom: 0, left: 2 }}>
          <XAxis
            dataKey="month"
            tickFormatter={monthLabel}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontFamily: "var(--font-body)", fill: "#6e6e6d" }}
            interval={0}
          />
          {categoryPlanned > 0 && (
            <ReferenceLine
              y={categoryPlanned}
              stroke="#6e6e6d"
              strokeDasharray="4 3"
              strokeWidth={1}
              strokeOpacity={0.55}
            />
          )}
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const bar = payload[0].payload as MonthBar;
              if (!bar.spent) return null;
              return (
                <div style={chartTooltipStyle}>
                  {Math.round(bar.spent).toLocaleString("fr-MA")} MAD
                </div>
              );
            }}
          />
          <Bar dataKey="spent" radius={[5, 5, 2, 2]} maxBarSize={40}>
            {bars.map((bar) => {
              const isCurrent = bar.month === currentMonth;
              const isOver = bar.spent > bar.planned && bar.planned > 0;
              const fill = isCurrent
                ? isOver ? "#ef4444" : "#9fe870"
                : isOver ? "#fca5a5" : "#dde2d9";
              return <Cell key={bar.month} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: number | null; tone?: "default" | "positive" | "negative" | "warn" }) {
  const color =
    tone === "positive" ? "var(--success)"
    : tone === "negative" ? "var(--spend-over)"
    : tone === "warn" ? "var(--spend-warn)"
    : "var(--text2)";
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={{ ...statValueStyle, color }}><Money value={value ?? 0} /></div>
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
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
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
  fontFamily: "var(--font-body)",
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
  padding: "4px 0 8px",
};

const heroValueStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(2.3rem, 7vw, 3.8rem)",
  lineHeight: 0.92,
  fontWeight: 800,
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
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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


const chartTooltipStyle: CSSProperties = {
  background: "#0e0f0c",
  color: "#ffffff",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 11,
  fontFamily: "var(--font-body)",
  whiteSpace: "nowrap",
  pointerEvents: "none",
};

const panelMessageStyle: CSSProperties = {
  padding: "14px 0",
  color: "var(--muted)",
  fontSize: 14,
};

const amountTextStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  fontWeight: 700,
};

const metaTextStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--muted)",
  fontFamily: "var(--font-body)",
  letterSpacing: 0.1,
};

// ── Panel tab styles ──────────────────────────────────────────────────────────

const panelSectionStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const panelTabsStyle: CSSProperties = {
  display: "inline-flex",
  gap: 6,
  alignSelf: "flex-start",
};

const panelTabStyle = (active: boolean): CSSProperties => ({
  padding: "5px 14px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
  background: active ? "var(--text)" : "transparent",
  color: active ? "var(--surface)" : "var(--muted)",
  transition: "background 0.15s ease, color 0.15s ease",
  letterSpacing: 0.1,
});
