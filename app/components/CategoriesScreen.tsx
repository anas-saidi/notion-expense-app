"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { BudgetScope, Category, MonthlySummary } from "./app-types";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SearchIcon, ShuffleIcon, FreezeIcon, ChevronRightIcon } from "./ui/icons";
import { fmt, getCategoryScope } from "./app-utils";

type Props = {
  categories: Category[];
  frozenCategories: Category[];
  monthlySummary: MonthlySummary;
  homeMonth: string;
  selectedCategoryId: string;
  onSelectCategory: (cat: Category) => void;
  onOpenCategoryDetails: (cat: Category) => void;
  onOpenRebalance: () => void;
  onFreezeCategory: (cat: Category) => void;
  onReviveCategory: (cat: Category) => void;
  onFundCategory: (cat: Category) => void;
};

type ScopeChip = BudgetScope;
type Health = "over" | "low" | "ontrack" | "noplan";

const HEALTH_SORT: Record<Health, number> = { over: 0, low: 1, ontrack: 2, noplan: 3 };

const SCOPE_CHIPS: { value: ScopeChip; emoji: string; label: string }[] = [
  { value: "joint", emoji: "👫", label: "Joint" },
  { value: "anas",  emoji: "👨", label: "Anas" },
  { value: "salma", emoji: "👩", label: "Salma" },
];

const CHIP_BG: Record<ScopeChip, string> = {
  joint: "var(--accent)",
  anas:  "var(--partner-husband)",
  salma: "var(--partner-wife)",
};

const CHIP_INK: Record<ScopeChip, string> = {
  joint: "var(--accent-ink)",
  anas:  "#ffffff",
  salma: "#ffffff",
};

const CHIP_COLOR: Record<ScopeChip, string> = {
  joint: "var(--accent)",
  anas:  "var(--partner-husband)",
  salma: "var(--partner-wife)",
};

function getHealth(spent: number, planned: number): Health {
  if (planned <= 0) return "noplan";
  if (spent > planned) return "over";
  if ((spent / planned) >= 0.82) return "low";
  return "ontrack";
}

/* ─── Main screen ─────────────────────────────────────────────── */

