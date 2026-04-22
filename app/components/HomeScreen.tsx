import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, MonthlySummary } from "./app-types";
import { HomeOverview } from "./HomeOverview";
import type { Scope } from "./HouseholdStatCard";
import { Money } from "./Money";

type HomeScreenProps = {
  categories: Category[];
  selectedCategoryId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectCategory: (category: Category) => void;
  onOpenCategoryDetails: (category: Category) => void;
  onOpenAdd: () => void;
  onOpenPlan: () => void;
  monthlySummary: MonthlySummary;
  onPlannedChange: (categoryId: string, nextPlanned: number) => void;
  readyToAssignByScope: Record<Scope, number>;
  contributionDueByScope: { wife: number; husband: number; total: number };
  householdSpentByPartner: { wife: number; husband: number; other: number; total: number };
};

export function HomeScreen({
  categories,
  selectedCategoryId,
  search,
  onSearchChange,
  onSelectCategory,
  onOpenCategoryDetails,
  onOpenAdd,
  onOpenPlan,
  monthlySummary,
  onPlannedChange,
  readyToAssignByScope,
  contributionDueByScope,
  householdSpentByPartner,
}: HomeScreenProps) {
  const [scope, setScope] = useState<Scope>("household");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [draftAvailable, setDraftAvailable] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [saveCategoryId, setSaveCategoryId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of monthlySummary.spentByCategory ?? []) {
      map.set(entry.categoryId, entry.total);
    }
    return map;
  }, [monthlySummary.spentByCategory]);

  const commitAvailable = (categoryId: string, rawValue: string) => {
    const cleaned = rawValue.replace(/[^0-9.\-]/g, "");
    if (!cleaned) {
      setEditingCategoryId(null);
      setDraftAvailable("");
      setSaveState("idle");
      return;
    }
    const numericValue = Number(cleaned);
    if (!Number.isFinite(numericValue)) return;
    const spent = spentByCategory.get(categoryId) ?? 0;
    const nextPlanned = Math.max(0, spent + numericValue);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveCategoryId(categoryId);
    setSaveState("saving");
    onPlannedChange(categoryId, nextPlanned);
    setEditingCategoryId(null);
    setDraftAvailable("");
    saveTimerRef.current = setTimeout(() => {
      setSaveState("saved");
      savedTimerRef.current = setTimeout(() => {
        setSaveState("idle");
        setSaveCategoryId(null);
      }, 1200);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const visibleCategories = useMemo(() => {
    if (scope === "household") return categories.filter(isHouseholdCategory);
    if (scope === "wife") return categories.filter(isWifeCategory);
    return categories.filter(isHusbandCategory);
  }, [categories, scope]);

  return (
    <div id="panel-home" role="tabpanel" aria-labelledby="tab-home">
      <header style={{ marginBottom: 20, animation: "fadeUp 0.4s ease both" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 0.95, fontWeight: 800, color: "var(--text)" }}>
            Home
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
            Your budget this month.
          </p>
        </div>
      </header>

      <div style={stickyHeaderWrapStyle}>
        <HomeOverview
          onOpenPlan={onOpenPlan}
          categories={categories}
          monthlySummary={monthlySummary}
          scope={scope}
          onScopeChange={setScope}
          readyToAssignByScope={readyToAssignByScope}
          contributionDueByScope={contributionDueByScope}
          householdSpentByPartner={householdSpentByPartner}
        />
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingBottom: 12,
            borderBottom: "1px solid color-mix(in srgb, var(--border) 44%, transparent)",
            animation: "fadeUp 0.35s 0.04s ease both",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--muted)", flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search categories"
            style={{
              flex: 1,
              background: "transparent",
              padding: 0,
              border: "none",
              fontSize: 15,
              color: "var(--text)",
              outline: "none",
            }}
          />
        </div>

        <section style={{ display: "grid", gap: 0, paddingBottom: 72 }}>
          <div style={{ paddingBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--muted)" }}>
                Categories
              </div>
              <p style={{ marginTop: 6, fontSize: 14, color: "var(--text2)" }}>Tap a category to open its details.</p>
            </div>
          </div>

          {visibleCategories.map((cat, i) => {
            const planned = cat.planned ?? 0;
            const spent = spentByCategory.get(cat.id) ?? 0;
            const available = cat.available ?? 0;
            const isEditing = editingCategoryId === cat.id;
            const draftNum = isEditing ? parseFloat(draftAvailable) : NaN;
            const livePlanned = isFinite(draftNum) ? Math.max(0, spent + draftNum) : planned;
            const spentPct = Math.min(100, (Math.max(0, spent) / Math.max(1, livePlanned)) * 100);
            const spentTone = spent > livePlanned
              ? "color-mix(in srgb, #ef4444 75%, #b91c1c)"
              : spentPct >= 85
              ? "color-mix(in srgb, #f97316 70%, #ea580c)"
              : spentPct >= 65
              ? "color-mix(in srgb, #f59e0b 70%, #d97706)"
              : "color-mix(in srgb, var(--accent) 65%, #d8f3c9)";

            return (
              <div key={cat.id} style={categoryRowWrapStyle}>
                <button
                  onClick={() => {
                    onSelectCategory(cat);
                    onOpenCategoryDetails(cat);
                  }}
                  style={{
                    ...categoryRowStyle,
                    animation: `fadeUp 0.28s ${i * 0.03}s ease both`,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 14,
                      background: cat.id === selectedCategoryId ? "color-mix(in srgb, var(--accent-dim) 42%, white)" : "var(--surface2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      flexShrink: 0,
                      transition: "background-color 0.2s ease",
                    }}
                  >
                    {cat.icon ?? "#"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: cat.id === selectedCategoryId ? 700 : 650,
                        color: "var(--text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {cat.name}
                    </div>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>
                      {(cat.type[0] ?? "Category").toUpperCase()} · Planned <Money value={planned} />
                    </p>
                    <div style={spentBarTrackStyle} aria-hidden="true">
                      <div style={{ ...spentBarFillStyle, width: `${spentPct}%`, background: spentTone }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, display: "grid", gap: 6, justifyItems: "end" }}>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingCategoryId(cat.id);
                          setDraftAvailable(String(available));
                        }}
                        style={availableButtonStyle}
                      >
                        <span style={availableLabelStyle}>Available</span>
                        <Money value={available} />
                      </button>
                    )}
                    {isEditing && (
                      <div style={{ display: "grid", gap: 5 }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoFocus
                          value={draftAvailable}
                          onChange={(event) => {
                            const cleaned = event.target.value.replace(/[^0-9.\-]/g, "");
                            const normalized = cleaned.replace(/(?!^)-/g, "");
                            if ((normalized.match(/\./g) || []).length <= 1) {
                              setDraftAvailable(normalized);
                            }
                          }}
                          onBlur={() => commitAvailable(cat.id, draftAvailable)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitAvailable(cat.id, draftAvailable);
                            if (event.key === "Escape") {
                              setEditingCategoryId(null);
                              setDraftAvailable("");
                            }
                          }}
                          aria-label={`Available amount for ${cat.name}`}
                          style={availableInputStyle}
                        />
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", animation: "fadeUp 0.18s ease both" }}>
                          {([-100, -10, 10, 100]).map((delta) => (
                            <button
                              key={delta}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const current = parseFloat(draftAvailable) || 0;
                                setDraftAvailable(String(Math.round((current + delta) * 100) / 100));
                              }}
                              style={nudgePillStyle}
                            >
                              {delta > 0 ? `+${delta}` : delta}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {saveCategoryId === cat.id && saveState !== "idle" && (
                      <span style={saveState === "saved" ? savedBadgeStyle : saveBadgeStyle}>
                        {saveState === "saving" ? "saving..." : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                            saved
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}

          {categories.length === 0 && (
            <div style={{ padding: "18px 0", color: "var(--muted)", fontSize: 14 }}>
              No categories match that search.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function isWifeCategory(category: Category) {
  return !category.isTeamFund && (category.owner?.toLowerCase().includes("salma") ?? false);
}

function isHusbandCategory(category: Category) {
  return !category.isTeamFund && (category.owner?.toLowerCase().includes("anas") ?? false);
}

function isHouseholdCategory(category: Category) {
  if (category.isTeamFund) return true;
  return category.type.some((value) => {
    const normalized = value.toLowerCase();
    return normalized.includes("team") || normalized.includes("household");
  });
}

const categoryRowWrapStyle = {
  display: "grid",
  gap: 8,
  padding: "14px 0",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 28%, transparent)",
};

const stickyHeaderWrapStyle = {
  position: "sticky" as const,
  top: "calc(var(--safe-top) + 8px)",
  zIndex: 10,
  background: "var(--bg)",
  paddingBottom: 16,
};

const saveBadgeStyle = {
  fontSize: 10,
  letterSpacing: 0.4,
  textTransform: "uppercase" as const,
  fontFamily: "'DM Mono', monospace",
  color: "color-mix(in srgb, var(--muted) 78%, transparent)",
};

const spentBarTrackStyle = {
  width: "100%",
  height: 6,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--surface2) 65%, white)",
  overflow: "hidden",
  marginTop: 6,
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--border) 45%, transparent)",
};

const spentBarFillStyle = {
  height: "100%",
  borderRadius: 999,
  transition: "width 0.3s ease, background 0.4s ease",
};

const categoryRowStyle = {
  textAlign: "left" as const,
  width: "100%",
  padding: 0,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const availableButtonStyle = {
  display: "inline-flex",
  flexDirection: "column" as const,
  alignItems: "flex-end",
  gap: 4,
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
  fontFamily: "'DM Mono', monospace",
  fontSize: 12,
  color: "var(--text)",
  transition: "transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), color 0.2s ease",
};

const availableLabelStyle = {
  fontSize: 10,
  letterSpacing: 0.4,
  textTransform: "uppercase" as const,
  color: "var(--muted)",
};

const nudgePillStyle = {
  fontSize: 10,
  fontFamily: "'DM Mono', monospace",
  letterSpacing: 0.3,
  padding: "3px 7px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
  background: "color-mix(in srgb, var(--surface2) 55%, white)",
  color: "var(--text2)",
  cursor: "pointer",
  lineHeight: 1.4,
};

const savedBadgeStyle = {
  fontSize: 10,
  letterSpacing: 0.4,
  textTransform: "uppercase" as const,
  fontFamily: "'DM Mono', monospace",
  color: "var(--success)",
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  animation: "fadeUp 0.18s ease both",
};

const availableInputStyle = {
  width: 92,
  height: 32,
  textAlign: "right" as const,
  borderRadius: 10,
  border: "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
  background: "var(--surface)",
  color: "var(--text)",
  padding: "6px 8px",
  fontFamily: "'DM Mono', monospace",
  fontSize: 12,
  outline: "none",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
  animation: "inputPop 160ms cubic-bezier(0.22, 1, 0.36, 1)",
};
