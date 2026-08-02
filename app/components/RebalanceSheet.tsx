"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { BudgetScope, Category, MonthlySummary } from "./app-types";
import { fmt, today } from "./app-utils";
import { AllocationFlow, type AllocationGroup } from "./AllocationFlow";
import { CategoryIcon } from "./ui/CategoryIcon";
import { ScopeChipBar, type ScopeChipItem } from "./ui/ScopeChipBar";
import type { PlanningAllocationItem } from "./app-types";

type RebalanceSheetProps = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
  homeMonth: string;         // "YYYY-MM"
  monthlySummary: MonthlySummary;
  // Unassigned money that can be pulled in on top of what's already allocated —
  // only meaningful (and only ever non-zero) for the current month.
  readyToAssignByScope?: Record<BudgetScope, number>;
  jointUnassigned?: number;
  savingPool?: number;
};

type MonthContext = "past" | "current" | "future";
type GroupFilter = "all" | "joint" | "wife" | "husband" | "savings";
type Transfer = { fromId: string; toId: string; amount: number };
type TopUp = { id: string; amount: number };

function getMonthContext(homeMonth: string): MonthContext {
  const current = new Date().toISOString().slice(0, 7);
  if (homeMonth < current) return "past";
  if (homeMonth > current) return "future";
  return "current";
}

const MONTH_LABELS: Record<string, string> = {
  "01": "January", "02": "February", "03": "March", "04": "April",
  "05": "May", "06": "June", "07": "July", "08": "August",
  "09": "September", "10": "October", "11": "November", "12": "December",
};

function formatMonth(ym: string) {
  const [year, month] = ym.split("-");
  return `${MONTH_LABELS[month] ?? month} ${year}`;
}

const SAVINGS_HINTS = ["saving", "savings", "sinking", "goal", "fund"];

function isJointCategory(cat: Category): boolean {
  if (cat.isTeamFund) return true;
  return cat.type.some((t) => {
    const n = t.toLowerCase();
    return n.includes("team") || n.includes("household");
  });
}

function getCategoryGroup(cat: Category): Exclude<GroupFilter, "all"> {
  if (isJointCategory(cat)) return "joint";
  if (cat.type.some((t) => SAVINGS_HINTS.some((h) => t.toLowerCase().includes(h)))) return "savings";
  if (cat.owner?.toLowerCase().includes("salma")) return "wife";
  if (cat.owner?.toLowerCase().includes("anas")) return "husband";
  return "joint";
}

/**
 * Greedy pairing of sources (reduced) → destinations (increased), plus any
 * destination growth that isn't covered by a reduction elsewhere. That
 * leftover is money pulled in from the unallocated pool rather than moved
 * between categories, so it's reported separately as `topUps`.
 */
function computeTransfersAndTopUps(
  funded: { id: string; original: number }[],
  allocations: Record<string, number>,
): { transfers: Transfer[]; topUps: TopUp[] } {
  const sources: { id: string; rem: number }[] = [];
  const dests: { id: string; rem: number }[] = [];

  for (const { id, original } of funded) {
    const current = allocations[id] ?? original;
    const delta = current - original;
    if (delta < -0.5) sources.push({ id, rem: Math.round(-delta) });
    if (delta > 0.5) dests.push({ id, rem: Math.round(delta) });
  }

  const transfers: Transfer[] = [];
  let si = 0;
  let di = 0;
  while (si < sources.length && di < dests.length) {
    const take = Math.min(sources[si].rem, dests[di].rem);
    if (take >= 1) transfers.push({ fromId: sources[si].id, toId: dests[di].id, amount: take });
    sources[si].rem -= take;
    dests[di].rem -= take;
    if (sources[si].rem < 1) si++;
    if (dests[di].rem < 1) di++;
  }

  const topUps: TopUp[] = [];
  for (let k = di; k < dests.length; k++) {
    if (dests[k].rem >= 1) topUps.push({ id: dests[k].id, amount: Math.round(dests[k].rem) });
  }

  return { transfers, topUps };
}

// ── Scope chip metadata ────────────────────────────────────────────────────────

const CHIP_EMOJI: Record<string, string> = {
  all:     "✦",
  joint:   "👫",
  husband: "👨",
  wife:    "👩",
  savings: "💰",
};

// ── Main component ────────────────────────────────────────────────────────────

