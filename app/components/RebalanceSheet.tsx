"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import type { Category, MonthlySummary } from "./app-types";
import { today } from "./app-utils";
import { AllocationFlow, type AllocationGroup } from "./AllocationFlow";
import { CategoryIcon } from "./ui/CategoryIcon";
import type { PlanningAllocationItem } from "./app-types";

type RebalanceSheetProps = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
  homeMonth: string;         // "YYYY-MM"
  monthlySummary: MonthlySummary;
};

type MonthContext = "past" | "current" | "future";
type GroupFilter = "all" | "joint" | "wife" | "husband" | "savings";
type Transfer = { fromId: string; toId: string; amount: number };

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

/** Greedy pairing of sources (reduced) → destinations (increased). */
function computeTransfers(
  funded: { id: string; original: number }[],
  allocations: Record<string, number>,
): Transfer[] {
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
  return transfers;
}

// ── GroupFilterPicker ─────────────────────────────────────────────────────────

function GroupFilterPicker({
  groupTabs,
  groupFilter,
  onSelect,
}: {
  groupTabs: Array<{ key: string; label: string; count: number }>;
  groupFilter: GroupFilter;
  onSelect: (key: GroupFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const active = groupTabs.find((t) => t.key === groupFilter) ?? groupTabs[0];

  useEffect(() => { setMounted(true); }, []);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menu = (
    <div
      ref={menuRef}
      role="listbox"
      aria-label="Filter by group"
      className="view-picker__menu"
      style={{ ...gfMenuStyle, position: "fixed", top: menuPos.top, right: menuPos.right, left: "auto" }}
    >
      {groupTabs.map((tab) => {
        const isActive = tab.key === groupFilter;
        return (
          <button
            key={tab.key}
            type="button"
            role="option"
            aria-selected={isActive}
            className={`view-picker__option${isActive ? " view-picker__option--active" : ""}`}
            onClick={() => { onSelect(tab.key as GroupFilter); setOpen(false); }}
            style={{ ...gfOptionStyle, ...(isActive ? gfOptionActiveStyle : null) }}
          >
            <span style={{ ...gfDotStyle, background: gfDotColor(tab.key) }} />
            <span style={gfOptionTextStyle}>{tab.label}</span>
            <span style={gfCountStyle}>{tab.count}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="view-picker" style={gfWrapStyle}>
      <button
        ref={triggerRef}
        type="button"
        className="view-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by group"
        onClick={handleToggle}
        style={gfTriggerStyle}
      >
        <span style={gfLabelStyle}>{active?.label ?? "All"}</span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          style={{ ...gfChevronStyle, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {mounted && open && createPortal(menu, document.body)}
    </div>
  );
}

const gfDotColor = (key: string): string => {
  if (key === "wife") return "var(--partner-wife-strong)";
  if (key === "husband") return "var(--partner-husband-strong)";
  if (key === "savings") return "var(--warning)";
  return "var(--text2)";
};

// ── Main component ────────────────────────────────────────────────────────────

export function RebalanceSheet({ open, onClose, categories, onSuccess, homeMonth, monthlySummary }: RebalanceSheetProps) {
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
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");

  useEffect(() => {
    if (!open) return;
    setAllocations(Object.fromEntries(allItems.map((f) => [f.id, f.original])));
    setGroupFilter("all");
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
      { key: "all", label: "All", count: allItems.length },
      ...(groupCounts.joint > 0 ? [{ key: "joint", label: "Joint", count: groupCounts.joint }] : []),
      ...(groupCounts.wife > 0 ? [{ key: "wife", label: "Salma", count: groupCounts.wife }] : []),
      ...(groupCounts.husband > 0 ? [{ key: "husband", label: "Anas", count: groupCounts.husband }] : []),
      ...(groupCounts.savings > 0 ? [{ key: "savings", label: "Savings", count: groupCounts.savings }] : []),
    ],
    [allItems.length, groupCounts],
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

  const poolForGroup = useMemo(
    () => visibleFunded.reduce((s, f) => s + f.original, 0),
    [visibleFunded],
  );

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

  const liveTransfers = useMemo(
    () => computeTransfers(allItems, allocations),
    [allItems, allocations],
  );

  const flowPreview = liveTransfers.length === 0 ? undefined : (
    <div style={flowWrapStyle}>
      <span style={flowHeadStyle}>Moving</span>
      <div style={flowListStyle}>
        {liveTransfers.slice(0, 5).map((t, i) => {
          const from = catById.get(t.fromId);
          const to   = catById.get(t.toId);
          if (!from || !to) return null;
          return (
            <div key={i} style={flowRowStyle}>
              <div style={flowFromStyle}>
                <CategoryIcon icon={from.icon} size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
                <span style={flowNameStyle}>{from.name}</span>
              </div>
              <span style={flowArrowStyle}>→ {t.amount} MAD</span>
              <div style={flowToStyle}>
                <span style={flowNameStyle}>{to.name}</span>
                <CategoryIcon icon={to.icon} size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
              </div>
            </div>
          );
        })}
        {liveTransfers.length > 5 && (
          <span style={flowMoreStyle}>+{liveTransfers.length - 5} more moves</span>
        )}
      </div>
    </div>
  );

  const headerControls = groupTabs.length > 2 ? (
    <GroupFilterPicker groupTabs={groupTabs} groupFilter={groupFilter} onSelect={setGroupFilter} />
  ) : undefined;

  const readOnlyBanner = isReadOnly ? (
    <div style={{
      ...contextBannerStyle,
      background: monthCtx === "past"
        ? "color-mix(in srgb, var(--surface2) 55%, white)"
        : "color-mix(in srgb, var(--info-dim) 60%, white)",
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
      requireBalanced
      readOnly={isReadOnly}
      readOnlyBanner={readOnlyBanner}
      flowPreview={flowPreview}
      headerControls={headerControls}
      onSave={async () => {
        const transfers = computeTransfers(allItems, allocations);
        await Promise.all(
          transfers.map((t) =>
            fetch("/api/transfer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fromCategoryId: t.fromId,
                toCategoryId: t.toId,
                amount: t.amount,
                date: today(),
                note: "Budget rebalance",
              }),
            }).then(async (r) => {
              if (!r.ok) {
                const d = await r.json();
                throw new Error(d.error ?? "Transfer failed");
              }
            }),
          ),
        );
      }}
    />
  );
}

// ── GroupFilterPicker styles ───────────────────────────────────────────────────

const gfWrapStyle: CSSProperties = {
  position: "relative", display: "inline-flex", alignItems: "center",
  flexShrink: 0, overflow: "visible", justifySelf: "end",
};
const gfTriggerStyle: CSSProperties = {
  minHeight: 28, padding: 0, border: "none", background: "transparent",
  color: "var(--text2)", fontSize: 13, fontWeight: 600, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 4,
};
const gfLabelStyle: CSSProperties = { fontSize: 13, fontWeight: 600 };
const gfChevronStyle: CSSProperties = { pointerEvents: "none", color: "var(--muted)", transition: "transform 0.16s ease" };
const gfMenuStyle: CSSProperties = {
  width: 192, padding: 6, borderRadius: 16,
  border: "1px solid color-mix(in srgb, var(--border2) 60%, transparent)",
  background: "var(--surface)",
  boxShadow: "0 18px 36px color-mix(in srgb, var(--ink-strong) 14%, transparent), inset 0 1px 0 color-mix(in srgb, white 55%, transparent)",
  zIndex: 90, display: "grid", gap: 3,
};
const gfOptionStyle: CSSProperties = {
  minHeight: 44, width: "100%", border: "none", borderRadius: 12,
  background: "transparent", color: "var(--text2)", cursor: "pointer",
  display: "grid", gridTemplateColumns: "8px 1fr auto",
  alignItems: "center", gap: 9, padding: "0 10px", textAlign: "left",
};
const gfOptionActiveStyle: CSSProperties = { background: "color-mix(in srgb, var(--surface2) 70%, white)" };
const gfDotStyle: CSSProperties = { width: 7, height: 7, borderRadius: 999 };
const gfOptionTextStyle: CSSProperties = { fontSize: 13, fontWeight: 700 };
const gfCountStyle: CSSProperties = { fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)" };

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
