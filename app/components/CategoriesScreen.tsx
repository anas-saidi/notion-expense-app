"use client";

import { useMemo, useState, useRef, useEffect, type CSSProperties } from "react";
import type { Account, BudgetScope, Category, MonthlySummary } from "./app-types";
import { CategoryIcon } from "./ui/CategoryIcon";
import { SearchIcon, ShuffleIcon, FreezeIcon, ChevronRightIcon } from "./ui/icons";
import { fmt, getCategoryScope } from "./app-utils";
import { PieChart, Pie, Cell, Sector } from "recharts";
import type { PieSectorShapeProps } from "recharts";

const CHART_COLORS = [
  "var(--accent)",
  "var(--partner-husband)",
  "var(--partner-wife)",
  "#a78bfa",
  "#fb923c",
  "#34d399",
  "#60a5fa",
];

type Props = {
  categories: Category[];
  frozenCategories: Category[];
  accounts: Account[];
  monthlySummary: MonthlySummary;
  homeMonth: string;
  selectedCategoryId: string;
  onSelectCategory: (cat: Category) => void;
  onOpenCategoryDetails: (cat: Category) => void;
  onOpenRebalance: () => void;
  onFreezeCategory: (cat: Category) => void;
  onReviveCategory: (cat: Category) => void;
  onFundCategory: (cat: Category) => void;
  onOpenNewCategory?: (defaultType: string) => void;
};

type ScopeChip = BudgetScope;
type Health = "over" | "low" | "funded" | "unfunded";

const HEALTH_SORT: Record<Health, number> = { over: 0, low: 1, funded: 2, unfunded: 3 };

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

function getHealth(spent: number, assigned: number, available: number | null): Health {
  if (available !== null && available < 0) return "over";
  if (assigned <= 0) return "unfunded";
  if ((spent / assigned) >= 0.82) return "low";
  return "funded";
}

/* ─── Main screen ─────────────────────────────────────────────── */

