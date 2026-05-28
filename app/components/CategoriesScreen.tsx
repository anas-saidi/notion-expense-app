import { useMemo, useState, type CSSProperties } from "react";
import type { Category, MonthlySummary } from "./app-types";
import { CategoryIcon } from "./ui/CategoryIcon";
import { Money } from "./Money";
import { SearchIcon, ArrowLeftIcon, SlidersIcon } from "./ui/icons";

type Props = {
  categories: Category[];
  monthlySummary: MonthlySummary;
  homeMonth: string;
  selectedCategoryId: string;
  onSelectCategory: (cat: Category) => void;
  onOpenCategoryDetails: (cat: Category) => void;
  onOpenRebalance: () => void;
  onBack: () => void;
};

type Health = "over" | "low" | "ontrack" | "noplan";

const HEALTH_SORT: Record<Health, number> = { over: 0, low: 1, ontrack: 2, noplan: 3 };

function getHealth(spent: number, planned: number): Health {
  if (planned <= 0) return "noplan";
  if (spent > planned) return "over";
  if ((spent / planned) >= 0.82) return "low";
  return "ontrack";
}

function spentTone(spentPct: number, isOver: boolean): string {
  if (isOver) return "color-mix(in srgb, var(--spend-over) 75%, var(--spend-over-deep))";
  if (spentPct >= 85) return "color-mix(in srgb, var(--spend-warn) 70%, var(--spend-warn-deep))";
  if (spentPct >= 65) return "color-mix(in srgb, var(--spend-caution) 70%, var(--spend-caution-deep))";
  return "color-mix(in srgb, var(--accent) 65%, #d8f3c9)";
}