export function CategoriesScreen({
  categories,
  frozenCategories,
  monthlySummary,
  homeMonth,
  onSelectCategory,
  onOpenCategoryDetails,
  onOpenRebalance,
  onFreezeCategory,
  onReviveCategory,
  onFundCategory,
}: Props) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<ScopeChip>("joint");
  const [freezingId, setFreezingId] = useState<string | null>(null);
  const [showFrozenAll, setShowFrozenAll] = useState(false);

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

  const activeGroups = useMemo(() => {
    const q = search.toLowerCase().trim();
    const items = categories
      .filter(cat => {
        if (q && !cat.name.toLowerCase().includes(q) && !cat.type.some(t => t.toLowerCase().includes(q))) return false;
        if (getCategoryScope(cat) !== scope) return false;
        return true;
      })
      .map(cat => {
        const planned = plannedByCategory.get(cat.id) ?? 0;
        const spent = spentByCategory.get(cat.id) ?? 0;
        const available = isCurrentMonth ? (cat.available ?? planned - spent) : planned - spent;
        const health = getHealth(spent, planned);
        const section = cat.type[0] ?? "Other";
        return { cat, planned, spent, available, health, section };
      })
      .sort((a, b) => HEALTH_SORT[a.health] - HEALTH_SORT[b.health]);

    const map = new Map<string, typeof items>();
    for (const row of items) {
      if (!map.has(row.section)) map.set(row.section, []);
      map.get(row.section)!.push(row);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [categories, search, scope, spentByCategory, plannedByCategory, isCurrentMonth]);

  // Frozen preview: flat, first 5, unfiltered (always visible regardless of scope)
  const frozenPreview = frozenCategories.slice(0, 5);

  if (showFrozenAll) {
    return (
      <FrozenAllScreen
        frozenCategories={frozenCategories}
        onBack={() => setShowFrozenAll(false)}
        onSelectCategory={onSelectCategory}
        onOpenCategoryDetails={onOpenCategoryDetails}
        onReviveCategory={onReviveCategory}
      />
    );
  }

  return (
    <div id="panel-budget" role="tabpanel" aria-labelledby="tab-budget" style={wrapStyle}>

      {/* Header */}
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Manage</div>
          <h1 style={titleStyle}>Budget</h1>
        </div>
      </div>

      {/* Scope chips + Rebalance on same row */}
      <div style={pillRailStyle} role="tablist" aria-label="Budget scope">
        {SCOPE_CHIPS.map(({ value, emoji, label }) => (
          <ScopeChipBtn
            key={value}
            value={value}
            emoji={emoji}
            label={label}
            active={scope === value}
            onClick={() => setScope(value)}
          />
        ))}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onOpenRebalance}
          style={rebalanceBtnStyle}
          aria-label="Rebalance budget"
        >
          <ShuffleIcon size={14} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Rebalance</span>
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

      {/* Active groups */}
      {activeGroups.length === 0
        ? <div style={emptyStyle}>No categories found.</div>
        : <div style={groupsStyle}>
            {activeGroups.map(({ label, items }) => (
              <section key={label} style={{ minWidth: 0 }}>
                <div style={sectionLabelStyle}>{label}</div>
                <div className="home-scroll-rail" style={railStyle}>
                  {items.map(({ cat, available, spent, planned, health }, i) => {
                    const isOver    = health === "over";
                    const isLow     = health === "low";
                    const amountNum = isOver ? spent - planned : Math.abs(available);
                    const amountStr = health === "noplan" ? "—" : fmt(amountNum);
                    const unitStr   = health === "noplan" ? "No plan"
                                    : isOver              ? "MAD over"
                                    :                       "MAD left";
                    const progressPct = planned > 0 ? Math.min(100, (spent / planned) * 100) : 0;
                    return (
                      <div
                        key={cat.id}
                        className={freezingId === cat.id ? "category-card--freezing" : undefined}
                        style={{ ...cardStyle, animation: `fadeUp 0.22s ${Math.min(i * 0.025, 0.2)}s ease both` }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setFreezingId(cat.id);
                            setTimeout(() => onFreezeCategory(cat), 260);
                            setTimeout(() => setFreezingId(null), 420);
                          }}
                          aria-label={`Freeze ${cat.name}`}
                          className="freeze-btn"
                          style={freezeBtnStyle}
                        >
                          <FreezeIcon size={9} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenCategoryDetails(cat)}
                          style={cardBodyStyle}
                          aria-label={`${cat.name}${isOver ? ", over budget" : isLow ? ", low" : ""}`}
                        >
                          <div style={cardTopStyle}>
                            <CategoryIcon icon={cat.icon} size={22} style={{ flexShrink: 0 }} />
                            <span style={cardNameStyle}>{cat.name}</span>
                            {(isOver || isLow) && (
                              <span style={cardBadgeStyle(isOver)}>
                                {isOver ? "OVER" : "LOW"}
                              </span>
                            )}
                          </div>
                          <div style={cardBottomStyle}>
                            {health !== "noplan" && (
                              <div style={progressTrackStyle}>
                                <div style={{
                                  height: "100%",
                                  width: `${progressPct}%`,
                                  borderRadius: 999,
                                  background: health === "over" ? "var(--danger)"
                                             : health === "low"  ? "var(--warning)"
                                             :                     "color-mix(in srgb, var(--accent) 65%, #d8f3c9)",
                                  transition: "width 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
                                }} />
                              </div>
                            )}
                            <span style={cardAmountStyle(health)}>{amountStr}</span>
                            <span style={cardUnitStyle}>{unitStr}</span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
      }

      {/* Frozen preview */}
      {frozenPreview.length > 0 && (
        <div style={frozenPreviewWrapStyle}>
          <div style={frozenPreviewHeaderStyle}>
            <div style={frozenPreviewLabelStyle}>
              <FreezeIcon size={10} strokeWidth={2} style={{ opacity: 0.5 }} />
              <span>Frozen · {frozenCategories.length}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowFrozenAll(true)}
              style={seeAllBtnStyle}
              aria-label="See all frozen categories"
            >
              See all
              <ChevronRightIcon size={12} strokeWidth={2.5} />
            </button>
          </div>
          <div className="home-scroll-rail" style={railStyle}>
            {frozenPreview.map((cat, i) => (
              <div
                key={cat.id}
                style={{ ...cardStyle, animation: `fadeUp 0.22s ${Math.min(i * 0.025, 0.2)}s ease both` }}
              >
                <button
                  type="button"
                  onClick={() => onOpenCategoryDetails(cat)}
                  style={cardBodyStyle}
                  aria-label={cat.name}
                >
                  <CategoryIcon icon={cat.icon} size={22} style={{ opacity: 0.35, flexShrink: 0 }} />
                  <span style={{ ...cardNameStyle, opacity: 0.45 }}>{cat.name}</span>
                  <span style={cardUnitStyle}>Frozen</span>
                </button>
                <button
                  type="button"
                  onClick={() => onReviveCategory(cat)}
                  style={cardActionStyle}
                >
                  Revive
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

/* ─── Frozen all screen ────────────────────────────────────────── */

function FrozenAllScreen({
  frozenCategories,
  onBack,
  onSelectCategory,
  onOpenCategoryDetails,
  onReviveCategory,
}: {
  frozenCategories: Category[];
  onBack: () => void;
  onSelectCategory: (cat: Category) => void;
  onOpenCategoryDetails: (cat: Category) => void;
  onReviveCategory: (cat: Category) => void;
}) {
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const q = search.toLowerCase().trim();
    const items = frozenCategories
      .filter(cat =>
        !q ||
        cat.name.toLowerCase().includes(q) ||
        cat.type.some(t => t.toLowerCase().includes(q))
      )
      .map(cat => ({ cat, section: cat.type[0] ?? "Other" }));

    const map = new Map<string, typeof items>();
    for (const row of items) {
      if (!map.has(row.section)) map.set(row.section, []);
      map.get(row.section)!.push(row);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [frozenCategories, search]);

  return (
    <div style={{ ...wrapStyle, animation: "fadeUp 0.2s ease both" }}>

      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={onBack}
            style={backBtnStyle}
            aria-label="Back to budget"
          >
            ←
          </button>
          <div>
            <div style={eyebrowStyle}>Budget</div>
            <h1 style={titleStyle}>Frozen</h1>
          </div>
        </div>
      </div>

      {/* Search */}
      <label style={searchWrapStyle}>
        <SearchIcon size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
        <input
          type="text"
          aria-label="Search frozen categories"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search frozen"
          style={searchInputStyle}
        />
      </label>

      {/* Grouped frozen rails */}
      {groups.length === 0
        ? <div style={emptyStyle}>No frozen categories.</div>
        : <div style={groupsStyle}>
            {groups.map(({ label, items }) => (
              <section key={label} style={{ minWidth: 0 }}>
                <div style={sectionLabelStyle}>{label}</div>
                <div className="home-scroll-rail" style={railStyle}>
                  {items.map(({ cat }, i) => (
                    <div
                      key={cat.id}
                      style={{ ...cardStyle, animation: `fadeUp 0.22s ${Math.min(i * 0.025, 0.2)}s ease both` }}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenCategoryDetails(cat)}
                        style={cardBodyStyle}
                        aria-label={cat.name}
                      >
                        <CategoryIcon icon={cat.icon} size={22} style={{ opacity: 0.35, flexShrink: 0 }} />
                        <span style={{ ...cardNameStyle, opacity: 0.45 }}>{cat.name}</span>
                        <span style={cardUnitStyle}>Frozen</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onReviveCategory(cat)}
                        style={cardActionStyle}
                      >
                        Revive
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
      }

    </div>
  );
}

/* ─── Scope chip button ────────────────────────────────────────── */

function ScopeChipBtn({
  value,
  emoji,
  label,
  active,
  onClick,
}: {
  value: ScopeChip;
  emoji: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={active ? `${label}, selected` : `Filter by ${label}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={active ? {
        height: 38,
        borderRadius: 12,
        border: "none",
        background: CHIP_BG[value],
        color: CHIP_INK[value],
        padding: "0 14px 0 10px",
        gap: 7,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        transform: pressed ? "scale(0.95)" : "translateY(-1px)",
        transition: "transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)",
        animation: "categorySelectIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
        flexShrink: 0,
      } : {
        width: 38,
        height: 38,
        borderRadius: 12,
        border: "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
        background: "transparent",
        color: CHIP_COLOR[value],
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.9 : hovered ? 0.75 : 0.45,
        transform: pressed ? "scale(0.93)" : hovered ? "translateY(-2px)" : "none",
        transition: "opacity 0.18s ease, transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
      {active && (
        <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}
    </button>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  paddingBottom: 80,
  animation: "fadeUp 0.2s ease both",
  minWidth: 0,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 14,
  paddingTop: 8,
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const titleStyle: CSSProperties = {
  margin: "4px 0 0",
  fontFamily: "var(--font-display)",
  fontSize: 34,
  lineHeight: 0.95,
  color: "var(--text)",
};

const rebalanceBtnStyle: CSSProperties = {
  minHeight: 36,
  padding: "0 8px",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  flexShrink: 0,
  opacity: 0.65,
};

const backBtnStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
  flexShrink: 0,
};

const pillRailStyle: CSSProperties = {
  display: "flex",
  gap: 8,
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

const groupsStyle: CSSProperties = {
  display: "grid",
  gap: 20,
  minWidth: 0,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: 8,
  paddingLeft: 2,
};

const railStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  padding: "2px 4px 8px",
  minWidth: 0,
};

/* ─── Frozen preview ────────────────────────────────────────────── */

const frozenPreviewWrapStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const frozenPreviewHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingLeft: 2,
};

const frozenPreviewLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "var(--muted)",
  opacity: 0.65,
};

const seeAllBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: "4px 0",
  border: "none",
  background: "transparent",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text2)",
  cursor: "pointer",
  opacity: 0.65,
};

/* ─── Card ─────────────────────────────────────────────────────── */

const cardStyle: CSSProperties = {
  flex: "0 0 120px",
  borderRadius: 16,
  background: "var(--surface)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
  position: "relative",
  overflow: "hidden",
};

const freezeBtnStyle: CSSProperties = {
  position: "absolute",
  top: 7,
  right: 7,
  width: 22,
  height: 22,
  borderRadius: 99,
  border: "none",
  background: "var(--info)",
  color: "white",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const cardBodyStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 10px 12px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  width: "100%",
  textAlign: "center",
  gap: 8,
};

const cardTopStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 5,
};

const cardBottomStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  width: "100%",
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
  textAlign: "center",
};

const cardBadgeStyle = (isOver: boolean): CSSProperties => ({
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: 1.1,
  textTransform: "uppercase",
  color: isOver ? "var(--danger)" : "var(--warning)",
  lineHeight: 1,
});

const cardAmountStyle = (health: Health): CSSProperties => ({
  fontFamily: "var(--font-body)",
  fontSize: 15,
  fontWeight: 500,
  lineHeight: 1,
  color: health === "over"   ? "var(--danger)"
       : health === "low"    ? "var(--warning)"
       : health === "noplan" ? "var(--muted)"
       :                       "var(--text2)",
});

const cardUnitStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 400,
  color: "var(--muted)",
  lineHeight: 1,
};

const progressTrackStyle: CSSProperties = {
  width: "100%",
  height: 3,
  borderRadius: 999,
  background: "var(--surface2)",
  overflow: "hidden",
};

const cardActionStyle: CSSProperties = {
  margin: "0 10px 10px",
  padding: "5px 0",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  fontSize: 11,
  fontWeight: 500,
  color: "var(--text2)",
  cursor: "pointer",
  alignSelf: "stretch",
};

const emptyStyle: CSSProperties = {
  padding: "22px 10px",
  color: "var(--muted)",
  fontSize: 14,
  textAlign: "center",
};