export function CategoriesScreen({
  categories,
  frozenCategories,
  accounts,
  monthlySummary,
  homeMonth,
  onSelectCategory,
  onOpenCategoryDetails,
  onOpenRebalance,
  onFreezeCategory,
  onReviveCategory,
  onFundCategory,
  onOpenNewCategory,
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
        if (getCategoryScope(cat, accounts) !== scope) return false;
        return true;
      })
      .map(cat => {
        const assigned = plannedByCategory.get(cat.id) ?? 0;  // this month's Funds DB
        const spent = spentByCategory.get(cat.id) ?? 0;
        const available = cat.available;                       // Notion formula, no math
        const health = getHealth(spent, assigned, cat.available);
        const section = cat.type[0] ?? "Other";
        return { cat, planned: assigned, spent, available, health, section };
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
    <div id="panel-budget" role="tabpanel" aria-labelledby="tab-budget" className="categories-main" style={wrapStyle}>

      {/* Header row: title left, scope chips + rebalance right on desktop */}
      <div className="categories-header-row">

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

      </div>{/* end categories-header-row */}

      {/* Budget distribution chart */}
      <BudgetDistributionChart
        key={scope}
        categories={categories}
        monthlySummary={monthlySummary}
        homeMonth={homeMonth}
        scope={scope}
        onSelectCategory={onOpenCategoryDetails}
      />

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
        : <div className="categories-groups" style={groupsStyle}>
            {activeGroups.map(({ label, items }) => (
              <section key={label} style={{ minWidth: 0 }}>
                <div style={sectionLabelStyle}>{label}</div>
                <div className="home-scroll-rail" style={railStyle}>
                  {items.map(({ cat, available, spent, planned, health }, i) => (
                    <CategoryCard
                      key={cat.id}
                      cat={cat}
                      available={available}
                      spent={spent}
                      planned={planned}
                      health={health}
                      index={i}
                      isFreezingId={freezingId === cat.id}
                      onFreeze={() => {
                        setFreezingId(cat.id);
                        setTimeout(() => onFreezeCategory(cat), 260);
                        setTimeout(() => setFreezingId(null), 420);
                      }}
                      onOpenDetails={() => onOpenCategoryDetails(cat)}
                    />
                  ))}
                  {onOpenNewCategory && (
                    <button
                      type="button"
                      onClick={() => onOpenNewCategory(label)}
                      aria-label={`Add new ${label} category`}
                      className="ghost-card"
                      style={ghostCardStyle}
                    >
                      <span style={{ fontSize: 22, lineHeight: 1, color: "var(--muted)", opacity: 0.5 }}>＋</span>
                    </button>
                  )}
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
        : <div className="categories-groups" style={groupsStyle}>
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

/* ─── Category card (owns count-up + bar animation) ───────────── */

function CategoryCard({
  cat, available, spent, planned, health, index, isFreezingId, onFreeze, onOpenDetails,
}: {
  cat: import("./app-types").Category;
  available: number | null; spent: number; planned: number;
  health: Health; index: number; isFreezingId: boolean;
  onFreeze: () => void; onOpenDetails: () => void;
}) {
  const amountNum = Math.abs(available ?? 0);
  const progressPct = planned > 0 ? Math.min(100, (spent / planned) * 100) : 0;

  // Count up from 0 on every mount (scope switch remounts cards with new cat.id keys)
  const displayAmount = useCountUp(amountNum, 580, 0);
  const amountStr = available === null ? "—" : fmt(Math.round(displayAmount));
  const unitStr   = available === null ? "" : "MAD";

  // Progress bar: scaleX from 0 on mount, transition on subsequent updates
  const [barScale, setBarScale] = useState(0);
  useEffect(() => { setBarScale(progressPct / 100); }, [progressPct]);

  const barColor = health === "over" ? "var(--danger)"
                 : health === "low"  ? "var(--warning)"
                 :                     "color-mix(in srgb, var(--accent) 65%, #d8f3c9)";

  return (
    <div
      className={isFreezingId ? "category-card--freezing" : undefined}
      style={{ ...cardStyle, animation: `fadeUp 0.22s ${Math.min(index * 0.025, 0.2)}s ease both` }}
    >
      <button type="button" onClick={onFreeze} aria-label={`Freeze ${cat.name}`}
        className="freeze-btn" style={freezeBtnStyle}>
        <FreezeIcon size={9} strokeWidth={2.5} />
      </button>
      <button type="button" onClick={onOpenDetails} style={cardBodyStyle}
        aria-label={`${cat.name}${health === "over" ? ", overbudget" : health === "low" ? ", low" : health === "funded" ? ", funded" : ", unfunded"}`}>
        <div style={cardTopStyle}>
          <CategoryIcon icon={cat.icon} size={22} style={{ flexShrink: 0 }} />
          <span style={cardNameStyle}>{cat.name}</span>
          <span style={cardBadgeStyle(health)}>
            {health === "over" ? "Overbudget" : health === "low" ? "Low" : health === "funded" ? "Funded" : "Unfunded"}
          </span>
        </div>
        <div style={cardBottomStyle}>
          {(health === "funded" || health === "low" || health === "over") && (
            <div style={progressTrackStyle}>
              <div style={{
                height: "100%", width: "100%", borderRadius: 999,
                background: barColor,
                transformOrigin: "left center",
                transform: `scaleX(${barScale})`,
                transition: "transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)",
              }} />
            </div>
          )}
          <span style={cardAmountStyle(health)}>{amountStr}</span>
          <span style={cardUnitStyle}>{unitStr}</span>
        </div>
      </button>
    </div>
  );
}

/* ─── Count-up animation hook ──────────────────────────────────── */

function useCountUp(target: number, duration = 750, from = target): number {
  const [display, setDisplay] = useState(from);
  const prevTarget = useRef(from);
  useEffect(() => {
    const startFrom = prevTarget.current;
    prevTarget.current = target;
    if (startFrom === target) return;
    const startTime = performance.now();
    let raf: number;
    function step(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(startFrom + eased * (target - startFrom)));
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      prevTarget.current = startFrom; // reset so effect re-runs (e.g. Strict Mode) restart the animation
    };
  }, [target, duration]);
  return display;
}

/* ─── Budget Distribution Chart ───────────────────────────────── */

function BudgetDistributionChart({
  categories,
  monthlySummary,
  homeMonth,
  scope,
  onSelectCategory,
}: {
  categories: Category[];
  monthlySummary: MonthlySummary;
  homeMonth: string;
  scope: ScopeChip;
  onSelectCategory: (cat: Category) => void;
}) {
  // All hooks at top — before any conditional return
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [ripple, setRipple] = useState<{ x: number; y: number; color: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const chartData = useMemo(() => {
    const items = categories
      .filter(cat => getCategoryScope(cat) === scope)
      .map(cat => {
        const available = Math.max(0, cat.available ?? 0);
        return { cat, available };
      })
      .filter(({ available }) => available > 0)
      .sort((a, b) => b.available - a.available);

    const total = items.reduce((s, { available }) => s + available, 0);
    return { items, total };
  }, [categories, scope]);

  // Segment computation before guard — needed by useCountUp
  const allSegments = chartData.items.map(({ cat, available }, i) => ({
    name: cat.name,
    value: available,
    available,
    cat,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const visibleSegments = allSegments.filter(s => !hiddenIds.has(s.cat.id));
  const visibleTotal = visibleSegments.reduce((s, seg) => s + seg.available, 0);

  // "All good" pulse: every visible category has ≥60% of planned remaining
  const allHealthy = visibleSegments.length > 0 && visibleSegments.every(s => {
    const planned = plannedByCategory.get(s.cat.id) ?? 0;
    return planned > 0 && s.available >= planned * 0.6;
  });

  // Count-up must be called before conditional return (hook rule)
  const countedTotal = useCountUp(visibleTotal);

  // ── All spent empty state ──────────────────────────────────────
  if (chartData.total === 0 || chartData.items.length === 0) {
    return (
      <div style={{ ...chartWrapStyle, animation: "modeIn 180ms cubic-bezier(0.22,1,0.36,1) both" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", width: 220, height: 220 }}>
            <svg width={220} height={220} viewBox="0 0 220 220" aria-hidden="true">
              <circle cx={110} cy={110} r={85} fill="none" stroke="var(--accent)"
                strokeWidth={20} strokeDasharray="5 8" strokeLinecap="round" opacity={0.4} />
            </svg>
            <div style={chartCenterStyle}>
              <span style={{ fontSize: 26, lineHeight: 1 }}>✓</span>
              <span style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, letterSpacing: 0.3 }}>all used!</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function toggleHidden(id: string) {
    setHiddenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSliceClick(index: number, e: { clientX: number; clientY: number }) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const color = visibleSegments[index]?.color ?? "var(--accent)";
      setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, color });
      setTimeout(() => setRipple(null), 280);
    }
    onSelectCategory(visibleSegments[index].cat);
  }

  return (
    <div style={{ ...chartWrapStyle, animation: "modeIn 180ms cubic-bezier(0.22,1,0.36,1) both" }}>
      {/* Donut — centered */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div ref={containerRef} style={{ position: "relative", width: 220, height: 220, overflow: "hidden" }}>
          <PieChart width={220} height={220} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={visibleSegments}
              cx={110} cy={110}
              innerRadius={74} outerRadius={96}
              paddingAngle={visibleSegments.length > 1 ? 4 : 0}
              dataKey="value"
              startAngle={90} endAngle={-270}
              onClick={(_, index, e) => handleSliceClick(index, e)}
              cursor="pointer"
              stroke="none"
              isAnimationActive={true}
              animationBegin={0}
              animationDuration={750}
              animationEasing="ease-out"
              shape={(props: PieSectorShapeProps) => {
                const sweep = Math.abs((props.endAngle ?? 0) - (props.startAngle ?? 0));
                const arcLen = (sweep * Math.PI / 180) * 96;
                // Scale down for small arcs so Recharts doesn't square them off
                const cr = Math.min(10, arcLen / 3);
                return <Sector {...props} cornerRadius={cr} outerRadius={96} />;
              }}
            >
              {visibleSegments.map((seg, i) => (
                <Cell key={seg.cat.id ?? i} fill={seg.color} />
              ))}
            </Pie>
          </PieChart>

          {/* Tap ripple */}
          {ripple && (
            <div
              style={{
                position: "absolute",
                left: ripple.x - 40,
                top: ripple.y - 40,
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: ripple.color,
                animation: "rippleOut 280ms ease-out forwards",
                pointerEvents: "none",
              }}
            />
          )}

          <div style={{ ...chartCenterStyle, pointerEvents: "none" }}>
            {/* Count-up total; pulses softly when all categories are healthy */}
            <span style={{
              fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800,
              color: "var(--text2)", fontVariantNumeric: "tabular-nums", lineHeight: 1,
              display: "block",
              animation: allHealthy ? "dotPulse 3s ease-in-out infinite" : "none",
            }}>
              {fmt(countedTotal)}
            </span>
            <span style={{ fontSize: 9, color: "var(--muted)", marginTop: 4, letterSpacing: 0.3 }}>MAD available</span>
          </div>
        </div>
      </div>

      {/* Legend — staggered cascade on mount */}
      <div style={chartLegendStyle}>
        {allSegments.map(({ cat, available, color }, i) => {
          const isHidden = hiddenIds.has(cat.id);
          return (
            <button
              key={cat.id ?? i}
              type="button"
              onClick={() => toggleHidden(cat.id)}
              title={isHidden ? `Show ${cat.name}` : `Hide ${cat.name}`}
              className="donut-legend-row"
              style={{
                ...chartLegendRowStyle,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                opacity: isHidden ? 0.35 : 1,
                transition: "opacity 0.15s ease",
                animation: `legendRowIn 0.28s ease-out ${i * 28}ms both`,
              }}
            >
              <span style={{ ...chartDotStyle, background: isHidden ? "var(--muted)" : color }} />
              <span style={chartLegendIconStyle}>
                <CategoryIcon icon={cat.icon} size={11} />
              </span>
              <span style={{ ...chartLegendNameStyle, textDecoration: isHidden ? "line-through" : "none" }}>{cat.name}</span>
              <span style={{ ...chartLegendAmtStyle, visibility: isHidden ? "hidden" : "visible" }}>{fmt(Math.round(available))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const chartWrapStyle: CSSProperties = {
  borderRadius: 16,
  background: "var(--surface)",
  padding: "16px 16px 18px",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
  display: "grid",
  gap: 16,
};

const chartCenterStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

const chartLegendStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px 12px",
};

const chartLegendRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
};

const chartDotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 2,
  flexShrink: 0,
};

const chartLegendIconStyle: CSSProperties = {
  width: 14,
  height: 14,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const chartLegendNameStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 11,
  fontWeight: 500,
  color: "var(--text2)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const chartLegendAmtStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text2)",
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum"',
};

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

/* ─── Ghost add card ────────────────────────────────────────────── */

const ghostCardStyle: CSSProperties = {
  flex: "0 0 120px",
  minHeight: 90,
  borderRadius: 16,
  border: "1.5px dashed color-mix(in srgb, var(--border) 55%, transparent)",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "border-color 0.15s ease, background 0.15s ease",
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
  zIndex: 1,
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

const cardBadgeStyle = (health: Health): CSSProperties => ({
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: 1.1,
  textTransform: "uppercase",
  color: health === "over"      ? "var(--danger)"
       : health === "low"       ? "var(--warning)"
       : health === "funded"    ? "var(--accent)"
       :                          "var(--warning)",
  lineHeight: 1,
});

const cardAmountStyle = (health: Health): CSSProperties => ({
  fontFamily: "var(--font-body)",
  fontSize: 15,
  fontWeight: 500,
  lineHeight: 1,
  color: health === "over"      ? "var(--danger)"
       : health === "low"       ? "var(--warning)"
       : health === "unfunded"  ? "var(--muted)"
       :                          "var(--text2)",
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
