"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Category, MonthlySummary } from "./app-types";
import { CategoryIcon } from "./ui/CategoryIcon";
import { Money } from "./Money";
import { SearchIcon, SlidersIcon, FreezeIcon, FundIcon, ReviveIcon } from "./ui/icons";
import { getCategoryScope } from "./app-utils";

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

type CategoryChip = "active" | "frozen";
type Health = "over" | "low" | "ontrack" | "noplan";

const HEALTH_SORT: Record<Health, number> = { over: 0, low: 1, ontrack: 2, noplan: 3 };

function getHealth(spent: number, planned: number): Health {
  if (planned <= 0) return "noplan";
  if (spent > planned) return "over";
  if ((spent / planned) >= 0.82) return "low";
  return "ontrack";
}

function scopeLabel(category: Category): string {
  const scope = getCategoryScope(category);
  if (scope === "joint") return "Joint";
  if (scope === "anas") return "Anas";
  if (scope === "salma") return "Salma";
  return "";
}

export function CategoriesScreen({
  categories,
  frozenCategories,
  monthlySummary,
  homeMonth,
  selectedCategoryId,
  onSelectCategory,
  onOpenCategoryDetails,
  onOpenRebalance,
  onFreezeCategory,
  onReviveCategory,
  onFundCategory,
}: Props) {
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<CategoryChip>("active");

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
        const health = getHealth(spent, planned);
        const section = cat.type[0] ?? "Other";
        return { cat, planned, spent, available, health, section };
      })
      .sort((a, b) => HEALTH_SORT[a.health] - HEALTH_SORT[b.health]);

    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!map.has(row.section)) map.set(row.section, []);
      map.get(row.section)!.push(row);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [categories, search, spentByCategory, plannedByCategory, isCurrentMonth]);

  const frozenRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return frozenCategories.filter(cat =>
      !q ||
      cat.name.toLowerCase().includes(q) ||
      cat.type.some(t => t.toLowerCase().includes(q))
    );
  }, [frozenCategories, search]);

  return (
    <div id="panel-budget" role="tabpanel" aria-labelledby="tab-budget" style={wrapStyle}>

      {/* Header */}
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Manage</div>
          <h1 style={titleStyle}>Budget</h1>
        </div>
        <button
          type="button"
          onClick={onOpenRebalance}
          style={rebalanceBtnStyle}
          aria-label="Rebalance budget"
        >
          <SlidersIcon size={18} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Rebalance</span>
        </button>
      </div>

      {/* Active / Frozen chips */}
      <div style={chipsRowStyle}>
        <div style={chipsStyle} role="tablist" aria-label="Category state">
          <Chip active={chip === "active"} onClick={() => setChip("active")}>
            {`Active · ${categories.length}`}
          </Chip>
          <Chip active={chip === "frozen"} onClick={() => setChip("frozen")}>
            {`Frozen · ${frozenCategories.length}`}
          </Chip>
        </div>
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

      {/* List */}
      <div style={listStyle}>

        {/* Active tab */}
        {chip === "active" && (
          <>
            {activeGroups.length === 0 && (
              <div style={emptyStyle}>No categories found.</div>
            )}
            {activeGroups.map(({ label, items }) => (
              <section key={label}>
                <div style={sectionLabelStyle}>{label}</div>
                <div style={sectionRowsStyle}>
                  {items.map(({ cat, available, health }, i) => {
                    const isOver = health === "over";
                    const isLow = health === "low";
                    const scope = scopeLabel(cat);
                    return (
                      <article key={cat.id} style={{ ...categoryRowStyle, animation: `fadeUp 0.22s ${Math.min(i * 0.02, 0.18)}s ease both` }}>
                        <button
                          type="button"
                          onClick={() => { onSelectCategory(cat); onOpenCategoryDetails(cat); }}
                          style={categoryMainStyle}
                          aria-label={cat.name}
                        >
                          <CategoryIcon icon={cat.icon} style={{ fontSize: 22, flexShrink: 0, color: "var(--text2)" }} />
                          <div style={{ minWidth: 0 }}>
                            <strong style={rowTitleStyle}>{cat.name}</strong>
                            <p style={rowMetaStyle}>
                              {scope && <span style={scopeBadgeStyle}>{scope}</span>}
                              {scope && " · "}
                              {cat.type[0] ?? "Budget"}
                            </p>
                          </div>
                        </button>
                        <div style={rowRightStyle}>
                          {(isOver || isLow) && (
                            <span style={healthBadgeStyle(isOver)}>
                              {isOver ? "OVER" : "LOW"}
                            </span>
                          )}
                          <strong style={availableStyle(isOver)}>
                            <Money value={available} />
                          </strong>
                          <div style={rowActionsStyle}>
                            <IconActionButton
                              icon={<FundIcon size={14} strokeWidth={2.2} />}
                              label="Fund"
                              ariaLabel={`Fund ${cat.name}`}
                              onClick={() => onFundCategory(cat)}
                            />
                            <IconActionButton
                              icon={<FreezeIcon size={14} strokeWidth={2.2} />}
                              label="Freeze"
                              ariaLabel={`Freeze ${cat.name}`}
                              tone="quiet"
                              onClick={() => onFreezeCategory(cat)}
                            />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}

        {/* Frozen tab */}
        {chip === "frozen" && (
          <>
            {frozenRows.length === 0 && (
              <div style={emptyStyle}>No frozen categories.</div>
            )}
            {frozenRows.map((cat, i) => {
              const scope = scopeLabel(cat);
              return (
                <article key={cat.id} style={{ ...categoryRowStyle, animation: `fadeUp 0.22s ${Math.min(i * 0.02, 0.18)}s ease both` }}>
                  <button
                    type="button"
                    onClick={() => { onSelectCategory(cat); onOpenCategoryDetails(cat); }}
                    style={categoryMainStyle}
                    aria-label={cat.name}
                  >
                    <CategoryIcon icon={cat.icon} style={{ fontSize: 22, flexShrink: 0, color: "var(--muted)" }} />
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ ...rowTitleStyle, color: "var(--muted)" }}>{cat.name}</strong>
                      <p style={rowMetaStyle}>
                        {scope && <span style={scopeBadgeStyle}>{scope}</span>}
                        {scope && " · "}
                        {cat.type[0] ?? "Budget"}
                      </p>
                    </div>
                  </button>
                  <div style={rowRightStyle}>
                    <div style={rowActionsStyle}>
                      <IconActionButton
                        icon={<ReviveIcon size={14} strokeWidth={2.2} />}
                        label="Revive"
                        ariaLabel={`Revive ${cat.name}`}
                        onClick={() => onReviveCategory(cat)}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </>
        )}

      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{ ...chipStyle, ...(active ? chipActiveStyle : null) }}
    >
      {children}
    </button>
  );
}

function IconActionButton({
  icon,
  label,
  ariaLabel,
  tone = "default",
  onClick,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  tone?: "default" | "quiet";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={label}
      style={tone === "quiet" ? quietActionButtonStyle : actionButtonStyle}
    >
      <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-hidden="true">
        {icon}
      </span>
      <span style={{ lineHeight: 1 }}>{label}</span>
    </button>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  paddingBottom: 80,
  animation: "fadeUp 0.2s ease both",
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
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--border2) 66%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 54%, white)",
  color: "var(--text2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const chipsRowStyle: CSSProperties = {
  display: "flex",
};

const chipsStyle: CSSProperties = {
  display: "inline-flex",
  gap: 6,
  padding: 4,
  borderRadius: 16,
  border: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 45%, white)",
};

const chipStyle: CSSProperties = {
  minHeight: 36,
  padding: "0 13px",
  borderRadius: 12,
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const chipActiveStyle: CSSProperties = {
  background: "var(--surface)",
  color: "var(--text2)",
  fontWeight: 600,
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
  gap: 10,
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
  display: "grid",
  gap: 6,
};

const categoryRowStyle: CSSProperties = {
  minHeight: 64,
  borderRadius: 14,
  border: "none",
  background: "var(--surface)",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  gap: 8,
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
};

const categoryMainStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  gap: 10,
  textAlign: "left",
  cursor: "pointer",
};

const rowTitleStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text2)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowMetaStyle: CSSProperties = {
  marginTop: 3,
  fontSize: 11,
  color: "var(--muted)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const scopeBadgeStyle: CSSProperties = {
  fontWeight: 600,
  color: "var(--muted)",
};

const rowRightStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
};

const rowActionsStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const availableStyle = (isOver: boolean): CSSProperties => ({
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 600,
  color: isOver ? "var(--danger)" : "var(--text2)",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});

const healthBadgeStyle = (isOver: boolean): CSSProperties => ({
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: 1.1,
  textTransform: "uppercase",
  color: isOver ? "var(--danger)" : "var(--warning)",
  lineHeight: 1,
});

const actionButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: "0 9px",
  borderRadius: 10,
  border: "1px solid color-mix(in srgb, var(--border2) 66%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 54%, white)",
  color: "var(--text2)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  whiteSpace: "nowrap",
};

const quietActionButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  background: "transparent",
  border: "1px solid transparent",
  color: "var(--muted)",
};

const emptyStyle: CSSProperties = {
  padding: "22px 10px",
  color: "var(--muted)",
  fontSize: 14,
  textAlign: "center",
};