export function RebalanceSheet({
  open,
  onClose,
  categories,
  onSuccess,
  homeMonth,
  monthlySummary,
  readyToAssignByScope,
  jointUnassigned = 0,
  savingPool = 0,
}: RebalanceSheetProps) {
  const monthCtx = useMemo(() => getMonthContext(homeMonth), [homeMonth]);
  const isReadOnly = monthCtx !== "current";

  const plannedByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of monthlySummary.assignedByCategory ?? []) m.set(e.categoryId, e.total);
    return m;
  }, [monthlySummary]);

  const spentByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of monthlySummary.spentByCategory ?? []) m.set(e.categoryId, e.total);
    return m;
  }, [monthlySummary]);

  const getAvailable = (c: Category): number => {
    if (monthCtx === "current") return Math.round(c.available ?? 0);
    if (monthCtx === "past") {
      const planned = plannedByCategory.get(c.id) ?? 0;
      const spent = spentByCategory.get(c.id) ?? 0;
      return Math.max(0, Math.round(planned - spent));
    }
    return Math.max(0, Math.round(plannedByCategory.get(c.id) ?? c.planned ?? 0));
  };

  // All categories (for display in rebalance — unfrozen, non-archived)
  const allItems = useMemo(
    () =>
      categories
        .map((c) => ({ id: c.id, original: getAvailable(c) }))
        .sort((a, b) => b.original - a.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, monthCtx, plannedByCategory, spentByCategory],
  );

  // Only categories with available > 0 — used for pool/transfer source computation
  const funded = useMemo(
    () => allItems.filter((f) => f.original > 0),
    [allItems],
  );

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [groupFilter, setGroupFilter] = useState<GroupFilter>(() => {
    if (typeof window === "undefined") return "joint";
    const stored = localStorage.getItem("rebalance-last-group") as GroupFilter | null;
    return (stored && stored !== "all") ? stored : "joint";
  });

  const handleGroupFilterChange = (next: GroupFilter) => {
    setGroupFilter(next);
    if (typeof window !== "undefined") localStorage.setItem("rebalance-last-group", next);
  };

  useEffect(() => {
    if (!open) return;
    setAllocations(Object.fromEntries(allItems.map((f) => [f.id, f.original])));
    const stored = (typeof window !== "undefined" ? localStorage.getItem("rebalance-last-group") : null) as GroupFilter | null;
    setGroupFilter((stored && stored !== "all") ? stored : "joint");
  }, [open, allItems]);

  // ── Group filtering ──
  const groupCounts = useMemo(() => {
    const counts: Record<Exclude<GroupFilter, "all">, number> = { joint: 0, wife: 0, husband: 0, savings: 0 };
    for (const f of allItems) {
      const cat = catById.get(f.id);
      if (cat) counts[getCategoryGroup(cat)]++;
    }
    return counts;
  }, [allItems, catById]);

  const groupTabs = useMemo(
    () => [
      ...(groupCounts.joint > 0 ? [{ key: "joint", label: "Joint", count: groupCounts.joint }] : []),
      ...(groupCounts.wife > 0 ? [{ key: "wife", label: "Salma", count: groupCounts.wife }] : []),
      ...(groupCounts.husband > 0 ? [{ key: "husband", label: "Anas", count: groupCounts.husband }] : []),
      ...(groupCounts.savings > 0 ? [{ key: "savings", label: "Savings", count: groupCounts.savings }] : []),
    ],
    [groupCounts],
  );

  const visibleItems = useMemo(() => {
    if (groupFilter === "all") return allItems;
    return allItems.filter((f) => {
      const cat = catById.get(f.id);
      return cat && getCategoryGroup(cat) === groupFilter;
    });
  }, [allItems, catById, groupFilter]);

  // Pool = only the funded (available > 0) categories in the current view
  const visibleFunded = useMemo(() => {
    if (groupFilter === "all") return funded;
    return funded.filter((f) => {
      const cat = catById.get(f.id);
      return cat && getCategoryGroup(cat) === groupFilter;
    });
  }, [funded, catById, groupFilter]);

  // Sum ALL visible items (including over-budget negatives) so the pool matches
  // how "left to spend" is computed on the home screen for each scope.
  const alreadyAllocatedForGroup = useMemo(
    () => visibleItems.reduce((s, f) => s + f.original, 0),
    [visibleItems],
  );

  // Money that hasn't been assigned to any category yet — only pulled in for
  // the current month, since it reflects real-time account state.
  const unallocatedForGroup = useMemo(() => {
    if (isReadOnly) return 0;
    const jointVal = Math.max(0, jointUnassigned);
    const wifeVal = Math.max(0, readyToAssignByScope?.salma ?? 0);
    const husbandVal = Math.max(0, readyToAssignByScope?.anas ?? 0);
    const savingsVal = Math.max(0, savingPool);
    if (groupFilter === "all") return jointVal + wifeVal + husbandVal + savingsVal;
    if (groupFilter === "joint") return jointVal;
    if (groupFilter === "wife") return wifeVal;
    if (groupFilter === "husband") return husbandVal;
    if (groupFilter === "savings") return savingsVal;
    return 0;
  }, [isReadOnly, groupFilter, jointUnassigned, readyToAssignByScope, savingPool]);

  const poolForGroup = alreadyAllocatedForGroup + unallocatedForGroup;

  // ── Build AllocationFlow groups ──
  // `available = amount` keeps rangeMin = 0 so the user can reduce any category to zero.
  const groups = useMemo<AllocationGroup[]>(
    () => [
      {
        key: groupFilter,
        label: groupFilter === "all" ? "All" : groupFilter.charAt(0).toUpperCase() + groupFilter.slice(1),
        items: visibleItems.map((f): PlanningAllocationItem => {
          const cat = catById.get(f.id)!;
          const amount = allocations[f.id] ?? f.original;
          return {
            categoryId: f.id,
            name: cat.name,
            icon: cat.icon,
            amount,
            available: amount,      // keeps rangeMin = 0 always
            lastMonthSpent: f.original,  // shown as "Last month" → original budget
            defaultAccount: cat.defaultAccount,
          };
        }),
        onChange: (newItems) => {
          setAllocations((prev) => {
            const next = { ...prev };
            for (const item of newItems) next[item.categoryId] = item.amount;
            return next;
          });
        },
      },
    ],
    // `allocations` is included so slider amounts stay live.
    // The active-category reset effect in AllocationFlow uses `groupKeysSignal`
    // (not the `groups` reference), so it won't fire on every allocation change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupFilter, visibleItems, catById, allocations],
  );

  const { transfers: liveTransfers, topUps: liveTopUps } = useMemo(
    () => computeTransfersAndTopUps(allItems, allocations),
    [allItems, allocations],
  );

  type FlowRow = { key: string; fromLabel: string; fromIcon: string | null; toLabel: string; toIcon: string | null; amount: number };

  const flowRows = useMemo<FlowRow[]>(() => {
    const rows: FlowRow[] = [];
    for (const t of liveTransfers) {
      const from = catById.get(t.fromId);
      const to = catById.get(t.toId);
      if (!from || !to) continue;
      rows.push({ key: `t-${t.fromId}-${t.toId}`, fromLabel: from.name, fromIcon: from.icon, toLabel: to.name, toIcon: to.icon, amount: t.amount });
    }
    for (const tu of liveTopUps) {
      const to = catById.get(tu.id);
      if (!to) continue;
      rows.push({ key: `u-${tu.id}`, fromLabel: "Unallocated", fromIcon: null, toLabel: to.name, toIcon: to.icon, amount: tu.amount });
    }
    return rows;
  }, [liveTransfers, liveTopUps, catById]);

  const unallocatedHint = unallocatedForGroup > 0 ? (
    <div style={unallocatedHintStyle}>
      <span style={unallocatedHintDotStyle} />
      <span style={unallocatedHintTextStyle}>+{fmt(Math.round(unallocatedForGroup))} MAD unallocated — available to use here</span>
    </div>
  ) : null;

  const flowPreview = (!unallocatedHint && flowRows.length === 0) ? undefined : (
    <div style={flowWrapStyle}>
      {unallocatedHint}
      {flowRows.length > 0 && (
        <>
          <span style={flowHeadStyle}>Moving</span>
          <div style={flowListStyle}>
            {flowRows.slice(0, 5).map((row) => (
              <div key={row.key} style={flowRowStyle}>
                <div style={flowFromStyle}>
                  {row.fromIcon && <CategoryIcon icon={row.fromIcon} size={13} style={{ flexShrink: 0, opacity: 0.7 }} />}
                  <span style={flowNameStyle}>{row.fromLabel}</span>
                </div>
                <span style={flowArrowStyle}>→ {row.amount} MAD</span>
                <div style={flowToStyle}>
                  <span style={flowNameStyle}>{row.toLabel}</span>
                  {row.toIcon && <CategoryIcon icon={row.toIcon} size={13} style={{ flexShrink: 0, opacity: 0.7 }} />}
                </div>
              </div>
            ))}
            {flowRows.length > 5 && (
              <span style={flowMoreStyle}>+{flowRows.length - 5} more moves</span>
            )}
          </div>
        </>
      )}
    </div>
  );

  const scopeChips: ScopeChipItem[] = useMemo(
    () => groupTabs.map(tab => ({
      key: tab.key,
      emoji: CHIP_EMOJI[tab.key] ?? "•",
      label: tab.label,
    })),
    [groupTabs],
  );

  const chipsContent = scopeChips.length > 1 ? (
    <ScopeChipBar
      chips={scopeChips}
      value={groupFilter}
      onChange={k => handleGroupFilterChange(k as GroupFilter)}
      ariaLabel="Rebalance scope"
    />
  ) : undefined;

  const readOnlyBanner = isReadOnly ? (
    <div style={{
      ...contextBannerStyle,
      background: monthCtx === "past"
        ? "color-mix(in srgb, var(--surface2) 55%, var(--surface))"
        : "color-mix(in srgb, var(--info-dim) 60%, var(--surface))",
      borderColor: monthCtx === "past"
        ? "color-mix(in srgb, var(--border2) 35%, transparent)"
        : "color-mix(in srgb, var(--info) 22%, transparent)",
    }}>
      <span style={contextBannerDotStyle} />
      <span style={contextBannerTextStyle}>
        {monthCtx === "past"
          ? `${formatMonth(homeMonth)} is closed — showing final balances`
          : `Rebalancing opens when ${formatMonth(homeMonth)} begins`}
      </span>
    </div>
  ) : undefined;

  const poolLabel = monthCtx === "past" ? "Leftover" : monthCtx === "future" ? "Planned" : "Available pool";

  return (
    <AllocationFlow
      open={open}
      mode="screen"
      selectedMonth={homeMonth}
      onCancel={onClose}
      onComplete={onSuccess}
      groups={groups}
      poolOverride={poolForGroup}
      poolLabel={poolLabel}
      title="Rebalance"
      balancedLabel="Balanced"
      saveButtonLabel="Apply"
      readOnly={isReadOnly}
      readOnlyBanner={readOnlyBanner}
      flowPreview={flowPreview}
      chipsContent={chipsContent}
      heroPool
      metaLabel="Before"
      rebalanceMode
      onSave={async () => {
        if (liveTransfers.length === 0 && liveTopUps.length === 0) return;
        const date = today();
        await Promise.all([
          ...liveTransfers.map((t) =>
            fetch("/api/transfer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fromCategoryId: t.fromId,
                toCategoryId: t.toId,
                amount: t.amount,
                date,
                note: "Budget rebalance",
              }),
            }).then(async (r) => {
              if (!r.ok) {
                const d = await r.json();
                throw new Error(d.error ?? "Failed to create transfer");
              }
            }),
          ),
          // Top-ups pull from the unallocated pool rather than another category,
          // so they're funded directly (bump this month's Planned) instead of transferred.
          ...liveTopUps.map((tu) => {
            const cat = catById.get(tu.id);
            const nextPlanned = Math.max(0, (cat?.planned ?? 0) + tu.amount);
            return fetch("/api/monthly-planning/funds", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                month: homeMonth,
                categoryId: tu.id,
                planned: nextPlanned,
                accountId: cat?.defaultAccount ?? null,
              }),
            }).then(async (r) => {
              if (!r.ok) {
                const d = await r.json();
                throw new Error(d.error ?? "Failed to fund category");
              }
            });
          }),
        ]);
      }}
    />
  );
}

