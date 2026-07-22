"use client";

import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Account, BudgetScope, Category } from "./app-types";
import { fmt, getCategoryScope, isSavingsAccount, monthBounds } from "./app-utils";
import { Money } from "./Money";
import { XIcon } from "./ui/icons";
import { CategoryIcon } from "./ui/CategoryIcon";
import { BottomSheet } from "./ui/BottomSheet";

/* ─── Helpers ─────────────────────────────────────────────────────── */

/** Contribution split for joint categories. Anas 65%, Salma 35%. */
const JOINT_SPLIT = { anas: 0.65, salma: 0.35 } as const;

type ScopeTab = "joint" | "anas" | "salma" | "saving";

function getCatScope(cat: Category, accounts?: Account[]): ScopeTab {
  return (getCategoryScope(cat, accounts) ?? "joint") as ScopeTab;
}

function prevMonthStr(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string, format: "long" | "short" = "long"): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: format, year: "numeric" }).format(new Date(y, m - 1, 1));
}

/* ─── Scope chip ──────────────────────────────────────────────────── */

const SCOPE_CHIPS: { value: ScopeTab; emoji: string; label: string }[] = [
  { value: "joint",  emoji: "👫", label: "Joint"  },
  { value: "anas",   emoji: "👨", label: "Anas"   },
  { value: "salma",  emoji: "👩", label: "Salma"  },
  { value: "saving", emoji: "🏦", label: "Saving" },
];

const CHIP_BG: Record<ScopeTab, string> = {
  joint:  "var(--accent)",
  anas:   "var(--partner-husband)",
  salma:  "var(--partner-wife)",
  saving: "var(--info)",
};
const CHIP_INK: Record<ScopeTab, string> = {
  joint:  "var(--accent-ink)",
  anas:   "#ffffff",
  salma:  "#ffffff",
  saving: "#ffffff",
};
const CHIP_COLOR: Record<ScopeTab, string> = {
  joint:  "var(--accent)",
  anas:   "var(--partner-husband)",
  salma:  "var(--partner-wife)",
  saving: "var(--info)",
};

function ScopeChipBtn({
  value, emoji, label, active, locked, onClick,
}: {
  value: ScopeTab; emoji: string; label: string; active: boolean; locked: boolean; onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={active ? {
        height: 38, borderRadius: 12, border: "none",
        background: CHIP_BG[value], color: CHIP_INK[value],
        padding: "0 14px 0 10px", gap: 7, cursor: "pointer",
        display: "inline-flex", alignItems: "center",
        transform: pressed ? "scale(0.95)" : "translateY(-1px)",
        transition: "transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)",
        animation: "categorySelectIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
        flexShrink: 0, fontFamily: "var(--font-body)",
      } : {
        width: 38, height: 38, borderRadius: 12,
        border: "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
        background: "transparent", color: CHIP_COLOR[value],
        cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
        opacity: pressed ? 0.9 : 0.45,
        transform: pressed ? "scale(0.93)" : "none",
        transition: "opacity 0.18s ease, transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {active ? (
        <>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
          <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>
            {label}{locked ? " ✓" : ""}
          </span>
        </>
      ) : (
        <>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
          {locked && (
            <span style={{
              position: "absolute", bottom: 4, right: 4,
              width: 7, height: 7, borderRadius: "50%",
              background: "var(--accent)",
              border: "1.5px solid var(--bg)",
            }} />
          )}
        </>
      )}
    </button>
  );
}

/* ─── Types ───────────────────────────────────────────────────────── */

type MonthStartPlannerProps = {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  categories: Category[];
  frozenCategories: Category[];
  accounts: Account[];
  planningMonth: string;
  readyToAssignByScope: Record<BudgetScope, number>;
  savingPool?: number;
  onOpenNewCategory?: () => void;
};

type ClosingSummary = {
  totalSpent: number;
  totalPlanned: number;
  spentByCategory: { categoryId: string; total: number }[];
  assignedByCategory: { categoryId: string; total: number }[];
};

type FundRecord = { categoryId: string; planned: number; assignmentType?: string | null; reverse?: boolean };
const normId = (id: string) => id.replace(/-/g, "").toLowerCase();
const isMonthlyFund = (fund: FundRecord) => !fund.assignmentType || fund.assignmentType === "Monthly";

/* ─── Main Component ──────────────────────────────────────────────── */

const isSavingCat = (cat: Category) =>
  cat.type.some((t) => t.toLowerCase().includes("saving") || t.toLowerCase() === "long term");