export function CategoriesScreen({
  categories,
  monthlySummary,
  homeMonth,
  selectedCategoryId,
  onSelectCategory,
  onOpenCategoryDetails,
  onOpenRebalance,
  onBack,
}: Props) {
  const [search, setSearch] = useState("");

  const isCurrentMonth = homeMonth === new Date().toISOString().slice(0, 7);

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthlySummary.spentByCategory ?? []) map.set(e.categoryId, e.total);
    return map;
  }, [monthlySummary.spentByCategory]);

  const plannedByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthlySummary.assignedByCategory ?? []) map.set(e.categoryId, e.total);
    return map;
  }, [monthlySummary.assignedByCategory]);

  const groups = useMemo(() => {
    const q = search.toLowerCase().trim();
    const rows = categories
      .filter(cat =>
        !q ||
        cat.name.toLowerCase().includes(q) ||
        cat.type.some(t => t.toLowerCase().includes(q))
      )
      .map(cat => {
        const planned = plannedByCategory.get(cat.id) ?? 0;
        const spent = spentByCategory.get(cat.id) ?? 0;
        const available = isCurrentMonth ? (cat.available ?? planned - spent) : planned - spent;
        const spentPct = planned > 0 ? Math.min(100, (Math.max(0, spent) / planned) * 100) : 0;
        const health = getHealth(spent, planned);
        const section = cat.type[0] ?? "Other";
        return { cat, planned, spent, available, spentPct, health, section };
      })
      .sort((a, b) => HEALTH_SORT[a.health] - HEALTH_SORT[b.health]);

    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!map.has(row.section)) map.set(row.section, []);
      map.get(row.section)!.push(row);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [categories, search, spentByCategory, plannedByCategory, isCurrentMonth]);

  return (
    <div id="panel-categories" role="region" aria-label="All categories" style={wrapStyle}>

      {/* Top bar */}
      <div style={topBarStyle}>
        <button type="button" onClick={onBack} style={backBtnStyle} aria-label="Back to home">
          <ArrowLeftIcon size={16} />
        </button>
        <button
          type="button"
          onClick={onOpenRebalance}
          style={rebalanceBtnStyle}
          aria-label="Rebalance budget"
        >
          <SlidersIcon size={15} />
        </button>
      </div>

      {/* Search */}
      <label style={searchWrapStyle}>
        <SearchIcon size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
        <input
          type="text"
          aria-label="Search categories"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search categories"
          style={searchInputStyle}
        />
      </label>

      {/* Category list — grouped by section */}
      <div style={listStyle}>
        {groups.length === 0 && (
          <div style={emptyStyle}>
            <SearchIcon size={15} style={{ color: "var(--muted)" }} />
            <div>
              <strong style={{ fontSize: 13, color: "var(--text2)" }}>No categories found</strong>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "3px 0 0" }}>
                Try a different search term.
              </p>
            </div>
          </div>
        )}

        {groups.map(({ label, items }) => (
          <section key={label} style={{ minWidth: 0 }}>
            <div style={sectionLabelStyle}>{label}</div>
            <div className="categories-scroll-rail" style={sectionRowsStyle}>
              {items.map(({ cat, available, spentPct, health }, i) => {
                const isOver  = health === "over";
                const isLow   = health === "low";
                const showTag = isOver || isLow;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { onSelectCategory(cat); onOpenCategoryDetails(cat); }}
                    aria-label={`${cat.name}`}
                    style={{
                      ...cardStyle,
                      ...(cat.id === selectedCategoryId ? selectedCardStyle : null),
                      animation: `fadeUp 0.22s ${Math.min(i * 0.02, 0.18)}s ease both`,
                    }}
                  >
                    <CategoryIcon
                      icon={cat.icon}
                      size={22}
                      style={{ color: cat.id === selectedCategoryId ? "var(--accent-ink)" : "var(--muted)", flexShrink: 0 }}
                    />
                    <span style={cardNameStyle}>{cat.name}</span>
                    {showTag && (
                      <span style={healthTagStyle(isOver)}>
                        {isOver ? "OVER" : "LOW"}
                      </span>
                    )}
                    <strong style={cardAmountStyle(isOver)}>
                      <Money value={available} />
                    </strong>
                    <span style={cardSubStyle(isOver)}>
                      {isOver ? "over budget" : "remaining"}
                    </span>
                    <div style={barTrackStyle}>
                      <div style={{
                        ...barFillStyle,
                        width: `${spentPct}%`,
                        background: spentTone(spentPct, isOver),
                      }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  paddingBottom: 80,
  animation: "fadeUp 0.2s ease both",
};

const topBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const backBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 8px 6px 2px",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "var(--accent-ink)",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};

const rebalanceBtnStyle: CSSProperties = {
  width: 36,
  height: 36,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const searchWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  minHeight: 42,
  padding: "0 12px",
  borderRadius: 12,
  background: "color-mix(in srgb, var(--surface) 86%, var(--surface2))",
  border: "1px solid color-mix(in srgb, var(--border2) 55%, transparent)",
};

const searchInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "transparent",
  padding: 0,
  border: "none",
  fontSize: 14,
  color: "var(--text2)",
  outline: "none",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: 6,
  paddingLeft: 2,
};

const sectionRowsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  padding: "2px 2px 8px",
};

const cardStyle: CSSProperties = {
  flex: "0 0 120px",
  minHeight: 152,
  borderRadius: 16,
  border: "none",
  background: "var(--surface)",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  gap: 4,
  padding: "14px 10px",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
};

const selectedCardStyle: CSSProperties = {
  border: "1px solid color-mix(in srgb, var(--accent) 38%, var(--border))",
  background: "linear-gradient(180deg, color-mix(in srgb, var(--accent-dim) 35%, var(--surface)) 0%, var(--surface) 84%)",
};

const cardNameStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--muted)",
  lineHeight: 1.2,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  maxWidth: "100%",
};

const healthTagStyle = (isOver: boolean): CSSProperties => ({
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: 1.1,
  textTransform: "uppercase",
  color: isOver ? "var(--danger)" : "var(--warning)",
  lineHeight: 1,
});

const cardAmountStyle = (isOver: boolean): CSSProperties => ({
  fontFamily: "var(--font-body)",
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: "-0.016em",
  color: isOver ? "var(--danger)" : "var(--text2)",
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
  marginTop: 2,
});

const cardSubStyle = (isOver: boolean): CSSProperties => ({
  fontFamily: "var(--font-body)",
  fontSize: 9,
  fontWeight: 400,
  letterSpacing: "0.01em",
  color: isOver
    ? "color-mix(in srgb, var(--danger) 55%, var(--muted))"
    : "var(--muted)",
  lineHeight: 1,
});

const barTrackStyle: CSSProperties = {
  width: "100%",
  height: 5,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 65%, white)",
  overflow: "hidden",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--border) 45%, transparent)",
};

const barFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 0.3s ease, background 0.4s ease",
};

const emptyStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "18px 2px",
  color: "var(--muted)",
};