// ── Flow preview styles ───────────────────────────────────────────────────────

const flowWrapStyle: CSSProperties = {
  margin: "0 0 4px",
  padding: "10px 14px 12px",
  borderRadius: 14,
  background: "color-mix(in srgb, var(--surface2) 60%, var(--surface))",
  display: "grid",
  gap: 8,
};

const flowHeadStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: "var(--muted)",
};

const flowListStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const flowRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 8,
};

const flowFromStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 5,
  minWidth: 0,
};

const flowToStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 5,
  minWidth: 0,
};

const flowNameStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "var(--text2)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const flowArrowStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: "var(--muted)",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const flowMoreStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--muted)",
  textAlign: "center",
};

const unallocatedHintStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 12,
  background: "color-mix(in srgb, var(--accent) 12%, var(--surface))",
  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
};

const unallocatedHintDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "var(--accent)",
  flexShrink: 0,
};

const unallocatedHintTextStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text2)",
  letterSpacing: 0.1,
};


// ── Context banner styles ──────────────────────────────────────────────────────

const contextBannerStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "10px 14px", borderRadius: 12, border: "1px solid transparent",
};
const contextBannerDotStyle: CSSProperties = {
  width: 6, height: 6, borderRadius: "50%", background: "var(--muted)", flexShrink: 0,
};
const contextBannerTextStyle: CSSProperties = {
  fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)", letterSpacing: 0.2,
};