export function MonthStartPlanner({
  open,
  onClose,
  onComplete,
  categories,
  frozenCategories,
  accounts,
  planningMonth,
  readyToAssignByScope,
  savingPool = 0,
  onOpenNewCategory,
}: MonthStartPlannerProps) {
  const [scope, setScope] = useState<ScopeTab>("joint");
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const initialAllocationsRef = useRef<Record<string, number>>({});
  const [frozenInSession, setFrozenInSession] = useState<Set<string>>(new Set());
  const [revivedInSession, setRevivedInSession] = useState<Set<string>>(new Set());
  const [lockedScopes, setLockedScopes] = useState<Record<ScopeTab, boolean>>({ joint: false, anas: false, salma: false, saving: false });
  const [savingScope, setSavingScope] = useState<ScopeTab | null>(null);
  const [saveError, setSaveError] = useState("");
  const [prevMonthFunds, setPrevMonthFunds] = useState<FundRecord[]>([]);
  const [closingSummary, setClosingSummary] = useState<ClosingSummary | null>(null);
  const [closingLoading, setClosingLoading] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);

  const prevMonth = useMemo(() => prevMonthStr(planningMonth), [planningMonth]);

  // Reset and fetch on open
  useEffect(() => {
    if (!open) return;
    setAllocations({});
    initialAllocationsRef.current = {};
    setLockedScopes({ joint: false, anas: false, salma: false, saving: false });
    setSavingScope(null);
    setSaveError("");
    setFrozenInSession(new Set());
    setRevivedInSession(new Set());
    setShowAddCat(false);
    setClosingLoading(true);

    // Prev month funds (for copy + recap) — reset first to avoid stale data flash
    setPrevMonthFunds([]);
    fetch(`/api/monthly-planning/funds?month=${prevMonth}`)
      .then((r) => r.json())
      .then((data) => {
        const funds: FundRecord[] = data.funds ?? [];
        setPrevMonthFunds(funds);
      })
      .catch((err) => {
        console.error("[planner] Failed to load prev-month funds:", err);
        setPrevMonthFunds([]);
      });

    // Current planning month funds — pre-populate allocations + derive locked scopes
    fetch(`/api/monthly-planning/funds?month=${planningMonth}`)
      .then((r) => r.json())
      .then((data) => {
        const funds: FundRecord[] = (data.funds ?? []).filter((f: any) => !f.reverse && f.planned > 0);
        if (funds.length > 0) {
          // Build a compact-ID → planned map so lookups work regardless of dash format
          const fundMap = new Map<string, number>();
          for (const f of funds) {
            const key = normId(f.categoryId);
            fundMap.set(key, (fundMap.get(key) ?? 0) + f.planned);
          }
          const all = [...categories, ...frozenCategories];
          // Key initialAllocations and allocations by cat.id (dashed), not fund's compact ID
          for (const cat of all) {
            const val = fundMap.get(normId(cat.id));
            if (val !== undefined) initialAllocationsRef.current[cat.id] = val;
          }
          setAllocations((prev) => {
            const next = { ...prev };
            for (const cat of all) {
              const val = fundMap.get(normId(cat.id));
              if (val !== undefined) next[cat.id] = val;
            }
            return next;
          });
          // Derive which scopes already have funds
          const fundedNormIds = new Set(funds.map((f) => normId(f.categoryId)));
          const regular = all.filter((c) => !isSavingCat(c));
          setLockedScopes({
            joint:  regular.filter((c) => getCatScope(c, accounts) === "joint").some((c) => fundedNormIds.has(normId(c.id))),
            anas:   regular.filter((c) => getCatScope(c, accounts) === "anas").some((c) => fundedNormIds.has(normId(c.id))),
            salma:  regular.filter((c) => getCatScope(c, accounts) === "salma").some((c) => fundedNormIds.has(normId(c.id))),
            saving: all.filter(isSavingCat).some((c) => fundedNormIds.has(normId(c.id))),
          });
        }
      })
      .catch(() => {});

    // Last month closing summary (for recap)
    const { start, end } = monthBounds(`${prevMonth}-01`);
    fetch(`/api/monthly-summary?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((data) => setClosingSummary({
        totalSpent: data.summary?.totalSpent ?? 0,
        totalPlanned: data.summary?.totalAssigned ?? 0,
        spentByCategory: data.summary?.spentByCategory ?? [],
        assignedByCategory: data.summary?.assignedByCategory ?? [],
      }))
      .catch(() => setClosingSummary(null))
      .finally(() => setClosingLoading(false));
  }, [open, prevMonth, planningMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Visible: active categories minus frozen-in-session, plus revived-in-session
  const visibleCats = useMemo(() => {
    const revived = frozenCategories.filter((c) => revivedInSession.has(c.id));
    return [...categories, ...revived].filter((c) => !frozenInSession.has(c.id));
  }, [categories, frozenCategories, frozenInSession, revivedInSession]);

  const catsByScope = useMemo((): Record<ScopeTab, Category[]> => {
    const regular = visibleCats.filter((c) => !isSavingCat(c));
    return {
      joint:  regular.filter((c) => getCatScope(c, accounts) === "joint"),
      anas:   regular.filter((c) => getCatScope(c, accounts) === "anas"),
      salma:  regular.filter((c) => getCatScope(c, accounts) === "salma"),
      saving: visibleCats.filter(isSavingCat),
    };
  }, [visibleCats, accounts]);

  // Includes frozen cats for complete historical recap data
  const allCatsByScope = useMemo((): Record<ScopeTab, Category[]> => {
    const all = [...categories, ...frozenCategories];
    const regular = all.filter((c) => !isSavingCat(c));
    return {
      joint:  regular.filter((c) => getCatScope(c, accounts) === "joint"),
      anas:   regular.filter((c) => getCatScope(c, accounts) === "anas"),
      salma:  regular.filter((c) => getCatScope(c, accounts) === "salma"),
      saving: all.filter(isSavingCat),
    };
  }, [categories, frozenCategories, accounts]);

  // Last month spend + planned per category — for subtle hint + flag on each row
  const lastMonthSpentMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of closingSummary?.spentByCategory ?? []) map.set(e.categoryId, e.total);
    return map;
  }, [closingSummary]);

  const lastMonthPlannedMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of prevMonthFunds.filter(isMonthlyFund)) {
      map.set(normId(f.categoryId), (map.get(normId(f.categoryId)) ?? 0) + f.planned);
    }
    return map;
  }, [prevMonthFunds]);

  // Available frozen cats (not already revived)
  const availableFrozen = useMemo(
    () => frozenCategories.filter((c) => !revivedInSession.has(c.id) && !frozenInSession.has(c.id)),
    [frozenCategories, revivedInSession, frozenInSession],
  );

  // Full balance in joint accounts — all of it covers the planned budget,
  // whether assigned to categories or not, so it doesn't need personal contributions.
  const jointFreePool = useMemo(() => {
    return accounts.reduce((sum, account) => {
      if (isSavingsAccount(account)) return sum;
      if (!account.label.toLowerCase().includes("joined")) return sum;
      return sum + Math.max(0, account.balance ?? 0);
    }, 0);
  }, [accounts]);

  // Effective joint pool = joint free money + whatever the split ratio allows from anas/salma.
  // Whichever spouse runs out first caps the split-funded portion.
  const effectiveJointPool = useMemo(() => {
    const anasBalance = readyToAssignByScope["anas"] ?? 0;
    const salmaBalance = readyToAssignByScope["salma"] ?? 0;
    const anasMax = anasBalance / JOINT_SPLIT.anas;
    const salmaMax = salmaBalance / JOINT_SPLIT.salma;
    return jointFreePool + Math.min(anasMax, salmaMax);
  }, [readyToAssignByScope, jointFreePool]);

  const computeLeft = (s: ScopeTab) => {
    let pool: number;
    if (s === "saving") pool = savingPool;
    else if (s === "joint") pool = effectiveJointPool;
    else pool = readyToAssignByScope[s as BudgetScope] ?? 0;
    const allocated = catsByScope[s].reduce((sum, c) => sum + (allocations[c.id] ?? 0), 0);
    return pool - allocated;
  };

  const setAlloc = (catId: string, raw: number, scopeForCat: ScopeTab) => {
    const left = computeLeft(scopeForCat);
    const current = allocations[catId] ?? 0;
    const max = current + Math.max(0, left);
    const clamped = Math.max(0, Math.min(raw, max));
    const snapped = Math.round(clamped / 50) * 50;
    setAllocations((prev) => ({ ...prev, [catId]: Math.min(snapped, max) }));
  };

  // Build a normalized prev-month map once (used for copy + button visibility)
  const prevMonthMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of prevMonthFunds) {
      if (!f.reverse && isMonthlyFund(f) && f.planned > 0) {
        const key = normId(f.categoryId);
        map.set(key, (map.get(key) ?? 0) + f.planned);
      }
    }
    return map;
  }, [prevMonthFunds]);

  // Only show copy button when current scope has prev-month data
  const scopeHasPrevData = useMemo(() => {
    const scopeCats = catsByScope[scope] ?? [];
    return scopeCats.some((c) => prevMonthMap.has(normId(c.id)));
  }, [prevMonthMap, catsByScope, scope]);

  const copyFromLastMonth = () => {
    setAllocations((prev) => {
      const next = { ...prev };
      for (const cat of catsByScope[scope] ?? []) {
        const val = prevMonthMap.get(normId(cat.id));
        if (val !== undefined) next[cat.id] = val;
      }
      return next;
    });
  };

  const freezeCategory = async (cat: Category) => {
    setFrozenInSession((prev) => new Set([...prev, cat.id]));
    try {
      await fetch("/api/categories", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cat.id, snoozed: true }) });
    } catch {
      setFrozenInSession((prev) => { const n = new Set(prev); n.delete(cat.id); return n; });
    }
  };

  const reviveCategory = async (cat: Category) => {
    setRevivedInSession((prev) => new Set([...prev, cat.id]));
    setShowAddCat(false);
    try {
      await fetch("/api/categories", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cat.id, snoozed: false }) });
    } catch {
      setRevivedInSession((prev) => { const n = new Set(prev); n.delete(cat.id); return n; });
    }
  };

  const saveScope = async (s: ScopeTab) => {
    setSaveError("");
    const budgetItems = catsByScope[s]
      .filter((c) => (allocations[c.id] ?? 0) > 0)
      .map((c) => ({ categoryId: c.id, amount: allocations[c.id]!, defaultAccount: c.defaultAccount ?? null }));

    // If nothing allocated for this scope, just mark as done locally
    if (!budgetItems.length) {
      setLockedScopes((prev) => ({ ...prev, [s]: true }));
      return;
    }

    setSavingScope(s);
    try {
      const res = await fetch("/api/monthly-planning/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: planningMonth, budgetItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setLockedScopes((prev) => ({ ...prev, [s]: true }));
      onComplete();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingScope(null);
    }
  };

  const activeChip = SCOPE_CHIPS.find((c) => c.value === scope)!;
  const isSavingCurrent = savingScope === scope;
  const isCurrentLocked = lockedScopes[scope];

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        showHandle
        label="Plan this month"
        detent="content"
        maxHeight="calc(100dvh - max(env(safe-area-inset-top, 0px), 20px))"
        panelStyle={sheetPanelStyle}
        contentStyle={sheetContentStyle}
        zIndex={85}
        desktopFullscreen
      >
        <div style={sheetInnerStyle} className="planner-wrap">
          {/* Header */}
          <header style={headerStyle}>
            <div>
              <div style={eyebrowStyle}>{monthLabel(planningMonth)}</div>
              <h1 style={titleStyle}>Plan budget</h1>
            </div>
            <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close">
              <XIcon size={16} />
            </button>
          </header>

          {/* Left to assign — hero number */}
          {(() => {
            const left = computeLeft(scope);
            const totalAllocated = (catsByScope[scope] ?? []).reduce((sum, c) => sum + (allocations[c.id] ?? 0), 0);

            // Per-spouse breakdown for joint scope
            let jointSplit: React.ReactNode = null;
            if (scope === "joint") {
              const anasBalance = readyToAssignByScope["anas"] ?? 0;
              const salmaBalance = readyToAssignByScope["salma"] ?? 0;
              // Joint free money covers first; remainder is split between anas/salma
              const afterJointFree = Math.max(0, totalAllocated - jointFreePool);
              const anasObligation = Math.round(afterJointFree * JOINT_SPLIT.anas);
              const salmaObligation = Math.round(afterJointFree * JOINT_SPLIT.salma);
              // Remaining capacity each person has (for future joint additions)
              const anasCapacityLeft = (anasBalance - anasObligation) / JOINT_SPLIT.anas;
              const salmaCapacityLeft = (salmaBalance - salmaObligation) / JOINT_SPLIT.salma;
              const anasTighter = anasCapacityLeft < salmaCapacityLeft;
              const salmaTighter = salmaCapacityLeft < anasCapacityLeft;
              const tightThreshold = Math.max(anasBalance, salmaBalance) * 0.25;
              const anasColor = anasCapacityLeft < 0 ? "var(--danger)" : (anasTighter && anasCapacityLeft < tightThreshold) ? "var(--warning)" : "var(--muted)";
              const salmaColor = salmaCapacityLeft < 0 ? "var(--danger)" : (salmaTighter && salmaCapacityLeft < tightThreshold) ? "var(--warning)" : "var(--muted)";

              jointSplit = (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: anasColor }}>
                    👨 {fmt(anasObligation)}
                    <span style={{ fontWeight: 400, opacity: 0.5 }}> / {fmt(Math.round(anasBalance))}</span>
                  </span>
                  <span style={{ color: "var(--muted)", opacity: 0.3, fontSize: 12 }}>·</span>
                  <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: salmaColor }}>
                    👩 {fmt(salmaObligation)}
                    <span style={{ fontWeight: 400, opacity: 0.5 }}> / {fmt(Math.round(salmaBalance))}</span>
                  </span>
                </div>
              );
            }

            return (
              <div style={leftHeroStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={leftHeroLabelStyle}>Left to assign</span>
                  {totalAllocated > 0 && (
                    <span style={afterLockBadgeStyle}>after lock</span>
                  )}
                </div>
                <span style={{ ...leftHeroAmountStyle, color: left < 0 ? "var(--danger)" : "var(--text)" }}>
                  {left < 0 ? "−" : ""}
                  <Money value={Math.abs(Math.round(left))} />
                </span>
                {jointSplit}
              </div>
            );
          })()}

          {/* Scope chips */}
          <div style={scopeBarStyle} role="tablist">
            {SCOPE_CHIPS.map(({ value, emoji, label }) => (
              <ScopeChipBtn
                key={value}
                value={value}
                emoji={emoji}
                label={label}
                active={scope === value}
                locked={lockedScopes[value]}
                onClick={() => setScope(value)}
              />
            ))}
          </div>

          {/* Category list — scrollable */}
          <div style={catListStyle}>
            {/* Add category */}
            <button type="button" onClick={() => setShowAddCat(true)} style={addCatButtonStyle}>
              <span style={{ fontSize: 18, opacity: 0.5 }}>＋</span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Add a category</span>
            </button>

            {(catsByScope[scope] ?? []).length === 0 ? (
              <div style={emptyStyle}>No categories in this scope.</div>
            ) : (catsByScope[scope] ?? []).map((cat, i) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                amount={allocations[cat.id] ?? 0}
                initialAllocation={initialAllocationsRef.current[cat.id] ?? 0}
                showSplit={scope === "joint"}
                scopePool={scope === "saving" ? savingPool : (readyToAssignByScope[scope as BudgetScope] ?? 0)}
                leftForScope={computeLeft(scope)}
                lastMonthSpent={lastMonthSpentMap.get(cat.id) ?? 0}
                lastMonthPlanned={lastMonthPlannedMap.get(cat.id.replace(/-/g, "").toLowerCase()) ?? 0}
                index={i}
                onSetAlloc={(v) => setAlloc(cat.id, v, scope)}
                onFreeze={() => freezeCategory(cat)}
              />
            ))}
          </div>

          {/* Footer */}
          <div style={footerStyle}>
            {saveError && <div style={saveErrorStyle}>{saveError}</div>}
            <div style={footerRowStyle} className="planner-footer-row">
              {scopeHasPrevData && (
                <button type="button" onClick={copyFromLastMonth} style={copyButtonStyle}>
                  Copy last month
                </button>
              )}
              <button
                type="button"
                onClick={() => saveScope(scope)}
                disabled={isSavingCurrent}
                style={{
                  ...lockButtonStyle,
                  opacity: isSavingCurrent ? 0.6 : 1,
                  cursor: isSavingCurrent ? "not-allowed" : "pointer",
                }}
              >
                {isSavingCurrent
                  ? "Saving…"
                  : isCurrentLocked
                  ? `Update ${activeChip.label}`
                  : `Lock ${activeChip.label}`}
              </button>
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* Add category sheet */}
      <BottomSheet
        open={showAddCat}
        onClose={() => setShowAddCat(false)}
        showHandle
        label="Add a category"
        detent="content"
        maxHeight="70dvh"
        zIndex={90}
        panelStyle={{ background: "var(--bg)", borderRadius: "24px 24px 0 0" }}
      >
        <div style={{ padding: "8px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)", display: "grid", gap: 6 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--muted)", padding: "4px 0" }}>
            Frozen categories
          </p>
          {availableFrozen.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>No frozen categories.</p>
          ) : availableFrozen.map((cat) => (
            <button key={cat.id} type="button" onClick={() => reviveCategory(cat)} style={frozenRowStyle}>
              <div style={catIconWrapStyle}><CategoryIcon icon={cat.icon} size={15} /></div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text2)", textAlign: "left" }}>{cat.name}</span>
              <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>Unfreeze</span>
            </button>
          ))}
          {onOpenNewCategory && (
            <>
              <div style={{ height: 1, background: "color-mix(in srgb, var(--border) 30%, transparent)", margin: "6px 0" }} />
              <button
                type="button"
                onClick={() => { setShowAddCat(false); onOpenNewCategory(); }}
                style={{ ...frozenRowStyle, color: "var(--accent)" }}
              >
                <span style={{ fontSize: 20 }}>＋</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, textAlign: "left" }}>Create new category</span>
              </button>
            </>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

/* ─── Recap Card — scope donut charts ────────────────────────────── */

const polar = (cx: number, cy: number, r: number, deg: number) => ({
  x: cx + r * Math.cos((deg * Math.PI) / 180),
  y: cy + r * Math.sin((deg * Math.PI) / 180),
});

const arcPath = (cx: number, cy: number, r: number, startDeg: number, endDeg: number): string => {
  const end = Math.min(endDeg, startDeg + 359.9);
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, end);
  const large = end - startDeg > 180 ? 1 : 0;
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
};

const SCOPE_COLOR: Record<ScopeTab, string> = {
  joint:  "var(--accent)",
  anas:   "var(--partner-husband)",
  salma:  "var(--partner-wife)",
  saving: "var(--info)",
};

function RecapCard({
  closingMonth,
  summary,
  loading,
  allCatsByScope,
}: {
  closingMonth: string;
  summary: ClosingSummary | null;
  loading: boolean;
  allCatsByScope: Record<ScopeTab, Category[]>;
}) {
  const scopeData = useMemo(() => {
    return SCOPE_CHIPS.map(({ value, emoji, label }) => {
      const cats = allCatsByScope[value];
      const spent   = summary ? cats.reduce((s, c) => s + (summary.spentByCategory.find((e) => e.categoryId === c.id)?.total ?? 0), 0) : 0;
      const planned = summary ? cats.reduce((s, c) => s + (summary.assignedByCategory.find((e) => e.categoryId === c.id)?.total ?? 0), 0) : 0;
      return { value, emoji, label, spent, planned };
    });
  }, [summary, allCatsByScope]);

  if (loading) {
    return (
      <div style={recapCardStyle}>
        <div className="skeleton" style={{ width: 64, height: 9, borderRadius: 4, marginBottom: 14 }} />
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div className="skeleton" style={{ width: 64, height: 64, borderRadius: "50%" }} />
              <div className="skeleton" style={{ width: [40, 32, 36][i], height: 9, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 52, height: 9, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!summary || scopeData.every((s) => s.spent === 0 && s.planned === 0)) return null;

  const SIZE = 68;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 26;
  const SW = 5.5;

  return (
    <div style={recapCardStyle}>
      <p style={recapEyebrowStyle}>{monthLabel(closingMonth, "short")} recap</p>
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        {scopeData.map(({ value, emoji, label, spent, planned }) => {
          const ratio      = planned > 0 ? spent / planned : 0;
          const isOver     = ratio > 1;
          const fillDeg    = Math.min(ratio, 1) * 360;
          const strokeColor = isOver ? "var(--danger)" : SCOPE_COLOR[value];
          const pct        = planned > 0 ? Math.round(ratio * 100) : null;

          return (
            <div key={value} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ position: "relative", width: SIZE, height: SIZE }}>
                <svg width={SIZE} height={SIZE} style={{ display: "block" }}>
                  {/* Track */}
                  <circle
                    cx={CX} cy={CY} r={R}
                    fill="none"
                    stroke="var(--surface2)"
                    strokeWidth={SW}
                  />
                  {/* Fill arc */}
                  {fillDeg > 0 && (
                    <path
                      d={arcPath(CX, CY, R, -90, -90 + fillDeg)}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={SW}
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                {/* Center label */}
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 1,
                }}>
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{emoji}</span>
                  {pct !== null && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, lineHeight: 1,
                      fontVariantNumeric: "tabular-nums",
                      color: isOver ? "var(--danger)" : "var(--text2)",
                    }}>
                      {pct}%
                    </span>
                  )}
                </div>
              </div>

              {/* Label + amount */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)" }}>{label}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontVariantNumeric: "tabular-nums", marginTop: 1 }}>
                  {planned > 0 ? `${fmt(Math.round(spent))} / ${fmt(Math.round(planned))}` : fmt(Math.round(spent))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Category Row ────────────────────────────────────────────────── */

type BudgetFlag = "over" | "balanced" | "low" | null;

function getBudgetFlag(spent: number, planned: number): BudgetFlag {
  if (planned === 0 || spent === 0) return null;
  const ratio = spent / planned;
  if (ratio > 1.05) return "over";
  if (ratio < 0.65) return "low";
  return "balanced";
}

const FLAG_COLOR: Record<NonNullable<BudgetFlag>, string> = {
  over:     "var(--danger)",
  balanced: "color-mix(in srgb, var(--success) 65%, var(--text2))",
  low:      "var(--warning)",
};

function CategoryRow({ cat, amount, initialAllocation, showSplit, scopePool, leftForScope, lastMonthSpent, lastMonthPlanned, index, onSetAlloc, onFreeze }: {
  cat: Category;
  amount: number;
  initialAllocation: number;
  showSplit?: boolean;
  scopePool: number;
  leftForScope: number;
  lastMonthSpent: number;
  lastMonthPlanned: number;
  index: number;
  onSetAlloc: (v: number) => void;
  onFreeze: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [freezing, setFreezing] = useState(false);
  const flag = getBudgetFlag(lastMonthSpent, lastMonthPlanned);

  const visualMax = Math.max(scopePool, amount);
  const actualMax = amount + Math.max(0, leftForScope);
  const rangeFill = visualMax > 0 ? Math.min(100, (amount / visualMax) * 100) : 0;

  const commitDraft = () => {
    if (draft !== null) {
      const parsed = parseInt(draft.replace(/\D/g, ""), 10);
      onSetAlloc(isNaN(parsed) ? 0 : parsed);
      setDraft(null);
    }
  };

  return (
    <div style={{
      ...catRowStyle,
      animation: `fadeUp 0.2s ${Math.min(index * 0.025, 0.15)}s ease both`,
      opacity: freezing ? 0.35 : 1,
      transition: "opacity 0.25s ease",
      pointerEvents: freezing ? "none" : "auto",
    }}>
      <div style={catRowTopStyle}>
        <div style={catIconWrapStyle}><CategoryIcon icon={cat.icon} size={15} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={catNameStyle} title={cat.name}>{cat.name}</div>
          <div style={{ fontSize: 11, marginTop: 3, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            {lastMonthSpent > 0 && (
              <span style={{ color: flag ? FLAG_COLOR[flag] : "var(--muted)" }}>
                {fmt(Math.round(lastMonthSpent))}
                {lastMonthPlanned > 0 && (
                  <span style={{ opacity: 0.6 }}> / {fmt(Math.round(lastMonthPlanned))}</span>
                )}
              </span>
            )}
            {lastMonthSpent > 0 && cat.available !== null && (
              <span style={{ color: "var(--muted)", opacity: 0.4 }}>·</span>
            )}
            {cat.available !== null && (() => {
              const delta = amount - initialAllocation;
              const projected = cat.available + delta;
              const hasChange = delta !== 0;
              return (
                <span style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  {hasChange ? (
                    <>
                      <span style={{ opacity: 0.5 }}>{fmt(Math.round(cat.available))}</span>
                      <span style={{ opacity: 0.35 }}>→</span>
                      <span style={{ color: delta > 0 ? "var(--accent)" : "var(--danger)", fontWeight: 700 }}>
                        {fmt(Math.round(projected))}
                      </span>
                      <span style={{ fontSize: 11, opacity: 0.55 }}>MAD</span>
                    </>
                  ) : (
                    <>{fmt(Math.round(cat.available))} <span style={{ fontSize: 11, opacity: 0.6 }}>MAD</span></>
                  )}
                </span>
              );
            })()}
          </div>
        </div>
        <input
          type="text"
          value={draft ?? (amount > 0 ? String(Math.round(amount)) : "")}
          placeholder="—"
          onFocus={() => setDraft(String(Math.round(amount)))}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={commitDraft}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraft(null); (e.target as HTMLInputElement).blur(); } }}
          style={{ ...amountInputStyle, marginTop: 1 }}
          aria-label={`Planned amount for ${cat.name}`}
        />
        <button type="button" onClick={async () => { setFreezing(true); await onFreeze(); }} disabled={freezing} aria-label={`Freeze ${cat.name}`} style={{ ...freezeBtnStyle, marginTop: 1 }} title="Skip this month">
          ❄
        </button>
      </div>

      <div style={{ position: "relative" }}>
        <input
          className="mprange"
          type="range"
          min={0}
          max={Math.max(1, visualMax)}
          step={1}
          value={amount}
          onChange={(e) => {
            const raw = Number(e.target.value);
            onSetAlloc(Math.min(raw, actualMax));
          }}
          aria-label={`Adjust planned amount for ${cat.name}`}
          style={{
            display: "block",
            width: "100%",
            "--range-fill": `${rangeFill.toFixed(1)}%`,
            "--bar-color": "var(--accent)",
          } as CSSProperties}
        />
      </div>

      {showSplit && amount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
          <span>👨 {fmt(Math.round(amount * JOINT_SPLIT.anas))}</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>👩 {fmt(Math.round(amount * JOINT_SPLIT.salma))}</span>
          <span style={{ fontSize: 11, opacity: 0.55 }}>MAD</span>
        </div>
      )}
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const sheetPanelStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--bg) 96%, var(--surface))",
  borderRadius: "24px 24px 0 0",
};

const sheetContentStyle: CSSProperties = {
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const sheetInnerStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: "22px 22px 8px",
  flexShrink: 0,
};

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
  marginBottom: 4,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 34,
  lineHeight: 0.95,
  fontWeight: 800,
  color: "var(--text)",
  margin: 0,
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

const leftHeroStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  padding: "12px 22px 24px",
  flexShrink: 0,
};

const leftHeroLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const afterLockBadgeStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.3,
  color: "var(--accent)",
  background: "color-mix(in srgb, var(--accent) 12%, transparent)",
  borderRadius: 6,
  padding: "2px 6px",
};

const leftHeroAmountStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 64,
  fontWeight: 800,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  transition: "color 0.2s ease",
};

const scopeBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "0 22px 18px",
  flexShrink: 0,
  flexWrap: "wrap",
};

const catListStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "4px 22px 16px",
  display: "grid",
  alignContent: "start",
  gap: 8,
};

/* Recap card */
const recapCardStyle: CSSProperties = {
  borderRadius: 14,
  background: "var(--surface)",
  padding: "12px 14px",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
};

const recapEyebrowStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "var(--muted)",
  margin: "0 0 10px",
};

/* Category rows */
const catRowStyle: CSSProperties = {
  borderRadius: 16,
  background: "var(--surface)",
  padding: "16px 18px 16px",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
  display: "grid",
  gap: 10,
};

const catRowTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
};

const catIconWrapStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 11,
  background: "color-mix(in srgb, var(--surface2) 55%, var(--surface))",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const catNameStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text2)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const amountInputStyle: CSSProperties = {
  width: 86,
  height: 36,
  borderRadius: 10,
  border: "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
  background: "var(--bg)",
  color: "var(--text2)",
  fontSize: 15,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
  padding: "0 10px",
  outline: "none",
  flexShrink: 0,
};

const freezeBtnStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "var(--muted)",
  fontSize: 15,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  opacity: 0.6,
};

const addCatButtonStyle: CSSProperties = {
  minHeight: 52,
  borderRadius: 14,
  border: "1.5px dashed color-mix(in srgb, var(--border) 50%, transparent)",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 16px",
  cursor: "pointer",
};

const frozenRowStyle: CSSProperties = {
  minHeight: 52,
  borderRadius: 12,
  border: "none",
  background: "var(--surface)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 14px",
  cursor: "pointer",
  width: "100%",
  boxShadow: "0 1px 0 color-mix(in srgb, var(--ink-strong) 4%, transparent)",
};

const emptyStyle: CSSProperties = {
  padding: "40px 0",
  textAlign: "center",
  fontSize: 13,
  color: "var(--muted)",
};

const footerStyle: CSSProperties = {
  padding: "16px 22px calc(env(safe-area-inset-bottom, 0px) + 20px)",
  flexShrink: 0,
  display: "grid",
  gap: 10,
  borderTop: "1px solid color-mix(in srgb, var(--border) 18%, transparent)",
};

const footerRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
};

const copyButtonStyle: CSSProperties = {
  flex: 1,
  height: 52,
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
  background: "transparent",
  color: "var(--text2)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const lockButtonStyle: CSSProperties = {
  flex: 1,
  height: 52,
  borderRadius: 14,
  border: "none",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontSize: 14,
  fontWeight: 800,
  boxShadow: "0 6px 18px color-mix(in srgb, var(--accent) 28%, transparent)",
};

const saveErrorStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  background: "color-mix(in srgb, var(--danger) 10%, transparent)",
  color: "var(--danger)",
  fontSize: 12,
  lineHeight: 1.4,
};
