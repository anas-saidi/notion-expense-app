"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Account, BudgetScope, Category, MonthlySummary } from "./app-types";
import { BUDGET_SCOPE_LABELS, fmt, getCategoryScope, today } from "./app-utils";
import { AllocationFlow, type AllocationGroup } from "./AllocationFlow";
import { CategoryIcon } from "./ui/CategoryIcon";
import { Banner } from "./ui/Banner";
import type { PlanningAllocationItem } from "./app-types";

type RebalanceSheetProps = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  accounts: Account[];
  onSuccess: () => void;
  homeMonth: string;         // "YYYY-MM"
  monthlySummary: MonthlySummary;
  budgetScope: BudgetScope;
  // Unassigned money that can be pulled in on top of what's already allocated —
  // only meaningful (and only ever non-zero) for the current month.
  readyToAssignByScope?: Record<BudgetScope, number>;
  jointUnassigned?: number;
};

type MonthContext = "past" | "current" | "future";
type Transfer = { fromId: string; toId: string; amount: number };
type TopUp = { id: string; amount: number };
type Release = { id: string; amount: number };

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

/**
 * Greedy pairing of sources (reduced) → destinations (increased), plus any
 * destination growth that isn't covered by a reduction elsewhere. That
 * leftover is money pulled in from the unallocated pool rather than moved
 * between categories, so it's reported separately as `topUps`.
 */
export function computeRebalanceOperations(
  funded: { id: string; original: number }[],
  allocations: Record<string, number>,
): { transfers: Transfer[]; topUps: TopUp[]; releases: Release[] } {
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

  const releases: Release[] = [];
  for (let k = si; k < sources.length; k++) {
    if (sources[k].rem >= 1) releases.push({ id: sources[k].id, amount: Math.round(sources[k].rem) });
  }

  return { transfers, topUps, releases };
}

// ── Main component ────────────────────────────────────────────────────────────

export function RebalanceSheet({
  open,
  onClose,
  categories,
  accounts,
  onSuccess,
  homeMonth,
  monthlySummary,
  budgetScope,
  readyToAssignByScope,
  jointUnassigned = 0,
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

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [allocations, setAllocations] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    setAllocations(Object.fromEntries(allItems.map((f) => [f.id, f.original])));
  }, [open, allItems]);

  const visibleItems = useMemo(() => {
    return allItems.filter((f) => {
      const cat = catById.get(f.id);
      return cat && getCategoryScope(cat, accounts) === budgetScope;
    });
  }, [allItems, catById, accounts, budgetScope]);

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
    if (budgetScope === "joint") return Math.max(0, jointUnassigned);
    return Math.max(0, readyToAssignByScope?.[budgetScope] ?? 0);
  }, [isReadOnly, budgetScope, jointUnassigned, readyToAssignByScope]);

  const poolForGroup = alreadyAllocatedForGroup + unallocatedForGroup;

  // ── Build AllocationFlow groups ──
  // `available = amount` keeps rangeMin = 0 so the user can reduce any category to zero.
  const groups = useMemo<AllocationGroup[]>(
    () => [
      {
        key: budgetScope,
        label: BUDGET_SCOPE_LABELS[budgetScope],
        items: visibleItems.map((f): PlanningAllocationItem => {
          const cat = catById.get(f.id)!;
          const amount = allocations[f.id] ?? f.original;
          return {
            categoryId: f.id,
            name: cat.name,
            icon: cat.icon,
            amount,
            spent: spentByCategory.get(f.id) ?? 0,
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
    [budgetScope, visibleItems, catById, allocations],
  );

  const { transfers: liveTransfers, topUps: liveTopUps, releases: liveReleases } = useMemo(
    () => computeRebalanceOperations(allItems, allocations),
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
    for (const release of liveReleases) {
      const from = catById.get(release.id);
      if (!from) continue;
      rows.push({ key: `r-${release.id}`, fromLabel: from.name, fromIcon: from.icon, toLabel: "Unallocated", toIcon: null, amount: release.amount });
    }
    return rows;
  }, [liveTransfers, liveTopUps, liveReleases, catById]);

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

  const readOnlyBanner = isReadOnly ? (
    <Banner tone={monthCtx === "past" ? "neutral" : "info"} compact>
      {monthCtx === "past"
        ? `${formatMonth(homeMonth)} is closed — showing final balances`
        : `Rebalancing opens when ${formatMonth(homeMonth)} begins`}
    </Banner>
  ) : undefined;

  const poolLabel = monthCtx === "past" ? "Leftover" : monthCtx === "future" ? "Planned" : "Available";

  return (
    <AllocationFlow
      open={open}
      mode="sheet"
      selectedMonth={homeMonth}
      onCancel={onClose}
      onComplete={onSuccess}
      groups={groups}
      poolOverride={poolForGroup}
      poolLabel={poolLabel}
      title="Rebalance"
      headerControls={<span style={scopeContextStyle}>{BUDGET_SCOPE_LABELS[budgetScope]}</span>}
      balancedLabel="Balanced"
      saveButtonLabel="Apply"
      readOnly={isReadOnly}
      readOnlyBanner={readOnlyBanner}
      flowPreview={flowPreview}
      heroPool
      metaLabel="Before"
      rebalanceMode
      onSave={async () => {
        if (liveTransfers.length === 0 && liveTopUps.length === 0 && liveReleases.length === 0) return;
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
            const nextPlanned = Math.max(0, (plannedByCategory.get(tu.id) ?? cat?.planned ?? 0) + tu.amount);
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
          // A reduction with no destination releases money back to the
          // unallocated pool by lowering this month's planned funding.
          ...liveReleases.map((release) => {
            const cat = catById.get(release.id);
            const nextPlanned = Math.max(0, (plannedByCategory.get(release.id) ?? cat?.planned ?? 0) - release.amount);
            return fetch("/api/monthly-planning/funds", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                month: homeMonth,
                categoryId: release.id,
                planned: nextPlanned,
                accountId: cat?.defaultAccount ?? null,
                mode: "set",
              }),
            }).then(async (r) => {
              if (!r.ok) {
                const d = await r.json();
                throw new Error(d.error ?? "Failed to release category funds");
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
  fontSize: 12,
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
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text2)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const flowArrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--muted)",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const flowMoreStyle: CSSProperties = {
  fontSize: 12,
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
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text2)",
  letterSpacing: 0.1,
};


const scopeContextStyle: CSSProperties = {
  minHeight: 32,
  padding: "0 11px",
  borderRadius: "var(--radius-control)",
  background: "var(--surface2)",
  color: "var(--text2)",
  display: "inline-flex",
  alignItems: "center",
  fontSize: 12,
  fontWeight: 700,
};
